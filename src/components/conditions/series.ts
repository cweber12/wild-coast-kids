/**
 * Turning a read's own day shape into the points a plot draws.
 *
 * One conversion per product, in one place, because two plots now draw the same
 * series: the week's sparkline and the day's chart. `ProvenanceLine`'s docstring
 * records what this repo's second call site usually costs -- the page printed
 * "San Diego Airport · 4.7 km from this beach" and "San Diego Airport · 4.7 km
 * away" eighty pixels apart -- and a series converter drifting would be worse
 * than wording, because the two plots would disagree about the data rather than
 * about a sentence.
 *
 * **`published` is where the honesty is.** It says whether the publisher issued
 * a value for that instant or whether the curve between two of theirs is ours.
 * Only published points are marked, so an hourly product and a three-hourly one
 * cannot look alike. Every converter here must set it from what the feed
 * actually sent, never to a convenient constant.
 */

import type { TideHourlyDay } from "@/lib/conditions";
import type { SparkPoint } from "./DaySpark";

/**
 * Hourly heights as a plot draws them.
 *
 * Every point is NOAA's own and none is interpolated, which is why `published`
 * is true throughout: `interval=h` returns a value for each hour rather than a
 * sparse series this site fills in. The swell converter beside this one will
 * not be able to say the same, and that difference is the thing the marks
 * exist to show.
 */
export function tidePoints(day: TideHourlyDay): SparkPoint[] {
  return day.hours.map((hour) => ({
    atMs: hour.atMs,
    value: hour.feet,
    published: true,
  }));
}
