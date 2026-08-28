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
