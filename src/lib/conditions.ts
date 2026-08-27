/**
 * Composing one beach's conditions into something a component can render.
 *
 * This is where "now" is read, and that placement is the point. `Date.now()` is
 * impure, and React's purity rule rejects it inside a component for a good
 * reason: a value that changes between renders makes the render unstable. The
 * clock is request data, so resolving it belongs in the data layer beside the
 * fetch, and what reaches the view is a settled value model with no clock in it.
 *
 * `nowMs` is injectable so the day-selection behaviour is testable against fixed
 * instants rather than against whatever the test runner's clock says.
 */

import {
  airStationFor,
  type Beach,
  beachBySlug,
  mopLineFor,
  tideStationFor,
  waveBuoyFor,
  type ObservationStation,
  skyStationFor,
} from "./beaches";
import { type Daylight, daylightOn, midpointOf } from "./daylight";
import type { TideExtreme } from "./coops-predictions";
import {
  addLocalDays,
  localDateOf,
  localDayLabel,
  localTimeOf,
} from "./pacific-time";
import { lowestLowBetween, lowestLowOn } from "./tide-day";
import type { MopWaveRow } from "./mop-forecast";
import type { SkyCoverHour, WeatherHour } from "./nws-gridpoint";
import {
  fetchGridForecast,
  fetchLatestNdbcAir,
  fetchLatestObservation,
  fetchLatestWave,
  fetchMopForecast,
  fetchTideExtremes,
} from "./upstream";

/** One predicted low, worded for a reader. */
export interface TideReading {
  timeLabel: string;
  feet: number;
}

/**
 * The two lows a tide row carries, and which of them leads.
 *
 * **`daylight` is the primary figure**, because it is the one a reader can act
 * on. A lowest low at 3:14 AM is a real prediction and a useless plan, and
 * until now the page printed it as the answer and left the reader to check it
 * against the daylight row themselves. On the seven days measured on
 * 2026-08-26 the day's lowest low fell before sunrise on six of them.
 *
 * **`allDay` is present only when it is a different extreme.** When the day's
 * lowest low happens to fall in daylight the two are the same reading, and
 * printing it twice would be noise; the view says there is nothing lower
 * instead. Null therefore means "nothing lower than the one above", not
 * "unknown".
 *
 * **Both can be null in only one direction.** `daylight` is null when no low
 * falls between sunrise and sunset, and `allDay` then carries the day's lowest
 * so the cell still has a figure. They are never both null: a day with no low
 * at all is `no-low`, which is a fact about the window this site asked NOAA
 * for.
 */
export interface TideLows {
  daylight: TideReading | null;
  allDay: TideReading | null;
}

/**
 * What the view renders. Four states, kept distinct on purpose, because the
 * dangerous direction is any of the last three reading as a calm sea:
 *
 *   reading        a predicted low for today
 *   no-low-today   the window held none, which is a gap in our request
 *   no-station     the join bound no station to this beach at all
 *   unavailable    a station exists and upstream could not answer
 *
 * `no-station` is a permanent fact about the place; `unavailable` is a transient
 * fact about the feed. Collapsing them would tell a reader to try again later
 * about something that will never work, or the reverse.
 */
export type TideTodayState =
  | ({ kind: "reading" } & TideLows)
  | { kind: "no-low-today" }
  | { kind: "no-station"; reason: string }
  | {
      kind: "unavailable";
      /** The exact upstream reason, for the disclosure. */
      detail: string;
      /** True when the payload shape drifted, which is a bug here rather than a quiet feed. */
      drift: boolean;
    };

export interface TideTodayView {
  beachName: string;
  /** null exactly when the state is `no-station`. */
  station: { name: string; water: string; distanceM: number | null } | null;
  state: TideTodayState;
}

/** Days the week grid names, today included. */
const WEEK_DAYS = 7;

/** One column of the week, before any product has filled it. */
interface WeekDayFrame {
  localDate: string;
  dayLabel: string;
  isToday: boolean;
}

/**
 * The seven days the week grid covers, today first.
 *
 * Every row on that grid is built from this, so the rows cannot disagree about
 * which day is Tuesday.
 *
 * **Today is included, and its tide cell does repeat the card above it.** That
 * cost is real — the same time and the same height, twice within one screen,
 * and the grid's copy is the poorer of the two. It was weighed rather than
 * missed, and three things pay for it.
 *
 * The grid is a comparison task, and "is Tuesday better than today?" wants
 * today inside the comparison rather than carried across from a differently
 * formatted component. Marking the first column `Today` removes any chance of
 * reading `Tue, Aug 25` as the day the reader is standing in. And daylight is
 * not in the now-band at all: today's sunrise and sunset appear nowhere else on
 * the page, and they are what say whether today's lowest low falls before the
 * sun comes up — which is the question the tide time alone cannot answer.
 *
 * The alternative that removes the repetition properly is to lift daylight into
 * the now-band and start the week tomorrow. That changes the three-across
 * layout PR B settled and runs into `StatGroup`'s one-group-one-provenance
 * contract, since daylight is computed here and the tide is NOAA's. So it is
 * its own slice rather than a tweak to this one.
 */
