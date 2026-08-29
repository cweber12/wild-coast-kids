import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { localMidnightOf } from "@/lib/pacific-time";

const readWeekOfLowestLows = vi.fn();
const readHourlyTide = vi.fn();
const readDaylightWeek = vi.fn();
const readWaveWeek = vi.fn();
const readSkyWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({
  readWeekOfLowestLows,
  readHourlyTide,
  readDaylightWeek,
  readWaveWeek,
  readSkyWeek,
}));

const { WeekPanel } = await import("./WeekPanel");

const BINDING = {
  beachName: "La Jolla Shores Beach",
  station: {
    name: "La Jolla (Scripps Institution Wharf)",
    water: "open-coast",
    distanceM: 1369,
  },
};

const DATES = [
  { localDate: "2026-08-17", dayLabel: "Mon, Aug 17", isToday: true },
  { localDate: "2026-08-18", dayLabel: "Tue, Aug 18", isToday: false },
] as const;

function tideDay(index: number, timeLabel: string, feet: number) {
  return {
    ...DATES[index],
    state: {
      kind: "reading",
      daylight: { timeLabel, feet },
      allDay: { timeLabel: "3:14 AM", feet: -1.1 },
    },
  };
}

/**
 * The row labels inside the day blocks, which is not the same set as every
 * occurrence of a label's words: `WeekGrid` also prints a row's name on its
 * provenance line beneath the grid, so a bare text query counts one row twice.
 */
function cellLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll("dt")].map(
    (node) => node.textContent ?? "",
  );
}

const countOf = (labels: string[], label: string) =>
  labels.filter((each) => each === label).length;

/** The cell binding, carried through a failure the way the tide's station is. */
const CELL = { id: "SGX/54,21", elevationM: 0 };

function skyWeek(
  days: {
    index: number;
    /** The day's three thirds. A single number fills all three, for the cases
     *  that are not about the shape of the day. */
    cloud:
      number | { am: number | null; mid: number | null; eve: number | null };
    phenomenon?: { weather: string; coverage: string | null };
  }[],
  cell = CELL,
) {
  return {
    beachName: BINDING.beachName,
    cell,
    state: {
      kind: "week",
      days: days.map(({ index, cloud, phenomenon = null }) => ({
        ...DATES[index],
        thirds:
          typeof cloud === "number"
            ? { am: cloud, mid: cloud, eve: cloud }
            : cloud,
        // The whole day's hours. Nothing in this grid draws them any more --
        // the wash came off the shape after review -- but `readSkyWeek` still
        // returns them, and the day chart is what will want them. A flat 40%,
        // because no test here is about what the sky is doing.
        hours: Array.from({ length: 24 }, (_, hour) => ({
          atMs: localMidnightOf(DATES[index].localDate) + hour * HOUR_MS,
          percent: 40,
        })),
        phenomenon,
      })),
    },
  };
}

/** The MOP binding, carried through a failure the way the tide's station is. */
const LINE = { id: "D0498", distanceM: 325 };

function waveWeek(
  days: {
    index: number;
    timeLabel?: string;
    heightFt: number;
    periodS: number;
  }[],
) {
  return {
    beachName: BINDING.beachName,
    line: LINE,
    state: {
      kind: "week",
      days: days.map(({ index, timeLabel = "2:00 PM", heightFt, periodS }) => ({
        ...DATES[index],
        daylight: { timeLabel, heightFt, periodS },
        allDay: { timeLabel: "2:00 AM", heightFt: 9.9, periodS: 5 },
      })),
    },
  };
}

/**
 * Every day's daylight window, found by the name only a screen reader hears.
 *
 * Daylight is the day's header rather than a `<dt>` label now, so counting
 * `cellLabels` no longer finds it. The `aria-label` is the thing under test
 * anyway: the visible line is two clock times and the word is what a reader
 * who cannot see the sun mark is given.
 */
function daylightWindows() {
  return screen.getAllByLabelText(/^Daylight, /);
}

