import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readWeekOfLowestLows = vi.fn();
const readDaylightWeek = vi.fn();
const readWaveWeek = vi.fn();
const readSkyWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({
  readWeekOfLowestLows,
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
    cloudPercent: number;
    phenomenon?: { weather: string; coverage: string | null };
  }[],
  cell = CELL,
) {
  return {
    beachName: BINDING.beachName,
    cell,
    state: {
      kind: "week",
      days: days.map(({ index, cloudPercent, phenomenon = null }) => ({
        ...DATES[index],
        cloudPercent,
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
    days: [
      { ...DATES[0], sunriseLabel: "6:14 AM", sunsetLabel: "7:32 PM" },
      { ...DATES[1], sunriseLabel: "6:15 AM", sunsetLabel: "7:31 PM" },
    ],
  };
}

beforeEach(() => {
  readWeekOfLowestLows.mockReset();
  readDaylightWeek.mockReset();
  readWaveWeek.mockReset();
  readSkyWeek.mockReset();
  readSkyWeek.mockResolvedValue(
    skyWeek([
      { index: 0, cloudPercent: 44 },
      {
        index: 1,
        cloudPercent: 67,
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
  expect(screen.getByText("44%")).toBeDefined();
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
    skyWeek([{ index: 0, cloudPercent: 44 }], {
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
  // the buoy the card above reads. A decimal, because every line is under a km.
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
  expect(screen.getByText(/today's are on the cards above/i)).toBeDefined();
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