function weekOfDays(nowMs: number): WeekDayFrame[] {
  const today = localDateOf(nowMs);
  return Array.from({ length: WEEK_DAYS }, (_, offset) => {
    const localDate = addLocalDays(today, offset);
    return {
      localDate,
      dayLabel: localDayLabel(localDate),
      isToday: localDate === today,
    };
  });
}

/**
 * Sunrise and sunset for each day of the week, keyed by that day's local date.
 *
 * **One computation, three readers.** The daylight row renders it, and the tide
 * and wave rows are now *selected* by it — each shows the extreme that falls
 * between these two instants. Three callers computing their own would be three
 * chances for the rows to disagree about when Tuesday's sun sets, which is
 * exactly the class of bug `weekOfDays` exists to prevent for dates.
 *
 * **A beach is reduced to its midpoint**, as `readDaylightWeek` has always done:
 * sunset differs by one minute across the entire county, so which end of a
 * shoreline segment you stand on is below the precision of the answer.
 *
 * **Nothing here can fail.** It is astronomy computed from coordinates the
 * inventory already holds, so constraining a NOAA reading or a CDIP forecast by
 * it adds no new way for either to go quiet. `daylightOn` throws only on a
 * latitude with no sunrise, which this county does not have.
 */
function daylightByDate(
  beach: Beach,
  nowMs: number,
): ReadonlyMap<string, Daylight> {
  const at = midpointOf(beach.segment);
  return new Map(
    weekOfDays(nowMs).map((frame) => [
      frame.localDate,
      daylightOn(frame.localDate, at),
    ]),
  );
}

/** `YYYY-MM-DD` to the `YYYYMMDD` CO-OPS wants. */
function compact(localDate: string): string {
  return localDate.replaceAll("-", "");
}

/**
 * The one window this page asks NOAA for, whichever read is asking.
 *
 * Both ends are slack, and each end's day is there for the same reason. The
 * request is made in GMT dates while the days on the page are Pacific days, so
 * a Pacific day straddles two GMT dates: a low late on the evening of the
 * week's last day falls on the GMT date after it, and a window ending on that
 * last day would clip it off. A day either side covers that in both directions.
 *
 * The dates are stepped with `addLocalDays` rather than by adding
 * milliseconds. Twice a year on this coast a day is twenty-three hours or
 * twenty-five, and a window assembled from 24-hour blocks near local midnight
 * lands a date short — which would silently drop the far end of the week on the
 * two days of the year nobody is testing on.
 */
function predictionsWindow(nowMs: number): {
  beginDate: string;
  endDate: string;
} {
  const today = localDateOf(nowMs);
  return {
    beginDate: compact(addLocalDays(today, -1)),
    endDate: compact(addLocalDays(today, WEEK_DAYS + 1)),
  };
}

/** The beach and the station bound to it, carried through a failure. */
interface TideBinding {
  beachName: string;
  station: { name: string; water: string; distanceM: number | null };
}

/**
 * What both tide reads get before they diverge.
 *
 * `no-station` keeps no binding because there is none — that is the state's
 * whole content.
 */
type TideWindowRead =
  | { kind: "no-station"; beachName: string; reason: string }
  | (TideBinding & { kind: "unavailable"; detail: string; drift: boolean })
  | (TideBinding & {
      kind: "ok";
      extremes: readonly TideExtreme[];
      /** Sunrise and sunset per day, which is what selects the figure each row leads with. */
      daylight: ReadonlyMap<string, Daylight>;
    });

/**
 * Bind the beach to its tide station and ask NOAA once for the shared window.
 *
 * Shared by the day read and the week read, and the sharing is the point rather
 * than a saving in lines: two callers computing their own ranges would be two
 * URLs, Next dedupes on the URL, and the page would reach NOAA twice per beach
 * where it reaches it once. Keeping the window in one function makes that
 * structural instead of a convention two call sites have to remember.
 *
 * Throws only when the slug is not in the inventory, which is a coding error
 * rather than a quiet feed. `caller` names which read asked, because by the
 * time this throws the stack is the least useful part of the message.
 */
async function readTideWindow(
  slug: string,
  nowMs: number,
  caller: string,
): Promise<TideWindowRead> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `${caller}: no beach in the inventory with slug "${slug}".`,
    );
  }

  const station = tideStationFor(beach);
  if (station === null) {
    return {
      kind: "no-station",
      beachName: beach.name,
      reason:
        beach.tide_station_null_reason ??
        "the join bound no tide station to this beach, and recorded no reason",
    };
  }

  const binding: TideBinding = {
    beachName: beach.name,
    station: {
      name: station.name,
      water: station.water,
      distanceM: beach.tide_station_distance_m,
    },
  };

  const result = await fetchTideExtremes({
    stationId: station.id,
    ...predictionsWindow(nowMs),
  });

  return result.kind === "unavailable"
    ? {
        ...binding,
        kind: "unavailable",
        detail: result.reason,
        drift: result.drift,
      }
    : {
        ...binding,
        kind: "ok",
        extremes: result.extremes,
        daylight: daylightByDate(beach, nowMs),
      };
}

