/**
 * What one day's needles are made of, assembled from the series the page
 * already reads.
 *
 * The split is `shore.ts`'s, one instrument over: this half knows what a
 * gridpoint hour is and turns a day of them into a bearing and an arc;
 * `Compass` draws what it is handed and knows nothing about forecasts.
 * `bearing.ts` under both of them owns the circular arithmetic and knows
 * nothing about either.
 *
 * **Named for the needles rather than for the compass**, which is `shore.ts`
 * sitting beside `ShoreMap.tsx` under a different word rather than a different
 * case. `compass.ts` beside `Compass.tsx` is one file on a case-insensitive
 * filesystem: the imports resolved to each other on Windows, every test in the
 * drawing's suite failed with an undefined component, and Linux CI would have
 * passed the pair without noticing.
 *
 * **Daylight, not the whole day**, which is the design brief's word and is
 * doing real work rather than being a nicety. The committed gridpoint run
 * swings across north in its first three hours -- 340, 20, 150 -- and a day
 * measured end to end reports an arc no reader could have stood in. The plan's
 * rule for the week's figures is the same one: what a reader can be there for.
 */

import type { GridDaySeries, WaveHour } from "@/lib/conditions";
import { bearingSpread, resultantBearing } from "./bearing";
import type { WeightedBearing } from "./bearing";
import { hourOfDay } from "./dayFrame";

/** One needle: where it came from, and how far it moved while doing so. */
export type Needle = {
  /** Degrees true it comes *from*, weighted by how much there was. */
  fromDegT: number;
  /** The arc containing every direction it blew from in daylight. */
  spreadDeg: number;
};

/** The largest a series got while the sun was up, and the hour it did it. */
export type DaylightPeak = {
  atMs: number;
  value: number;
};

/** What the wind did at one hour, as the readout's row states it. */
export type HourlyWind = {
  /** Degrees true it came from at that hour. */
  fromDegT: number;
  /** How fast, or null where the cell gave a bearing and no speed. */
  mph: number | null;
};

/**
 * One of CDIP's own estimates, whole.
 *
 * **Three fields off one instant, which is the whole reason this type exists.**
 * `WaveHour` carries an interpolated height on every hour and a period and a
 * bearing only where CDIP issued one, so a row reading it field by field would
 * put this hour's height beside another hour's direction. Whatever holds one of
 * these holds an estimate the model published, entire.
 *
 * The nulls are checked once, where a `WaveHour` becomes one of these, so
 * nothing downstream re-checks them -- input is validated at the boundary and
 * the interior trusts it.
 */
export type PublishedSwell = {
  atMs: number;
  heightFt: number;
  periodS: number;
  directionDegT: number;
};

/**
 * How far an hour may stand from a published estimate and still be spoken for
 * by it.
 *
 * Ninety minutes, which is half of CDIP's three-hour step: each estimate owns
 * the three hours centred on itself and no hour is owned by two. It is the
 * window `ConditionsNotes` already explains to a reader -- a figure printed for
 * a step can sit up to ninety minutes off the real peak -- read the other way
 * round, and ADR-0035 is where the readout takes it up.
 */
const STEP_REACH_MS = 90 * 60_000;

/**
 * One day of the cell's wind, as bearings weighted by the speed at that hour.
 *
 * **Joined on the instant, never on position.** Both series come gapless out of
 * the same run today, so an index join would work and would put the wrong speed
 * against the wrong bearing the first time one of them was short -- the same
 * failure `readGridpointWeek` buckets by Pacific date to avoid rather than by
 * counting hours.
 *
 * An hour missing from either series is not in the answer. There is no bearing
 * to weight without a speed, and no speed to place without a bearing, and
 * inventing either would be a drawn needle standing on one number.
 */
export function gridWindReadings(
  directions: GridDaySeries,
  speeds: GridDaySeries,
  sunriseMs: number,
  sunsetMs: number,
): readonly WeightedBearing[] {
  if (directions.kind !== "published" || speeds.kind !== "published") return [];

  const speedAt = new Map(speeds.hours.map((hour) => [hour.atMs, hour.value]));

  const readings: WeightedBearing[] = [];
  for (const hour of directions.hours) {
    if (hour.atMs < sunriseMs || hour.atMs >= sunsetMs) continue;
    const speed = speedAt.get(hour.atMs);
    if (speed === undefined) continue;
    readings.push({ degreesTrue: hour.value, weight: speed });
  }
  return readings;
}

