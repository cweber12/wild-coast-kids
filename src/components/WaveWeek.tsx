/**
 * One day's biggest swell, as the week grid prints it.
 *
 * **The label names the selection, and that is not a stylistic choice.** A day
 * has fifty-six three-hourly estimates behind it and this cell shows one of
 * them; which one is a judgement, and on two of ten sampled days the day's
 * smallest and largest fell either side of one of `WavesToday`'s plain-language
 * bands. "Biggest swell" is the same contract `TideWeek`'s "Lowest tide" makes,
 * for the same reason: a superlative stated is a superlative a reader can
 * discount, and a bare number is one they cannot.
 *
 * **Height leads, period supports.** The opposite order to `TideWeek`, and
 * deliberately: a tide is a plan about when to leave the house, so its time
 * leads. A swell is a plan about whether to go at all, so its height does. The
 * period is what tells a surfer whether that height is groundswell or chop, and
 * it is the second thing either reader wants.
 *
 * **Whole seconds.** CDIP publishes the peak period as a float -- 16.666668 --
 * because it is the reciprocal of a spectral frequency bin, not a measurement
 * to six decimal places. The buoy card beside this one prints whole seconds
 * because NDBC publishes whole seconds, and two wave products on one page
 * printing periods to different precisions would imply one of them is the more
 * exact.
 *
 * **No cell where the forecast does not reach.** That is the caller's doing
 * rather than this component's: `readWaveWeek` returns only the days it has, and
 * `WeekGrid` draws no pair for a day a row has nothing for. A forecast that
 * stops on Sunday is a forecast, and a label sitting over a gap would read as an
 * instrument that failed.
 *
 * **No glyph, and no attribution here.** ADR-0015 for the first -- a full-colour
 * emoji at 10px is a smudge rather than a mark -- and `WeekGrid`'s single
 * provenance line for the second. Which model this came from is one fact about
 * a feed, printed once beneath the grid rather than seven times inside it.
 *
 * **A cell rather than a row**, for the reason `TideWeek` gives: the grid is
 * day-major, so a row is seven of these rather than one subtree.
 */

import type { WaveWeekDay } from "@/lib/conditions";

/** What every day of this row shares: the words that name it. */
export const WAVE_WEEK_ROW = {
  label: "Biggest swell",
} as const;

export function WaveWeek({
  day,
}: {
  day: Pick<WaveWeekDay, "heightFt" | "periodS">;
}) {
  return (
    <>
      <span className="font-extrabold">{day.heightFt.toFixed(1)} ft</span>{" "}
      <span className="text-fog">{Math.round(day.periodS)} s</span>
    </>
  );
}
