/**
 * One day's daylight, as the week grid prints it.
 *
 * **It is here to make the tide row mean something.** A lowest low at 2:23 AM
 * and a lowest low at 2:23 PM are the same number and not the same trip, and
 * the tide row alone cannot say which is which. Put beside it, "6:14 AM to 7:32
 * PM" answers the question a parent is actually asking — can we be down there
 * when the water is out — without the page ever offering a verdict about it,
 * which ADR-0009 forbids and which this deliberately stops short of.
 *
 * **Both ends, not a duration.** "13h 18m of daylight" is the same information
 * arranged so that nobody can use it: the reader is choosing when to leave the
 * house, and the two clock times are what that turns on.
 *
 * **🌅 rather than ☀️.** The glyph has to mean sunrise and sunset rather than
 * "sunny", because the air card next to it is where sky belongs and a page's
 * glyph may mean one thing. It is also not an animal, which the brief reserves
 * for sightings.
 *
 * **A cell rather than a row**, for the reason `TideWeek` gives: the grid is
 * day-major, so a row is seven of these rather than one subtree.
 */

import type { DaylightWeekDay } from "@/lib/conditions";

/** What every day of this row shares: the glyph that marks it and the words that name it. */
export const DAYLIGHT_WEEK_ROW = {
  emoji: "🌅",
  label: "Daylight",
} as const;

export function DaylightWeek({
  day,
}: {
  day: Pick<DaylightWeekDay, "sunriseLabel" | "sunsetLabel">;
}) {
  return (
    <>
      <span className="font-extrabold">{day.sunriseLabel}</span>{" "}
      <span className="text-fog">to {day.sunsetLabel}</span>
    </>
  );
}
