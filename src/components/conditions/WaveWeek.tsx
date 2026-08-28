/**
 * One day's biggest swell inside the daylight window, as the week grid prints
 * it.
 *
 * **The label is "Swell", and the selection it names is stated in the day
 * header.** A day has fifty-six three-hourly estimates behind it and this cell
 * shows one of them; which one is a judgement, and on two of ten sampled days
 * the day's smallest and largest fell either side of one of `WavesToday`'s
 * plain-language bands. ADR-0017 put that judgement in the label — "Biggest
 * daylight swell" — and the label never fitted: 187px against 125px of cell at
 * 1280 and 161px at 1536. ADR-0023 moves the daylight half of it into the
 * header, where it is said once for all three rows.
 *
 * **The day's own biggest is no longer here.** On the seven days measured on
 * 2026-08-26 it fell outside daylight on six of them — four of those at 11 PM
 * or 2 AM — which is what made the daylight estimate the one worth leading
 * with. It is not dropped from the site: `WavesToday` still prints "Biggest all
 * day" for today, the day view is where the other six are going, and
 * `WeekPanel` says so in a sentence beneath the grid.
 *
 * **The time leads, the way it does in every other row of this grid.** An
 * earlier draft led with the height, on the argument that a swell is a decision
 * about whether to go rather than when. That was wrong about what the grid is:
 * the tide row leads with the time of the lowest low, so a reader scanning down
 * one day reads "when, when" and then a cloud figure about the whole day, and a
 * row that opened with a number would break the column they are reading.
 *
 * **The time is a three-hour step, not a peak located to the minute.** MOP
 * publishes every three hours, so this is the step that carried the day's
 * largest height and the real peak can fall up to ninety minutes either side.
 * The tide time above it is a turning point NOAA computed, and the two look
 * alike in a column — which is why `ConditionsNotes` says which is which rather
 * than leaving a reader to assume they are the same kind of figure.
 *
 * **Whole seconds.** CDIP publishes the peak period as a float — 16.666668 —
 * because it is the reciprocal of a spectral frequency bin, not a measurement
 * to six decimal places. The buoy card beside this one prints whole seconds
 * because NDBC publishes whole seconds, and two wave products on one page
 * printing periods to different precisions would imply one of them is the more
 * exact.
 *
 * **One line, at every width**, with an interpunct between the two figures
 * rather than a space — "0.8 ft 5 s" is two numbers a reader has to separate,
 * and ` · ` is what `ProvenanceLine` already uses to separate facts in running
 * text. Measured: `11:00 AM 0.7 ft · 6 s` is 117px against 125px in the
 * narrowest seven-column cell the grid now has, and 189px at 1024. This is the
 * longest line in the cell and the one that decided seven columns could not
 * start before `xl`.
 *
 * **No cell where the forecast does not reach.** That is the caller's doing
 * rather than this component's: `readWaveWeek` returns only the days it has,
 * and `WeekGrid` draws no pair for a day a row has nothing for. A forecast that
 * stops on Sunday is a forecast, and a label sitting over a gap would read as
 * an instrument that failed.
 *
 * **No glyph, and no attribution here.** ADR-0015 for the first — a full-colour
 * emoji at 10px is a smudge rather than a mark — and `WeekGrid`'s single
 * provenance line for the second. Which model this came from is one fact about
 * a feed, printed once beneath the grid rather than seven times inside it.
 *
 * **A cell rather than a row**, for the reason `TideWeek` gives: the grid is
 * day-major, so a row is seven of these rather than one subtree.
 */

import type { WaveWeekDay } from "@/lib/conditions";

/** What every day of this row shares: the words that name it. */
export const WAVE_WEEK_ROW = {
  label: "Swell",
} as const;

export function WaveWeek({ day }: { day: Pick<WaveWeekDay, "daylight"> }) {
  if (day.daylight === null) {
    // No estimate between sunrise and sunset, which a ragged forecast can
    // produce. A named absence rather than a blank, for the reason `TideWeek`
    // gives: an empty cell in a forecast row reads as a flat, quiet day.
    return <span className="text-fog italic">None</span>;
  }

  return (
    <>
      {/*
        The space between the spans stays a text node. It is one line now, so
        nothing collapses it visually, but the accessible text would still run
        together as "2:00 PM0.8 ft" without it -- the same concatenation
        `ReadingCard` records hitting in the accessible-name algorithm.
      */}
      <span className="font-extrabold">{day.daylight.timeLabel}</span>{" "}
      <span className="text-fog">
        {day.daylight.heightFt.toFixed(1)} ft ·{" "}
        {Math.round(day.daylight.periodS)} s
      </span>
    </>
  );
}
