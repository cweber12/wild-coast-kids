/**
 * The seven days as one row of pills, directly under the day region's heading.
 *
 * **A second control over one fact, deliberately.** The week grid above is
 * still the selector and still marks the showing day; this writes to the same
 * `SelectedDayProvider`, so choosing in either moves both and neither can hold
 * a different answer. That is worth a second control because the two are not
 * the same kind of thing: the grid is a table a reader reads -- each cell
 * carries that day's daylight low, its swell and its cloud -- and this is a
 * control a reader operates. Reading a table and operating a control want
 * different shapes and, more to the point, different places.
 *
 * **The place is the whole reason it exists.** The grid is ~290px of cells plus
 * its heading, and the chart sits under all of it, so changing the day meant
 * scrolling up to a control, then back down to see what it did -- the control
 * and its effect never on screen together. This puts a control where the effect
 * is.
 *
 * **Under the heading rather than under the sky wording**, though the wording
 * sits between it and the chart. The wording is one to three lines depending on
 * what the office wrote for that day, so a control below it would move up and
 * down the page as a reader stepped across the week. `ChosenDay` already orders
 * the region on that rule -- it is why the rip block and the measured block went
 * below the chart rather than above it -- and a control is the element that can
 * least afford to move, because a reader is aiming at it.
 *
 * **It never wraps.** Seven pills on two lines costs the height this whole
 * brief is recovering, and it stops reading as one control. Below the width
 * that fits them it scrolls sideways instead, which is the same choice
 * `GalleryRow` makes and the same `no-scrollbar` utility.
 *
 * **`overflow-x-auto`, never `overflow-hidden`.** The focus ring is
 * `outline-offset: 2px` in `globals.css`, so a ring on the first or last pill
 * is drawn outside the pill's own box and an `overflow-hidden` scroller clips
 * it. `py-1` gives the ring room on the cross axis for the same reason.
 *
 * **Buttons with `aria-current="date"`, not a tablist.** The chart below
 * already owns a real tab set -- tide, swell, wind, temperature -- and nesting
 * a second tablist for days inside the same region would put a reader in two
 * tab contexts at once. `aria-current` is the week grid's word for the same
 * fact one region up, and the two controls write one provider: until
 * 2026-09-17 this one said `aria-pressed`, so the same choice was announced as
 * a toggle here and as the current item there. One fact, one word.
 *
 * **One tab stop, and the arrow keys walk it.** Seven pills were seven stops,
 * on top of the seven day headers in the grid above -- fourteen presses to get
 * past one choice. The showing pill holds `tabIndex="0"` and the rest `-1`,
 * ArrowLeft and ArrowRight step the week and stop at its ends, Home and End
 * jump to them, and focus moves with the selection through a ref -- the half
 * of a roving tabindex the chart's own controls were missing until the same
 * day. It is the shape the chart's hour columns already had.
 *
 * The label a pill carries is `dayName`, which is the same string the heading
 * uses and the grid's own label for that day. Three names for one Thursday is
 * how two regions start disagreeing about which day is which.
 *
 * **Nothing renders until the page has hydrated, which is ADR-0027.** A control
 * mounts only once it can work: seven pills in the server render are seven dead
 * buttons for a reader with a blocked script. `BeachSelector` can afford to
 * render early because it has a `noscript` list of real links to fall back to;
 * day selection does not exist on this page in any other form, so the honest
 * fallback is no affordance at all and the region renders exactly as it did
 * before this control existed -- on today, with the week grid above still whole
 * and still readable. The week grid makes the same call one region up, which is
 * why `useHydrated` was given a module of its own.
 */

"use client";

import { useRef } from "react";
import { TOUCH_TARGET } from "../ui/touchTarget";
import { useHydrated } from "./hydrated";
import { resolveSelected, useSelectedDay } from "./selectedDay";

export type DayChoice = {
  /** `YYYY-MM-DD` in Pacific. What the provider chooses by. */
  localDate: string;
  /** "Today", "Thu, Sep 3" — the heading's and the grid's name for this day. */
  dayName: string;
};

export function DayStrip({ days }: { days: readonly DayChoice[] }) {
  const hydrated = useHydrated();
  const { selected, choose } = useSelectedDay();
  const showing = resolveSelected(
    selected,
    days.map((day) => day.localDate),
  );
  const showingIndex = days.findIndex((day) => day.localDate === showing);

  // One ref per pill, read by the key handler alone: choosing a day moves
  // `tabIndex="0"` onto its pill, and focus has to be moved there by hand or
  // the ring stays on the pill the keys just left.
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveTo = (index: number) => {
    const day = days[Math.min(days.length - 1, Math.max(0, index))];
    if (day === undefined) return;
    choose(day.localDate);
    pillRefs.current[days.indexOf(day)]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in moves) {
      event.preventDefault();
      moveTo(showingIndex + moves[event.key]);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveTo(event.key === "Home" ? 0 : days.length - 1);
    }
  };

  // ADR-0027, and see this file's header: no affordance at all beats a dead
  // one. There is nothing to degrade *to* here -- unlike the beach chooser,
  // whose `noscript` list does the same job in plain markup -- so the region
  // simply renders as it did before this control existed.
  if (!hydrated) return null;

  return (
    <div
      role="group"
      aria-label="Choose a day"
      className="no-scrollbar mb-4 flex gap-2 overflow-x-auto py-1"
      onKeyDown={onKeyDown}
    >
      {days.map((day, index) => {
        const isShowing = day.localDate === showing;

        return (
          <button
            key={day.localDate}
            type="button"
            onClick={() => choose(day.localDate)}
            aria-current={isShowing ? "date" : undefined}
            tabIndex={isShowing ? 0 : -1}
            ref={(element) => {
              pillRefs.current[index] = element;
            }}
            data-day-pill={day.localDate}
            /*
              `md:min-h-9` rather than the `md:min-h-0` most callers of
              `TOUCH_TARGET` take. Both compose the floor rather than replacing
              it, so ADR-0004 holds below `md` and a pill is 44px on a phone
              either way. Above `md` this stays a pointer target, which is the
              same call `WeekGrid`'s day button makes one region up -- and this
              is the primary day control, so it keeps a little more than that
              one does.

              `shrink-0` is what makes the row scroll rather than squeeze: flex
              items shrink before a container overflows, so without it seven
              pills compress into seven unreadable slivers and never trigger the
              scroller at all.

              The selected pill is marked twice -- filled, and underlined --
              because the grid above marks its own selection the same way and
              for the same reason: fill alone is a colour, and a reader who does
              not separate these two colours still sees the line.

              And it names its focus ring colour, which no other control on
              this page has to. The site's ring is `currentColor` at a 2px
              offset -- drawn outside the pill, on cream -- and this pill's
              current colour is white. White on cream is no ring at all, and
              this is the pill Tab lands on first. `outline-ocean` matches the
              fill, with the offset's 2px of cream between them to separate the
              two. An unselected pill is `text-ocean` and gets that ring for
              free.
            */
            className={`${TOUCH_TARGET} md:min-h-9 rounded-pill shrink-0 cursor-pointer px-4 text-2xs font-extrabold tracking-widest uppercase ${
              isShowing
                ? "focus-visible:outline-ocean bg-ocean text-white underline decoration-2 underline-offset-4"
                : "bg-mist text-ocean"
            }`}
          >
            {day.dayName}
          </button>
        );
      })}
    </div>
  );
}