/** Daylight always answers, which is what the panel leans on for its columns. */
function daylightWeek() {
  return {
    beachName: BINDING.beachName,
    days: DATES.map((date, index) => ({
      ...date,
      sunriseLabel: index === 0 ? "6:14 AM" : "6:15 AM",
      sunsetLabel: index === 0 ? "7:32 PM" : "7:31 PM",
      // The unrounded instants the night band is drawn from, alongside the
      // labels the header prints. Roughly 6:14 AM and 7:32 PM Pacific.
      sunriseMs: localMidnightOf(date.localDate) + 6 * HOUR_MS + 14 * 60_000,
      sunsetMs: localMidnightOf(date.localDate) + 19 * HOUR_MS + 32 * 60_000,
    })),
  };
}

const HOUR_MS = 3_600_000;

/**
 * A week of hourly heights, one full day per named index.
 *
 * The values rise and fall across the day rather than being flat, so a shape
 * drawn from them has somewhere to go -- a constant series would draw a
 * straight line and pass a test that a broken y axis would also pass.
 */
function hourlyTide(indexes: readonly number[]) {
  return {
    ...BINDING,
    state: {
      kind: "week",
      days: DATES.map((date, index) => ({
        ...date,
        startMs: localMidnightOf(date.localDate),
        endMs: localMidnightOf(DATES[index + 1]?.localDate ?? "2026-08-19"),
        hours: indexes.includes(index)
          ? Array.from({ length: 24 }, (_, hour) => ({
              atMs: localMidnightOf(date.localDate) + hour * HOUR_MS,
              feet: 2.5 + 2 * Math.sin((hour / 24) * 2 * Math.PI),
            }))
          : [],
      })),
    },
  };
}

/** Every day's drawn shape, found by the name only a screen reader hears. */
function sparks() {
  return screen.queryAllByLabelText(/^Tide through /);
}

/**
 * The curves, scoped to the shapes.
 *
 * A bare `svg path` would also collect `DaylightWeek`'s sun mark, which is an
 * SVG in every day header -- so a grid with no shapes at all still has two
 * paths in it, and a test counting them would pass while asserting nothing.
 */
function sparkPaths(container: HTMLElement): Element[] {
  return [
    ...container.querySelectorAll('svg[aria-label^="Tide through"] path'),
  ];
}

beforeEach(() => {
  readWeekOfLowestLows.mockReset();
  readHourlyTide.mockReset();
  readHourlyTide.mockResolvedValue(hourlyTide([0, 1]));
  readDaylightWeek.mockReset();
  readWaveWeek.mockReset();
  readSkyWeek.mockReset();
  readSkyWeek.mockResolvedValue(
    skyWeek([
      { index: 0, cloud: 44 },
      {
        index: 1,
        cloud: 67,
        phenomenon: { weather: "fog", coverage: "patchy" },
      },
    ]),
  );
  readDaylightWeek.mockReturnValue(daylightWeek());
  readWaveWeek.mockResolvedValue(
    waveWeek([
      { index: 0, timeLabel: "2:00 PM", heightFt: 2.62, periodS: 13.333333 },
      { index: 1, timeLabel: "8:00 AM", heightFt: 3.41, periodS: 16.666668 },
    ]),
  );
});

test("asks for the slug it was given and renders both live rows", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "week",
      days: [tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)],
    },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(readWeekOfLowestLows).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(readDaylightWeek).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("7:10 AM")).toBeDefined();
  expect(screen.getByText("-0.4 ft")).toBeDefined();
  expect(daylightWindows()[0].getAttribute("aria-label")).toBe(
    "Daylight, 6:14 AM to 7:32 PM",
  );
  // Each row's own label, which is what stops a glyph carrying the meaning.
  expect(countOf(cellLabels(container), "Low tide")).toBe(2);
  expect(daylightWindows()).toHaveLength(2);
});

test("the forecasts that are not built yet are named, and waves are no longer among them", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  // The wave slot came out in the same change that filled its row: a slot left
  // in beside a live row promises the same product twice.
  expect(screen.queryByText(/A wave forecast is coming/i)).toBeNull();
  // The gridded slot went the same way in the change that filled its row.
  expect(screen.queryByText(/A gridded forecast is coming/i)).toBeNull();
  expect(screen.getByText(/surf zone forecast/i)).toBeDefined();
});

/**
 * The row that replaced the promise. Until 2026-08-27 this slot said a gridded
 * forecast was coming and, briefly, over-promised temperature and wind with it.
 * A slot and the row it stood in for must never both be on the page: that is
 * the same rule the wave slot came out under, and it is why the removal is in
 * the change that fills the row rather than a tidy-up after it.
 */
