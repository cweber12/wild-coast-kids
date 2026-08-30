/**
 * How this page says a direction.
 *
 * **One vocabulary, because two would be visible on one screen.** The measured
 * air card has worded a bearing since it was written, and the compass on the
 * shore map words two more a few hundred pixels away. A page that called 281
 * degrees "west" beside a needle calling it "west-northwest" would be reporting
 * a disagreement it does not have — which is the drift `CONTEXT.md`'s glossary
 * exists to prevent, arriving through a helper rather than through a term.
 *
 * Lifted out of `MeasuredToday` unchanged when the compass needed it. Its own
 * module rather than an export from that component, because a component
 * exporting a helper makes the second caller depend on the first one's file.
 */

/**
 * Eight points, not sixteen.
 *
 * The design brief's example accessible name reads "wind from the
 * west-northwest, 281 degrees", which is a sixteen-point rose. This is eight,
 * because eight is what the air card has always printed and the two sit on one
 * page: adding the finer rose for the needles would either say "west" and
 * "west-northwest" about the same wind in two places, or change the card's
 * words as a side effect of building a compass.
 *
 * What the finer rose was for is the precision, and the degrees carry that
 * already — every place these words are spoken states the bearing beside them.
 */
const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

/**
 * Plain words for a direction in degrees true.
 *
 * Every feed this page reads publishes the direction the wind or the swell
 * comes *from*, which is why every caller says "from the". Naming it as the
 * direction it travels towards would reverse every reading on the page.
 *
 * The modulo is not defensive: 359 rounds to the ninth bucket, and without it
 * the page prints "from the undefined".
 */
export function compassWords(degreesTrue: number): string {
  return COMPASS[Math.round(degreesTrue / 45) % 8];
}

/**
 * One hour's direction, and how much of the thing there was to have one.
 *
 * **The weight is what stops a dead hour voting.** A gridpoint publishes a wind
 * direction for every hour whether or not there is any wind, so a 0 mph
 * pre-dawn bearing is a number the model had to emit rather than a direction
 * anybody could have felt. Weighting by speed is the standard resultant-wind
 * treatment and it is also the honest one here: the needle then points where
 * the wind mostly came from rather than where the average of its labels lies.
 *
 * The caller says what the weight is -- miles per hour for the wind, feet of
 * significant height for the swell -- because the two feeds measure different
 * things and neither function needs to know which.
 */
export type WeightedBearing = {
  /** Degrees true, the direction it comes *from*. */
  degreesTrue: number;
  /** How much there was. Zero or less takes the reading out of the answer. */
  weight: number;
};

/**
 * Below this, the readings have cancelled and there is no resultant to draw.
 *
 * Compared against the total weight rather than as an absolute, so it means the
 * same thing for a 2 mph day and a 20 mph one. It is a floating-point guard,
 * not a judgement about weak winds: two exactly opposed hours sum to about
 * 1e-16 of their own weight, and every real day is many orders above it.
 */
const CANCELLED = 1e-9;

/** Everything with something in it, which is what both answers are built from. */
function carrying(
  readings: readonly WeightedBearing[],
): readonly WeightedBearing[] {
  return readings.filter((reading) => reading.weight > 0);
}

/**
 * Where these hours mostly came from, weighted by how much there was.
 *
 * **Vectors, not an average of the numbers**, and that is the whole of it:
 * bearings are angles on a circle, so 340 and 20 average to 180 -- due south,
 * the exact reverse of the answer -- under any arithmetic that treats them as
 * quantities. Summing unit vectors and taking the angle back off the sum is the
 * circular mean, and it wraps because the circle does.
 *
 * `null` when there is nothing to average, or when the hours cancel: a day that
 * blew equally from the east and the west has no resultant direction, and
 * drawing one would be inventing the answer the data declined to give.
 */
export function resultantBearing(
  readings: readonly WeightedBearing[],
): number | null {
  const carried = carrying(readings);
  if (carried.length === 0) return null;

  let x = 0;
  let y = 0;
  let total = 0;
  for (const { degreesTrue, weight } of carried) {
    const radians = (degreesTrue * Math.PI) / 180;
    x += weight * Math.cos(radians);
    y += weight * Math.sin(radians);
    total += weight;
  }

  if (Math.hypot(x, y) / total < CANCELLED) return null;

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * The smallest arc that contains every one of these bearings.
 *
 * **Found by looking for the emptiest part of the circle**, not by sorting and
 * subtracting: 350 and 10 are twenty degrees apart, and the difference of the
 * sorted values says 340. The widest gap between neighbours is the part of the
 * dial nothing blew from, so what is left over is the arc that holds them all.
 *
 * Unweighted, unlike the needle, because this is the envelope rather than the
 * average -- an hour that happened is inside the range whether it was a strong
 * hour or a weak one. It uses the same `weight > 0` filter for the same reason
 * the needle does: a calm hour has no direction to be inside the range.
 *
 * `null` when there is nothing to measure, and 0 for a single bearing or for a
 * day that never shifted.
 */
export function bearingSpread(
  readings: readonly WeightedBearing[],
): number | null {
  const carried = carrying(readings);
  if (carried.length === 0) return null;

  const sorted = carried
    .map(({ degreesTrue }) => ((degreesTrue % 360) + 360) % 360)
    .sort((a, b) => a - b);

  /*
    The gap that closes the circle is measured on its own and without a modulo.
    Taking it as `(first - last + 360) % 360` reads 0 when every bearing is the
    same, which makes the widest gap 0 and the arc the whole dial -- a day that
    never shifted reported as a day that blew from everywhere.
  */
  let widestGap = sorted[0] + 360 - sorted[sorted.length - 1];
  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const gap = sorted[index + 1] - sorted[index];
    if (gap > widestGap) widestGap = gap;
  }

  return 360 - widestGap;
}
