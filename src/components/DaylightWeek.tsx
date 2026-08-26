/**
 * One day's daylight, as the week grid prints it.
 *
 * **It used to be here to make the tide row mean something**, and it is not any
 * more. A lowest low at 2:23 AM and one at 2:23 PM are the same number and not
 * the same trip, and for a while this row was the only thing on the page that
 * said which. ADR-0017 moved that into the rows themselves: they now lead with
 * the extreme daylight reaches and name it, so this is no longer the correction
 * to the figure above it.
 *
 * **What it still answers is the question no other row does** — when you can be
 * down there at all, and how much of the day is left once the tide window
 * closes. That is narrower than the job it was built for and it is why the row
 * stayed when the alternative was to drop it and buy back 380px of phone
 * scroll. It offers no verdict about any of it, which ADR-0009 forbids and this
 * deliberately stops short of.
 *
 * **Both ends, not a duration.** "13h 18m of daylight" is the same information
 * arranged so that nobody can use it: the reader is choosing when to leave the
 * house, and the two clock times are what that turns on.
 *
 * **Two lines, always, rather than one that sometimes becomes two.** Set on one
 * line this is about nineteen characters against a 124px cell, so it fits on
 * six days and wraps on the seventh -- and the wrap pushed that column's rows
 * out of line with its neighbours, which is the thing a grid exists to prevent.
 * Breaking it on purpose costs the same height on every day and buys back the
 * alignment. The sunrise leads because it is the one a reader plans against.
 *
 * The space between the two spans stays. Two blocks collapse it visually, but
 * it is still a text node, and without it the accessible text runs together as
 * "6:48 AMto 4:47 PM" -- the same concatenation `ReadingCard` records hitting
 * in the accessible-name algorithm. A line break a reader can see must not be
 * a word break a reader can hear.
 *
 * **No glyph.** This row carried 🌅, and the tide row beside it 🐚, at the 10px
 * the week grid's labels are set in. See ADR-0015: at that size a full-colour
 * emoji is not a mark, and the shell in particular rendered as a grey smudge on
 * the pale cell. A glyph marks a panel on this page; a row inside one is named
 * in words.
 *
 * **A cell rather than a row**, for the reason `TideWeek` gives: the grid is
 * day-major, so a row is seven of these rather than one subtree.
 */

import type { DaylightWeekDay } from "@/lib/conditions";

/** What every day of this row shares: the words that name it. */
export const DAYLIGHT_WEEK_ROW = {
  label: "Daylight",
} as const;

export function DaylightWeek({
  day,
}: {
  day: Pick<DaylightWeekDay, "sunriseLabel" | "sunsetLabel">;
}) {
  return (
    <>
      <span className="block font-extrabold">{day.sunriseLabel}</span>{" "}
      <span className="block text-fog">to {day.sunsetLabel}</span>
    </>
  );
}