/**
 * One day of the swell, as bearings weighted by the height that came with them.
 *
 * **Only CDIP's own estimates**, which is the same distinction the swell curve
 * draws with a mark and this reads off `directionDegT` being null. Five hours
 * in every eight of that curve are a line this repo drew between two
 * published points: they carry a height, because a polyline needs one at every
 * hour, and no bearing, because halfway between 350 and 10 is not 180 and
 * pretending otherwise would put a needle on a number nobody issued.
 *
 * Weighted by height for the same reason the wind is weighted by speed: a
 * quarter-foot of leftover chop from the south should not pull the needle off
 * the four-foot north-west swell a reader came to find.
 */
export function swellReadings(
  hours: readonly WaveHour[],
  sunriseMs: number,
  sunsetMs: number,
): readonly WeightedBearing[] {
  const readings: WeightedBearing[] = [];
  for (const hour of hours) {
    if (hour.directionDegT === null) continue;
    if (hour.atMs < sunriseMs || hour.atMs >= sunsetMs) continue;
    readings.push({ degreesTrue: hour.directionDegT, weight: hour.heightFt });
  }
  return readings;
}

/**
 * What the wind was doing at each hour of this day the cell spoke for, keyed by
 * the hour's index into the day.
 *
 * **The whole day rather than the daylight window**, which is where this parts
 * company with `gridWindReadings` above. That function feeds the wedge, which
 * is a statement about a day and is daylight-bound for the reason the design
 * brief gives. This feeds the arrow, which is a statement about one hour a
 * reader chose -- and a reader who chooses 3 AM is owed 3 AM's wind rather than
 * silence (ADR-0035). At a night hour the arrow may therefore sit outside its
 * own wedge, which is a true thing about that hour.
 *
 * **An hour with a bearing and no speed is kept, where a weighted reading is
 * not.** The two are asked different questions: a weight of nothing cannot pull
 * a resultant, but an arrow with no figure beside it still says which way the
 * wind was blowing. `windFigure` words that absence and `CompassNeedle.figure`
 * carries it.
 *
 * Keyed by hour rather than by instant because the selection a reader makes is
 * an hour of a day, and `hourOfDay` is the one definition of which that is.
 */
export function windByHour(
  directions: GridDaySeries,
  speeds: GridDaySeries,
  dayStartMs: number,
): ReadonlyMap<number, HourlyWind> {
  const byHour = new Map<number, HourlyWind>();
  if (directions.kind !== "published") return byHour;

  const speedAt = new Map(
    speeds.kind === "published"
      ? speeds.hours.map((hour) => [hour.atMs, hour.value])
      : [],
  );

  for (const hour of directions.hours) {
    byHour.set(hourOfDay(hour.atMs, dayStartMs), {
      fromDegT: hour.value,
      mph: speedAt.get(hour.atMs) ?? null,
    });
  }
  return byHour;
}

/**
 * The published estimate each hour of this day is inside, keyed by the hour's
 * index into the day.
 *
 * **The nearest one within ninety minutes, and nothing outside that.** CDIP
 * publishes every three hours, so the hours between two estimates are one hour
 * from the nearer of them and two from the other; an hour with neither in reach
 * is an hour no estimate speaks for, and the readout withholds its swell row
 * there rather than reaching further. That happens at the start of a Pacific
 * day, whose last estimate belongs to the previous date, and inside a hole a
 * refused estimate left -- `hourlyWaveHeights` does not bridge those either.
 *
 * **The alternative was the last estimate at or before the hour**, which is
 * what the plan wrote. It is up to three hours stale where this is at most
 * ninety minutes, and it answers nothing at all at midnight and 1 AM.
 *
 * Ties keep the earlier estimate, which is `biggestOf`'s rule in `conditions.ts`
 * and cannot arise on a three-hour grid of whole hours anyway.
 *
 * **One object per estimate, shared by the three hours inside it.** They are
 * the same estimate rather than three copies of one, and the readout's rows are
 * built from that identity: what the map sends the browser is one attribution
 * per step rather than one per hour.
 */