/**
 * The two lows one day carries, or null when the run holds none for that date.
 *
 * The comparison is on the instant rather than the height, because two lows can
 * share a height to one decimal and are still two different times to leave the
 * house.
 */
function tideLowsOn(
  extremes: readonly TideExtreme[],
  localDate: string,
  daylight: Daylight,
): TideLows | null {
  const allDay = lowestLowOn(extremes, localDate);
  if (allDay === null) return null;

  const inDaylight = lowestLowBetween(
    extremes,
    daylight.sunriseMs,
    daylight.sunsetMs,
  );

  const reading = (extreme: TideExtreme): TideReading => ({
    timeLabel: localTimeOf(extreme.atMs),
    feet: extreme.feet,
  });

  return {
    daylight: inDaylight === null ? null : reading(inDaylight),
    allDay: inDaylight?.atMs === allDay.atMs ? null : reading(allDay),
  };
}

/**
 * Read today's lowest low tide for one beach.
 *
 * Asks for the whole week's window even though it reads one day out of it. That
 * looks wasteful and is the opposite: the week read next door wants the same
 * station and the same six-hour cache, and a narrower range here would be a
 * second URL and a second call to NOAA. See `predictionsWindow`.
 *
 * Throws only when the slug is not in the inventory. Everything an upstream can
 * do wrong, and every beach the join could not bind, arrives as a state instead.
 */
export async function readTodaysLowestLow(
  slug: string,
  nowMs: number = Date.now(),
): Promise<TideTodayView> {
  const read = await readTideWindow(slug, nowMs, "readTodaysLowestLow");

  if (read.kind === "no-station") {
    return {
      beachName: read.beachName,
      station: null,
      state: { kind: "no-station", reason: read.reason },
    };
  }

  const binding = { beachName: read.beachName, station: read.station };

  if (read.kind === "unavailable") {
    return {
      ...binding,
      state: {
        kind: "unavailable",
        detail: read.detail,
        drift: read.drift,
      },
    };
  }

  const localDate = localDateOf(nowMs);
  const lows = tideLowsOn(
    read.extremes,
    localDate,
    read.daylight.get(localDate)!,
  );

  return {
    ...binding,
    state:
      lows === null ? { kind: "no-low-today" } : { kind: "reading", ...lows },
  };
}

/**
 * One day of the week, as the grid renders it.
 *
 * `no-low` is a named absence rather than a missing entry, and the week is
 * always `TIDE_WEEK_DAYS` long for that reason: a short array would let a grid
 * draw six columns and say nothing at all about the seventh, which is the
 * silent failure this file's four-state model exists to prevent.
 */
export interface TideWeekDay {
  /** The Pacific calendar date, `YYYY-MM-DD`. */
  localDate: string;
  /** That date named for a reader, `Mon, Aug 17`. */
  dayLabel: string;
  /** True for the day the reader is standing in, so the grid reads no clock. */
  isToday: boolean;
  state: ({ kind: "reading" } & TideLows) | { kind: "no-low" };
}

/**
 * What the week grid's tide row renders.
 *
 * The three failure states are the same three the day view carries and mean the
 * same things — but they sit on the week rather than on a day, because a station
 * that cannot be reached is one fact about the feed and not seven facts about
 * seven days.
 */
export interface TideWeekView {
  beachName: string;
  /** null exactly when the state is `no-station`. */
  station: { name: string; water: string; distanceM: number | null } | null;
  state:
    | { kind: "week"; days: TideWeekDay[] }
    | { kind: "no-station"; reason: string }
    | { kind: "unavailable"; detail: string; drift: boolean };
}

/**
 * Read a week of lowest low tides for one beach, starting today.
 *
 * Why today is in the week, and what including it costs, is argued once in
 * `weekOfDays` rather than again here. What this read adds is that today's cell
 * agrees with the now-band above it by construction rather than by luck: same
 * station, same request, same day-selection rule.
 *
 * Throws only when the slug is not in the inventory.
 */
export async function readWeekOfLowestLows(
  slug: string,
  nowMs: number = Date.now(),
): Promise<TideWeekView> {
  const read = await readTideWindow(slug, nowMs, "readWeekOfLowestLows");

  if (read.kind === "no-station") {
    return {
      beachName: read.beachName,
      station: null,
      state: { kind: "no-station", reason: read.reason },
    };
  }

  const binding = { beachName: read.beachName, station: read.station };

  if (read.kind === "unavailable") {
    return {
      ...binding,
      state: { kind: "unavailable", detail: read.detail, drift: read.drift },
    };
  }

  const days: TideWeekDay[] = weekOfDays(nowMs).map((frame) => {
    const lows = tideLowsOn(
      read.extremes,
      frame.localDate,
      read.daylight.get(frame.localDate)!,
    );
    return {
      ...frame,
      state: lows === null ? { kind: "no-low" } : { kind: "reading", ...lows },
    };
  });

  return { ...binding, state: { kind: "week", days } };
}

