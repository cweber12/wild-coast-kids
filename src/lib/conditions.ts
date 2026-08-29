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
} from "./beaches";
import { type Daylight, daylightOn, midpointOf } from "./daylight";
import type { TideExtreme, TideHeight } from "./coops-predictions";
import {
  addLocalDays,
  localDateOf,
  localDateLabel,
  localDayLabel,
  localMidnightOf,
  localTimeOf,
} from "./pacific-time";
import { lowestLowBetween, lowestLowOn } from "./tide-day";
import type { MopWaveRow } from "./mop-forecast";
import type {
  GridpointHour,
  GridpointSeries,
  SkyCoverHour,
  WeatherHour,
} from "./nws-gridpoint";
import type { ForecastPeriod } from "./nws-forecast";
import {
  fetchGridForecast,
  fetchHourlyTide,
  fetchSkyWording,
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

/** Days the week grid names, today included. */
const WEEK_DAYS = 7;

/** One column of the week, before any product has filled it. */
interface WeekDayFrame {
  localDate: string;
  dayLabel: string;
  /** The same date with no weekday, for the column that carries a "Today" chip. */
  dateLabel: string;
  isToday: boolean;
}

/**
 * The seven days the week grid covers, today first.
 *
 * Every row on that grid is built from this, so the rows cannot disagree about
 * which day is Tuesday.
 *
 * **Today is included, and it no longer repeats anything.** It used to: a tide
 * card above the grid printed the same time and the same height, twice within
 * one screen, and the cost was weighed rather than missed. The card came off
 * the page with the rest of the three-across band, and what argued for
 * including today anyway is what is left.
 *
 * The grid is a comparison task, and "is Tuesday better than today?" wants
 * today inside the comparison rather than carried across from a differently
 * formatted component. Marking the first column `Today` removes any chance of
 * reading `Tue, Aug 25` as the day the reader is standing in. And today's
 * sunrise and sunset appear nowhere else on the page, and they are what say
 * whether today's lowest low falls before the sun comes up — which is the
 * question the tide time alone cannot answer.
 */
function weekOfDays(nowMs: number): WeekDayFrame[] {
  const today = localDateOf(nowMs);
  return Array.from({ length: WEEK_DAYS }, (_, offset) => {
    const localDate = addLocalDays(today, offset);
    return {
      localDate,
      dayLabel: localDayLabel(localDate),
      dateLabel: localDateLabel(localDate),
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
 * The beach, its tide station and the words for having neither.
 *
 * Split out from `readTideWindow` when a third read arrived that wants the same
 * station and a different interval. Which station a beach reads, and what it
 * means when the join bound none, is one fact about the place — three reads
 * deciding it separately is three chances to word the same absence three ways,
 * which is the drift `ProvenanceLine` and `mopLine.ts` already record.
 *
 * Throws only when the slug is not in the inventory, which is a coding error
 * rather than a quiet feed. `caller` names which read asked, because by the
 * time this throws the stack is the least useful part of the message.
 */
function bindTideStation(
  slug: string,
  caller: string,
):
  | { kind: "no-station"; beachName: string; reason: string }
  | { kind: "bound"; beach: Beach; stationId: string; binding: TideBinding } {
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

  return {
    kind: "bound",
    beach,
    stationId: station.id,
    binding: {
      beachName: beach.name,
      station: {
        name: station.name,
        water: station.water,
        distanceM: beach.tide_station_distance_m,
      },
    },
  };
}

/**
 * Bind the beach to its tide station and ask NOAA once for the shared window.
 *
 * Shared by the day read and the week read, and the sharing is the point rather
 * than a saving in lines: two callers computing their own ranges would be two
 * URLs, Next dedupes on the URL, and the page would reach NOAA twice per beach
 * where it reaches it once. Keeping the window in one function makes that
 * structural instead of a convention two call sites have to remember.
 *
 * The hourly read next door is the one exception, and it is not a leak:
 * `interval` is part of the URL, so a height on every hour cannot come back in
 * the same response as the turning points however the window is arranged.
 *
 * Throws only when the slug is not in the inventory.
 */
async function readTideWindow(
  slug: string,
  nowMs: number,
  caller: string,
): Promise<TideWindowRead> {
  const bound = bindTideStation(slug, caller);
  if (bound.kind === "no-station") return bound;

  const { beach, binding } = bound;

  const result = await fetchTideExtremes({
    stationId: bound.stationId,
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
 * Why today is in the week is argued once in `weekOfDays` rather than again
 * here. What this read adds is that every one of the seven days is selected by
 * the same rule from one station and one request, so no column can disagree
 * with another about what a lowest low is.
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
 * One day's worth of hourly tide heights, and what that day spans.
 *
 * **The window is carried rather than derived**, and that is what keeps a curve
 * honest. A consumer handed only the hours would have to take the first and the
 * last as the ends of the day, which stretches a series that starts at 3 AM
 * across the whole width and draws a morning that was never predicted. It also
 * cannot be recovered by adding 24 hours to midnight: twice a year on this
 * coast a day is twenty-three hours or twenty-five.
 */
export interface TideHourlyDay extends WeekDayFrame {
  /** Local midnight this day begins on, epoch milliseconds UTC. */
  startMs: number;
  /** Local midnight the next day begins on, which is this day's end. */
  endMs: number;
  /**
   * Every predicted hour falling on this Pacific date, oldest first.
   *
   * **Empty is a real state and never a flat day.** The far end of the week can
   * fall outside the window this page asks NOAA for, and a consumer must render
   * that as a named absence rather than as a line at zero — a drawn zero is a
   * stronger claim than a missing figure, because a curve says the sea did
   * something rather than that we did not ask.
   */
  hours: readonly TideHeight[];
}

/**
 * What a drawn week of tide needs. The same three states the week's figures
 * carry, meaning the same things, for the reason `TideWeekView` gives: a
 * station that cannot be reached is one fact about the feed and not seven facts
 * about seven days.
 */
export interface TideHourlyView {
  beachName: string;
  /** null exactly when the state is `no-station`. */
  station: { name: string; water: string; distanceM: number | null } | null;
  state:
    | { kind: "week"; days: TideHourlyDay[] }
    | { kind: "no-station"; reason: string }
    | { kind: "unavailable"; detail: string; drift: boolean };
}

/**
 * Read a week of hourly tide heights for one beach, starting today.
 *
 * The shape a curve is drawn from, where `readWeekOfLowestLows` is the shape a
 * figure is printed from. Both exist because they answer different questions:
 * the figure a week cell leads with is a turning point, and reading it off this
 * series would round 3:13 PM to 3:00 PM and 1.6 ft to whatever the hour
 * happened to be. **ADR-0023's selected figure is untouched by this read** —
 * the hours are what the figure is selected out of, and are drawn behind it.
 *
 * All seven days are returned whether or not the window reached them, following
 * `readWeekOfLowestLows`: a short array would let a grid draw six columns and
 * say nothing at all about the seventh.
 *
 * Throws only when the slug is not in the inventory.
 */
export async function readHourlyTide(
  slug: string,
  nowMs: number = Date.now(),
): Promise<TideHourlyView> {
  const bound = bindTideStation(slug, "readHourlyTide");

  if (bound.kind === "no-station") {
    return {
      beachName: bound.beachName,
      station: null,
      state: { kind: "no-station", reason: bound.reason },
    };
  }

  const { binding } = bound;

  const result = await fetchHourlyTide({
    stationId: bound.stationId,
    ...predictionsWindow(nowMs),
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

  // Bucketed by the Pacific date each hour falls on, not by position. The
  // request is made in GMT dates and answered in GMT instants, so the first
  // seven rows are not the first seven hours of any day on this page.
  const byDate = new Map<string, TideHeight[]>();
  for (const height of result.heights) {
    const localDate = localDateOf(height.atMs);
    const standing = byDate.get(localDate);
    if (standing === undefined) byDate.set(localDate, [height]);
    else standing.push(height);
  }

  const days: TideHourlyDay[] = weekOfDays(nowMs).map((frame) => ({
    ...frame,
    startMs: localMidnightOf(frame.localDate),
    endMs: localMidnightOf(addLocalDays(frame.localDate, 1)),
    hours: byDate.get(frame.localDate) ?? [],
  }));

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
  /**
   * The same two instants, unrounded.
   *
   * The labels are for reading and these are for drawing: a plot that shaded
   * night from a formatted string would have to parse it back, and the day
   * spark needs the boundary to the millisecond it was computed at rather than
   * to the minute it is printed at. Both come from one `daylightOn` call, so
   * the shaded edge and the printed time cannot disagree about when the sun
   * came up.
   */
  sunriseMs: number;
  sunsetMs: number;
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
  /**
   * The instant these days were computed from -- "now", as the render saw it.
   *
   * Carried out rather than left for a consumer to ask a clock for, because a
   * component that called `Date.now()` would be reading one during render:
   * impure, refused by this repo's lint rules, and untestable without faking
   * time. The day chart's "now" line is the only thing that wants it so far,
   * and it wants exactly this instant -- the one the days themselves were
   * derived from -- so that the line cannot land on a day the array does not
   * think is today.
   *
   * It is this read that carries it because this is the read that cannot fail.
   * A "now" that arrived with the tide would vanish when NOAA did.
   */
  atMs: number;
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
    atMs: nowMs,
    days: weekOfDays(nowMs).map((frame) => {
      const { sunriseMs, sunsetMs } = daylight.get(frame.localDate)!;
      return {
        ...frame,
        sunriseLabel: localTimeOf(toNearestMinute(sunriseMs)),
        sunsetLabel: localTimeOf(toNearestMinute(sunsetMs)),
        sunriseMs,
        sunsetMs,
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

export interface StationBinding {
  /** The station's display name: what the page calls it, never its callsign. */
  name: string;
  distanceM: number | null;
}

export interface AirView {
  beachName: string;
  /** Where temperature and wind were measured. null exactly when `air` is `no-station`. */
  airStation: StationBinding | null;
  air: AirState;
}

/**
 * Read the air at one beach, from the station that measures it.
 *
 * ONE PROVENANCE NOW, AND THAT IS THE POINT OF ADR-0020 RATHER THAN A
 * SIMPLIFICATION. This read had two halves: temperature and wind from the
 * nearest station standing in the marine layer at the shoreline, often on the
 * NDBC network, and sky and visibility from the nearest station publishing
 * them, which in this county is always an airport. The sky half is gone. Its
 * figures were measured at a median of 7.9 km and beyond 10 km for 20 of the 45
 * beaches, and `docs/reference/sensor-representativeness.md` §7 holds that
 * ceiling and visibility do not transfer off an aerodrome at any distance.
 * Cloud now reaches the reader as a forecast for the beach's own grid cell, in
 * the week grid, where it is labelled a forecast.
 *
 * WHAT ADR-0010 ARGUED IS NOT UNDONE BY THIS. Its point was that requiring one
 * station for all four values let the scarcest of them decide where the
 * temperature was measured -- which bound La Jolla Shores to Miramar, ten
 * kilometres inland, where the air read 81 °F against the pier's 72 °F. The
 * remedy was to stop the sky binding from dragging the air one, and dropping
 * the sky binding entirely keeps that property rather than reversing it. The
 * station this reads is still the shore station ADR-0010 introduced.
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
  const air = await readAirHalf(beach, airStation, nowMs);

  return {
    beachName: beach.name,
    airStation:
      airStation === null
        ? null
        : {
            name: airStation.display_name,
            distanceM: beach.air_station_distance_m,
          },
    air,
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
 * One hour of a drawn swell series.
 *
 * **`published` is the whole reason this is not a `TideHeight`.** NOAA answers
 * `interval=h` with a height for every hour, so every point of a tide curve is
 * its own; CDIP publishes on a three-hour grid, so five hours in every eight
 * here are a line this repo drew between two of theirs. The flag is what lets a
 * plot mark one and not the other, which is the difference between showing a
 * reader the model's resolution and telling them about it.
 */
export interface WaveHour {
  /** Start of the hour, epoch milliseconds UTC. */
  atMs: number;
  /** Significant wave height in feet, CDIP's own or interpolated between two. */
  heightFt: number;
  /** True when CDIP issued an estimate for this instant. */
  published: boolean;
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
  /**
   * Every hour of this day the forecast covers, oldest first, for the day
   * chart's swell tab.
   *
   * **The whole day, where `daylight` and `allDay` are selections out of it** —
   * the same relationship `TideHourlyDay.hours` has to the figure ADR-0023
   * selects, and the reason the curve does not reverse that decision. It is
   * built across the run rather than from this day's own rows, because in
   * Pacific time CDIP's grid lands at 02:00 and the hours before it are
   * interpolated from the previous day's last estimate.
   *
   * Ragged rather than padded: the far end of the week runs out of forecast,
   * and a padded hour would be a drawn zero.
   */
  hours: readonly WaveHour[];
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
 * How far apart CDIP's estimates stand, and therefore how wide a gap this repo
 * is willing to draw across.
 *
 * Three hours. The committed fixture publishes at 00, 03, 06, 09, 12, 15, 18
 * and 21 UTC without exception, and MOP's own documentation calls it a
 * three-hour grid. It is named here rather than derived from the run because a
 * run whose middle was flagged out would derive the wrong cadence from its own
 * damage — which is exactly the case this constant exists to catch.
 */
const MOP_STEP_MS = 3 * 3_600_000;

/**
 * The run as hourly points: CDIP's own estimates, and the hours between them.
 *
 * **A gap wider than the grid is not bridged.** `flaggedOut` counts estimates
 * this repo refused, and refusing one leaves a six- or nine-hour hole in the
 * run. Filling it would put a value on every hour of a stretch the model said
 * nothing usable about, and the day chart would let a reader select one and
 * read it off. The curve still crosses the hole — a polyline joins whatever it
 * is given, and the same is true of the tide — but nothing inside it claims a
 * figure.
 *
 * **The hours are whole hours of Pacific time and that is not a coincidence.**
 * The grid is UTC and this coast's offset is a whole number of hours, so every
 * published estimate already lands on the hour a reader's clock shows. Nothing
 * here rounds an instant; if that offset ever stopped being whole, the
 * published points would simply keep their own instants and the interpolated
 * ones would fall between them.
 */
function hourlyWaveHeights(rows: readonly MopWaveRow[]): WaveHour[] {
  const hours: WaveHour[] = [];

  rows.forEach((row, index) => {
    hours.push({ atMs: row.atMs, heightFt: row.heightFt, published: true });

    const next = rows[index + 1];
    if (next === undefined) return;

    const spanMs = next.atMs - row.atMs;
    if (spanMs <= 0 || spanMs > MOP_STEP_MS) return;

    for (let atMs = row.atMs + 3_600_000; atMs < next.atMs; atMs += 3_600_000) {
      const through = (atMs - row.atMs) / spanMs;
      hours.push({
        atMs,
        heightFt: row.heightFt + (next.heightFt - row.heightFt) * through,
        published: false,
      });
    }
  });

  return hours.sort((a, b) => a.atMs - b.atMs);
}

/** Every hour of the interpolated run, keyed by the Pacific date it falls on. */
function waveHoursByDate(
  hours: readonly WaveHour[],
): ReadonlyMap<string, WaveHour[]> {
  const byDate = new Map<string, WaveHour[]>();
  for (const hour of hours) {
    const localDate = localDateOf(hour.atMs);
    const standing = byDate.get(localDate);
    if (standing === undefined) byDate.set(localDate, [hour]);
    else standing.push(hour);
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

  // Interpolated across the whole run and bucketed after, not bucketed and
  // interpolated per day. In Pacific time the grid lands at 02:00, so a day's
  // first two hours are drawn from the previous day's last estimate and a
  // per-day pass would leave every morning short.
  const hoursByDate = waveHoursByDate(hourlyWaveHeights(result.forecast.rows));

  // The slack in the window and the forecast's own reach both put estimates
  // outside the seven columns. Building from `weekOfDays` rather than from the
  // rows is what keeps this row agreeing with the tide and daylight rows about
  // which day is Tuesday, and drops the rest.
  const days = weekOfDays(nowMs).flatMap((frame) => {
    const readings = waveReadingsOn(
      byDate.get(frame.localDate) ?? [],
      daylight.get(frame.localDate)!,
    );
    return readings === null
      ? []
      : [
          {
            ...frame,
            ...readings,
            hours: hoursByDate.get(frame.localDate) ?? [],
          },
        ];
  });

  return { ...binding, state: { kind: "week", days } };
}

/* =========================================================================
 * The week's cloud cover, from the beach's own forecast cell
 * ========================================================================= */

/**
 * Mean cloud cover for each third of one day's daylight window, 0 to 100.
 *
 * **Thirds of the window, not named clock hours.** "Morning" is not a fact
 * about the sky, and any boundary drawn at 11 AM would be this site inventing
 * one; the window is already computed here from the beach's own coordinates,
 * so dividing it is arithmetic rather than judgement. It also tracks the
 * season: a 13-hour August window gives roughly 6:20-10:40, 10:40-3:00,
 * 3:00-7:20, and a 10-hour December one narrows all three together.
 *
 * **A third can be null**, which is why these are not plain numbers. The
 * forecast does not reach backwards: on the day the reader is standing in, the
 * hours before now are gone and the first third is often empty. A null says
 * "no forecast covered it", and rendering a zero there would say "cloudless".
 */
export interface SkyThirds {
  /** The first third of the daylight window. */
  am: number | null;
  /** The middle third. */
  mid: number | null;
  /** The last third, ending at sunset. */
  eve: number | null;
}

/** One day of the cloud row. */
export interface SkyWeekDay extends WeekDayFrame {
  /**
   * Cloud cover across the day, in three parts.
   *
   * **Means rather than extremes, which is a deliberate departure from
   * ADR-0017** and the one place this row differs from the tide and swell rows
   * above it. Those take the daylight extreme because a lowest low at 3:14 AM
   * is a number nobody planning a trip with children can use -- the extreme is
   * selected for *reachability*. Cloud cover has no unreachable hours: the
   * daylight window is the trip.
   *
   * **Three parts rather than one, because on this coast one is misleading.**
   * The row shipped a single daylight mean, and measured against the live cell
   * on 2026-08-28 every one of seven days was a marine-layer burn-off: Sunday
   * ran 65% / 32% / 31% and averaged to 46%, a figure that describes neither
   * half of the day. A parent deciding whether to drive out after breakfast is
   * asking exactly the question the mean destroys. See ADR-0024.
   */
  thirds: SkyThirds;
  /**
   * Every forecast hour falling on this day, daylight and dark alike.
   *
   * **The whole day, where `thirds` is the daylight window.** The thirds answer
   * "what is the sky doing while the trip is happening"; these are a background
   * layer washed across a plot that spans midnight to midnight, and a wash that
   * stopped at sunrise would leave the shaded half of the frame claiming
   * nothing was forecast there.
   *
   * Ragged rather than padded. An hour the forecast did not reach is simply
   * absent, which is what lets a consumer draw silence differently from a clear
   * sky.
   */
  hours: readonly SkyCoverHour[];
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

/** The mean of some hours, rounded, or null when there are none to average. */
function meanPercent(hours: readonly SkyCoverHour[]): number | null {
  if (hours.length === 0) return null;
  const total = hours.reduce((sum, hour) => sum + hour.percent, 0);
  return Math.round(total / hours.length);
}

/**
 * The day's cloud in three parts, and the phenomenon if one was forecast.
 *
 * Returns null when no forecast hour falls in this day's daylight at all,
 * which is what the far end of the week does as the product's reach runs out.
 * A day with no hours is dropped rather than rendered as zeroes -- a zero here
 * would read as a cloudless day, which is the specific failure this row exists
 * to avoid.
 *
 * A day with *some* hours keeps them and nulls the thirds it cannot fill. That
 * is the ordinary state of today's column: the forecast does not reach
 * backwards, so the hours before now are gone.
 *
 * The boundaries are open at the top and closed at the bottom, so an hour
 * landing exactly on a boundary belongs to the later third and no hour is
 * counted twice. Sunset itself is included, which is why the last comparison
 * is the only one that is not strict.
 */
function skyReadingOn(
  hours: readonly SkyCoverHour[],
  weather: readonly WeatherHour[],
  daylight: Daylight,
): { thirds: SkyThirds; phenomenon: SkyWeekDay["phenomenon"] } | null {
  const inDaylight = hours.filter(
    (hour) => hour.atMs >= daylight.sunriseMs && hour.atMs <= daylight.sunsetMs,
  );
  if (inDaylight.length === 0) return null;

  const third = (daylight.sunsetMs - daylight.sunriseMs) / 3;
  const firstEndsMs = daylight.sunriseMs + third;
  const secondEndsMs = daylight.sunriseMs + third * 2;

  // The first phenomenon of the daylight window rather than the most common
  // one: "patchy fog" at 7 AM is the fact a parent is deciding on, and a day
  // with fog in the morning and sun after lunch is a foggy morning rather than
  // an average of the two.
  const named = weather.find(
    (hour) => hour.atMs >= daylight.sunriseMs && hour.atMs <= daylight.sunsetMs,
  );

  return {
    thirds: {
      am: meanPercent(inDaylight.filter((hour) => hour.atMs < firstEndsMs)),
      mid: meanPercent(
        inDaylight.filter(
          (hour) => hour.atMs >= firstEndsMs && hour.atMs < secondEndsMs,
        ),
      ),
      eve: meanPercent(inDaylight.filter((hour) => hour.atMs >= secondEndsMs)),
    },
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
    const hours = skyByDate.get(frame.localDate) ?? [];
    const reading = skyReadingOn(
      hours,
      weatherByDate.get(frame.localDate) ?? [],
      daylight.get(frame.localDate)!,
    );
    return reading === null ? [] : [{ ...frame, hours, ...reading }];
  });

  return { ...binding, state: { kind: "week", days } };
}

/* =========================================================================
 * The week's wind and air temperature, from the same forecast cell
 * ========================================================================= */

/**
 * One of the cell's series for one day: the hours, or the reason there are
 * none.
 *
 * **Two absences that must not be collapsed.** `absent` is the parser's word
 * for a series this cell does not forecast at all — declared and empty, which
 * is what `visibility` does at every cell on every request. An empty `hours`
 * inside `published` is a day the run did not reach, which is a forecast doing
 * what forecasts do. A plot owes a different sentence to each, and a plot that
 * drew a flat line at zero for either would make the strongest claim available
 * out of the weakest fact it had.
 */
export type GridDaySeries =
  | { kind: "published"; hours: readonly GridpointHour[] }
  | { kind: "absent"; reason: string };

/** One day of the cell's wind and air temperature. */
export interface GridpointWeekDay extends WeekDayFrame {
  /** Wind speed in miles per hour. */
  windMph: GridDaySeries;
  /** Air temperature in Fahrenheit. */
  airTempF: GridDaySeries;
}

/**
 * What the day chart's wind and temperature tabs are drawn from.
 *
 * **A sibling of `readSkyWeek` rather than a field on it**, and the split is
 * ADR-0020's rather than a preference. That decision took the sky off the air
 * card because requiring one source to supply every value let the scarcest of
 * them decide for the rest; a `SkyWeekView` carrying the wind would put the
 * same coupling back one layer up, under a name that says sky.
 *
 * **It costs no second request.** `fetchGridForecast` is a `next.revalidate`
 * fetch for a URL this page already asks for, so the two reads share one
 * response and one outage. What they do not share is a shape: this one is
 * ragged per series, where the cloud row is ragged per day.
 */
export interface GridpointWeekView {
  beachName: string;
  /** null exactly when the state is `no-cell`. */
  cell: { id: string; elevationM: number | null } | null;
  state:
    | { kind: "week"; days: GridpointWeekDay[] }
    | { kind: "no-cell"; reason: string }
    | { kind: "unavailable"; detail: string; drift: boolean };
}

/** One series' hours, bucketed by the Pacific date each falls on. */
function gridHoursByDate(
  series: GridpointSeries,
): ReadonlyMap<string, GridpointHour[]> {
  const byDate = new Map<string, GridpointHour[]>();
  if (series.kind === "absent") return byDate;
  for (const hour of series.hours) {
    const localDate = localDateOf(hour.atMs);
    const standing = byDate.get(localDate);
    if (standing === undefined) byDate.set(localDate, [hour]);
    else standing.push(hour);
  }
  return byDate;
}

/**
 * One day's slice of one series, keeping the parser's absence where there is
 * one.
 *
 * A cell that does not forecast the wind does not forecast it on Tuesday
 * either, so the reason is repeated on every day rather than being hoisted to
 * the view: the consumer draws one day at a time and the sentence has to be
 * where it is read.
 */
function gridDaySeries(
  series: GridpointSeries,
  byDate: ReadonlyMap<string, GridpointHour[]>,
  localDate: string,
): GridDaySeries {
  return series.kind === "absent"
    ? series
    : { kind: "published", hours: byDate.get(localDate) ?? [] };
}

/**
 * Read a week of the cell's wind and air temperature for one beach.
 *
 * **Every day is returned, including the ones with no hours**, which is
 * `readHourlyTide`'s treatment rather than `readSkyWeek`'s. The cloud row draws
 * no cell where it has nothing; a day chart always has a day to draw and owes
 * the reader a sentence about the tab they chose.
 *
 * Throws only when the slug is not in the inventory.
 */
export async function readGridpointWeek(
  slug: string,
  nowMs: number = Date.now(),
): Promise<GridpointWeekView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readGridpointWeek: no beach in the inventory with slug "${slug}".`,
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

  const windByDate = gridHoursByDate(result.forecast.windMph);
  const tempByDate = gridHoursByDate(result.forecast.airTempF);

  const days = weekOfDays(nowMs).map((frame) => ({
    ...frame,
    windMph: gridDaySeries(
      result.forecast.windMph,
      windByDate,
      frame.localDate,
    ),
    airTempF: gridDaySeries(
      result.forecast.airTempF,
      tempByDate,
      frame.localDate,
    ),
  }));

  return { ...binding, state: { kind: "week", days } };
}

/** One day of the publisher's own wording for the sky. */
export interface SkyWordingDay extends WeekDayFrame {
  /**
   * The publisher's own name for the period these words describe.
   *
   * Printed beside the words rather than dropped, because it is what makes the
   * fallback below honest: on a day whose daytime half has already ended, the
   * reader is told they are reading "Tonight" and not this afternoon.
   */
  periodName: string;
  /** True when this is the daylight half of the publisher's own day. */
  isDaytime: boolean;
  /**
   * The forecaster's own words, exactly as published.
   *
   * "Patchy Fog then Mostly Sunny". Never reworded, never banded, never
   * shortened: ADR-0009 forbids this site forming a forecaster's judgement, and
   * ADR-0024 measured a computed band word disagreeing with this very field on
   * three days of six.
   */
  words: string;
}

/**
 * What the day panel's sky line needs.
 *
 * The same three states the cloud row carries, meaning the same things, for the
 * reason `SkyWeekView` gives: a cell that cannot be reached is one fact about
 * the feed and not seven facts about seven days. It is a **separate** view from
 * `SkyWeekView` rather than a field on it, because it comes from a separate
 * request that fails separately -- which is the second outage path ADR-0024
 * named as the cost of taking this read at all.
 *
 * **A union, rather than a `cell` that may be null beside any state.** The
 * views beside this one carry "null exactly when the state is `no-cell`" as a
 * comment and leave the compiler unable to help. A consumer then writes a null
 * check for a case that cannot arise, and that unreachable branch is dead code
 * the coverage floor is right to refuse -- which is exactly how this type came
 * to be written this way. Saying it in the type costs nothing and deletes the
 * check. The older views are left alone: moving them is a refactor with its own
 * reasons, not a side effect of this one.
 */
export type SkyWordingView =
  | {
      beachName: string;
      cell: { id: string; elevationM: number | null };
      state:
        | { kind: "week"; days: SkyWordingDay[] }
        | { kind: "unavailable"; detail: string; drift: boolean };
    }
  | {
      beachName: string;
      cell: null;
      state: { kind: "no-cell"; reason: string };
    };

/**
 * The period whose words a day should be described by.
 *
 * **The daytime half, and the night half only when the daytime one has gone.**
 * A day panel is about a trip, and a trip happens in the day. But the product
 * does not run backwards: by evening, today's daytime period has dropped out of
 * the payload and only "Tonight" remains. Returning nothing then would put a
 * named absence on a day the National Weather Service has perfectly good words
 * for; returning the night period silently would print "Patchy Fog" as though
 * it described the afternoon. So the period is returned with its own name, and
 * the panel prints that name.
 *
 * Null when no period covers the day at all, which is what the far end of the
 * week does as the product's reach runs out.
 */
function wordingOn(periods: readonly ForecastPeriod[]): ForecastPeriod | null {
  if (periods.length === 0) return null;
  return periods.find((period) => period.isDaytime) ?? periods[0];
}

/**
 * The week's forecast wording for one beach, from the publisher's own words.
 *
 * **This is ADR-0024's deferred read, taken where it said it should be.** That
 * decision printed three cloud means and deliberately computed no band word,
 * because banding the mean on the National Weather Service's own scale
 * contradicted the National Weather Service on three days of six. It named
 * `shortForecast` as the right answer and deferred it: "a day view is planned
 * that will want that read anyway, and taking it once, in the shape that view
 * needs, is better than taking it twice." This is that view and this is that
 * shape.
 *
 * A second request to the same agency, and therefore a second outage. It fails
 * apart from `readSkyWeek` on purpose: the numbers and the words are separate
 * products, and a day when the office has issued one and not the other must
 * show the one it has.
 *
 * `nowMs` is injected for the reason every read here injects it: day selection
 * is asserted against fixed instants and no clock is read during a render.
 */
export async function readSkyWording(
  slug: string,
  nowMs: number = Date.now(),
): Promise<SkyWordingView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readSkyWording: no beach in the inventory with slug "${slug}".`,
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

  const result = await fetchSkyWording(beach.grid_cell);
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

  // Bucketed by the Pacific date each period *starts* on, which is what puts
  // "Saturday Night" on Saturday rather than on Sunday. A night period runs
  // past midnight by construction, so bucketing by its end would move every
  // one of them a day forward.
  const byDate = new Map<string, ForecastPeriod[]>();
  for (const period of result.forecast.periods) {
    const localDate = localDateOf(period.startMs);
    const standing = byDate.get(localDate);
    if (standing === undefined) byDate.set(localDate, [period]);
    else standing.push(period);
  }

  // Built from `weekOfDays` rather than from the payload's own periods, so this
  // line cannot disagree with the rows above it about which day is Tuesday.
  // Ragged like the cloud row: a day the product did not reach is dropped, and
  // the panel says so rather than being handed an empty string to print.
  const days = weekOfDays(nowMs).flatMap((frame) => {
    const period = wordingOn(byDate.get(frame.localDate) ?? []);
    return period === null
      ? []
      : [
          {
            ...frame,
            periodName: period.name,
            isDaytime: period.isDaytime,
            words: period.shortForecast,
          },
        ];
  });

  return { ...binding, state: { kind: "week", days } };
}
