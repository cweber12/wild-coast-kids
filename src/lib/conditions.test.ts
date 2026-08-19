import { beforeEach, expect, test, vi } from "vitest";

const fetchTideExtremes = vi.fn();
const fetchLatestWave = vi.fn();
const fetchLatestObservation = vi.fn();
const fetchLatestNdbcAir = vi.fn();
vi.mock("./upstream", () => ({
  fetchTideExtremes,
  fetchLatestWave,
  fetchLatestObservation,
  fetchLatestNdbcAir,
}));

const BEACH = "la-jolla-shores-beach";

/**
 * A beach with nothing bound to it, which the inventory no longer contains.
 *
 * It used to be Imperial Beach pier area, whose upstream coordinates are
 * transposed. The service predicate removes every beach a join could not bind,
 * so no slug in `beaches.json` reaches the `no-station` states any
 * more -- and those states stay, because that file is written by joins that can
 * fail and the four-state model exists to keep a permanent fact about a place
 * apart from a feed having a bad day.
 *
 * So one synthetic beach, added to the real inventory rather than replacing it:
 * every other test in this file still runs against the shipped file, which is
 * what makes them evidence rather than assertions about a fixture.
 */
const UNBOUND_BEACH = "nothing-is-bound-here";

vi.mock("./beaches", async (importOriginal) => {
  const real = await importOriginal<typeof import("./beaches")>();
  const reason =
    "the lower endpoint published upstream (32.1327, -117.1332) is outside San Diego " +
    "County, so no station can be joined to it";
  const unbound: import("./beaches").Beach = {
    ...real.beachBySlug("la-jolla-shores-beach")!,
    slug: UNBOUND_BEACH,
    name: "Nothing Is Bound Here",
    tide_station: null,
    tide_station_distance_m: null,
    tide_station_from_end: null,
    tide_station_null_reason: reason,
    wave_buoy: null,
    wave_buoy_distance_m: null,
    wave_buoy_from_end: null,
    wave_buoy_null_reason: reason,
    weather_station: null,
    weather_station_distance_m: null,
    weather_station_from_end: null,
    weather_station_null_reason: reason,
    air_station: null,
    air_station_distance_m: null,
    air_station_from_end: null,
    air_station_null_reason: reason,
  };
  return {
    ...real,
    beachBySlug: (slug: string) =>
      slug === UNBOUND_BEACH ? unbound : real.beachBySlug(slug),
  };
});

const { readTodaysLowestLow, readLatestWaves, readLatestAir } =
  await import("./conditions");

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
  fetchLatestNdbcAir.mockReset();
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

/**
 * A bay beach, which the join deliberately binds to no buoy. Agua Hedionda
 * Lagoon used to stand here and left the inventory with the rest of North
 * County: its nearest bay tide station is 39.7 km away.
 */
const BAY_BEACH = "mission-bay";

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

/**
 * La Jolla Shores binds two stations: LJAC1 at Scripps Pier for temperature and
 * wind, on the NDBC network, and KNKX at Miramar for sky and visibility, ten
 * kilometres inland. That split is the whole of ADR 0010, so most of what
 * follows is about the two halves staying apart.
 */
const ndbcAirOk = (overrides = {}) => ({
  kind: "ok" as const,
  airTempF: 71.42,
  windMph: 8.05,
  gustMph: null,
  windDirDegT: 320,
  url: "https://example.invalid",
  ...overrides,
});

const skyOk = () => ({
  kind: "ok" as const,
  observation: KNKX_OBSERVATION,
  ageMinutes: 12,
  url: "https://example.invalid",
});

test("temperature and wind come from the pier, sky and visibility from the airport", async () => {
  // The reading this whole issue was opened for. Both stations are named, each
  // with its own distance, because a reader who cannot tell which supplied
  // which figure is worse off than one who reads two lines.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());
  fetchLatestObservation.mockResolvedValue(skyOk());

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  // The display name, not the "9410230 - La Jolla, CA" the tide network
  // publishes: what reaches the view is what the page prints.
  expect(view.airStation?.name).toBe("Scripps Pier");
  expect(view.airStation?.distanceM).toBe(1381);
  expect(view.skyStation?.name).toMatch(/Miramar/);
  expect(view.skyStation?.distanceM).toBe(10429);

  expect(view.air.kind).toBe("reading");
  if (view.air.kind === "reading") {
    expect(view.air.airTempF).toBeCloseTo(71.42, 2);
    expect(view.air.windMph).toBeCloseTo(8.05, 2);
  }
  expect(view.sky.kind).toBe("reading");
  if (view.sky.kind === "reading") {
    // The flag has to survive the trip, or the view re-derives it from a magic
    // number and the two can disagree.
    expect(view.sky.visibilityAtCeiling).toBe(true);
    expect(view.sky.visibilityMi).toBe(10.0);
    expect(view.sky.sky).toBe("Clear");
  }
});