export function swellStepByHour(
  hours: readonly WaveHour[],
  dayStartMs: number,
): ReadonlyMap<number, PublishedSwell> {
  const steps: PublishedSwell[] = [];
  for (const hour of hours) {
    if (!hour.published) continue;
    if (hour.periodS === null || hour.directionDegT === null) continue;
    steps.push({
      atMs: hour.atMs,
      heightFt: hour.heightFt,
      periodS: hour.periodS,
      directionDegT: hour.directionDegT,
    });
  }

  const byHour = new Map<number, PublishedSwell>();
  for (const hour of hours) {
    let nearest: PublishedSwell | null = null;
    let reach = Infinity;
    for (const step of steps) {
      const gap = Math.abs(step.atMs - hour.atMs);
      if (gap > STEP_REACH_MS || gap >= reach) continue;
      nearest = step;
      reach = gap;
    }
    if (nearest !== null) byHour.set(hourOfDay(hour.atMs, dayStartMs), nearest);
  }
  return byHour;
}

/**
 * The largest value this series reaches while the sun is up, or nothing.
 *
 * **The wind's answer to `WaveReading`**, and deliberately the same rule. CDIP
 * publishes a three-hour step and `readWaveWeek` selects the daylight one that
 * carried the largest height; the gridpoint publishes every hour and nothing
 * selects among them, so this does. Both figures are then the largest thing the
 * daylight window holds, which is what lets the two rows of the readout be
 * worded once instead of each explaining its own selection.
 *
 * **Daylight rather than the whole day**, for the reason `gridWindReadings`
 * gives above and `ADR-0023` gives for the week: a figure a reader cannot be
 * there for is not the figure they came for.
 *
 * **It answers with the hour rather than the figure**, because the figure has
 * moved into the wind's provenance line and a superlative there has to say when
 * it happened: "biggest in daylight" over a block showing 3 AM is a claim about
 * a different hour, and a reader cannot check it against the curve without
 * being told which. ADR-0035 records why the figure moved -- it is the page's
 * only statement of the day's biggest wind, and an hour instrument would
 * otherwise have dropped it.
 *
 * Ties keep the earlier hour, which is `biggestOf`'s rule in `conditions.ts`
 * and for its reason: a reader planning a morning is better served by the
 * earlier of two identical figures.
 *
 * `null` on an absent series and on a day whose daylight window the forecast
 * does not reach -- a ragged row is a forecast doing what forecasts do, and a
 * zero would be a drawn calm that nobody predicted.
 */
export function peakInDaylight(
  series: GridDaySeries,
  sunriseMs: number,
  sunsetMs: number,
): DaylightPeak | null {
  if (series.kind !== "published") return null;

  let peak: DaylightPeak | null = null;
  for (const hour of series.hours) {
    if (hour.atMs < sunriseMs || hour.atMs >= sunsetMs) continue;
    if (peak === null || hour.value > peak.value) {
      peak = { atMs: hour.atMs, value: hour.value };
    }
  }
  return peak;
}

/**
 * A day's readings as one needle, or nothing to draw.
 *
 * **Both numbers or neither.** An arc with no needle in it says the wind had a
 * range and then declines to say where in that range it mostly sat, which is
 * half an instrument and reads as a fault.
 *
 * One guard rather than two, and that is a finding rather than a style. Written
 * as two sequential checks, whichever came second could never fire: a resultant
 * implies a reading with something in it, which is exactly the condition a
 * spread exists under. Mutating the second check left every test passing, which
 * is how a branch that cannot be reached announces itself. This states the rule
 * the needle actually has -- both numbers or neither -- without relying on an
 * invariant proved in another module.
 */
export function needleFrom(
  readings: readonly WeightedBearing[],
): Needle | null {
  const fromDegT = resultantBearing(readings);
  const spreadDeg = bearingSpread(readings);
  if (fromDegT === null || spreadDeg === null) return null;

  return { fromDegT, spreadDeg };
}
