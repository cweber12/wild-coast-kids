/**
 * The geometry two plots of one day must agree about.
 *
 * `DaySpark` draws a day 240 units wide and `HourChart` draws it several times
 * larger, so almost nothing about their frames is shared -- but the *layers*
 * are, and ADR-0026 narrowed exactly what "shared" now means: the `SparkPoint`
 * type, and the night band. The cloud wash belongs to the chart alone.
 *
 * This module is the night band, in one place, so that sentence is literally
 * true rather than aspirational. ADR-0025's argument for hand-rolling every
 * plot was that sharing becomes enforceable when there is no library contract
 * in between for two components to satisfy differently; a shared function is
 * what that argument cashes out to.
 *
 * **Two bands rather than one, because a day starts and ends in the dark.** A
 * single band from sunset to sunrise would run off the right edge of one day
 * and belong to the next.
 *
 * **Clipped to the day, and empty rather than negative.** A band is dropped
 * when it has no width -- which is what a polar summer would produce, and what
 * a caller handing in a sunrise before its own day start would produce by
 * mistake. Returning a zero-width rect would draw an invisible element that
 * every test counting bands would then have to know about.
 */

/** One stretch of a day that is dark, already mapped into plot units. */
export interface NightBand {
  x: number;
  width: number;
  /** Which end of the day this is, and what `data-night` prints. */
  side: "before-dawn" | "after-dusk";
}

export interface DayBounds {
  /** Local midnight this day begins on. */
  startMs: number;
  /** Local midnight the next day begins on. */
  endMs: number;
  sunriseMs: number;
  sunsetMs: number;
}

const HOUR_MS = 3_600_000;

/**
 * Which hour of its day an instant falls in.
 *
 * **The one place the convention lives.** The chart draws the hours and the day
 * panel computes which one is now, so without a shared definition the two could
 * name one hour differently -- and the readout on the map reads the same value
 * again. That is this module's own argument applied past the night band: two
 * plots agreeing about a quantity is enforceable only when there is one
 * definition of it.
 *
 * It is here rather than beside the selection it feeds because the selection
 * module is `"use client"`, and the default is computed on the server. The
 * hour's definition is day geometry; which hour a reader chose is not.
 *
 * **It is an index into the day rather than a clock hour**, and on the two days
 * a year this coast changes offset the two diverge: `localMidnightOf` resolves
 * the zone offset twice, so a fall-back day is twenty-five hours long. The
 * chart's `hourLabel` reads this index as a clock hour and is wrong for it on
 * those days. That defect predates the sharing and is inherited here rather
 * than forked, so the two regions stay wrong together rather than
 * disagreeing -- see ADR-0035's last consequence.
 */
export function hourOfDay(atMs: number, dayStartMs: number): number {
  return Math.round((atMs - dayStartMs) / HOUR_MS);
}

/**
 * `0` to "12 AM", `13` to "1 PM". The axis speaks the reader's clock.
 *
 * **Here rather than in the chart, because the readout on the map names the
 * same hour.** `hourOfDay` is the one definition of which hour an instant falls
 * in and this is the one definition of what to call it, and the pair belongs
 * together for that function's own reason: the caption over the readout and the
 * label under the plot are how a reader sees that two regions are showing one
 * hour, and they can only be that if the words come from one place. `HourChart`
 * is `"use client"` and the caption is worded on the server, so a module both
 * can reach was the only place this could go in any case.
 *
 * **It reads its argument as a clock hour, which an index is not on the two
 * days a year this coast changes offset** -- see `hourOfDay` above. Inherited
 * rather than forked: the chart and the map are wrong together rather than
 * disagreeing, and the fix stays a single-site one.
 */
export function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/**
 * The dark ends of one day, in the caller's own plot units.
 *
 * `x` maps an instant to a horizontal position and `width` is the frame's, so
 * this function knows nothing about how big either plot is -- which is the
 * point. What it fixes is *where night is*, not how large it is drawn.
 */
export function nightBands(
  bounds: DayBounds,
  x: (atMs: number) => number,
  width: number,
): NightBand[] {
  const band = (
    fromMs: number,
    toMs: number,
    side: NightBand["side"],
  ): NightBand | null => {
    const from = Math.max(x(fromMs), 0);
    const to = Math.min(x(toMs), width);
    return to <= from ? null : { x: from, width: to - from, side };
  };

  return [
    band(bounds.startMs, bounds.sunriseMs, "before-dawn"),
    band(bounds.sunsetMs, bounds.endMs, "after-dusk"),
  ].filter((each): each is NightBand => each !== null);
}
