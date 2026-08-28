import { beforeEach, expect, test, vi } from "vitest";
import type { TideWeekView } from "./conditions";
import { localDateOf, localMidnightOf, localTimeOf } from "./pacific-time";

const fetchTideExtremes = vi.fn();
const fetchHourlyTide = vi.fn();
const fetchLatestWave = vi.fn();
const fetchLatestObservation = vi.fn();
const fetchLatestNdbcAir = vi.fn();
const fetchMopForecast = vi.fn();
const fetchGridForecast = vi.fn();
vi.mock("./upstream", () => ({
  fetchGridForecast,
  fetchHourlyTide,
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
    grid_cell: null,
    grid_cell_from_end: null,
    grid_cell_elevation_m: null,
    grid_cell_null_reason: reason,
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
  readHourlyTide,
  readDaylightWeek,
  readLatestWaves,
  readLatestAir,
  readWaveWeek,
  readSkyWeek,
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
  fetchHourlyTide.mockReset();
  fetchLatestWave.mockReset();
  fetchLatestObservation.mockReset();
  fetchLatestNdbcAir.mockReset();
  fetchMopForecast.mockReset();
  fetchGridForecast.mockReset();
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
    // Nothing answers for the waves here, so the card must not promise a
    // modelled figure below a sentence saying none is coming.
    expect(view.state.modelAnswersInstead).toBe(false);
  }
});

