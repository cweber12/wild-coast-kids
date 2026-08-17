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
