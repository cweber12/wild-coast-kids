/**
 * The week, as a grid the reader can compare across.
 *
 * **The DOM is day-major and identical at every width.** Each of the seven days
 * is one block holding that day's figures, and the only thing that moves
 * between breakpoints is `grid-template-columns`: one column below `lg`, seven
 * at `lg` and up. So the grid transposes without reparenting anything, which is
 * why ADR-0005's render-twice allowance is not invoked here and no hidden
 * second copy exists to drift out of step with the first.
 *
 * **It transposes rather than scrolling, and that departs from a stated
 * convention on purpose.** `globals.css` says small screens swipe and large
 * screens grid. That was written about the gallery — images, where swiping is
 * natural — and a seven-day forecast is a comparison task with few items, where
 * hidden content is the specific cost that matters. A parent planning Tuesday
 * has to be able to see Tuesday, not discover a scroll affordance concealing
 * it. It is also why weather products list daily data vertically.
 *
 * **Day-major is the right order for a reader who cannot see the layout.** It
 * reads "Tuesday, lowest tide, 7:10 AM" rather than every day's tide followed
 * by every day's waves, which is what a product-major DOM would give.
 *
 * **A row that cannot reach a day renders no pair there.** Products have
 * different horizons — a tide prediction runs years ahead, a surf zone forecast
 * about three days — so rows are ragged by nature. The absent cell is left out
 * rather than blanked, because a label sitting over a gap reads as an
 * instrument that failed rather than as a forecast that does not reach that
 * far. A cell that *is* present and has nothing to report says so in words;
 * that is the caller's job, not this one's.
 *
 * **Not `StatGroup`, though the pairs look alike.** That component's contract is
 * that one group is one provenance — ADR-0010 turns on it, and it is what keeps
 * two stations' figures from rendering as one set. A day here holds a NOAA
 * prediction beside a value computed in this repo, which is exactly the span
 * that contract forbids. Two components rather than one that quietly stopped
 * meaning what its docstring says.
 */

import type { ReactNode } from "react";
import { ReservedSlot } from "./ReservedSlot";

/** One column of the week. */
export type WeekDay = {
  /** `YYYY-MM-DD` in Pacific. The key every row's cells are looked up by. */
  localDate: string;
  /** That date named for a reader, `Mon, Aug 17`. */
  dayLabel: string;
  /** True for the day the reader is standing in. Decided upstream, so this renders no clock. */
  isToday: boolean;
};

/** One product across the week. */
export type WeekRow = {
  /** Marks the product at a glance; hidden from assistive tech, which reads the label. */
  emoji: string;
  /**
   * Names the product inside every day.
   *
   * Repeated per day rather than printed once down the side, because at every
   * width below `lg` a day is a row and there is no side to print it down. It
   * is also what makes the stacked layout read as sentences.
   */
  label: string;
  /**
   * This product's figure for each day, keyed by `localDate`.
   *
   * Keyed rather than positional: a row is allowed to be shorter than the week,
   * and an array would align its cells with the wrong days the moment it was.
   */
  cells: Readonly<Record<string, ReactNode>>;
};

/** What `ReservedSlot` needs, carried through so the caller names its own slots. */
export type ReservedRow = {
  emoji: string;
  headline: string;
  detail: string;
};

type WeekGridProps = {
  /** The heading's own id. The caller owns it, because it owns the anchor. */
  headingId: string;
  title: string;
  days: readonly WeekDay[];
  rows: readonly WeekRow[];
  /**
   * A sentence for each product that could not fill a row at all.
   *
   * Printed once above the grid rather than seven times inside it: a station
   * that could not be reached is one fact about a feed, not seven facts about
   * seven days. The upstream detail stays behind the disclosure on the card
   * that shares this request, rather than being repeated here.
   */
  notes?: readonly string[];
  /** Products that are decided but not built. Named rather than left silent. */
  reserved?: readonly ReservedRow[];
};

export function WeekGrid({
  headingId,
  title,
  days,
  rows,
  notes = [],
  reserved = [],
}: WeekGridProps) {
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase"
      >
        {title}
      </h2>

      {notes.map((note) => (
        <p
          key={note}
          className="leading-relaxed mb-4 max-w-130 text-base text-fog"
        >
          {note}
        </p>
      ))}

      {/*
        `grid` alone is one column; `lg:grid-cols-7` is seven. That single
        property is the whole transpose — see this file's header for why it has
        to be, and why nothing here is hidden at any width.

        No days at all is a real state rather than an oversight: a station that
        could not be reached has a note above and nothing to tabulate, and an
        empty list announced as a list would be worse than no list.

        Today is marked by a border and by the word "Today", never by a surface.
        `bg-lavender` was tried and removed: fog on lavender is 4.29:1, under
        the 4.5:1 this page holds itself to, and it would have reintroduced on
        one column the exact failure `globals.css` records fog being darkened to
        escape. A border is a boundary rather than text, and ocean on mist
        clears 7:1 as one. Every block carries `border-2` so the marked day is
        not two pixels wider than its neighbours.
      */}
      {days.length > 0 && (
        <ol className="mb-4 grid gap-3 lg:grid-cols-7">
          {days.map((day) => (
            <li
              key={day.localDate}
              className={`rounded-card border-2 bg-mist px-4 py-3 ${
                day.isToday ? "border-ocean" : "border-transparent"
              }`}
            >
              <h3 className="text-2xs mb-2 font-extrabold tracking-widest text-ocean uppercase">
                {day.isToday ? `Today · ${day.dayLabel}` : day.dayLabel}
              </h3>

              <dl>
                {rows.map((row) => {
                  const cell = row.cells[day.localDate];
                  if (cell === undefined) return null;

                  return (
                    <div key={row.label} className="mb-2 last:mb-0">
                      <dt className="text-2xs font-extrabold tracking-widest text-fog uppercase">
                        <span aria-hidden="true">{row.emoji}</span> {row.label}
                      </dt>
                      <dd className="text-base text-dark">{cell}</dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          ))}
        </ol>
      )}

      {/*
        `density="row"` rather than the section default. At section density
        these three slots measured 244px against 128px of live week above
        them -- three dashed boxes physically larger than the seven days they
        annotate, because `ReservedSlot` was built to hold open a whole section
        and was reused here unchanged. It records why its own numbers are what
        they are; what this asks for is the density sized to a row.
      */}
      {reserved.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {reserved.map((slot) => (
            <ReservedSlot key={slot.headline} {...slot} density="row" />
          ))}
        </div>
      )}
    </section>
  );
}
