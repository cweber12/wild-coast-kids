import { beforeEach, expect, test, vi } from "vitest";

const fetchTideExtremes = vi.fn();
const fetchLatestWave = vi.fn();
const fetchLatestObservation = vi.fn();
vi.mock("./upstream", () => ({
  fetchTideExtremes,
  fetchLatestWave,
  fetchLatestObservation,
}));

const { readTodaysLowestLow, readLatestWaves, readLatestAir } =
  await import("./conditions");

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
  fetchLatestWave.mockReset();
  fetchLatestObservation.mockReset();
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

/* ===========================================================================
 * Waves
 * ========================================================================= */

/** A bay beach, which the join deliberately binds to no buoy. */
const BAY_BEACH = "agua-hedionda-lagoon";

test("a wave reading carries the buoy, its distance and the water temperature", async () => {
  fetchLatestWave.mockResolvedValue({
    kind: "ok",
    observation: {
      atMs: NOON_PACIFIC_20260817,
      heightFt: 2.62,
      periodS: 5,
      directionDegT: 278,
      waterTempF: 69.98,
    },
    ageMinutes: 12,
    url: "https://example.invalid",
  });

  const view = await readLatestWaves(
    "la-jolla-shores-beach",
    NOON_PACIFIC_20260817,
  );

  expect(view.buoy?.name).toBe("Scripps Nearshore");
  expect(view.buoy?.distanceM).toBeGreaterThan(0);
  expect(view.state).toMatchObject({
    kind: "reading",
    heightFt: 2.62,
    waterTempF: 69.98,
  });
});

test("a bay beach is never asked about, because there is nothing to ask", async () => {
  const view = await readLatestWaves(BAY_BEACH, NOON_PACIFIC_20260817);

  expect(view.state.kind).toBe("no-buoy");
  expect(view.buoy).toBeNull();
  expect(fetchLatestWave).not.toHaveBeenCalled();
  if (view.state.kind === "no-buoy") {
    expect(view.state.reason).toMatch(/does not reach into a bay/);
  }
});

test("an unavailable buoy carries its reason through", async () => {
  fetchLatestWave.mockResolvedValue({
    kind: "unavailable",
    reason: "NDBC 46254 returns 404 for its observations.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readLatestWaves(
    "la-jolla-shores-beach",
    NOON_PACIFIC_20260817,
  );

  expect(view.state).toEqual({
    kind: "unavailable",
    detail: "NDBC 46254 returns 404 for its observations.",
    drift: false,
  });
});

test("the clock is passed to the fetch, so freshness is judged not guessed", async () => {
  fetchLatestWave.mockResolvedValue({
    kind: "unavailable",
    reason: "stale",
    drift: false,
    url: "https://example.invalid",
  });

  await readLatestWaves("la-jolla-shores-beach", NOON_PACIFIC_20260817);

  expect(fetchLatestWave).toHaveBeenCalledWith("46254", NOON_PACIFIC_20260817);
});

/** What KNKX served on 2026-08-18, as the parser hands it on. */
const KNKX_OBSERVATION = {
  atMs: Date.UTC(2026, 7, 18, 4, 55),
  visibilityMi: 10.0,
  visibilityAtCeiling: true,
  airTempF: 69.98,
  windMph: 5.82,
  gustMph: null,
  windDirDegT: 320,
  sky: "Clear",
};

test("the air reading names its station and carries the ceiling flag through", async () => {
  fetchLatestObservation.mockResolvedValue({
    kind: "ok",
    observation: KNKX_OBSERVATION,
    ageMinutes: 12,
    url: "https://example.invalid",
  });

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.station?.name).toMatch(/Miramar/);
  expect(view.station?.distanceM).toBe(10429);
  expect(view.state.kind).toBe("reading");
  if (view.state.kind === "reading") {
    // The flag has to survive the trip, or the view re-derives it from a
    // magic number and the two can disagree.
    expect(view.state.visibilityAtCeiling).toBe(true);
    expect(view.state.visibilityMi).toBe(10.0);
    expect(view.state.sky).toBe("Clear");
  }
});

test("a bay beach still gets an air reading, unlike its waves", async () => {
  fetchLatestObservation.mockResolvedValue({
    kind: "ok",
    observation: KNKX_OBSERVATION,
    ageMinutes: 3,
    url: "https://example.invalid",
  });

  // A lagoon: no wave buoy by design, and an observation station all the same,
  // because air reaches enclosed water and swell does not.
  const view = await readLatestAir(
    "agua-hedionda-lagoon",
    NOON_PACIFIC_20260817,
  );

  expect(view.station).not.toBeNull();
  expect(view.state.kind).toBe("reading");
});

test("the beach the join refused asks nobody and says why", async () => {
  const view = await readLatestAir(UNBOUND_BEACH, NOON_PACIFIC_20260817);

  expect(view.state.kind).toBe("no-station");
  expect(view.station).toBeNull();
  // No station means nothing to ask. A request here would be a wasted call
  // whose failure would then be reported as a transient one.
  expect(fetchLatestObservation).not.toHaveBeenCalled();
});

test("an unavailable station carries its reason and its drift flag through", async () => {
  fetchLatestObservation.mockResolvedValue({
    kind: "unavailable",
    reason: "NWS KNKX returns 404 for its latest observation.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "unavailable",
    detail: "NWS KNKX returns 404 for its latest observation.",
    drift: false,
  });
});

test("the clock is passed to the fetch, so freshness is judged not guessed", async () => {
  fetchLatestObservation.mockResolvedValue({
    kind: "unavailable",
    reason: "stale",
    drift: false,
    url: "https://example.invalid",
  });

  await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestObservation).toHaveBeenCalledWith(
    "KNKX",
    NOON_PACIFIC_20260817,
  );
});

test("an unknown slug is a coding error, not a quiet feed", async () => {
  await expect(
    readLatestAir("not-a-beach", NOON_PACIFIC_20260817),
  ).rejects.toThrow(/no beach in the inventory/);
});