/**
 * The nearest minute.
 *
 * `localTimeOf` formats the fields of an instant, which drops the seconds
 * rather than rounding them — so a sunrise computed at 06:18:32 would print as
 * 6:18 and every time on the daylight row would read up to a minute early. The
 * solar series behind it is good to about half a minute, so the minute is the
 * precision worth printing, and this is the one place that decides it.
 */
function toNearestMinute(atMs: number): number {
  return Math.round(atMs / 60_000) * 60_000;
}

/** One day of the week grid's daylight row. */
export interface DaylightWeekDay extends WeekDayFrame {
  /** Pacific wall-clock sunrise, already worded and rounded. */
  sunriseLabel: string;
  /** Pacific wall-clock sunset, already worded and rounded. */
  sunsetLabel: string;
}

/**
 * What the week grid's daylight row renders.
 *
 * **No failure states, and their absence is the content.** Every other view in
 * this file carries `no-station` and `unavailable` because every other view
 * depends on somebody else's instrument. This one is astronomy computed from
 * coordinates the inventory already holds, so there is no station to be missing
 * and no feed to be down. It is the row that still answers when NOAA does not,
 * which is also why the grid takes its columns from here.
 */
export interface DaylightWeekView {
  beachName: string;
  days: DaylightWeekDay[];
}

/**
 * Read a week of sunrise and sunset times for one beach, starting today.
 *
 * Synchronous, because nothing is fetched — see `lib/daylight.ts` for why
 * there is no sun API here and should not be.
 *
 * A beach is a shoreline segment everywhere else on this page, and here it is
 * reduced to its midpoint: sunset differs by one minute across the entire
 * county, so which end you stand on is below the precision of the answer.
 *
 * Throws only when the slug is not in the inventory, which is a coding error.
 */
export function readDaylightWeek(
  slug: string,
  nowMs: number = Date.now(),
): DaylightWeekView {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readDaylightWeek: no beach in the inventory with slug "${slug}".`,
    );
  }

  const daylight = daylightByDate(beach, nowMs);

  return {
    beachName: beach.name,
    days: weekOfDays(nowMs).map((frame) => {
      const { sunriseMs, sunsetMs } = daylight.get(frame.localDate)!;
      return {
        ...frame,
        sunriseLabel: localTimeOf(toNearestMinute(sunriseMs)),
        sunsetLabel: localTimeOf(toNearestMinute(sunsetMs)),
      };
    }),
  };
}

/**
 * What the waves view renders. The same three-way split as the tide, and for the
 * same reason: `no-buoy` is a permanent fact about a place, `unavailable` is a
 * transient fact about a feed.
 */
export type WavesState =
  | {
      kind: "reading";
      heightFt: number;
      periodS: number | null;
      directionDegT: number | null;
      waterTempF: number | null;
    }
  | {
      kind: "no-buoy";
      reason: string;
      /**
       * Whether a model answers for the waves here instead of a buoy.
       *
       * `no-buoy` used to mean one thing -- enclosed water, where swell does
       * not reach and nothing describes the waves at all. Since ADR-0019 it
       * means two, and they need opposite sentences: at a bay the card says no
       * wave figure is coming, and at these four it says the figure below is
       * modelled. Carried as a fact from the join rather than inferred from
       * whether a forecast happened to arrive, because CDIP having a bad day
       * must not make the card claim swell does not reach an open coast.
       */
      modelAnswersInstead: boolean;
    }
  | { kind: "unavailable"; detail: string; drift: boolean };

export interface WavesView {
  beachName: string;
  /** null exactly when the state is `no-buoy`. */
  buoy: { name: string; distanceM: number | null } | null;
  state: WavesState;
}

/**
 * Read the newest wave observation for one beach.
 *
 * Throws only when the slug is not in the inventory. A beach the join bound no
 * buoy to -- every bay, lagoon and inlet -- arrives as `no-buoy` without a
 * request being made, because there is nothing to ask.
 */
export async function readLatestWaves(
  slug: string,
  nowMs: number = Date.now(),
): Promise<WavesView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readLatestWaves: no beach in the inventory with slug "${slug}".`,
    );
  }

  const buoy = waveBuoyFor(beach);
  if (buoy === null) {
    return {
      beachName: beach.name,
      buoy: null,
      state: {
        kind: "no-buoy",
        reason:
          beach.wave_buoy_null_reason ??
          "the join bound no wave buoy to this beach, and recorded no reason",
        // A line bound to a beach with no buoy is the ADR-0019 case, and the
        // seed guarantees the pairing: a buoy is only ever dropped where a
        // qualifying line replaced it. Read from the binding rather than from
        // the reason string, which is prose meant for a reader.
        modelAnswersInstead: beach.mop_line !== null,
      },
    };
  }

  const binding = {
    beachName: beach.name,
    buoy: { name: buoy.name, distanceM: beach.wave_buoy_distance_m },
  };

  const result = await fetchLatestWave(buoy.id, nowMs);
  if (result.kind === "unavailable") {
    return {
      ...binding,
      state: {
        kind: "unavailable",
        detail: result.reason,
        drift: result.drift,
      },
    };
  }

  return {
    ...binding,
    state: {
      kind: "reading",
      heightFt: result.observation.heightFt,
      periodS: result.observation.periodS,
      directionDegT: result.observation.directionDegT,
      waterTempF: result.observation.waterTempF,
    },
  };
}

