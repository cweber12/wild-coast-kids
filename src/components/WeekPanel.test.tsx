import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readWeekOfLowestLows = vi.fn();
const readDaylightWeek = vi.fn();
const readWaveWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({
  readWeekOfLowestLows,
  readDaylightWeek,
  readWaveWeek,
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
    state: { kind: "reading", timeLabel, feet },
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
        timeLabel,
        heightFt,
        periodS,
      })),
    },
  };
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

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(readWeekOfLowestLows).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(readDaylightWeek).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("7:10 AM")).toBeDefined();
  expect(screen.getByText("-0.4 ft")).toBeDefined();
  expect(screen.getByText("to 7:32 PM")).toBeDefined();
  // Each row's own label, which is what stops a glyph carrying the meaning.
  expect(screen.getAllByText("Lowest tide")).toHaveLength(2);
  expect(screen.getAllByText("Daylight")).toHaveLength(2);
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
  expect(screen.getByText(/surf zone forecast/i)).toBeDefined();
  expect(screen.getByText(/gridded forecast/i)).toBeDefined();
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
  expect(screen.getAllByText("Daylight")).toHaveLength(2);
  expect(screen.queryByText("Lowest tide")).toBeNull();
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
  expect(screen.getAllByText("Daylight")).toHaveLength(2);
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
 * ADR-0015. The reserved row and the live card describe the same product from
 * different feeds, so they take the same glyph — the gridded forecast is the
 * air card's replacement, and marking it with the thermometer the air card no
 * longer uses would leave the page saying two things about one product.
 */
test("the gridded forecast is marked like the air card it will replace", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    station: { name: "La Jolla (Scripps Institution Wharf)", distanceM: 1369 },
    state: { kind: "reading", days: [] },
  });

  const { container } = render(
    await WeekPanel({ slug: "la-jolla-shores-beach" }),
  );

  const glyphs = [...container.querySelectorAll('[aria-hidden="true"]')].map(
    (node) => node.textContent,
  );
  expect(glyphs).toContain("💨");
  expect(glyphs).not.toContain("🌡️");
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
  expect(countOf(cellLabels(container), "Daylight")).toBe(2);
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
  expect(screen.getAllByText("Daylight")).toHaveLength(2);
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

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  // Said in full here rather than pointed at a card, because CDIP is read here
  // and nowhere else on the page.
  expect(screen.getByText(/HTTP 503 for MOP line D0498/)).toBeDefined();
  expect(screen.queryByText("Biggest swell")).toBeNull();
  expect(screen.getAllByText("Lowest tide")).toHaveLength(2);
  expect(screen.getAllByText("Daylight")).toHaveLength(2);
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

  expect(screen.queryByText("Lowest tide")).toBeNull();
  expect(countOf(cellLabels(container), "Biggest swell")).toBe(2);
});

test("the wave row sits under daylight, not between it and the tide", async () => {
  // `DaylightWeek` is there to make the tide row mean something -- a lowest low
  // at 2:23 is a different trip depending on AM or PM -- so a third product
  // between them would take away the thing it is for.
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
  expect(labels).toEqual(["Lowest tide", "Daylight", "Biggest swell"]);
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
