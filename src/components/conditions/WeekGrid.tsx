/**
 * The week, as a grid the reader can compare across.
 *
 * **The DOM is day-major and identical at every width.** Each of the seven days
 * is one block holding that day's figures, and the only thing that moves
 * between breakpoints is `grid-template-columns`: one column, then two, four
 * and seven at `md`, `lg` and `xl`. So the grid transposes without reparenting
 * anything, which is why ADR-0005's render-twice allowance is not invoked here
 * and no hidden second copy exists to drift out of step with the first.
 *
 * **Seven columns start at `xl`, and used to start at `lg`.** At 1024 seven
 * columns give a cell 120px, of which 88px is content -- narrower than
 * `THU, AUG 27` renders at 89px. Every hard-coded line break the four cell
 * components used to carry was really describing that number, and the grid was
 * 84px *taller* at 1024 than at 1536 because of them. Four columns there give
 * 223px, and all seven days still stand on one screen as 4 + 3. The cost is
 * that between 1024 and 1279 the week is two rows rather than one, which is a
 * real loss for comparing across days and the reason this is a breakpoint
 * rather than a rewrite. See `docs/plans/week-grid-legibility.md`.
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
import { REGION_HEADING } from "./headingRank";
import { ProvenanceLine } from "./ProvenanceLine";
import { ReservedSlot } from "../ui/ReservedSlot";

/** One column of the week. */
export type WeekDay = {
  /** `YYYY-MM-DD` in Pacific. The key every row's cells are looked up by. */
  localDate: string;
  /** That date named for a reader, `Mon, Aug 17`. */
  dayLabel: string;
  /** True for the day the reader is standing in. Decided upstream, so this renders no clock. */
  isToday: boolean;
  /**
   * The window this day's figures fall inside, printed in the header.
   *
   * A slot on the day rather than a `WeekRow`, because a row is a `<dt>`/`<dd>`
   * pair repeated inside every day block and this is one line above all of
   * them. The distinction is the point: a row states a figure, and this states
   * the scope the figures are selected within, which is what lets their labels
   * be "Low tide" rather than "Lowest daylight tide". See
   * `docs/plans/week-grid-legibility.md`.
   *
   * Optional, so a grid with nothing to scope renders a header of just the
   * date rather than a gap where a line should be.
   */
  daylight?: ReactNode;
};

/**
 * Which instrument or model a row's figures came from, for the line beneath the
 * grid.
 *
 * The fields `ProvenanceLine` takes, and no others: this carries them across
 * rather than re-deciding them, so the wording of "how far away" stays in the
 * one component that owns it -- the drift that component's docstring records.
 * The rounding is still the caller's, because what counts as a distance worth
 * a decimal differs per product.
 *
 * Shaped for the rows that are coming as much as for the one that is here. Two
 * of the reserved forecasts below will each want to name a source, and a field
 * shaped around waves alone would have to be widened to hold them.
 */
export type WeekRowProvenance = {
  source: string;
  network?: string | null;
  distanceKm?: string | null;
  note?: string | null;
};

