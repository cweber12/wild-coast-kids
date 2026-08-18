import { beforeEach, expect, test, vi } from "vitest";

const fetchTideExtremes = vi.fn();
vi.mock("./upstream", () => ({ fetchTideExtremes }));

const { readTodaysLowestLow } = await import("./conditions");

const BEACH = "la-jolla-shores-beach";

/** The one beach the join refuses, because upstream's coordinates are transposed. */
const UNBOUND_BEACH = "imperial-beach-pier-area";

/**
 * Noon Pacific on 2026-08-17. The clock is injected rather than faked, which is
 * the reason `readTodaysLowestLow` takes it as an argument at all.
 */
const NOON_PACIFIC_20260817 = Date.UTC(2026, 7, 17, 19, 0);

/** Just after local midnight, where a naive UTC day would already be tomorrow. */
const JUST_AFTER_MIDNIGHT_20260817 = Date.UTC(2026, 7, 17, 7, 30);

beforeEach(() => {
  fetchTideExtremes.mockReset();
});

function ok(extremes: { atMs: number; feet: number; kind: "low" | "high" }[]) {
  fetchTideExtremes.mockResolvedValue({
    kind: "ok",
    extremes,
    url: "https://example.invalid",
  });
}

test("asks for a window either side of today, because a Pacific day spans two GMT dates", async () => {
  ok([]);
  await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(fetchTideExtremes).toHaveBeenCalledWith({
    stationId: "9410230",
    beginDate: "20260816",
    endDate: "20260818",
  });
});

test("the window is anchored to the Pacific date, not the UTC one", async () => {
  ok([]);
  // 00:30 Pacific on the 17th is already 07:30 UTC on the 17th, so a UTC-anchored
  // window would ask for the 16th-18th by accident and be right for the wrong
  // reason. Anchoring on the local date makes it right on purpose.
  await readTodaysLowestLow(BEACH, JUST_AFTER_MIDNIGHT_20260817);

  expect(fetchTideExtremes).toHaveBeenCalledWith({
    stationId: "9410230",
    beginDate: "20260816",
    endDate: "20260818",
  });
});

test("carries the beach and station bindings, including how far the station is", async () => {
  ok([]);
  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.beachName).toBe("La Jolla Shores Beach");
  expect(view.station?.name).toContain("La Jolla");
  expect(view.station?.water).toBe("open-coast");
  expect(view.station?.distanceM).toBeGreaterThan(0);
});

test("picks the day's deeper low and renders it as Pacific wall-clock time", async () => {
  ok([
    // 6:41 PM on the 16th in California: the previous day, and must not win.
    { atMs: Date.UTC(2026, 7, 17, 1, 41), feet: 0.9, kind: "low" },
    { atMs: Date.UTC(2026, 7, 17, 13, 24), feet: 1.368, kind: "low" },
    { atMs: Date.UTC(2026, 7, 18, 2, 46), feet: 1.51, kind: "low" },
  ]);

  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "reading",
    timeLabel: "6:24 AM",
    feet: 1.368,
  });
});

test("a window with no low for today is its own state, never a reading", async () => {
  ok([{ atMs: Date.UTC(2026, 7, 20, 13, 24), feet: 1.1, kind: "low" }]);

  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({ kind: "no-low-today" });
});

test("an unavailable upstream carries its reason through, unswallowed", async () => {
  fetchTideExtremes.mockResolvedValue({
    kind: "unavailable",
    reason: "NOAA returned HTTP 503 for station 9410230.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "unavailable",
    detail: "NOAA returned HTTP 503 for station 9410230.",
    drift: false,
  });
  // The bindings survive a failure, so the panel can still say which beach and
  // station it was asking about.
  expect(view.beachName).toBe("La Jolla Shores Beach");
});

test("drift is carried as drift rather than folded into a quiet failure", async () => {
  fetchTideExtremes.mockResolvedValue({
    kind: "unavailable",
    reason:
      'CO-OPS 9410230: expected a "predictions" array and found undefined.',
    drift: true,
    url: "https://example.invalid",
  });

  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toMatchObject({ kind: "unavailable", drift: true });
});

test("a beach with no station never reaches upstream, and is not an outage", async () => {
  const view = await readTodaysLowestLow(UNBOUND_BEACH, NOON_PACIFIC_20260817);

  // A permanent fact about the place, kept apart from a feed having a bad day:
  // telling this reader to try again later would be telling them to wait for
  // something that will never arrive.
  expect(view.state.kind).toBe("no-station");
  expect(view.station).toBeNull();
  expect(fetchTideExtremes).not.toHaveBeenCalled();

  if (view.state.kind === "no-station") {
    expect(view.state.reason).toMatch(/outside San Diego County/);
  }
});

test("a slug outside the inventory is a coding error, and nothing is fetched", async () => {
  await expect(
    readTodaysLowestLow("no-such-beach", NOON_PACIFIC_20260817),
  ).rejects.toThrow(/no beach in the inventory/);
  expect(fetchTideExtremes).not.toHaveBeenCalled();
});