test("the gridded row is live, and the slot that promised it is gone", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(readSkyWeek).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getAllByText("Cloud cover").length).toBeGreaterThan(0);
  // Three figures, not one: the fixture gives this day 44% in all three
  // thirds, so the row rendering the day's shape prints it three times.
  expect(screen.getAllByText("44%")).toHaveLength(3);
  expect(screen.queryByText(/A gridded forecast is coming/i)).toBeNull();
  expect(
    screen.queryByText(/grid cell, instead of the nearest airport/i),
  ).toBeNull();
});

/**
 * These two notes carry more weight than the wave row's equivalents. After
 * ADR-0020 this row is the only sky anywhere on the site, so a reader who came
 * to find out whether it will be foggy is told nothing at all -- and a row that
 * simply vanished would read as a clear week rather than as a missing forecast.
 */
test("a beach with no forecast cell says so, rather than dropping the row silently", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readSkyWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: null,
    state: { kind: "no-cell", reason: "the grid does not cover this beach" },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText(/no cloud forecast for this beach/i)).toBeDefined();
  expect(screen.queryByText("Cloud cover")).toBeNull();
});

test("an outage at the National Weather Service says so, and names the reason", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readSkyWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "unavailable",
      detail:
        "The National Weather Service returned HTTP 503 for forecast cell SGX/54,21.",
      drift: false,
    },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(
    screen.getByText(/could not get this week's cloud forecast/i),
  ).toBeDefined();
  expect(screen.getByText(/HTTP 503/)).toBeDefined();
  // Not drift, so the sentence blaming this repo must not appear.
  expect(screen.queryByText(/bug here rather than a problem/)).toBeNull();
});

test("drift says the bug is here, not at the National Weather Service", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readSkyWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: {
      kind: "unavailable",
      detail: 'SGX/54,21: skyCover is declared in "wmoUnit:one".',
      drift: true,
    },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(
    screen.getByText(
      /bug here rather than a problem at the National Weather Service/,
    ),
  ).toBeDefined();
});

test("a bluff cell says the square covers the cliff as well as the shore", async () => {
  // Torrey Pines City Beach reads a cell averaging 117 m. ADR-0020 serves it
  // and discloses rather than withholding, and this sentence is the half of
  // that decision no gate can assert -- so a gate asserts it reaches the page.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readSkyWeek.mockResolvedValue(
    skyWeek([{ index: 0, cloud: 44 }], {
      id: "SGX/55,22",
      elevationM: 117.0432,
    }),
  );

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText(/covers the bluff above this beach/)).toBeDefined();
});

test("a shoreline cell adds no bluff sentence", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.queryByText(/covers the bluff/)).toBeNull();
  // The clause that always stands, which is what separates this row from the
  // readings on the cards above.
  expect(
    screen.getByText(/a forecast, not a reading taken at the beach/),
  ).toBeDefined();
});

test("a NOAA outage costs the tide row, not the whole grid", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "unavailable",
      detail: "NOAA returned HTTP 503 for station 9410230.",
      drift: false,
    },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText(/could not get this week/i)).toBeDefined();
  // The upstream reason, printed rather than pointed at. This note used to say
  // "the card above says what went wrong", which was true while the tide card
  // shared this request and stood above the grid. That card is gone, so a note
  // that still delegated would leave the only account of the outage nowhere on
  // the page -- the hour-by-hour tab below is a different request and can be
  // perfectly healthy while this one is not.
  expect(
    screen.getByText(/NOAA returned HTTP 503 for station 9410230/),
  ).toBeDefined();
  expect(screen.queryByText(/the card above/)).toBeNull();
  // The reason the columns come from the daylight read: it is computed here and
  // cannot fail, so the week still stands and still answers a question.
  expect(screen.getByText("Tue, Aug 18")).toBeDefined();
  expect(daylightWindows()).toHaveLength(2);
  expect(screen.queryByText("Low tide")).toBeNull();
});

test("a beach with no station keeps its daylight, and does not read as an outage", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    beachName: "Nothing Is Bound Here",
    station: null,
    state: { kind: "no-station", reason: "no station could be joined to it" },
  });

  render(await WeekPanel({ slug: "nothing-is-bound-here" }));

  expect(screen.getByText(/no tide station/i)).toBeDefined();
  expect(screen.queryByText(/try again/i)).toBeNull();
  // A permanent fact about the place takes the tide row and nothing else: the
  // sun still rises there.
  expect(daylightWindows()).toHaveLength(2);
});

