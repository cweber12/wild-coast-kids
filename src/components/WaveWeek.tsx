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
 * **The time leads, the way it does in every other row of this grid.** An
 * earlier draft led with the height, on the argument that a swell is a decision
 * about whether to go rather than when. That was wrong about what the grid is:
 * the tide row leads with the time of the lowest low and the daylight row with
 * sunrise, so a reader scanning down one day reads "when, when, when" and then
 * a fourth row that opened with a number would break the column they are
 * reading. The height and the period follow on the line beneath, which is the
 * shape `TideWeek` and `DaylightWeek` already share.
 *
 * **The time is a three-hour step, not a peak located to the minute.** MOP
 * publishes every three hours, so this is the step that carried the day's
 * largest height and the real peak can fall up to ninety minutes either side.
 * The tide time above it is a turning point NOAA computed, and the two look
 * alike in a column — which is why `ConditionsNotes` says which is which rather
 * than leaving a reader to assume they are the same kind of figure.
 *
 * **Whole seconds.** CDIP publishes the peak period as a float -- 16.666668 --
 * because it is the reciprocal of a spectral frequency bin, not a measurement
 * to six decimal places. The buoy card beside this one prints whole seconds
 * because NDBC publishes whole seconds, and two wave products on one page
 * printing periods to different precisions would imply one of them is the more
 * exact.
 *
 * **Two lines at `lg`, one below it**, and an interpunct between the two
 * figures rather than a space -- "0.8 ft 5 s" is two numbers a reader has to
 * separate, and ` · ` is what `ProvenanceLine` already uses to separate facts
 * in running text. Measured at 1280: the second line sets to about 12
 * characters against a 124px cell, inside the budget `DaylightWeek` recorded
 * when nineteen characters wrapped there.
 *
 * The break is scoped to `lg` for the reason that cell records: it exists to
 * keep seven columns aligned across, and there are only seven columns at `lg`.
 * Below it a day is a full-width row, nothing wraps, and forcing the break
 * bought nothing and cost 35px a day.
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
  day: Pick<WaveWeekDay, "timeLabel" | "heightFt" | "periodS">;
}) {
  return (
    <>
      {/*
        The space between the two spans stays, for the reason `DaylightWeek`
        records: two blocks collapse it visually and it is still a text node,
        and without it the accessible text runs together as "2:00 PM0.8 ft".
      */}
      <span className="font-extrabold lg:block">{day.timeLabel}</span>{" "}
      <span className="text-fog lg:block">
        {day.heightFt.toFixed(1)} ft · {Math.round(day.periodS)} s
      </span>
    </>
  );
}
