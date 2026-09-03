/**
 * Picking one day's lowest tide out of a run of predicted extremes.
 *
 * Pure, and deliberately separate from the parser: which day counts as "today"
 * is a question about the reader's clock and their zone, not about NOAA's
 * payload. Keeping it here means the day-selection rule can be tested against
 * fixed instants without a network or a frozen system clock.
 *
 * The rule is stated rather than implied, because two plausible readings differ
 * on the days that matter most. A day's lowest tide is the lowest **low**
 * whose instant falls on that local date -- not the lowest of all extremes, and
 * not the low nearest to noon. A day with two lows a foot apart is exactly the
 * day a tidepooling group needs the deeper one named.
 *
 * TWO SELECTIONS, NOT ONE, since the page began leading with the tide a reader
 * can actually reach. `lowestLowOn` answers "how low does it get today";
 * `lowestLowBetween` answers "how low does it get while the sun is up", which
 * is a different question and usually a different low. On this coast in summer
 * the deeper of the day's two lows falls before sunrise on most days, so the
 * two disagree far more often than they agree.
 */

import { localDateOf, SITE_TIME_ZONE } from "./pacific-time";
import type { TideExtreme } from "./coops-predictions";

/**
 * The lowest predicted low tide falling on `localDate`, or null when the run of
 * extremes contains none.
 *
 * Null means the window did not cover that date. It never means the tide does
 * not go out, and a caller must not render it as though it did.
 */
export function lowestLowOn(
  extremes: readonly TideExtreme[],
  localDate: string,
  timeZone: string = SITE_TIME_ZONE,
): TideExtreme | null {
  let lowest: TideExtreme | null = null;

  for (const extreme of extremes) {
    if (extreme.kind !== "low") continue;
    if (localDateOf(extreme.atMs, timeZone) !== localDate) continue;
    if (lowest === null || extreme.feet < lowest.feet) {
      lowest = extreme;
    }
  }

  return lowest;
}

/**
 * The lowest predicted low tide falling between two instants, or null when the
 * run contains none.
 *
 * **No local date, because the window already pins one.** A caller passes
 * sunrise and sunset for one day, and only that day's lows can fall between
 * them — so a second date filter would be a second way of saying the same
 * thing, and the two could disagree about which zone the date is in.
 *
 * **Both ends inclusive.** A low at the instant of sunrise is a low a reader
 * can stand in front of. The alternative excludes a reading for being exactly
 * on a boundary computed to the second from an ephemeris, which is precision
 * neither the sunrise nor the prediction has.
 *
 * Null means no low falls in the window. On this coast that is close to
 * unreachable — two lows about twelve and a half hours apart against ten to
 * fourteen hours of daylight — but it is a real state and never means the tide
 * did not go out.
 */
export function lowestLowBetween(
  extremes: readonly TideExtreme[],
  fromMs: number,
  toMs: number,
): TideExtreme | null {
  let lowest: TideExtreme | null = null;

  for (const extreme of extremes) {
    if (extreme.kind !== "low") continue;
    if (extreme.atMs < fromMs || extreme.atMs > toMs) continue;
    if (lowest === null || extreme.feet < lowest.feet) {
      lowest = extreme;
    }
  }

  return lowest;
}