test("a failure to resolve the beach is not swallowed into a rendered nothing", async () => {
  readWeekOfLowestLows.mockRejectedValue(
    new Error("no beach in the inventory"),
  );

  await expect(WeekPanel({ slug: "no-such-beach" })).rejects.toThrow(
    /no beach in the inventory/,
  );
});

/**
 * ADR-0015 marked the gridded slot with the air card's glyph while it was a
 * promise about that card. The slot is gone, so the glyph question goes with
 * it: rows in this grid carry no glyph at all -- a full-colour emoji at 10px is
 * a smudge rather than a mark -- and the only glyph left in this band belongs
 * to the one slot still reserved.
 *
 * The day headers now carry a decorative sun, which is why this counts *text*
 * rather than every `aria-hidden` node. That mark is a stroked SVG on
 * `currentColor` and contributes no characters, so it cannot be the smudge the
 * rule is about; the assertion below is that it stays that way.
 */
test("the filled row brings no glyph, and only the reserved slot still has one", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    station: { name: "La Jolla (Scripps Institution Wharf)", distanceM: 1369 },
    state: { kind: "reading", days: [] },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  const glyphs = [...container.querySelectorAll('[aria-hidden="true"]')]
    .map((node) => node.textContent)
    .filter((text) => text !== "");
  expect(glyphs).toEqual(["🏖️"]);

  // The header's mark draws rather than spells, so a day block contributes no
  // glyph text of its own.
  const day = container.querySelector("ol > li");
  expect(day?.querySelector("svg")?.getAttribute("stroke")).toBe(
    "currentColor",
  );
});

/* =========================================================================
 * The wave forecast row
 * ========================================================================= */

test("the wave row renders a height and a period for each day it reaches", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(readWaveWeek).toHaveBeenCalledWith("la-jolla-shores-beach");
  // The time leads, the way every other row of this grid does.
  expect(screen.getByText("2:00 PM")).toBeDefined();
  expect(screen.getByText("8:00 AM")).toBeDefined();
  // Whole seconds. CDIP publishes 13.333333 because it is the reciprocal of a
  // spectral frequency bin, and the buoy card beside this prints whole seconds.
  expect(screen.getByText(/2\.6 ft · 13 s/)).toBeDefined();
  expect(screen.getByText(/3\.4 ft · 17 s/)).toBeDefined();
});

test("the row's label names the statistic, so the maximum is not hidden", async () => {
  // A day has fifty-six estimates behind it and the cell shows one of them.
  // The same contract "Lowest tide" makes.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(countOf(cellLabels(container), "Biggest swell")).toBe(2);
});

test("the wave row is attributed once, beneath the grid, not seven times", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  // A feed's identity is one fact about a feed. Two days, one line.
  const attributions = screen.getAllByText(/MOP line D0498/);
  expect(attributions).toHaveLength(1);
  expect(attributions[0].textContent).toContain(
    "CDIP, Scripps Institution of Oceanography",
  );
  // The distance is what lets a reader see the model's point is nearer than
  // the buoy the day panel below reads. A decimal, every line being under a km.
  expect(attributions[0].textContent).toContain("about 0.3 km from this beach");
  expect(attributions[0].textContent).toContain(
    "a model of the swell at 10 m depth, not a measurement",
  );
  // Labelled, because the grid may carry more than one of these.
  expect(attributions[0].textContent).toContain("Biggest swell");
});

test("the row goes ragged where the forecast stops, rather than blank", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readWaveWeek.mockResolvedValue(
    waveWeek([{ index: 0, heightFt: 2.62, periodS: 13.333333 }]),
  );

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  // One cell, one label. A label over a gap would read as an instrument that
  // failed rather than as a forecast that does not reach that far.
  expect(countOf(cellLabels(container), "Biggest swell")).toBe(1);
  expect(daylightWindows()).toHaveLength(2);
});

