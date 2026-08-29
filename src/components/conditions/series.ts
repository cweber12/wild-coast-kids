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

import type {
  GridDaySeries,
  TideHourlyDay,
  WaveWeekDay,
} from "@/lib/conditions";
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

/**
 * Swell heights as a plot draws them, and the converter the paragraph above
 * was written for.
 *
 * **The flag is carried, never assumed.** CDIP publishes on a three-hour grid,
 * so eight points of a day are its own and the sixteen between them are a line
 * `readHourlyTide`'s neighbour drew — and the read is the only place that knows
 * which is which. Setting `published: true` here to match `tidePoints` would
 * make a three-hourly model and an hourly one draw the same twenty-four marks,
 * which is the single thing this flag exists to prevent.
 */
export function swellPoints(day: WaveWeekDay): SparkPoint[] {
  return day.hours.map((hour) => ({
    atMs: hour.atMs,
    value: hour.heightFt,
    published: hour.published,
  }));
}

/**
 * One of the forecast cell's series as a plot draws it.
 *
 * **The publisher's own instants, not the hours it was held across.** The
 * National Weather Service publishes intervals rather than hours -- one hour
 * near the present, three and six further out -- and `nws-gridpoint.ts` expands
 * them so a caller selecting a day does not have to reason about a block
 * straddling sunrise. The flag is what survives that expansion, so a chart
 * marks where the office put a point and not where this repo repeated one.
 *
 * A series the cell does not forecast converts to nothing rather than to a
 * curve, and the caller renders the parser's own reason. That absence is the
 * one this whole shape exists to keep distinguishable from a calm day: a flat
 * line at zero would say the wind drops to nothing, out of the fact that we
 * were not told.
 */
export function gridPoints(series: GridDaySeries): SparkPoint[] {
  return series.kind === "absent"
    ? []
    : series.hours.map((hour) => ({
        atMs: hour.atMs,
        value: hour.value,
        published: hour.published,
      }));
}
