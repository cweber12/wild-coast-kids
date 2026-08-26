/**
 * One day's lowest low tide, as the week grid prints it.
 *
 * **A row in a day-major grid is not a subtree, so this is a cell rather than a
 * row.** `WeekGrid` renders seven day blocks and each block asks every product
 * for its figure, which is what makes the grid transpose with one CSS property
 * and read day-then-values to a screen reader. The tide "row" is therefore
 * seven instances of this component, and `TIDE_WEEK_ROW` carries the identity
 * they share so the label and the glyph live beside the thing they label.
 *
 * **Timing leads, height supports.** The same order `TideToday` argues for and
 * for the same reason: a parent plans around when to leave the house, and the
 * height is what separates a good tidepooling day from an ordinary one rather
 * than the number they are looking for first.
 *
 * **The daylight low leads, and the day's lowest follows it.** The row used to
 * print the day's lowest low full stop, which on this coast in summer is before
 * sunrise on most days -- six of the seven measured on 2026-08-26. That is a
 * real prediction and a useless plan, and the page left the reader to notice it
 * by checking the daylight row two lines down. Now the row does that itself and
 * still says what it passed over, because a -0.2 ft at 3:14 AM is exactly the
 * figure a tidepooler willing to set an alarm wants to know exists.
 *
 * **The second line is always two lines at `lg`, whichever branch it takes.**
 * "all day" is broken onto its own line there for the reason `DaylightWeek`
 * records: a cell whose height depends on which branch it took puts every row
 * beneath it out of line with its neighbours, and a grid whose rows do not line
 * up across is a table pretending. Below `lg` a day is a full-width row, so the
 * break is scoped and the line reads as one sentence.
 *
 * **"None lower" rather than a repeat.** When the day's lowest low does fall in
 * daylight the two figures are the same reading, and printing it twice would
 * read as a fault rather than as agreement.
 *
 * **An absent day says so.** `no-low` means the range we asked NOAA for did not
 * cover that date — a fact about our request, never about the sea. Rendered as
 * words because a blank cell in a tide row reads as a calm, flat day, which is
 * the failure this whole page is built to avoid.
 *
 * **What is not here is a caveat per cell.** Which station these predictions
 * come from, how far away it is and what the datum means are all said once, on
 * the card above and in the notes block below, and both are on this page
 * already. Seven columns each repeating an attribution would bury the figures
 * they qualify.
 */

import type { TideReading, TideWeekDay } from "@/lib/conditions";

/** What every day of this row shares: the words that name it. */
export const TIDE_WEEK_ROW = {
  label: "Lowest daylight tide",
} as const;

/** `3:14 AM -0.2 ft`, the one wording both lines of this cell use. */
function worded({ timeLabel, feet }: TideReading): string {
  return `${timeLabel} ${feet.toFixed(1)} ft`;
}

export function TideWeek({ state }: { state: TideWeekDay["state"] }) {
  if (state.kind === "no-low") {
    return <span className="text-fog italic">Not in range</span>;
  }

  return (
    <>
      {state.daylight === null ? (
        // No low between sunrise and sunset. Close to unreachable on this
        // coast, and a named absence rather than a blank: the day's lowest is
        // on the line below, so the cell still answers.
        <span className="text-fog italic">None</span>
      ) : (
        <>
          <span className="font-extrabold">{state.daylight.timeLabel}</span>{" "}
          <span className="text-fog">{state.daylight.feet.toFixed(1)} ft</span>
        </>
      )}

      <span className="block text-fog">
        <span className="lg:block">all day</span>{" "}
        {state.allDay === null ? "none lower" : worded(state.allDay)}
      </span>
    </>
  );
}
