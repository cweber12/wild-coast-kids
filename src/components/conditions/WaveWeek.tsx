/**
 * One day's biggest swell inside the daylight window, as the week grid prints
 * it.
 *
 * **The label is "Biggest swell", and the half of the selection it drops is
 * stated in the day header.** A day has fifty-six three-hourly estimates behind
 * it and this cell shows one of them; which one is a judgement, and on two of
 * ten sampled days the day's smallest and largest fell either side of one of
 * `WavesToday`'s plain-language bands. So the superlative has to be in the
 * label: "Swell" over a single figure invites a reader to take it for the
 * day's typical swell, which is the one thing it is not.
 *
 * What the label does not have to carry is the window, because the header
 * states it. ADR-0017 put both in — "Biggest daylight swell" — and it rendered
 * 187px against 133px of cell at 1280, so it wrapped at every width the grid
 * has had. "Biggest swell" is 112px and fits.
 *
 * **The day's own biggest is no longer here.** On the seven days measured on
 * 2026-08-26 it fell outside daylight on six of them — four of those at 11 PM
 * or 2 AM — which is what made the daylight estimate the one worth leading
 * with. It is not dropped from the site: the day view below draws CDIP's whole
 * curve for whichever day is chosen, night included, so an 11 PM peak is there
 * as a shape on every day rather than as a figure on one. `WeekPanel` says so
 * in a sentence beneath the grid.
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
 * **The two figures are worded by `swellFigure`, not here**, because the shore
 * map's readout prints the same `WaveReading` — the same three-hour step,
 * selected once by `readWaveWeek` — a screen away. Two call sites each wording
 * one fact is what `ProvenanceLine`'s docstring records the cost of, and here
 * the cost would be the grid and the map stating different numbers for
 * Thursday. That helper carries the reasons that used to be written here: whole
 * seconds, because CDIP publishes the period as the reciprocal of a spectral
 * frequency bin and the buoy card beside this prints whole seconds; and an
 * interpunct rather than a space, because "0.8 ft 5 s" is two numbers a reader
 * has to separate.
 *
 * **One line, at every width.** Measured: `11:00 AM 0.7 ft · 6 s` is 117px
 * against 125px in the narrowest seven-column cell the grid now has, and 189px
 * at 1024. This is the longest line in the cell and the one that decided seven
 * columns could not start before `xl`.
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
import { swellFigure } from "./mopLine";
import { SWELL_TONE } from "./weekTone";

/** What every day of this row shares: the words that name it, and its colour. */
export const WAVE_WEEK_ROW = {
  label: "Biggest swell",
  tone: SWELL_TONE,
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
      <span className="text-fog">{swellFigure(day.daylight)}</span>
    </>
  );
}
