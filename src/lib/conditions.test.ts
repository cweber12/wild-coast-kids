import { beforeEach, expect, test, vi } from "vitest";
import type { TideWeekView } from "./conditions";

const fetchTideExtremes = vi.fn();
const fetchLatestWave = vi.fn();
const fetchLatestObservation = vi.fn();
const fetchLatestNdbcAir = vi.fn();
const fetchMopForecast = vi.fn();
vi.mock("./upstream", () => ({
  fetchTideExtremes,
  fetchLatestWave,
  fetchLatestObservation,
  fetchLatestNdbcAir,
  fetchMopForecast,
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
    mop_line: null,
    mop_line_distance_m: null,
    mop_line_from_end: null,
    mop_line_null_reason: reason,
    sky_station: null,
    sky_station_distance_m: null,
    sky_station_from_end: null,
    sky_station_null_reason: reason,
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

const {
  readTodaysLowestLow,
  readWeekOfLowestLows,
  readDaylightWeek,
  readLatestWaves,
  readLatestAir,
  readWaveWeek,
} = await import("./conditions");

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
  fetchMopForecast.mockReset();
});

function ok(extremes: { atMs: number; feet: number; kind: "low" | "high" }[]) {
  fetchTideExtremes.mockResolvedValue({
    kind: "ok",
    extremes,
    url: "https://example.invalid",
  });
}

test("asks for the week's window even when only today is wanted", async () => {
  ok([]);
  await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  // The day read used to stop at tomorrow. It now asks for the same range the
  // week read asks for, and that is the point rather than an accident: two
  // ranges would be two URLs, which Next does not dedupe, and the page would
  // reach NOAA twice for one station.
  expect(fetchTideExtremes).toHaveBeenCalledWith({
    stationId: "9410230",
    beginDate: "20260816",
    endDate: "20260825",
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
    endDate: "20260825",
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

test("leads with the deepest low a reader can reach, and keeps the day's own", async () => {
  // The instants are hours clear of sunrise and sunset on purpose: a fixture
  // that turned on the ephemeris agreeing to the minute would be asserting
  // something other than the rule under test.
  ok([
    // 6:41 PM on the 16th in California: the previous day, and must not win.
    { atMs: Date.UTC(2026, 7, 17, 1, 41), feet: 0.9, kind: "low" },
    // 3:14 AM: deeper than anything in daylight, and hours before sunrise.
    { atMs: Date.UTC(2026, 7, 17, 10, 14), feet: -0.42, kind: "low" },
    // 2:00 PM: the lowest a parent can stand in front of.
    { atMs: Date.UTC(2026, 7, 17, 21, 0), feet: 1.368, kind: "low" },
  ]);

  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "reading",
    daylight: { timeLabel: "2:00 PM", feet: 1.368 },
    allDay: { timeLabel: "3:14 AM", feet: -0.42 },
  });
});

test("says there is nothing lower when the day's lowest is the daylight one", async () => {
  // Null means "nothing lower than the one above", never "unknown". Printing
  // the same reading twice would read as a fault rather than as agreement.
  ok([{ atMs: Date.UTC(2026, 7, 17, 21, 0), feet: 0.4, kind: "low" }]);

  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "reading",
    daylight: { timeLabel: "2:00 PM", feet: 0.4 },
    allDay: null,
  });
});

test("a day whose only low is overnight still answers, from the other figure", async () => {
  // Close to unreachable on this coast, and a real state: the reading is not
  // withheld, it simply has nothing to lead with.
  ok([{ atMs: Date.UTC(2026, 7, 17, 10, 14), feet: -0.42, kind: "low" }]);

  const view = await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "reading",
    daylight: null,
    allDay: { timeLabel: "3:14 AM", feet: -0.42 },
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
 * The week
 * ========================================================================= */

/** The seven days, or a failure naming whatever the view said instead. */
function daysOf(view: TideWeekView) {
  if (view.state.kind !== "week") {
    throw new Error(`expected a week of days and got "${view.state.kind}"`);
  }
  return view.state.days;
}

test("the day and the week come from one request, so NOAA is asked once", async () => {
  ok([]);

  await readTodaysLowestLow(BEACH, NOON_PACIFIC_20260817);
  await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817);

  // Not "both were called" — both were called with the *same* contract. That
  // is what makes them one URL, and one URL is what makes them one fetch.
  const [dayCall, weekCall] = fetchTideExtremes.mock.calls;
  expect(weekCall).toEqual(dayCall);
});

test("the window reaches past the last day of the week, not past today", async () => {
  ok([]);
  await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817);

  // 20260823 is the seventh day; a low late on its evening falls on GMT
  // 20260824, and the eighth day of slack is the same boundary allowance the
  // lower bound has always carried.
  expect(fetchTideExtremes).toHaveBeenCalledWith({
    stationId: "9410230",
    beginDate: "20260816",
    endDate: "20260825",
  });
});

test("names seven consecutive days, beginning with today", async () => {
  ok([]);
  const view = await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817);

  expect(daysOf(view).map((day) => day.localDate)).toEqual([
    "2026-08-17",
    "2026-08-18",
    "2026-08-19",
    "2026-08-20",
    "2026-08-21",
    "2026-08-22",
    "2026-08-23",
  ]);
});

