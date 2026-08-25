import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readWeekOfLowestLows = vi.fn();
const readDaylightWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({ readWeekOfLowestLows, readDaylightWeek }));

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
  readDaylightWeek.mockReturnValue(daylightWeek());
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

test("the forecasts that are not built yet are named, waves among them", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: { kind: "week", days: [tideDay(0, "6:41 PM", 0.9)] },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  // Waves get a reserved row rather than no row: only NDBC is
  // observation-only, and CDIP's MOP system publishes a wave forecast. A
  // layout that omitted the row would encode "no wave forecast exists".
  expect(screen.getByText(/wave forecast/i)).toBeDefined();
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