test("the air station is asked on its own network, not the weather service's", async () => {
  // The dispatch reads the station table's `network` field. NDBC ids and NWS
  // ids are both five uppercase characters, so there is nothing in an id to
  // read this from, and guessing would send LJAC1 to api.weather.gov for a 404.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());
  fetchLatestObservation.mockResolvedValue(skyOk());

  await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestNdbcAir).toHaveBeenCalledWith(
    "LJAC1",
    NOON_PACIFIC_20260817,
  );
  expect(fetchLatestObservation).toHaveBeenCalledWith(
    "KNKX",
    NOON_PACIFIC_20260817,
  );
});

test("an air station on the weather service's own network is read there", async () => {
  // Most beaches bind an NWS mesonet station for air. The La Jolla run and the
  // two southern bays are NDBC, so the common path must not go through the NDBC
  // fetcher at all.
  fetchLatestObservation.mockResolvedValue(skyOk());

  const view = await readLatestAir(BAY_BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestNdbcAir).not.toHaveBeenCalled();
  expect(view.air.kind).toBe("reading");
});

test("a bay beach still gets an air reading, unlike its waves", async () => {
  fetchLatestObservation.mockResolvedValue(skyOk());

  // A bay: no wave buoy by design, and an air station all the same, because
  // air reaches enclosed water and swell does not.
  const view = await readLatestAir(BAY_BEACH, NOON_PACIFIC_20260817);

  expect(view.airStation).not.toBeNull();
  expect(view.skyStation).not.toBeNull();
  expect(view.air.kind).toBe("reading");
});

test("a failing sky leaves the temperature standing", async () => {
  // The point of two fetches. Withholding a temperature measured 1.4 km from
  // the sand because an airport ten kilometres away missed a minute would trade
  // the good reading for the irrelevant one.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());
  fetchLatestObservation.mockResolvedValue({
    kind: "unavailable",
    reason: "NWS KNKX returns 404 for its latest observation.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.air.kind).toBe("reading");
  expect(view.sky).toEqual({
    kind: "unavailable",
    detail: "NWS KNKX returns 404 for its latest observation.",
    drift: false,
  });
});

test("a failing air reading leaves the sky standing", async () => {
  fetchLatestNdbcAir.mockResolvedValue({
    kind: "unavailable",
    reason: "NDBC LJAC1 returns 404 for realtime2.",
    drift: false,
    url: "https://example.invalid",
  });
  fetchLatestObservation.mockResolvedValue(skyOk());

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.sky.kind).toBe("reading");
  expect(view.air).toEqual({
    kind: "unavailable",
    detail: "NDBC LJAC1 returns 404 for realtime2.",
    drift: false,
  });
});

test("a drift flag survives the trip from either network", async () => {
  fetchLatestNdbcAir.mockResolvedValue({
    kind: "unavailable",
    reason: "ATMP is published in degF, not degC.",
    drift: true,
    url: "https://example.invalid",
  });
  fetchLatestObservation.mockResolvedValue(skyOk());

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.air.kind).toBe("unavailable");
  if (view.air.kind === "unavailable") expect(view.air.drift).toBe(true);
});

test("a per-field null arrives as a null rather than as a missing reading", async () => {
  // LJPC1 publishes wind on every row and temperature on none. The reading is
  // still `ok`; it is the field that is absent, and the panel says so.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk({ airTempF: null }));
  fetchLatestObservation.mockResolvedValue(skyOk());

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.air.kind).toBe("reading");
  if (view.air.kind === "reading") {
    expect(view.air.airTempF).toBeNull();
    expect(view.air.windMph).toBeCloseTo(8.05, 2);
  }
});

test("the beach the join refused asks nobody and says why", async () => {
  const view = await readLatestAir(UNBOUND_BEACH, NOON_PACIFIC_20260817);

  expect(view.air.kind).toBe("no-station");
  expect(view.sky.kind).toBe("no-station");
  expect(view.airStation).toBeNull();
  expect(view.skyStation).toBeNull();
  // No station means nothing to ask. A request here would be a wasted call
  // whose failure would then be reported as a transient one.
  expect(fetchLatestObservation).not.toHaveBeenCalled();
  expect(fetchLatestNdbcAir).not.toHaveBeenCalled();
});

test("the clock is passed to both fetches, so freshness is judged not guessed", async () => {
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());
  fetchLatestObservation.mockResolvedValue({
    kind: "unavailable",
    reason: "stale",
    drift: false,
    url: "https://example.invalid",
  });

  await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestNdbcAir).toHaveBeenCalledWith(
    "LJAC1",
    NOON_PACIFIC_20260817,
  );
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