/**
 * The temperature-and-wind half of the panel. The same three-way split as the
 * tide and the waves, and for the same reason: `no-station` is a permanent fact
 * about a place, `unavailable` is a transient fact about a feed.
 *
 * Unlike the wave view, `no-station` is rare here rather than routine — every
 * beach binds a station because air reaches a lagoon, and the only beach without
 * one is the beach whose coordinates upstream publishes transposed.
 */
export type AirState =
  | {
      kind: "reading";
      airTempF: number | null;
      windMph: number | null;
      gustMph: number | null;
      windDirDegT: number | null;
    }
  | { kind: "no-station"; reason: string }
  | { kind: "unavailable"; detail: string; drift: boolean };

/**
 * The sky-and-visibility half, read at a different station and failing on its
 * own. Both fields come from one METAR, which is why they are one state: a
 * station publishes both or neither.
 */
export type SkyState =
  | {
      kind: "reading";
      /** Statute miles, or null when the bound station published none this hour. */
      visibilityMi: number | null;
      /** True when visibility is at METAR's ten-mile ceiling, so it is a floor. */
      visibilityAtCeiling: boolean;
      sky: string | null;
    }
  | { kind: "no-station"; reason: string }
  | { kind: "unavailable"; detail: string; drift: boolean };

export interface StationBinding {
  /** The station's display name: what the page calls it, never its callsign. */
  name: string;
  distanceM: number | null;
}

export interface AirView {
  beachName: string;
  /** Where temperature and wind were measured. null exactly when `air` is `no-station`. */
  airStation: StationBinding | null;
  /** Where sky and visibility were measured. null exactly when `sky` is `no-station`. */
  skyStation: StationBinding | null;
  air: AirState;
  sky: SkyState;
}

/**
 * Read the air at one beach, from the two stations that measure it.
 *
 * TWO PROVENANCES, FETCHED AND FAILED SEPARATELY. Temperature and wind come from
 * the nearest station standing in the marine layer at the shoreline, which is
 * often on the NDBC network; sky and visibility come from the nearest station
 * publishing them, which in this county is always an airport. Requiring one
 * station for all four is what bound La Jolla Shores to Miramar, ten kilometres
 * inland, where the air read 81 °F against the pier's 72 °F. See
 * docs/adr/0010-two-provenances-in-the-air-panel.md.
 *
 * The two halves fail independently on purpose. Withholding a measured shore
 * temperature because an airport ten kilometres away missed a minute would trade
 * the good reading for the irrelevant one. They are fetched concurrently for the
 * same reason they are separate: neither waits on the other.
 *
 * Throws only when the slug is not in the inventory, which is a coding error
 * rather than a quiet feed.
 */