test("the week is anchored to the Pacific date, not the UTC one", async () => {
  ok([]);
  // 00:30 Pacific on the 17th is already 07:30 UTC on the 17th. A UTC-anchored
  // week would start on the 17th here too, and be right by accident; the day
  // that separates them is the one before local midnight, so this asserts the
  // rule rather than the coincidence.
  const view = await readWeekOfLowestLows(BEACH, JUST_AFTER_MIDNIGHT_20260817);

  expect(daysOf(view)[0].localDate).toBe("2026-08-17");
});

test("each day gets its own two lows, and never a high", async () => {
  ok([
    // 3:00 AM on the 17th: deeper than anything in daylight that day.
    { atMs: Date.UTC(2026, 7, 17, 10, 0), feet: -0.4, kind: "low" },
    // 2:00 PM on the 17th: the lowest a reader can reach.
    { atMs: Date.UTC(2026, 7, 17, 21, 0), feet: 0.9, kind: "low" },
    // 10:00 AM on the 18th, and the only low that day.
    { atMs: Date.UTC(2026, 7, 18, 17, 0), feet: 1.2, kind: "low" },
    // A high on the 18th, lower in the list and irrelevant to a lowest low.
    { atMs: Date.UTC(2026, 7, 18, 20, 0), feet: 3.0, kind: "high" },
  ]);

  const days = daysOf(await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817));

  expect(days[0].state).toEqual({
    kind: "reading",
    daylight: { timeLabel: "2:00 PM", feet: 0.9 },
    allDay: { timeLabel: "3:00 AM", feet: -0.4 },
  });
  // The one day of the two whose lowest low does fall in daylight, so there is
  // nothing lower to report beside it.
  expect(days[1].state).toEqual({
    kind: "reading",
    daylight: { timeLabel: "10:00 AM", feet: 1.2 },
    allDay: null,
  });
});

test("all three rows are selected by one computation of the week's daylight", async () => {
  // A tide row that thought Tuesday's sun set at a different minute from the
  // daylight row beside it would be the same class of bug weekOfDays exists to
  // prevent for dates.
  ok([
    { atMs: Date.UTC(2026, 7, 17, 10, 0), feet: -0.4, kind: "low" },
    { atMs: Date.UTC(2026, 7, 17, 21, 0), feet: 0.9, kind: "low" },
  ]);

  const tide = daysOf(await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817));
  const daylight = readDaylightWeek(BEACH, NOON_PACIFIC_20260817).days;

  const state = tide[0].state;
  if (state.kind !== "reading" || state.daylight === null) {
    throw new Error("expected a daylight reading");
  }
  expect(daylight[0].sunriseLabel).toBe("6:14 AM");
  expect(daylight[0].sunsetLabel).toBe("7:32 PM");
  // 2:00 PM sits inside that window; 3:00 AM does not, and is the one carried
  // beside it rather than led with.
  expect(state.daylight.timeLabel).toBe("2:00 PM");
  expect(state.allDay?.timeLabel).toBe("3:00 AM");
});