test("a beach whose buoy was refused says a model answers instead", async () => {
  // The other half of `no-buoy`, since ADR-0019. Read against the shipped
  // inventory rather than a fixture: the guarantee this asserts is that the
  // seed only ever drops a buoy where a line replaced it, and a fixture would
  // assert that about itself.
  const view = await readLatestWaves(
    "border-field-state-park",
    NOON_PACIFIC_20260817,
  );

  expect(view.state.kind).toBe("no-buoy");
  expect(view.buoy).toBeNull();
  // Still no request: the buoy is not read here, it is declined.
  expect(fetchLatestWave).not.toHaveBeenCalled();
  if (view.state.kind === "no-buoy") {
    expect(view.state.modelAnswersInstead).toBe(true);
    expect(view.state.reason).toMatch(/further than this site publishes/);
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
  airTempF: 69.98,
  windMph: 5.82,
  gustMph: null,
  windDirDegT: 320,
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

/**
 * An NWS station observation, for the beaches whose AIR station is on that
 * network rather than NDBC's. It was `skyOk` until ADR-0020: this read used to
 * call the observation endpoint for sky and visibility at every beach, and now
 * calls it only where the air binding points there.
 */
const nwsObservationOk = () => ({
  kind: "ok" as const,
  observation: KNKX_OBSERVATION,
  ageMinutes: 12,
  url: "https://example.invalid",
});

test("temperature and wind come from the pier, and nothing else does", async () => {
  // ADR-0010 split this panel's provenances so the scarcest value would stop
  // deciding where the temperature was measured. ADR-0020 removed the scarce
  // one entirely, and what that leaves is the half ADR-0010 was protecting:
  // the shore station, alone, still 1.4 km away rather than ten.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  // The display name, not the "9410230 - La Jolla, CA" the tide network
  // publishes: what reaches the view is what the page prints.
  expect(view.airStation?.name).toBe("Scripps Pier");
  expect(view.airStation?.distanceM).toBe(1381);

  expect(view.air.kind).toBe("reading");
  if (view.air.kind === "reading") {
    expect(view.air.airTempF).toBeCloseTo(71.42, 2);
    expect(view.air.windMph).toBeCloseTo(8.05, 2);
  }
});

test("the airport is not asked at all any more", async () => {
  // The property that makes the deletion real rather than cosmetic. A card that
  // hid the figures but still fetched them would keep the request, the failure
  // surface and the reason to re-add the reading.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestObservation).not.toHaveBeenCalled();
  expect(view).not.toHaveProperty("sky");
  expect(view).not.toHaveProperty("skyStation");
});

test("the air station is asked on its own network, not the weather service's", async () => {
  // The dispatch reads the station table's `network` field. NDBC ids and NWS
  // ids are both five uppercase characters, so there is nothing in an id to
  // read this from, and guessing would send LJAC1 to api.weather.gov for a 404.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());

  await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestNdbcAir).toHaveBeenCalledWith(
    "LJAC1",
    NOON_PACIFIC_20260817,
  );
  // Not KNKX, and not anybody: the only NWS call this read still makes is for
  // a beach whose AIR station is on that network, which this one's is not.
  expect(fetchLatestObservation).not.toHaveBeenCalled();
});

test("an air station on the weather service's own network is read there", async () => {
  // Most beaches bind an NWS mesonet station for air. The La Jolla run and the
  // two southern bays are NDBC, so the common path must not go through the NDBC
  // fetcher at all.
  fetchLatestObservation.mockResolvedValue(nwsObservationOk());

  const view = await readLatestAir(BAY_BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestNdbcAir).not.toHaveBeenCalled();
  expect(view.air.kind).toBe("reading");
});

test("a bay beach still gets an air reading, unlike its waves", async () => {
  // A bay: no wave buoy by design, and an air station all the same, because
  // air reaches enclosed water and swell does not.
  fetchLatestObservation.mockResolvedValue(nwsObservationOk());

  const view = await readLatestAir(BAY_BEACH, NOON_PACIFIC_20260817);

  expect(view.airStation).not.toBeNull();
  expect(view.air.kind).toBe("reading");
});

test("a failing air reading is the only failure this card can have now", async () => {
  // There were two halves and they failed apart, which was the point of two
  // fetches. With one half left the card either has a temperature or says why
  // it does not, and no other reading can be withheld by an unrelated station.
  fetchLatestNdbcAir.mockResolvedValue({
    kind: "unavailable",
    reason: "NDBC LJAC1 returns 404 for realtime2.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.air).toEqual({
    kind: "unavailable",
    detail: "NDBC LJAC1 returns 404 for realtime2.",
    drift: false,
  });
  expect(fetchLatestObservation).not.toHaveBeenCalled();
});

test("a drift flag survives the trip from either network", async () => {
  fetchLatestNdbcAir.mockResolvedValue({
    kind: "unavailable",
    reason: "ATMP is published in degF, not degC.",
    drift: true,
    url: "https://example.invalid",
  });

  const view = await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(view.air.kind).toBe("unavailable");
  if (view.air.kind === "unavailable") expect(view.air.drift).toBe(true);
});

test("a per-field null arrives as a null rather than as a missing reading", async () => {
  // LJPC1 publishes wind on every row and temperature on none. The reading is
  // still `ok`; it is the field that is absent, and the panel says so.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk({ airTempF: null }));

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
  expect(view.airStation).toBeNull();
  // No station means nothing to ask. A request here would be a wasted call
  // whose failure would then be reported as a transient one.
  expect(fetchLatestObservation).not.toHaveBeenCalled();
  expect(fetchLatestNdbcAir).not.toHaveBeenCalled();
});

test("the clock is passed to the fetch, so freshness is judged not guessed", async () => {
  // Injected rather than read inside, so an aged-out reading is asserted
  // against a fixed instant and no clock is read during a render.
  fetchLatestNdbcAir.mockResolvedValue(ndbcAirOk());

  await readLatestAir(BEACH, NOON_PACIFIC_20260817);

  expect(fetchLatestNdbcAir).toHaveBeenCalledWith(
    "LJAC1",
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

/* =========================================================================
 * readSkyWeek
 * ========================================================================= */

/**
 * Sunrise and sunset at La Jolla Shores on 2026-08-17 are about 6:14 AM and
 * 7:32 PM Pacific, so an hour stamped 14:00 UTC (7 AM Pacific) is in daylight
 * and one stamped 09:00 UTC (2 AM Pacific) is not.
 */
const hourUtc = (day: number, utcHour: number) =>
  Date.UTC(2026, 7, day, utcHour);

function gridOk(
  skyCover: { atMs: number; percent: number }[],
  weather: { atMs: number; weather: string; coverage: string | null }[] = [],
) {
  fetchGridForecast.mockResolvedValue({
    kind: "ok",
    forecast: { cellId: "SGX/54,21", skyCover, weather },
    url: "https://example.invalid",
  });
}

test("a day's figure is the mean of its daylight hours, not of the whole day", async () => {
  // THE DECISION THIS ROW TURNS ON. The night hours here are 0% and 100%; if
  // either reached the mean the answer would not be 50. Daylight is 20 and 80.
  gridOk([
    { atMs: hourUtc(17, 9), percent: 0 },
    { atMs: hourUtc(17, 15), percent: 20 },
    { atMs: hourUtc(17, 23), percent: 80 },
    { atMs: hourUtc(18, 8), percent: 100 },
  ]);

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);

  expect(view.state.kind).toBe("week");
  if (view.state.kind !== "week") throw new Error("expected a week");
  // 08:00 and 16:00 Pacific are the two daylight steps, and they fall in the
  // first and last thirds of a 6:20-to-7:25 window. The middle third has no
  // step, which is a null rather than a zero.
  expect(view.state.days[0].thirds).toEqual({ am: 20, mid: null, eve: 80 });
});

test("each third is a mean of its own hours, not the cloudiest of them", async () => {
  // Measured at SGX/54,21 for 2026-08-30: daylight steps spanning 21 to 62.
  // ADR-0017 selects extremes for reachability, and this row does not, for the
  // reason `SkyWeekDay` records -- the daylight window is the trip, so there
  // are no unreachable hours to route around.
  gridOk([
    { atMs: hourUtc(17, 14), percent: 21 },
    { atMs: hourUtc(17, 17), percent: 34 },
    { atMs: hourUtc(17, 20), percent: 39 },
    { atMs: hourUtc(17, 23), percent: 62 },
  ]);

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  // 07:00 and 10:00 Pacific share the first third and average to 28; 13:00 is
  // the middle third alone and 16:00 the last.
  expect(view.state.days[0].thirds).toEqual({ am: 28, mid: 39, eve: 62 });
});

test("a day with fog in its daylight carries the phenomenon", async () => {
  gridOk(
    [{ atMs: hourUtc(17, 15), percent: 60 }],
    [{ atMs: hourUtc(17, 15), weather: "fog", coverage: "patchy" }],
  );

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days[0].phenomenon).toEqual({
    weather: "fog",
    coverage: "patchy",
  });
});

test("fog outside daylight does not annotate the day", async () => {
  // 09:00 UTC is 2 AM Pacific. Fog nobody will be at the beach for is not what
  // the row is telling a parent about.
  gridOk(
    [{ atMs: hourUtc(17, 15), percent: 60 }],
    [{ atMs: hourUtc(17, 9), weather: "fog", coverage: "patchy" }],
  );

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days[0].phenomenon).toBeNull();
});

test("a day the forecast does not reach is dropped, not rendered as zero", async () => {
  // A zero here would read as a cloudless day. The far column runs out as the
  // product's reach does, and the grid draws no cell where a row has none.
  gridOk([{ atMs: hourUtc(17, 15), percent: 60 }]);

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days).toHaveLength(1);
  expect(view.state.days[0].localDate).toBe("2026-08-17");
});

test("the days it does reach agree with the other rows about which day is which", async () => {
  gridOk([
    { atMs: hourUtc(17, 15), percent: 10 },
    { atMs: hourUtc(18, 15), percent: 20 },
  ]);

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days.map((day) => day.localDate)).toEqual([
    "2026-08-17",
    "2026-08-18",
  ]);
  expect(view.state.days[0].isToday).toBe(true);
  expect(view.state.days[1].isToday).toBe(false);
});