/** One product across the week. */
export type WeekRow = {
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
  /**
   * The colour this row's label takes, in every day of the week.
   *
   * A text-colour utility rather than a token, and the set of them lives in
   * `weekTone.ts` with the contrast figures and the argument that colour per
   * product is not the verdict ADR-0009 forbids. Optional, and fog without it:
   * a caller that has not thought about the key gets the colour every label in
   * this grid had before there was one.
   */
  tone?: string;
  /**
   * Where this row's figures came from, printed once beneath the grid.
   *
   * Optional because most rows do not need one. The tide row's station is
   * already named on the card that shares its request, and daylight is computed
   * in this repo from coordinates the inventory holds -- there is no instrument
   * to name. A row whose source appears nowhere else on the page carries this.
   */
  provenance?: WeekRowProvenance;
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
      <h2 id={headingId} className={REGION_HEADING}>
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
        `grid` alone is one column; the three `grid-cols-*` steps are the rest.
        That single property is the whole transpose — see this file's header for
        why it has to be, why nothing here is hidden at any width, and why seven
        columns wait for `xl`.

        No days at all is a real state rather than an oversight: a station that
        could not be reached has a note above and nothing to tabulate, and an
        empty list announced as a list would be worse than no list.

        Today is marked three ways and none of them is a bare fill behind
        running text. Its edge is ocean where the others are lavender, its
        header band is ocean where the others are mist, and it carries the word
        "Today" on a yellow chip. `bg-lavender` behind the whole cell was tried
        and removed once: fog on lavender is 4.29:1, under the 4.5:1 this page
        holds itself to. The band escapes that because the text on it is white
        rather than fog -- 8.5:1 for the day name on ocean, 6.7:1 for the window
        beneath it at `white/85`.

        Every cell carries the same border width so the marked day is not
        narrower inside than its neighbours; only the colour changes.

        **The header is a band rather than more text on the same surface**, and
        that is what the reading below turns on. Four labelled pairs run
        together on one white field was the shape the 2026-08-27 review called
        undifferentiated, and it had no way to say which line was the day and
        which was a figure. A filled band says "this is the day" without a word,
        and the hairline rules inside the body say where one reading stops and
        the next begins. Rules rather than boxes: the tile is already a box, and
        three more nested inside a 157px cell is the mess this is escaping.

        The band is ADR-0015's vocabulary one row down. That decision put the
        reading cards on a saturated surface with a yellow eyebrow because the
        page "does not look like the site it belongs to", left the week grid
        pale, and said in as many words that if the difference ever read as an
        oversight rather than a distinction, this is the decision it gets
        converted against. It did. The grid keeps its own register -- a pale
        tile with one filled band, not a dark card -- because "now" and
        "planning" are still different things.

        `rounded-tile` with `overflow-hidden`, so the band is clipped by the
        corner rather than squaring it off. The radius is the one
        `SessionSchedule` and `/art` already use for a box this size, rather
        than the 520px hero card's `rounded-card`: on a 157px cell that is 15%
        of the width and the corner stops being a corner.
      */}
      {days.length > 0 && (
        <ol className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day) => (
            <li
              key={day.localDate}
              className={`overflow-hidden rounded-tile border-[1.5px] bg-white/60 ${
                day.isToday ? "border-ocean" : "border-lavender"
              }`}
            >
              <div
                className={`border-b-[1.5px] px-3 py-2 ${
                  day.isToday
                    ? "border-ocean bg-ocean text-white/85"
                    : "border-lavender bg-mist text-fog"
                }`}
              >
                <h3
                  className={`text-2xs font-extrabold tracking-widest uppercase ${
                    day.isToday ? "text-white" : "text-ocean"
                  }`}
                >
                  {/*
                    The chip's line is reserved on every day at `xl` and shared
                    with the date below it. `TODAY · THU, AUG 27` renders 151px
                    against 125px of cell at 1280, so the marked day wraps where
                    the other six do not, and every row beneath it in that column
                    then sits a line lower than the same row beside it. Reserving
                    the line is what keeps seven columns readable across rather
                    than only down.

                    Only at `xl`, because only there is the cell too narrow to
                    hold both: at 1024 the chip and the date measure about 141px
                    against 221px, so they sit on one line and the reserve would
                    be 22px a day for nothing. It shipped unscoped once and put
                    242px of extra scroll on a phone.

                    Reserved rather than shortened. "Today" alone fits and drops
                    the date from the one column a reader without the layout most
                    needs it named in; splitting the visible text from the
                    accessible one would need an `sr-only`, which this repo does
                    not use (`ReadingCard` records why). What the band changes is
                    how the empty line reads: on a tinted surface it is the
                    band's padding rather than a line that failed to render.
                  */}
                  <span className="xl:mb-1 xl:block xl:min-h-4.5">
                    {day.isToday && (
                      <>
                        <span className="rounded-pill bg-yellow px-1.5 py-0.5 tracking-wider text-dark">
                          Today
                        </span>{" "}
                      </>
                    )}
                  </span>
                  {day.dayLabel}
                </h3>
                {/*
                  Inside the header rather than in the `<dl>` below, because it
                  scopes every pair in that list rather than being one of them.
                  That is what lets the labels below drop the word "daylight" —
                  see `WeekDay.daylight` and `DaylightWeek`. It takes its colour
                  from this band, which is why it sets none of its own.
                */}
                {day.daylight}
              </div>

              <dl className="px-3 pb-2">
                {rows.map((row) => {
                  const cell = row.cells[day.localDate];
                  if (cell === undefined) return null;

                  return (
                    <div
                      key={row.label}
                      className="flex items-baseline gap-2.5 border-t border-lavender py-2 first:border-t-0 lg:block"
                    >
                      {/*
                        **Label beside the value below `lg`, above it from
                        `lg`.** A day is a full-width block at one and two
                        columns -- 303px of content at 375, 328px at 768 -- and
                        a 10px label alone on a line that wide is most of the
                        line wasted. `LOW TIDE` is 70px, so a 76px column holds
                        every label in the grid and leaves 217px at 375, which
                        takes the longest value the cell has (`65% Slight chance
                        rain showers`, 203px) without wrapping. Measured at
                        375: a day goes 214px to 169px with this alone, and
                        250px to 169px against what the grid shipped before
                        ADR-0023 -- 1822px of week to 1256px.

                        This is not the `lg:block` the four cell components just
                        lost. Those forced a break *inside* one value to keep
                        seven narrow columns in step; this chooses where a label
                        sits relative to its value, and it flips at `lg` because
                        that is where four columns make the cell 221px and the
                        76px column stops being affordable.

                        The tone is the row's, and constant across all seven
                        days — see `weekTone.ts` for the contrast measurements
                        and for why colour per product is not the verdict
                        ADR-0009 forbids. A row that brings none stays fog,
                        which is what every label here used to be.
                      */}
                      <dt
                        className={`text-2xs w-19 shrink-0 font-extrabold tracking-widest uppercase lg:w-auto ${
                          row.tone ?? "text-fog"
                        }`}
                      >
                        {row.label}
                      </dt>
                      <dd className="min-w-0 text-base text-dark">{cell}</dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          ))}
        </ol>
      )}

      {/*
        Once beneath the grid, never inside a day. A feed's identity is one fact
        about a feed, not seven facts about seven days -- the same argument the
        `notes` prop above is built on, and the reason `TideWeek`'s docstring
        gives for carrying no attribution of its own.

        It is here rather than in the day blocks for a second reason too: the
        wave row's figures are model output and the wave card above the grid is
        a measurement, so on today's column a reader is looking at two wave
        heights for one beach. Being able to tell which is which is what
        ADR-0010 turns on, and ADR-0016 records why the two are allowed to share
        a page at all.

        Labelled with the row's own name, because a grid may carry more than one
        of these and "MOP line D0498 · CDIP" under a table says nothing about
        which row it belongs to.
      */}
      {rows.some((row) => row.provenance !== undefined) && (
        <div className="mb-4">
          {rows.map((row) =>
            row.provenance === undefined ? null : (
              <ProvenanceLine
                key={row.label}
                label={row.label}
                {...row.provenance}
              />
            ),
          )}
        </div>
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
        <>
          {/*
            The band says what it is. Nothing tied it to the grid above, so a
            reader had no way to tell that a wave forecast lands *in* the week
            rather than in a box of its own -- three dashed panels under a
            table read as a separate thing that happens to sit below it.

            A sentence is the whole fix, and the band stays where it is. A
            reserved product is one fact about a feed rather than seven facts
            about seven days: `ReservedRow` carries no `cells`, so there is
            nothing to put in a day-block until the product exists, and moving
            one into the `<ol>` would print its headline seven times.
          */}
          <p className="leading-relaxed mb-3 max-w-130 text-base text-fog">
            Each of these will join the week above as a row of its own.
          </p>
          {/*
            `lg:grid-cols-3`, which is where the days above first go wider
            than two. These three once sat side by side from `sm` at 216px
            each -- roughly 26 characters over five ragged lines -- while the
            live week was still stacked full-width: the week said 768 was
            narrow and the slots said it was wide, in adjacent bands of the
            same section. Three across beside four days is close enough that
            neither band contradicts the other.
          */}
          <div className="grid gap-3 lg:grid-cols-3">
            {reserved.map((slot) => (
              <ReservedSlot key={slot.headline} {...slot} density="row" />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