test("a day the window did not cover is named, not dropped from the week", async () => {
  ok([{ atMs: Date.UTC(2026, 7, 18, 14, 10), feet: -0.4, kind: "low" }]);

  const days = daysOf(await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817));

  // Seven entries whatever happened. A short array would let a grid render six
  // columns and say nothing about the seventh, which is the silent failure the
  // four-state model exists to prevent.
  expect(days).toHaveLength(7);
  expect(days[0].state).toEqual({ kind: "no-low" });
  expect(days[1].state.kind).toBe("reading");
});

test("today is marked as today, so the grid need not read a clock", async () => {
  ok([]);
  const days = daysOf(await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817));

  expect(days.filter((day) => day.isToday).map((day) => day.localDate)).toEqual(
    ["2026-08-17"],
  );
});

test("a day carries a label a reader can scan, not just an ISO date", async () => {
  ok([]);
  const days = daysOf(await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817));

  expect(days[0].dayLabel).toBe("Mon, Aug 17");
});

test("an unavailable upstream is one failure for the week, not seven", async () => {
  fetchTideExtremes.mockResolvedValue({
    kind: "unavailable",
    reason: "NOAA returned HTTP 503 for station 9410230.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "unavailable",
    detail: "NOAA returned HTTP 503 for station 9410230.",
    drift: false,
  });
  expect(view.beachName).toBe("La Jolla Shores Beach");
});

test("a beach with no tide station has no week, and no outage either", async () => {
  const view = await readWeekOfLowestLows(UNBOUND_BEACH, NOON_PACIFIC_20260817);

  expect(view.state.kind).toBe("no-station");
  expect(view.station).toBeNull();
  expect(fetchTideExtremes).not.toHaveBeenCalled();
});

test("a slug outside the inventory is a coding error here too", async () => {
  await expect(
    readWeekOfLowestLows("no-such-beach", NOON_PACIFIC_20260817),
  ).rejects.toThrow(/no beach in the inventory/);
  expect(fetchTideExtremes).not.toHaveBeenCalled();
});

/* ===========================================================================
 * Daylight
 * ========================================================================= */

/**
 * The reference times below are published by the United States Naval
 * Observatory for the midpoint of La Jolla Shores Beach's own segment,
 * 32.869182, -117.255932, fetched 2026-08-24:
 *
 *   https://aa.usno.navy.mil/api/rstt/oneday?date=2026-08-17&coords=32.869182,-117.255932&tz=-7
 *
 * The astronomy itself is asserted against seven such references in
 * `daylight.test.ts`. What these tests are for is everything between it and a
 * reader: the right coordinates, the right seven days, the rounding, and the
 * fact that none of it depends on a station.
 */
test("sunrise and sunset are this beach's own, as Pacific wall-clock times", () => {
  const view = readDaylightWeek(BEACH, NOON_PACIFIC_20260817);

  expect(view.days[0].sunriseLabel).toBe("6:14 AM");
  expect(view.days[0].sunsetLabel).toBe("7:32 PM");
});

test("the daylight row covers the same seven days the tide row does", async () => {
  ok([]);
  const tide = await readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817);
  const daylight = readDaylightWeek(BEACH, NOON_PACIFIC_20260817);

  // The grid looks a row's cells up by local date, so two rows that disagreed
  // about the week would silently render as one ragged row and one full one.
  const dates = (days: { localDate: string }[]) =>
    days.map((day) => day.localDate);
  expect(dates(daylight.days)).toEqual(
    dates(tide.state.kind === "week" ? tide.state.days : []),
  );
});

test("today is marked here too, so the two rows agree about where the reader is", () => {
  const view = readDaylightWeek(BEACH, NOON_PACIFIC_20260817);

  expect(
    view.days.filter((day) => day.isToday).map((day) => day.localDate),
  ).toEqual(["2026-08-17"]);
});

test("nothing is fetched, because there is no sun API here", () => {
  readDaylightWeek(BEACH, NOON_PACIFIC_20260817);

  expect(fetchTideExtremes).not.toHaveBeenCalled();
});

test("a beach with no station still has a full week of daylight", () => {
  // The row that cannot fail. Every other read in this file has a state for a
  // beach nothing could be joined to; this one has coordinates, and coordinates
  // are all it needs.
  const view = readDaylightWeek(UNBOUND_BEACH, NOON_PACIFIC_20260817);

  expect(view.days).toHaveLength(7);
  expect(view.days[6].sunriseLabel).toMatch(/^\d+:\d\d AM$/);
});

