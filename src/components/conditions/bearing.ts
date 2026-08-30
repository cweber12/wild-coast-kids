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