export async function readLatestAir(
  slug: string,
  nowMs: number = Date.now(),
): Promise<AirView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readLatestAir: no beach in the inventory with slug "${slug}".`,
    );
  }

  const airStation = airStationFor(beach);
  const skyStation = skyStationFor(beach);

  const [air, sky] = await Promise.all([
    readAirHalf(beach, airStation, nowMs),
    readSkyHalf(beach, skyStation, nowMs),
  ]);

  return {
    beachName: beach.name,
    airStation:
      airStation === null
        ? null
        : {
            name: airStation.display_name,
            distanceM: beach.air_station_distance_m,
          },
    skyStation:
      skyStation === null
        ? null
        : {
            name: skyStation.display_name,
            distanceM: beach.sky_station_distance_m,
          },
    air,
    sky,
  };
}

/**
 * Temperature and wind, from whichever network the bound station is on.
 *
 * The dispatch is the station table's `network` field rather than a guess at the
 * id's shape: NDBC ids and NWS ids are both five characters and both uppercase,
 * so there is nothing in an id to read this from.
 */
async function readAirHalf(
  beach: Beach,
  station: (ObservationStation & { id: string }) | null,
  nowMs: number,
): Promise<AirState> {
  if (station === null) {
    return {
      kind: "no-station",
      reason:
        beach.air_station_null_reason ??
        "the join bound no air station to this beach, and recorded no reason",
    };
  }

  if (station.network === "ndbc") {
    const result = await fetchLatestNdbcAir(station.id, nowMs);
    if (result.kind === "unavailable") {
      return {
        kind: "unavailable",
        detail: result.reason,
        drift: result.drift,
      };
    }
    return {
      kind: "reading",
      airTempF: result.airTempF,
      windMph: result.windMph,
      gustMph: result.gustMph,
      windDirDegT: result.windDirDegT,
    };
  }

  const result = await fetchLatestObservation(station.id, nowMs);
  if (result.kind === "unavailable") {
    return { kind: "unavailable", detail: result.reason, drift: result.drift };
  }
  const { observation } = result;
  return {
    kind: "reading",
    airTempF: observation.airTempF,
    windMph: observation.windMph,
    gustMph: observation.gustMph,
    windDirDegT: observation.windDirDegT,
  };
}

/** Sky and visibility, always from an NWS airport: no other station has them. */
async function readSkyHalf(
  beach: Beach,
  station: (ObservationStation & { id: string }) | null,
  nowMs: number,
): Promise<SkyState> {
  if (station === null) {
    return {
      kind: "no-station",
      reason:
        beach.sky_station_null_reason ??
        "the join bound no observation station to this beach, and recorded no reason",
    };
  }

  const result = await fetchLatestObservation(station.id, nowMs);
  if (result.kind === "unavailable") {
    return { kind: "unavailable", detail: result.reason, drift: result.drift };
  }

  const { observation } = result;
  return {
    kind: "reading",
    visibilityMi: observation.visibilityMi,
    visibilityAtCeiling: observation.visibilityAtCeiling,
    sky: observation.sky,
  };
}

/* =========================================================================
 * The wave forecast the week grid reads, from CDIP MOP
 * ========================================================================= */

/** One estimate of the swell, worded for a reader. */
export interface WaveReading {
  /**
   * Pacific wall-clock time of the estimate, already worded.
   *
   * NOT a peak the model located to the minute. MOP publishes on a three-hour
   * grid, so this is the step that carried the largest height and the real peak
   * can sit up to ninety minutes either side of it. The tide row's time is a
   * turning point NOAA computed; this one is a bucket. `ConditionsNotes` says
   * so, because the two sit one above the other and look alike.
   */
  timeLabel: string;
  /** Significant wave height in feet. */
  heightFt: number;
  /** The period of the estimate that height came from, in seconds. */
  periodS: number;
}

/**
 * One day of the week grid's wave row: the swell a reader can be there for, and
 * the day's own if that is a different estimate.
 *
 * The same split as `TideLows`, for the same reason and with the same
 * invariants. `daylight` leads; `allDay` is present only when it is a different
 * estimate; a day with no estimates at all is not in the week rather than being
 * a day with two nulls.
 */
export interface WaveWeekDay extends WeekDayFrame {
  daylight: WaveReading | null;
  allDay: WaveReading | null;
}

/**
 * What the week grid's wave row renders.
 *
 * The same three-way split as the tide week, and the same reason: `no-line` is
 * a permanent fact about a place, `unavailable` is a transient fact about a
 * feed.
 *
 * `week` CARRIES ONLY THE DAYS THE FORECAST REACHES, which is where this
 * differs from `TideWeekView`. A tide prediction runs years ahead, so a short
 * tide week is a fault and is named `no-low`; a forecast that stops on Sunday
 * is a forecast doing what forecasts do. The grid draws no cell where a row has
 * none, which is exactly the shape a ragged row needs -- see `WeekGrid`.
 */
export interface WaveWeekView {
  beachName: string;
  /** null exactly when the state is `no-line`. */
  line: { id: string; distanceM: number | null } | null;
  state:
    | { kind: "week"; days: WaveWeekDay[] }
    | { kind: "no-line"; reason: string }
    | { kind: "unavailable"; detail: string; drift: boolean };
}

/**
 * The window this page asks CDIP for.
 *
 * A day of slack either side, for the reason `predictionsWindow` gives: the
 * request is made in UTC instants and the days on the page are Pacific days, so
 * a Pacific day straddles two UTC dates and a window ending on the week's last
 * day would clip its afternoon off. The dates are stepped with `addLocalDays`
 * rather than by adding milliseconds, because twice a year on this coast a day
 * is twenty-three hours or twenty-five.
 *
 * Slack costs nothing here. The whole forecast is about 6 KB and reaches only
 * ten days, so a window wider than the file returns the file; a window narrower
 * than the week would silently lose a column.
 */
function mopWindow(nowMs: number): { startIso: string; endIso: string } {
  const today = localDateOf(nowMs);
  return {
    startIso: `${addLocalDays(today, -1)}T00:00:00Z`,
    endIso: `${addLocalDays(today, WEEK_DAYS + 1)}T00:00:00Z`,
  };
}

/** Every estimate of each Pacific day, keyed by date, oldest first. */
function rowsByDate(
  rows: readonly MopWaveRow[],
): ReadonlyMap<string, MopWaveRow[]> {
  const byDate = new Map<string, MopWaveRow[]>();
  for (const row of rows) {
    const localDate = localDateOf(row.atMs);
    const standing = byDate.get(localDate);
    if (standing === undefined) byDate.set(localDate, [row]);
    else standing.push(row);
  }
  return byDate;
}

/**
 * The biggest of a run of estimates, or null when the run is empty.
 *
 * THE MAXIMUM RATHER THAN THE MEAN, and it is a consequential choice rather
 * than a cosmetic one: on two of ten sampled days the day's smallest and
 * largest estimates fell either side of one of `WavesToday`'s plain-language
 * bands, so the two statistics would describe the same day in different words.
 * The row's label names the selection so it is not a hidden judgement.
 *
 * Ties keep the earlier estimate. Strictly-greater rather than
 * greater-or-equal: the rows arrive oldest first, so this is deterministic, and
 * a reader planning a morning is better served by the earlier of two identical
 * heights.
 */
function biggestOf(rows: readonly MopWaveRow[]): MopWaveRow | null {
  let biggest: MopWaveRow | null = null;
  for (const row of rows) {
    if (biggest === null || row.heightFt > biggest.heightFt) biggest = row;
  }
  return biggest;
}

/**
 * The two estimates one day carries, or null when the forecast holds none for
 * that date.
 *
 * Compared on the instant rather than the height, for the reason `tideLowsOn`
 * gives: two steps can share a height to one decimal and are still two
 * different times to be at the beach.
 */
function waveReadingsOn(
  dayRows: readonly MopWaveRow[],
  daylight: Daylight,
): Pick<WaveWeekDay, "daylight" | "allDay"> | null {
  const allDay = biggestOf(dayRows);
  if (allDay === null) return null;

  const inDaylight = biggestOf(
    dayRows.filter(
      (row) => row.atMs >= daylight.sunriseMs && row.atMs <= daylight.sunsetMs,
    ),
  );

  const reading = (row: MopWaveRow): WaveReading => ({
    timeLabel: localTimeOf(row.atMs),
    heightFt: row.heightFt,
    periodS: row.periodS,
  });

  return {
    daylight: inDaylight === null ? null : reading(inDaylight),
    allDay: inDaylight?.atMs === allDay.atMs ? null : reading(allDay),
  };
}

/**
 * Read a week of wave forecasts for one beach, starting today.
 *
 * A SECOND WAVE READ BESIDE `readLatestWaves`, NOT A REPLACEMENT FOR IT. That
 * one is a measurement of now from an NDBC buoy; this is model output for the
 * week from CDIP. Both appear on the page for today, which is why the row
 * carries its own provenance -- see the ADR.
 *
 * Throws only when the slug is not in the inventory. A beach the join bound no
 * line to -- every bay, lagoon and sheltered beach -- arrives as `no-line`
 * without a request being made, because there is nothing to ask.
 */
export async function readWaveWeek(
  slug: string,
  nowMs: number = Date.now(),
): Promise<WaveWeekView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readWaveWeek: no beach in the inventory with slug "${slug}".`,
    );
  }

  const line = mopLineFor(beach);
  if (line === null) {
    return {
      beachName: beach.name,
      line: null,
      state: {
        kind: "no-line",
        reason:
          beach.mop_line_null_reason ??
          "the join bound no MOP line to this beach, and recorded no reason",
      },
    };
  }

  const binding = {
    beachName: beach.name,
    line: { id: line.id, distanceM: beach.mop_line_distance_m },
  };

  const result = await fetchMopForecast({
    lineId: line.id,
    ...mopWindow(nowMs),
  });
  if (result.kind === "unavailable") {
    return {
      ...binding,
      state: {
        kind: "unavailable",
        detail: result.reason,
        drift: result.drift,
      },
    };
  }

  const byDate = rowsByDate(result.forecast.rows);
  const daylight = daylightByDate(beach, nowMs);

  // The slack in the window and the forecast's own reach both put estimates
  // outside the seven columns. Building from `weekOfDays` rather than from the
  // rows is what keeps this row agreeing with the tide and daylight rows about
  // which day is Tuesday, and drops the rest.
  const days = weekOfDays(nowMs).flatMap((frame) => {
    const readings = waveReadingsOn(
      byDate.get(frame.localDate) ?? [],
      daylight.get(frame.localDate)!,
    );
    return readings === null ? [] : [{ ...frame, ...readings }];
  });

  return { ...binding, state: { kind: "week", days } };
}

