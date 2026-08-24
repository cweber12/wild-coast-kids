import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const readWeekOfLowestLows = vi.fn();
vi.mock("@/lib/conditions", () => ({ readWeekOfLowestLows }));

const { WeekPanel } = await import("./WeekPanel");

const BINDING = {
  beachName: "La Jolla Shores Beach",
  station: {
    name: "La Jolla (Scripps Institution Wharf)",
    water: "open-coast",
    distanceM: 1369,
  },
};

function day(
  localDate: string,
  dayLabel: string,
  timeLabel: string,
  feet: number,
  isToday = false,
) {
  return {
    localDate,
    dayLabel,
    isToday,
    state: { kind: "reading", timeLabel, feet },
  };
}

beforeEach(() => {
  readWeekOfLowestLows.mockReset();
});

test("asks for the slug it was given and renders the week", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "week",
      days: [
        day("2026-08-17", "Mon, Aug 17", "6:41 PM", 0.9, true),
        day("2026-08-18", "Tue, Aug 18", "7:10 AM", -0.42),
      ],
    },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  expect(readWeekOfLowestLows).toHaveBeenCalledWith("la-jolla-shores-beach");
  expect(screen.getByText("7:10 AM")).toBeDefined();
  expect(screen.getByText("-0.4 ft")).toBeDefined();
  // The row's own label, which is what stops the glyph carrying the meaning.
  expect(screen.getAllByText("Lowest tide")).toHaveLength(2);
});

test("the forecasts that are not built yet are named, waves among them", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    ...BINDING,
    state: {
      kind: "week",
      days: [day("2026-08-17", "Mon, Aug 17", "6:41 PM", 0.9, true)],
    },
  });

  render(await WeekPanel({ slug: "la-jolla-shores-beach" }));

  // Waves get a reserved row rather than no row: only NDBC is
  // observation-only, and CDIP's MOP system publishes a wave forecast. A
  // layout that omitted the row would encode "no wave forecast exists".
  expect(screen.getByText(/wave forecast/i)).toBeDefined();
  expect(screen.getByText(/surf zone forecast/i)).toBeDefined();
  expect(screen.getByText(/gridded forecast/i)).toBeDefined();
});

test("an unavailable week reaches the reader as a sentence, not an empty grid", async () => {
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
  // The reserved rows are facts about products rather than about this station,
  // so a NOAA outage must not take them off the page with it.
  expect(screen.getByText(/wave forecast/i)).toBeDefined();
});

test("a beach with no station says so, and does not read as an outage", async () => {
  readWeekOfLowestLows.mockResolvedValue({
    beachName: "Nothing Is Bound Here",
    station: null,
    state: { kind: "no-station", reason: "no station could be joined to it" },
  });

  render(await WeekPanel({ slug: "nothing-is-bound-here" }));

  expect(screen.getByText(/no tide station/i)).toBeDefined();
  expect(screen.queryByText(/try again/i)).toBeNull();
});

test("a failure to resolve the beach is not swallowed into a rendered nothing", async () => {
  readWeekOfLowestLows.mockRejectedValue(
    new Error("no beach in the inventory"),
  );

  await expect(WeekPanel({ slug: "no-such-beach" })).rejects.toThrow(
    /no beach in the inventory/,
  );
});