test("a beach with no MOP line says so, and keeps the rest of the grid", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readWaveWeek.mockResolvedValue({
    beachName: "Mission Bay",
    line: null,
    state: {
      kind: "no-line",
      reason:
        "every MOP line sits at 10 m depth on the open coast, and ocean swell does not " +
        "reach into a bay or lagoon",
    },
  });

  render(await WeekPanel({ slug: "mission-bay" }));

  expect(screen.getByText(/no wave forecast for this beach/i)).toBeDefined();
  expect(screen.queryByText("Biggest swell")).toBeNull();
  expect(screen.queryByText(/MOP line/)).toBeNull();
  expect(daylightWindows()).toHaveLength(2);
});

test("a CDIP outage costs the wave row and nothing else", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "week",
      days: [tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)],
    },
  });
  readWaveWeek.mockResolvedValue({
    ...BINDING,
    line: LINE,
    state: {
      kind: "unavailable",
      detail: "CDIP returned HTTP 503 for MOP line D0498.",
      drift: false,
    },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  // Said in full here rather than pointed at a card, because CDIP is read here
  // and nowhere else on the page.
  expect(screen.getByText(/HTTP 503 for MOP line D0498/)).toBeDefined();
  expect(screen.queryByText("Biggest swell")).toBeNull();
  expect(countOf(cellLabels(container), "Low tide")).toBe(2);
  expect(daylightWindows()).toHaveLength(2);
});

test("a drifted CDIP payload says the bug is here, not at the model", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readWaveWeek.mockResolvedValue({
    ...BINDING,
    line: LINE,
    state: {
      kind: "unavailable",
      detail: 'CDIP D0498: waveHs is published in "feet", not "meter".',
      drift: true,
    },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(
    screen.getByText(/a bug here rather than a problem with the model/i),
  ).toBeDefined();
});

test("NOAA going quiet does not take the wave row with it", async () => {
  // Two publishers, two outages, and neither may take the other's row. The
  // reads are made concurrently for the same reason.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "unavailable",
      detail: "NOAA returned HTTP 503 for station 9410230.",
      drift: false,
    },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(screen.queryByText("Low tide")).toBeNull();
  expect(countOf(cellLabels(container), "Biggest swell")).toBe(2);
});

test("the rows run tide, swell, cloud, inside the window the header states", async () => {
  // Daylight is no longer among them. It was between the tide and the swell so
  // that a reader could tell a 2:23 AM low from a 2:23 PM one; the header does
  // that for all three rows at once now, which is what lets these labels drop
  // the word.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  const labels = [...container.querySelectorAll("li:first-child dt")].map(
    (node) => node.textContent,
  );
  // Cloud last, and last for a reason: it is the only row with no time in it,
  // so a reader scanning a column reads two "when"s and then the one figure
  // about the whole day.
  expect(labels).toEqual(["Low tide", "Biggest swell", "Cloud cover"]);
});

test("a line with no recorded distance is still named, without one", async () => {
  // `mop_line_distance_m` is nullable in the inventory's own types, so this is
  // reachable rather than defensive. Withholding the whole attribution because
  // one field of it is missing would hide which model answered.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });
  readWaveWeek.mockResolvedValue({
    ...waveWeek([{ index: 0, heightFt: 2.62, periodS: 13.333333 }]),
    line: { id: "D0498", distanceM: null },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  const line = screen.getByText(/MOP line D0498/);
  expect(line.textContent).toContain(
    "CDIP, Scripps Institution of Oceanography",
  );
  expect(line.textContent).not.toContain("km from this beach");
});

/**
 * ADR-0023 dropped the day's own extremes from the week's cells, and this
 * sentence is the condition it was allowed under. Without it a reader who saw a
 * -0.2 ft at 3:38 AM last week finds it gone with nothing to explain the
 * change -- the silent failure this repo is built to avoid.
 *
 * Asserted here rather than in `WeekGrid`, because the grid prints whatever
 * notes it is handed and the decision to hand it this one is the panel's.
 */
test("the week says it shows only the daylight window, once", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(
    screen.getAllByText(/shows what falls between sunrise and sunset/i),
  ).toHaveLength(1);
  // And says where the missing figure went, rather than only that it is gone.
  // It pointed at the tide card until that card came off the page; it points
  // at the day chart now, which is where an overnight low is actually drawn.
  expect(
    screen.getByText(/the day below draws the whole twenty-four hours/i),
  ).toBeDefined();
});

test("the scope sentence stands whether or not a feed also failed", async () => {
  // It qualifies every figure in the grid rather than reporting one feed's
  // trouble, so an outage must not displace it -- and it leads, because a
  // reader hits it before the figures it qualifies.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "unavailable",
      detail: "NOAA returned HTTP 503.",
      drift: false,
    },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  const notes = [...container.querySelectorAll("section > p")].map(
    (node) => node.textContent,
  );
  expect(notes[0]).toMatch(/shows what falls between sunrise and sunset/i);
  expect(
    notes.some((note) => /could not get this week/i.test(note ?? "")),
  ).toBe(true);
});