test("two phenomena on one day are grouped, not overwritten", async () => {
  // Exercises the second-hour path of the by-date grouping. A day with fog in
  // the morning and showers later must keep both hours behind one date, or the
  // day's annotation would depend on which arrived last.
  gridOk(
    [
      { atMs: hourUtc(17, 15), percent: 40 },
      { atMs: hourUtc(17, 18), percent: 60 },
    ],
    [
      { atMs: hourUtc(17, 15), weather: "fog", coverage: "patchy" },
      { atMs: hourUtc(17, 18), weather: "rain_showers", coverage: "chance" },
    ],
  );

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days[0].thirds.am).toBe(40);
  // The first of the daylight window, which is the one a parent plans around.
  expect(view.state.days[0].phenomenon?.weather).toBe("fog");
});

test("a beach with no forecast cell says so, and does not read as an outage", async () => {
  const view = await readSkyWeek(UNBOUND_BEACH, NOON_PACIFIC_20260817);

  expect(view.cell).toBeNull();
  expect(view.state.kind).toBe("no-cell");
  if (view.state.kind !== "no-cell") throw new Error("expected no-cell");
  expect(view.state.reason).toMatch(/outside San Diego County/);
  // A permanent fact about the place must not reach the network.
  expect(fetchGridForecast).not.toHaveBeenCalled();
});

