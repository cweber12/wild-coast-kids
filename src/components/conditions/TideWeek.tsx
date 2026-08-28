/**
 * One day's lowest low tide inside the daylight window, as the week grid
 * prints it.
 *
 * **A row in a day-major grid is not a subtree, so this is a cell rather than a
 * row.** `WeekGrid` renders seven day blocks and each block asks every product
 * for its figure, which is what makes the grid transpose with one CSS property
 * and read day-then-values to a screen reader. The tide "row" is therefore
 * seven instances of this component, and `TIDE_WEEK_ROW` carries the identity
 * they share so the label lives beside the thing it labels.
 *
 * **Timing leads, height supports.** The same order `TideToday` argues for and
 * for the same reason: a parent plans around when to leave the house, and the
 * height is what separates a good tidepooling day from an ordinary one rather
 * than the number they are looking for first.
 *
 * **The label is "Low tide", and the day's own lowest is no longer here.**
 * ADR-0017 put both figures in this cell and named the first one "Lowest
 * daylight tide" so a reader could tell which was which. That label renders
 * 170px wide against 125px of cell at 1280 and 161px at 1536 — it wrapped at
 * every width the grid has ever had. ADR-0023 says the selection once, in the
 * day header: everything under a window that reads `6:20 AM to 7:20 PM` is
 * inside it, so the label does not have to repeat the word and the second line
 * has nothing to distinguish itself from.
 *
 * **The overnight low is not dropped from the site, only from this grid.**
 * `TideToday` still prints "Lowest all day" for today, and the day view is
 * where the other six are going. `WeekPanel` says so in a sentence beneath the
 * grid rather than letting the figure vanish quietly — ADR-0023 records why
 * that sentence is the condition this was allowed under.
 *
 * **One line, at every width.** The old second line was two lines at `lg` on
 * purpose, because a cell whose height depended on which branch it took put
 * every row beneath it out of line with its neighbours. With one line there is
 * no branch to equalise: `3:13 PM 1.6 ft` is 79px against 125px in the
 * narrowest seven-column cell, and 189px at 1024 where the grid now shows four.
 *
 * **An absent day says so.** `no-low` means the range we asked NOAA for did not
 * cover that date — a fact about our request, never about the sea. `None` means
 * the sea did not put a low between sunrise and sunset, which is close to
 * unreachable on this coast. Both are words rather than a blank, because a
 * blank cell in a tide row reads as a calm, flat day, which is the failure this
 * whole page is built to avoid.
 *
 * **What is not here is a caveat per cell.** Which station these predictions
 * come from, how far away it is and what the datum means are all said once, on
 * the card above and in the notes block below. Seven columns each repeating an
 * attribution would bury the figures they qualify.
 */

import type { TideWeekDay } from "@/lib/conditions";
import { TIDE_TONE } from "./weekTone";

/** What every day of this row shares: the words that name it, and its colour. */
export const TIDE_WEEK_ROW = {
  label: "Low tide",
  tone: TIDE_TONE,
} as const;

export function TideWeek({ state }: { state: TideWeekDay["state"] }) {
  if (state.kind === "no-low") {
    return <span className="text-fog italic">Not in range</span>;
  }

  if (state.daylight === null) {
    // No low between sunrise and sunset. Close to unreachable on this coast --
    // two lows about twelve and a half hours apart against ten to fourteen
    // hours of daylight -- and a named absence rather than a blank.
    return <span className="text-fog italic">None</span>;
  }

  return (
    <>
      <span className="font-extrabold">{state.daylight.timeLabel}</span>{" "}
      <span className="text-fog">{state.daylight.feet.toFixed(1)} ft</span>
    </>
  );
}
