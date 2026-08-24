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

import type { TideWeekDay } from "@/lib/conditions";

/** What every day of this row shares: the glyph that marks it and the words that name it. */
export const TIDE_WEEK_ROW = {
  // 🌊 rather than 🐚: the animal vocabulary belongs to sightings, and a shell
  // renders pale on this surface. The now-band's tide card made the same call.
  emoji: "🌊",
  label: "Lowest tide",
} as const;

export function TideWeek({ state }: { state: TideWeekDay["state"] }) {
  if (state.kind === "no-low") {
    return <span className="text-fog italic">Not in range</span>;
  }

  return (
    <>
      <span className="font-extrabold">{state.timeLabel}</span>{" "}
      <span className="text-fog">{state.feet.toFixed(1)} ft</span>
    </>
  );
}