/* =========================================================================
 * The week's cloud cover, from the beach's own forecast cell
 * ========================================================================= */

/** One day of the cloud row. */
export interface SkyWeekDay extends WeekDayFrame {
  /**
   * Mean cloud cover across the day's daylight hours, 0 to 100, rounded.
   *
   * A mean rather than an extreme, which is a deliberate departure from
   * ADR-0017 and the one place this row differs from the tide and swell rows
   * above it. Those take the daylight extreme because a lowest low at 3:14 AM
   * is a number nobody planning a trip with children can use -- the extreme is
   * selected for *reachability*. Cloud cover has no unreachable hours: the
   * daylight window is the trip. Measured over seven days at one cell, the
   * daylight spread runs 20 to 41 points, and taking the cloudiest step would
   * have reported 2026-08-30 at 62% against a daylight mean of 39%.
   */
  cloudPercent: number;
  /**
   * The phenomenon forecast for any daylight hour of this day, or null.
   *
   * This is what carries the "when" that ADR-0017's times carry for the rows
   * above: a parent plans around fog rather than around a percentage. Null on
   * most days, which is an ordinary day rather than a missing reading.
   */
  phenomenon: { weather: string; coverage: string | null } | null;
}

export interface SkyWeekView {
  beachName: string;
  /** null exactly when the state is `no-cell`. */
  cell: { id: string; elevationM: number | null } | null;
  state:
    | { kind: "week"; days: SkyWeekDay[] }
    | { kind: "no-cell"; reason: string }
    | { kind: "unavailable"; detail: string; drift: boolean };
}