/* =========================================================================
 * The shape behind each day's figure
 * ========================================================================= */

function tideWeek(...days: ReturnType<typeof tideDay>[]) {
  return { ...BINDING, state: { kind: "week", days } };
}

test("a shape is drawn for each day the series reaches", async () => {
  readWeekOfLowestLows.mockResolvedValue(
    tideWeek(tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)),
  );

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(readHourlyTide).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(sparks()).toHaveLength(2);
  // The description names the day and the hourly extremes, and says they are
  // hourly -- the real turning point falls between two of these, and it is the
  // figure printed above rather than anything read off this series.
  expect(sparks()[0].getAttribute("aria-label")).toBe(
    "Tide through Mon, Aug 17, hour by hour: 0.5 ft at its lowest hour, " +
      "4.5 ft at its highest. Night is shaded; the sun is up from 6:14 AM to 7:32 PM.",
  );
});

test("a day the window did not reach says so rather than drawing a flat line", async () => {
  readWeekOfLowestLows.mockResolvedValue(
    tideWeek(tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)),
  );
  // Only the first day has hours.
  readHourlyTide.mockResolvedValue(hourlyTide([0]));

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(sparks()).toHaveLength(1);
  expect(screen.getByText("No hourly prediction for this day.")).toBeDefined();
  // One curve on the page, not two: the second day drew no path at all.
  expect(sparkPaths(container)).toHaveLength(1);
});

/**
 * ADR-0023 IS FULFILLED HERE, NOT REVERSED. The decision dropped the day's own
 * extreme from six cells of seven "until a day view carries them" and kept
 * `allDay` in `lib/conditions.ts` so this would be cheap. The shape draws the
 * hours the daylight figure was selected out of; the figure and the header
 * window are exactly what they were.
 */
test("the figure and the window are unchanged by the shape above them", async () => {
  readWeekOfLowestLows.mockResolvedValue(
    tideWeek(tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)),
  );

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  // The daylight-selected figure, still leading its cell and still alone in it.
  const tideCell = [...container.querySelectorAll("dl > div")].find((row) =>
    row.querySelector("dt")?.textContent?.includes("Low tide"),
  )!;
  expect(tideCell.querySelector("dd")!.textContent).toBe("6:41 PM 0.9 ft");

  // `allDay` is -1.1 ft at 3:14 AM in the fixture. It is in the data and must
  // not be in the cell: the label that would distinguish it renders 170px
  // against 125px, which is the measurement ADR-0023 turns on.
  expect(container.textContent).not.toContain("3:14 AM");
  expect(container.textContent).not.toContain("-1.1");

  // The window still stated once, in the header.
  expect(daylightWindows()[0].getAttribute("aria-label")).toBe(
    "Daylight, 6:14 AM to 7:32 PM",
  );

  // And the sentence ADR-0023 allowed the drop under is still beneath the grid.
  expect(screen.getByText(/overnight are real and often bigger/)).toBeDefined();
});

test("a failed hourly read costs the shape and not the grid", async () => {
  readWeekOfLowestLows.mockResolvedValue(
    tideWeek(tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)),
  );
  readHourlyTide.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "unavailable",
      detail: "NOAA returned HTTP 503 for station 9410230.",
      drift: false,
    },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  // The week still stands: both figures, both windows, the rows beneath.
  expect(screen.getByText("6:41 PM")).toBeDefined();
  expect(screen.getByText("7:10 AM")).toBeDefined();
  expect(daylightWindows()).toHaveLength(2);
  // No shapes, and no empty frames either.
  expect(sparks()).toHaveLength(0);
  expect(sparkPaths(container)).toHaveLength(0);
});

