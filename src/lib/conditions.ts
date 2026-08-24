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
  tideStationFor,
  waveBuoyFor,
  type ObservationStation,
  skyStationFor,
} from "./beaches";
import { daylightOn, midpointOf } from "./daylight";
import type { TideExtreme } from "./coops-predictions";
import {
  addLocalDays,
  localDateOf,
  localDayLabel,
  localTimeOf,
} from "./pacific-time";
import { lowestLowOn } from "./tide-day";
import {
  fetchLatestNdbcAir,
  fetchLatestObservation,
  fetchLatestWave,
  fetchTideExtremes,
} from "./upstream";

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
  | { kind: "reading"; timeLabel: string; feet: number }
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
  | (TideBinding & { kind: "ok"; extremes: readonly TideExtreme[] });

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
    : { ...binding, kind: "ok", extremes: result.extremes };
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

  const lowest = lowestLowOn(read.extremes, localDateOf(nowMs));
  return {
    ...binding,
    state:
      lowest === null
        ? { kind: "no-low-today" }
        : {
            kind: "reading",
            timeLabel: localTimeOf(lowest.atMs),
            feet: lowest.feet,
          },
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
  state:
    { kind: "reading"; timeLabel: string; feet: number } | { kind: "no-low" };
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
    const lowest = lowestLowOn(read.extremes, frame.localDate);
    return {
      ...frame,
      state:
        lowest === null
          ? { kind: "no-low" }
          : {
              kind: "reading",
              timeLabel: localTimeOf(lowest.atMs),
              feet: lowest.feet,
            },
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

  const at = midpointOf(beach.segment);

  return {
    beachName: beach.name,
    days: weekOfDays(nowMs).map((frame) => {
      const { sunriseMs, sunsetMs } = daylightOn(frame.localDate, at);
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
  | { kind: "no-buoy"; reason: string }
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
