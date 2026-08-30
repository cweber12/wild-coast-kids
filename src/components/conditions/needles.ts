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

/** One needle: where it came from, and how far it moved while doing so. */
export type Needle = {
  /** Degrees true it comes *from*, weighted by how much there was. */
  fromDegT: number;
  /** The arc containing every direction it blew from in daylight. */
  spreadDeg: number;
};

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