test("a slug outside the inventory is a coding error for daylight too", () => {
  expect(() =>
    readDaylightWeek("no-such-beach", NOON_PACIFIC_20260817),
  ).toThrow(/no beach in the inventory/);
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

/* =========================================================================
 * The wave forecast, from CDIP MOP
 * ========================================================================= */

/** Three-hourly rows for one Pacific day, in metres-converted feet. */
function mopRows(
  entries: { atMs: number; heightFt: number; periodS: number }[],
) {
  fetchMopForecast.mockResolvedValue({
    kind: "ok",
    forecast: {
      lineId: "D0498",
      rows: entries.map((entry) => ({ ...entry, directionDegT: 270 })),
      flaggedOut: 0,
    },
    url: "https://example.invalid",
  });
}

/** 3am, noon and 9pm Pacific on the given offset from 2026-08-17. */
const pacificHour = (dayOffset: number, hour: number) =>
  Date.UTC(2026, 7, 17 + dayOffset, hour + 7);

test("each cell is that day's biggest estimate, with the period that went with it", async () => {
  // The statistic is consequential rather than cosmetic: the smallest and
  // largest estimates of one day can fall either side of a plain-language band,
  // so the mean and the maximum describe the same day in different words.
  mopRows([
    { atMs: pacificHour(0, 3), heightFt: 1.2, periodS: 8 },
    { atMs: pacificHour(0, 12), heightFt: 3.4, periodS: 14 },
    { atMs: pacificHour(0, 21), heightFt: 2.1, periodS: 11 },
  ]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  expect(view.state.kind).toBe("week");
  if (view.state.kind !== "week") return;
  expect(view.state.days).toHaveLength(1);
  expect(view.state.days[0]).toMatchObject({
    localDate: "2026-08-17",
    isToday: true,
    // The instant of the estimate that supplied the maximum, worded in
    // Pacific. A three-hour step rather than a peak located to the minute --
    // the row and ConditionsNotes both say so.
    daylight: { timeLabel: "12:00 PM", heightFt: 3.4, periodS: 14 },
    // The 3am and 9pm estimates are both outside daylight and both smaller, so
    // the day's biggest is the one already led with.
    allDay: null,
  });
});

test("the day's biggest is kept beside it when it falls outside daylight", async () => {
  // Six of the seven days measured on 2026-08-26 were this shape, four of them
  // peaking at 11 PM or 2 AM. A row printing the day's biggest full stop was
  // answering a question nobody planning a trip had asked.
  mopRows([
    { atMs: pacificHour(0, 3), heightFt: 4.1, periodS: 5 },
    { atMs: pacificHour(0, 12), heightFt: 2.6, periodS: 14 },
  ]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days[0]).toMatchObject({
    daylight: { timeLabel: "12:00 PM", heightFt: 2.6, periodS: 14 },
    allDay: { timeLabel: "3:00 AM", heightFt: 4.1, periodS: 5 },
  });
});

test("a day whose estimates are all overnight still answers", async () => {
  // A ragged forecast can cover only part of a day. The reading is not
  // withheld; it simply has nothing to lead with.
  mopRows([{ atMs: pacificHour(0, 3), heightFt: 4.1, periodS: 5 }]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days[0]).toMatchObject({
    daylight: null,
    allDay: { timeLabel: "3:00 AM", heightFt: 4.1, periodS: 5 },
  });
});

test("the time comes from the estimate that supplied the height", async () => {
  // Not the first row of the day, and not the middle of it. Picking the
  // maximum and then labelling it with somebody else's clock would be a time
  // about nothing.
  mopRows([
    { atMs: pacificHour(0, 3), heightFt: 1.2, periodS: 8 },
    { atMs: pacificHour(0, 18), heightFt: 3.4, periodS: 14 },
  ]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days[0].daylight?.timeLabel).toBe("6:00 PM");
});

test("a tie keeps the earlier estimate", async () => {
  // The rows arrive oldest first, so strictly-greater is what makes this
  // deterministic -- and a reader planning a morning is better served by the
  // earlier of two identical heights.
  // Both inside daylight -- sunrise is 6:14 AM, so a 6 AM estimate would not
  // reach the tie-break at all.
  mopRows([
    { atMs: pacificHour(0, 9), heightFt: 2.5, periodS: 9 },
    { atMs: pacificHour(0, 18), heightFt: 2.5, periodS: 15 },
  ]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days[0].daylight?.periodS).toBe(9);
  expect(view.state.days[0].daylight?.timeLabel).toBe("9:00 AM");
});

test("days are grouped by the Pacific date, not the UTC one", async () => {
  // 9pm Pacific is the next day in UTC. Grouping on UTC would move the whole
  // evening of every day into the column after it.
  mopRows([
    { atMs: pacificHour(0, 21), heightFt: 4.0, periodS: 16 },
    { atMs: pacificHour(1, 9), heightFt: 1.0, periodS: 6 },
  ]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days.map((day) => day.localDate)).toEqual([
    "2026-08-17",
    "2026-08-18",
  ]);
  // 9pm Pacific is outside daylight, so it is the day's own rather than the
  // one led with -- and it is still on the 17th, which is the point.
  expect(view.state.days[0].allDay?.heightFt).toBe(4.0);
});

test("the row goes ragged rather than blank where the forecast stops", async () => {
  // A tide prediction runs years ahead and a short tide week is a fault. A
  // forecast that stops on Sunday is a forecast doing what forecasts do, and
  // the grid draws no cell where a row has none.
  mopRows([
    { atMs: pacificHour(0, 12), heightFt: 2.0, periodS: 10 },
    { atMs: pacificHour(1, 12), heightFt: 2.0, periodS: 10 },
    { atMs: pacificHour(2, 12), heightFt: 2.0, periodS: 10 },
  ]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days).toHaveLength(3);
});

test("estimates outside the seven columns are dropped", async () => {
  // The window is asked with a day of slack either side, and the forecast
  // reaches three days back on its own. Building from the week's own days is
  // what keeps this row agreeing with the tide row about which day is Tuesday.
  mopRows([
    { atMs: pacificHour(-1, 12), heightFt: 9.9, periodS: 20 },
    { atMs: pacificHour(0, 12), heightFt: 2.0, periodS: 10 },
    { atMs: pacificHour(8, 12), heightFt: 9.9, periodS: 20 },
  ]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days.map((day) => day.localDate)).toEqual(["2026-08-17"]);
});

test("the window is bounded and slack on both ends", async () => {
  mopRows([{ atMs: pacificHour(0, 12), heightFt: 2.0, periodS: 10 }]);

  await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  expect(fetchMopForecast).toHaveBeenCalledWith({
    lineId: "D0498",
    startIso: "2026-08-16T00:00:00Z",
    endIso: "2026-08-25T00:00:00Z",
  });
});

test("the line and its distance travel with the reading", async () => {
  mopRows([{ atMs: pacificHour(0, 12), heightFt: 2.0, periodS: 10 }]);

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  expect(view.line?.id).toBe("D0498");
  expect(view.line?.distanceM).toBeGreaterThan(0);
  expect(view.beachName).toBe("La Jolla Shores Beach");
});

test("a bay beach is not asked for a forecast either, for the same reason", async () => {
  const view = await readWaveWeek(BAY_BEACH, NOON_PACIFIC_20260817);

  expect(view.state.kind).toBe("no-line");
  expect(view.line).toBeNull();
  expect(fetchMopForecast).not.toHaveBeenCalled();
  if (view.state.kind === "no-line") {
    expect(view.state.reason).toMatch(/does not reach into a bay/);
  }
});

test("an unavailable forecast carries its reason and its drift flag through", async () => {
  fetchMopForecast.mockResolvedValue({
    kind: "unavailable",
    reason:
      "CDIP's forecast for MOP line D0498 does not reach the week this page is showing.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readWaveWeek(BEACH, NOON_PACIFIC_20260817);

  expect(view.state).toEqual({
    kind: "unavailable",
    detail:
      "CDIP's forecast for MOP line D0498 does not reach the week this page is showing.",
    drift: false,
  });
  // The binding survives the failure, so the page can still say which line it
  // was asking about.
  expect(view.line?.id).toBe("D0498");
});

test("a slug that is not in the inventory is a coding error, not a quiet feed", async () => {
  await expect(
    readWaveWeek("no-such-beach", NOON_PACIFIC_20260817),
  ).rejects.toThrow(/no beach in the inventory/);
});