/**
 * The daylight mean for one day, and the phenomenon if one was forecast.
 *
 * Returns null when no forecast hour falls in this day's daylight, which is
 * what the far end of the week does as the product's reach runs out. A day with
 * no hours is dropped rather than rendered as zero -- a zero here would read as
 * a cloudless day.
 */
function skyReadingOn(
  hours: readonly SkyCoverHour[],
  weather: readonly WeatherHour[],
  daylight: Daylight,
): { cloudPercent: number; phenomenon: SkyWeekDay["phenomenon"] } | null {
  const inDaylight = hours.filter(
    (hour) => hour.atMs >= daylight.sunriseMs && hour.atMs <= daylight.sunsetMs,
  );
  if (inDaylight.length === 0) return null;

  const total = inDaylight.reduce((sum, hour) => sum + hour.percent, 0);

  // The first phenomenon of the daylight window rather than the most common
  // one: "patchy fog" at 7 AM is the fact a parent is deciding on, and a day
  // with fog in the morning and sun after lunch is a foggy morning rather than
  // an average of the two.
  const named = weather.find(
    (hour) => hour.atMs >= daylight.sunriseMs && hour.atMs <= daylight.sunsetMs,
  );

  return {
    cloudPercent: Math.round(total / inDaylight.length),
    phenomenon:
      named === undefined
        ? null
        : { weather: named.weather, coverage: named.coverage },
  };
}

/**
 * The week's cloud cover for one beach.
 *
 * `nowMs` is injected for the reason every read here injects it: day selection
 * is asserted against fixed instants and no clock is read during a render.
 */
export async function readSkyWeek(
  slug: string,
  nowMs: number = Date.now(),
): Promise<SkyWeekView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readSkyWeek: no beach in the inventory with slug "${slug}".`,
    );
  }

  if (beach.grid_cell === null) {
    return {
      beachName: beach.name,
      cell: null,
      state: {
        kind: "no-cell",
        reason:
          beach.grid_cell_null_reason ??
          "the join bound no forecast cell to this beach, and recorded no reason",
      },
    };
  }

  const binding = {
    beachName: beach.name,
    cell: { id: beach.grid_cell, elevationM: beach.grid_cell_elevation_m },
  };

  const result = await fetchGridForecast(beach.grid_cell);
  if (result.kind === "unavailable") {
    return {
      ...binding,
      state: {
        kind: "unavailable",
        detail: result.reason,
        drift: result.drift,
      },
    };
  }

  const skyByDate = new Map<string, SkyCoverHour[]>();
  for (const hour of result.forecast.skyCover) {
    const localDate = localDateOf(hour.atMs);
    const standing = skyByDate.get(localDate);
    if (standing === undefined) skyByDate.set(localDate, [hour]);
    else standing.push(hour);
  }

  const weatherByDate = new Map<string, WeatherHour[]>();
  for (const hour of result.forecast.weather) {
    const localDate = localDateOf(hour.atMs);
    const standing = weatherByDate.get(localDate);
    if (standing === undefined) weatherByDate.set(localDate, [hour]);
    else standing.push(hour);
  }

  const daylight = daylightByDate(beach, nowMs);

  // Built from `weekOfDays` rather than from the forecast's own hours, so this
  // row cannot disagree with the tide, daylight and wave rows about which day
  // is Tuesday. Ragged by construction: the product reaches about seven and a
  // half days and the far column may have none.
  const days = weekOfDays(nowMs).flatMap((frame) => {
    const reading = skyReadingOn(
      skyByDate.get(frame.localDate) ?? [],
      weatherByDate.get(frame.localDate) ?? [],
      daylight.get(frame.localDate)!,
    );
    return reading === null ? [] : [{ ...frame, ...reading }];
  });

  return { ...binding, state: { kind: "week", days } };
}