test("an upstream failure keeps the binding and carries the reason", async () => {
  fetchGridForecast.mockResolvedValue({
    kind: "unavailable",
    reason:
      "The National Weather Service returned HTTP 503 for forecast cell SGX/54,21.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);

  expect(view.cell?.id).toBe("SGX/54,21");
  if (view.state.kind !== "unavailable")
    throw new Error("expected unavailable");
  expect(view.state.detail).toMatch(/503/);
  expect(view.state.drift).toBe(false);
});

test("drift is carried separately, because it is a bug here rather than a bad day", async () => {
  fetchGridForecast.mockResolvedValue({
    kind: "unavailable",
    reason: 'SGX/54,21: skyCover is declared in "wmoUnit:one".',
    drift: true,
    url: "https://example.invalid",
  });

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "unavailable")
    throw new Error("expected unavailable");
  expect(view.state.drift).toBe(true);
});

test("the bound cell's elevation reaches the view, for the bluff sentence", async () => {
  gridOk([{ atMs: hourUtc(17, 15), percent: 60 }]);

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);

  expect(view.cell?.id).toBe("SGX/54,21");
  expect(view.cell?.elevationM).toBe(0);
});

test("a slug that is not in the inventory throws rather than rendering nothing", async () => {
  await expect(
    readSkyWeek("no-such-beach", NOON_PACIFIC_20260817),
  ).rejects.toThrow(/no beach in the inventory/);
});

/* =========================================================================
 * readHourlyTide
 * ========================================================================= */

function hourlyOk(heights: { atMs: number; feet: number }[]) {
  fetchHourlyTide.mockResolvedValue({
    kind: "ok",
    heights,
    url: "https://example.invalid",
  });
}

/** Every hour of one Pacific date, at a height that is never zero. */
function wholeDay(
  localDate: string,
  from = 1,
): { atMs: number; feet: number }[] {
  const startMs = localMidnightOf(localDate);
  return Array.from({ length: 24 }, (_, hour) => ({
    atMs: startMs + hour * 3_600_000,
    feet: from + hour * 0.1,
  }));
}

test("the hourly read asks for the same window as the extremes, at a different interval", async () => {
  hourlyOk(wholeDay("2026-08-17"));

  await readHourlyTide(BEACH, NOON_PACIFIC_20260817);

  // A day either side of the week, exactly as `predictionsWindow` builds it for
  // the high/low request. Two windows would be two ranges for one station and
  // the curve could reach a day the figure above it does not.
  expect(fetchHourlyTide).toHaveBeenCalledWith({
    stationId: "9410230",
    beginDate: "20260816",
    endDate: "20260825",
  });
});