test("a shape that went missing is said out loud, not left as a gap", async () => {
  // The two are separate requests to one station, so the figures can arrive
  // when the curve does not. A reader who saw the shapes last week would
  // otherwise find them gone with nothing to explain it, and the tide card
  // above cannot cover it because that card shares the other request.
  readWeekOfLowestLows.mockResolvedValue(tideWeek(tideDay(0, "6:41 PM", 0.9)));
  readHourlyTide.mockResolvedValue({
    ...BINDING,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(screen.getByText(/hour-by-hour shape behind each day/)).toBeDefined();
});

test("one outage is one sentence, even though two requests failed", async () => {
  // Both reads go to the same station, so a station-level outage takes both.
  // Two sentences would make one bad afternoon read as two separate faults.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });
  readHourlyTide.mockResolvedValue({
    ...BINDING,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(
    screen.getByText(/could not get this week's tide predictions/),
  ).toBeDefined();
  expect(screen.queryByText(/hour-by-hour shape behind each day/)).toBeNull();
});

test("every day is drawn against one scale, so the week can be compared", async () => {
  // THE SMALL-MULTIPLE RULE, asserted where the range is actually chosen. The
  // second day here swings a quarter as far as the first, and must be drawn a
  // quarter as tall. Under a per-day scale both would fill the frame and a
  // quiet Tuesday would look exactly like a dramatic Monday.
  readWeekOfLowestLows.mockResolvedValue(
    tideWeek(tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)),
  );
  const week = hourlyTide([0, 1]);
  week.state.days[1].hours = week.state.days[1].hours.map((hour) => ({
    ...hour,
    feet: 3 + (hour.feet - 2.5) / 4,
  }));
  readHourlyTide.mockResolvedValue(week);

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  const [first, second] = sparkPaths(container).map((path) => {
    const ys = (path.getAttribute("d") ?? "")
      .split(/[ML]/)
      .filter((step) => step.trim() !== "")
      .map((step) => Number(step.trim().split(/\s+/)[1]));
    return Math.max(...ys) - Math.min(...ys);
  });

  expect(second).toBeLessThan(first / 2);
});

test("the sky read no longer reaches the shape at all, in either direction", async () => {
  // It used to supply the wash. That layer came off after review -- two grey
  // layers in a 21px frame is one too many -- so a cloud outage now costs the
  // grid its cloud row and nothing else, where before it also stripped a layer
  // out of seven shapes.
  readWeekOfLowestLows.mockResolvedValue(tideWeek(tideDay(0, "6:41 PM", 0.9)));

  const withSky = render(await WeekPanel({ slug: "la-jolla-shores-beach" }));
  expect(
    withSky.container.querySelectorAll("[data-cloud-percent]"),
  ).toHaveLength(0);
  const drawn = sparkPaths(withSky.container).map((path) =>
    path.getAttribute("d"),
  );
  expect(drawn.length).toBeGreaterThan(0);

  readSkyWeek.mockResolvedValue({
    beachName: BINDING.beachName,
    cell: CELL,
    state: { kind: "unavailable", detail: "HTTP 503", drift: false },
  });

  const without = render(await WeekPanel({ slug: "la-jolla-shores-beach" }));
  // Byte for byte the same curves. A sky outage that changed the shape would
  // mean the wash had crept back in under another name.
  expect(
    sparkPaths(without.container).map((path) => path.getAttribute("d")),
  ).toEqual(drawn);
  expect(
    without.container.querySelectorAll("[data-cloud-percent]"),
  ).toHaveLength(0);
  // Both days still drawn: the columns come from the daylight read, which
  // cannot fail.
  expect(
    within(without.container).getAllByLabelText(/^Tide through /),
  ).toHaveLength(2);
});

test("a beach with no tide station gets no shape and the reason it already had", async () => {
  const noStation = {
    beachName: BINDING.beachName,
    station: null,
    state: {
      kind: "no-station",
      reason: "no station could be joined to this beach",
    },
  };
  readWeekOfLowestLows.mockResolvedValue(noStation);
  readHourlyTide.mockResolvedValue(noStation);

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  expect(sparks()).toHaveLength(0);
  expect(screen.getByText(/no tide station for this beach/)).toBeDefined();
  // One sentence: the shape's absence is the same permanent fact about the
  // place, not a second thing that went wrong.
  expect(screen.queryByText(/hour-by-hour shape behind each day/)).toBeNull();
  expect(sparkPaths(container)).toHaveLength(0);
});

/**
 * REGRESSION. The tide station was named exactly once on this page and the
 * naming was on the tide card, which sat above the grid and shared this read's
 * station and request. Taking the three-card slab off the page took the only
 * attribution the tide has with it: every tide figure in the grid, and the
 * chart's whole tide curve below it, were suddenly published by nobody.
 *
 * Found by rendering `main` and this branch and diffing what a reader sees --
 * "La Jolla (Scripps Institution Wharf) · NOAA Tides & Currents" was on one
 * page and on no part of the other. No test failed, because no test had ever
 * needed to assert it here: the card's own suite asserted it, and that suite
 * was deleted with the card.
 *
 * ADR-0010 is what this breaks. Its guarantee is the one sentence it ends on:
 * "No figure is ever shown without the reader being able to see where it came
 * from." The wave and cloud rows each carry their own line and always have;
 * the tide row delegated, and had nothing to delegate to.
 */
test("the tide row names its station, which nothing else on the page does", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "week",
      days: [tideDay(0, "6:41 PM", 0.9), tideDay(1, "7:10 AM", -0.42)],
    },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  // One line for the row, like the wave row beside it -- a feed's identity is
  // one fact about a feed, not one per column.
  const attributions = screen.getAllByText(/NOAA Tides & Currents/);
  expect(attributions).toHaveLength(1);
  expect(attributions[0].textContent).toContain(
    "La Jolla (Scripps Institution Wharf)",
  );
  // Labelled with the row's own name, because the grid carries three of these
  // and an unlabelled one would leave a reader matching stations to rows.
  expect(attributions[0].textContent).toContain("Low tide");
});

test("a near tide station is credited without a distance, a far one with it", async () => {
  // The 5 km threshold and its reason came off the tide card with everything
  // else. It is a real rule: NOAA publishes no delivering station on the open
  // coast between La Jolla and Imperial Beach, so some beaches read one tens of
  // kilometres away, and that is the difference between a prediction for this
  // shore and the nearest one anybody publishes.
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  const { unmount } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );
  // 1,369 m, under the threshold: the number would say nothing here.
  expect(screen.getByText(/NOAA Tides & Currents/).textContent).not.toContain(
    "km from this beach",
  );
  unmount();

  readWeekOfLowestLows.mockResolvedValue({
    beachName: "Border Field State Park",
    station: {
      name: "San Diego, San Diego Bay",
      water: "bay",
      distanceM: 21_400,
    },
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  const { unmount: unmount2 } = render(
    await WeekPanel({ slug: "border-field-state-park" }),
  );

  const far = screen.getByText(/NOAA Tides & Currents/).textContent ?? "";
  expect(far).toContain("about 21 km from this beach");
  expect(far).toContain("the nearest bay station publishing predictions");
  unmount2();

  // And the other side of the join's classification, which decides which pool
  // the station came from: an open-coast beach binds a shore station, a bay
  // beach binds the nearest of any kind. Both words reach a reader, so both
  // are asserted -- a clause that only ever said "bay" would be a rule nobody
  // could see was being applied.
  readWeekOfLowestLows.mockResolvedValue({
    beachName: "Torrey Pines State Beach",
    station: {
      name: "La Jolla (Scripps Institution Wharf)",
      water: "open-coast",
      distanceM: 8_900,
    },
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "torrey-pines-state-beach" }));

  const coast = screen.getByText(/NOAA Tides & Currents/).textContent ?? "";
  expect(coast).toContain("about 9 km from this beach");
  expect(coast).toContain("the nearest open-coast station publishing");
});

test("a beach with no tide station is attributed to nothing rather than to a blank", async () => {
  // `no-station` carries a null binding, so there is no source to name and the
  // line must not render an empty one. The grid says the row is absent in its
  // own words; an attribution with no station in it would be worse than none.
  readWeekOfLowestLows.mockResolvedValue({
    beachName: "Nothing Is Bound Here",
    station: null,
    state: { kind: "no-station", reason: "no tide station was joined to it" },
  });

  render(await WeekPanel({ slug: "nothing-is-bound-here" }));

  expect(screen.queryByText(/NOAA Tides & Currents/)).toBeNull();
});
