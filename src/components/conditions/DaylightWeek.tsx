/**
 * One day's daylight window, as the week grid's day header prints it.
 *
 * **It is the header rather than a row, and that is what pays for the rest of
 * the cell.** It began as a correction to the tide row — a lowest low at 2:23
 * AM and one at 2:23 PM are the same number and not the same trip — and
 * ADR-0017 took that job off it by moving the constraint into the rows
 * themselves, which then had to say so in their labels: "Lowest daylight tide",
 * "Biggest daylight swell". Those labels never fitted. At 10px with
 * `tracking-widest` they render 170px and 187px wide against 125px of cell at
 * 1280 and 161px at 1536, so both wrapped at every width the grid has.
 *
 * Opening the day with the window says it once instead. Everything under this
 * line is understood to fall between these two times, so the rows below can be
 * called "Low tide" and "Swell" without hiding the judgement their old labels
 * were carrying. See `docs/plans/week-grid-legibility.md`.
 *
 * **What it still answers on its own** is the question no row does — when you
 * can be down there at all, and how much of the day is left once the tide
 * window closes. It offers no verdict about any of it, which ADR-0009 forbids.
 *
 * **Both ends, not a duration.** "13h 18m of daylight" is the same information
 * arranged so that nobody can use it: the reader is choosing when to leave the
 * house, and the two clock times are what that turns on.
 *
 * **One line at every width, which the old two-line break existed to avoid.**
 * Set at 13px, `6:20 AM to 7:20 PM` is 123px and did not fit the 88px cell
 * seven columns gave it at 1024 — hence the `lg:block` this no longer carries.
 * At 11px it measures 109px, inside the narrowest cell the grid now has: 125px
 * at 1280, after seven columns were moved to `xl` so that 1024 gives four
 * columns and 189px rather than seven and 88px. The break is gone because the
 * measurement that forced it is, and both halves had to move together — at the
 * old breakpoints this line would have overflowed its cell rather than wrapped,
 * because it is `whitespace-nowrap`.
 *
 * That `nowrap` is deliberate and it is the reason the two moves are one slice.
 * A clock range broken across lines is two half-times, and no width this grid
 * has is narrow enough to need it: 109px against 189px is the tightest case.
 *
 * **The mark is an SVG, not an emoji.** ADR-0015 records that a full-colour
 * emoji at this size is not a mark but a smudge, which is why no row in this
 * grid carries a glyph. A stroked icon in `currentColor` is a different thing:
 * it takes the colour of whatever band it stands on -- white on today's ocean,
 * fog on mist -- and draws the same on every machine, where an emoji is
 * whatever the visitor's OS font happens to hold. It claims no product, so it
 * does not enter the vocabulary ADR-0015 governs.
 *
 * **The word "Daylight" is spoken, not shown.** The visible text is the two
 * clock times; `role="img"` with an `aria-label` gives the line the name the
 * visible text drops. A `title` tooltip was the other option and is worse in
 * every direction that matters here: it does not appear on touch, it is not
 * keyboard-reachable, and this grid's whole argument is that nothing is hidden
 * behind an affordance. `sr-only` is the third, and this repo does not use it
 * (`ReadingCard` records why). `role="img"` with a label is already how
 * `Placeholder` names a thing whose visible content is not its name.
 *
 * The space between sunrise and sunset stays a text node. Without it the
 * accessible text would run together as "6:48 AMto 4:47 PM" -- the same
 * concatenation `ReadingCard` records hitting in the accessible-name
 * algorithm. That the label is now explicit does not make the fallback safe to
 * break.
 */

import type { DaylightWeekDay } from "@/lib/conditions";

/** The word the visible line drops, and the one a screen reader is given. */
export const DAYLIGHT_LABEL = "Daylight";

/**
 * The sun, at the size a 10px eyebrow can stand beside.
 *
 * `currentColor` and no fill: the header band is mist under ocean text on six
 * days and ocean under white text on the seventh, and a mark with its own
 * colour would have to be measured against both. Inheriting means it cannot be
 * wrong on either.
 */
function SunMark() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      className="flex-none"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 1.6v2.2M12 20.2v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M1.6 12h2.2M20.2 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

export function DaylightWeek({
  day,
}: {
  day: Pick<DaylightWeekDay, "sunriseLabel" | "sunsetLabel">;
}) {
  return (
    <p
      role="img"
      aria-label={`${DAYLIGHT_LABEL}, ${day.sunriseLabel} to ${day.sunsetLabel}`}
      className="mt-1 flex items-center gap-1.5 text-xs font-bold"
    >
      <SunMark />
      <span className="whitespace-nowrap">
        {day.sunriseLabel} to {day.sunsetLabel}
      </span>
    </p>
  );
}