test("hours are filed under the Pacific date they fall on, not the GMT one", async () => {
  // 07:00 UTC on the 18th is midnight Pacific on the 18th; 06:00 UTC is 11 PM
  // on the 17th. Bucketing by the GMT date would file the second under the 18th
  // and draw an eleven o'clock reading at the start of the next day.
  hourlyOk([
    { atMs: Date.UTC(2026, 7, 18, 6, 0), feet: 4.1 },
    { atMs: Date.UTC(2026, 7, 18, 7, 0), feet: 4.2 },
  ]);

  const view = await readHourlyTide(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  const [today, tomorrow] = view.state.days;
  expect(today.localDate).toBe("2026-08-17");
  expect(today.hours.map((h) => h.feet)).toEqual([4.1]);
  expect(tomorrow.localDate).toBe("2026-08-18");
  expect(tomorrow.hours.map((h) => h.feet)).toEqual([4.2]);
});

test("a day carries what it spans, so a partial series is not stretched across it", async () => {
  hourlyOk(wholeDay("2026-08-17"));

  const view = await readHourlyTide(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  const today = view.state.days[0];
  expect(today.startMs).toBe(localMidnightOf("2026-08-17"));
  expect(today.endMs).toBe(localMidnightOf("2026-08-18"));
  // Every hour returned falls inside the window that is drawn.
  expect(today.hours.every((h) => h.atMs >= today.startMs)).toBe(true);
  expect(today.hours.every((h) => h.atMs < today.endMs)).toBe(true);
});

test("all seven days come back, and a day the window missed is empty rather than absent", async () => {
  // Only today. The other six are real days with nothing predicted for them,
  // and a six-day array would let a grid say nothing at all about the seventh.
  hourlyOk(wholeDay("2026-08-17"));

  const view = await readHourlyTide(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days).toHaveLength(7);
  expect(view.state.days[0].hours).toHaveLength(24);
  expect(view.state.days.slice(1).every((day) => day.hours.length === 0)).toBe(
    true,
  );
  // An empty day still knows what it spans, so a consumer renders a named
  // absence rather than a flat line at zero.
  expect(view.state.days[6].endMs - view.state.days[6].startMs).toBe(
    24 * 3_600_000,
  );
});

test("today is marked, so the curve reads no clock of its own", async () => {
  hourlyOk(wholeDay("2026-08-17"));

  const view = await readHourlyTide(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days.filter((day) => day.isToday)).toHaveLength(1);
  expect(view.state.days[0].isToday).toBe(true);
  expect(view.state.days[0].dayLabel).toBe("Mon, Aug 17");
});

test("negative heights survive the read, MLLW being what makes them mean something", async () => {
  hourlyOk([
    { atMs: Date.UTC(2026, 7, 17, 18, 0), feet: -0.147 },
    { atMs: Date.UTC(2026, 7, 17, 19, 0), feet: 0.373 },
  ]);

  const view = await readHourlyTide(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");
  expect(view.state.days[0].hours.map((h) => h.feet)).toEqual([-0.147, 0.373]);
});

test("a beach with no tide station says so, and carries no station", async () => {
  const view = await readHourlyTide(UNBOUND_BEACH, NOON_PACIFIC_20260817);

  expect(view.station).toBeNull();
  if (view.state.kind !== "no-station") throw new Error("expected no-station");
  expect(view.state.reason).toMatch(/outside San Diego County/);
  // A permanent fact about the place, so nothing was asked of NOAA.
  expect(fetchHourlyTide).not.toHaveBeenCalled();
});

test("an outage keeps the station and says what went wrong", async () => {
  fetchHourlyTide.mockResolvedValue({
    kind: "unavailable",
    reason: "NOAA returned HTTP 503 for station 9410230.",
    drift: false,
    url: "https://example.invalid",
  });

  const view = await readHourlyTide(BEACH, NOON_PACIFIC_20260817);

  expect(view.station?.name).toBeTruthy();
  if (view.state.kind !== "unavailable")
    throw new Error("expected unavailable");
  expect(view.state.detail).toMatch(/503/);
  expect(view.state.drift).toBe(false);
});

test("drift is carried separately, because it is a bug here rather than a bad day", async () => {
  fetchHourlyTide.mockResolvedValue({
    kind: "unavailable",
    reason: 'CO-OPS 9410230: a prediction\'s "v" was number, not a string.',
    drift: true,
    url: "https://example.invalid",
  });

  const view = await readHourlyTide(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "unavailable")
    throw new Error("expected unavailable");
  expect(view.state.drift).toBe(true);
});

test("the hourly read leaves the week's selected figure alone", async () => {
  // ADR-0023 IS FULFILLED BY THIS READ, NOT REVERSED BY IT. The figure a week
  // cell leads with is still the daylight extreme, selected by
  // `readWeekOfLowestLows` from the turning points. The hours are what that
  // figure is selected out of. If reading them ever changed the figure, the
  // curve would be overwriting the decision it exists to illustrate.
  ok([
    { atMs: Date.UTC(2026, 7, 17, 20, 13), feet: 1.6, kind: "low" },
    { atMs: Date.UTC(2026, 7, 17, 10, 41), feet: 0.2, kind: "low" },
  ]);
  hourlyOk(wholeDay("2026-08-17"));

  const [week, hourly] = await Promise.all([
    readWeekOfLowestLows(BEACH, NOON_PACIFIC_20260817),
    readHourlyTide(BEACH, NOON_PACIFIC_20260817),
  ]);

  if (week.state.kind !== "week") throw new Error("expected a week");
  const today = week.state.days[0];
  if (today.state.kind !== "reading") throw new Error("expected a reading");

  // 1:13 PM Pacific at 1.6 ft: the daylight low, not the 3:41 AM one at 0.2 ft
  // and not any hour of the series above.
  expect(today.state.daylight).toEqual({ timeLabel: "1:13 PM", feet: 1.6 });
  expect(today.state.allDay).toEqual({ timeLabel: "3:41 AM", feet: 0.2 });
  if (hourly.state.kind !== "week") throw new Error("expected a week");
  expect(hourly.state.days[0].hours).toHaveLength(24);
});

test("a slug that is not in the inventory throws rather than rendering nothing", async () => {
  await expect(
    readHourlyTide("no-such-beach", NOON_PACIFIC_20260817),
  ).rejects.toThrow(/no beach in the inventory/);
});

/* =========================================================================
 * The two background layers a drawn day needs
 * ========================================================================= */

test("the daylight row carries its instants as well as its labels", () => {
  // The labels are rounded to the minute for printing; a shaded night wants
  // the boundary where it was computed. Both come from one `daylightOn` call,
  // so the printed sunrise and the shaded edge cannot disagree about when the
  // sun came up.
  const view = readDaylightWeek(BEACH, NOON_PACIFIC_20260817);
  const today = view.days[0];

  expect(localTimeOf(today.sunriseMs)).toMatch(/AM$/);
  expect(localTimeOf(today.sunsetMs)).toMatch(/PM$/);
  expect(today.sunriseMs).toBeLessThan(today.sunsetMs);
  // Inside the day it belongs to, at both ends.
  expect(localDateOf(today.sunriseMs)).toBe("2026-08-17");
  expect(localDateOf(today.sunsetMs)).toBe("2026-08-17");
  // The rounded label is the same instant to the minute, not a second reading.
  expect(today.sunriseLabel).toBe(
    localTimeOf(Math.round(today.sunriseMs / 60_000) * 60_000),
  );
});

test("the cloud row carries the whole day's hours, not only the daylight ones", async () => {
  // The thirds answer what the sky does while the trip is happening; the hours
  // are a layer washed across a plot that spans midnight to midnight. A wash
  // that stopped at sunrise would leave the shaded half of the frame claiming
  // nothing was forecast there.
  gridOk([
    { atMs: hourUtc(17, 9), percent: 0 }, // 2 AM Pacific, before sunrise
    { atMs: hourUtc(17, 15), percent: 20 }, // 8 AM
    { atMs: hourUtc(17, 23), percent: 80 }, // 4 PM
  ]);

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  const today = view.state.days[0];
  expect(today.hours.map((hour) => hour.percent)).toEqual([0, 20, 80]);
  // And the thirds are still the daylight two, unchanged by carrying the third.
  expect(today.thirds.am).toBe(20);
  expect(today.thirds.eve).toBe(80);
});

test("an hour the forecast did not reach is absent rather than zero", async () => {
  // Ragged on purpose. A padded series would let a consumer draw a clear sky
  // where there is silence, which is the failure the whole row exists to avoid.
  gridOk([
    { atMs: hourUtc(17, 15), percent: 20 },
    { atMs: hourUtc(17, 17), percent: 40 },
  ]);

  const view = await readSkyWeek(BEACH, NOON_PACIFIC_20260817);
  if (view.state.kind !== "week") throw new Error("expected a week");

  expect(view.state.days[0].hours).toHaveLength(2);
});
