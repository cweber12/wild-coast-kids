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
 *
 * **It is a client component now, and it holds no data because of it.** Every
 * figure in this grid still comes from `WeekPanel`, on the server, and arrives
 * here as markup that was already rendered -- the rows, the windows, the
 * shapes. What runs on the client is the choosing: which day the panel below is
 * showing, and the mark that says so. So a reader with a blocked script still
 * gets the whole week, server-rendered and complete, which is what the day
 * selection falls back *to* and the reason it needs no `noscript` list of its
 * own. See `useHydrated`.
 */

"use client";

import type { ReactNode } from "react";
import { MIN_USEFUL_SPARK_WIDTH_PX } from "./DaySpark";
import { useHydrated } from "./hydrated";
import { resolveSelected, useSelectedDay } from "./selectedDay";
import { TOUCH_TARGET } from "../ui/touchTarget";
import { REGION_HEADING } from "./headingRank";
import { ProvenanceLine } from "./ProvenanceLine";
import { ReservedSlot } from "../ui/ReservedSlot";

/**
 * The narrowest a day block ever gets, in CSS pixels.
 *
 * Measured on the built page 2026-08-28 at 1280, which is where `xl` turns four
 * columns into seven and is therefore the tightest the grid ever is: 158.8px of
 * block holding a 132.8px shape. Wider at every other width — 195.4 at 1536,
 * 223 at 1024's four columns, 327 at 375's one.
 *
 * Here rather than beside the shape it constrains, because the thing that could
 * make it wrong is `xl:grid-cols-7` below. It has been wrong that way once
 * already: ADR-0023 moved seven columns from `lg` to `xl` precisely because
 * 88px of content at 1024 was narrower than the text standing in it.
 */
const NARROWEST_DAY_BLOCK_PX = 158.8;

/**
 * What a day block spends on chrome before its contents get any, as a container
 * query sees it.
 *
 * **The padding only, and the border deliberately not.** `container-type:
 * inline-size` resolves a query against the container's *content* box, so the
 * 1.5px border is already outside the number being compared. Including it put
 * the first version of this threshold three pixels high, which the probe caught
 * by hiding a block at 138px that should have kept its shape.
 *
 * It is `px-3` on the wrapper, twice. Good to a pixel rather than exactly: a
 * 1.5px border does not render as 1.5px, so the shape measures a pixel wider
 * than the arithmetic says. That slop is far inside the resolution of the
 * measurement it serves — the shape was judged legible at 110px and illegible
 * at 88 — so it is recorded rather than chased.
 */
const DAY_BLOCK_PADDING_PX = 24;

/**
 * The container width at which a shape stops being worth drawing.
 *
 * `MIN_USEFUL_SPARK_WIDTH_PX` is measured on the shape itself, so the container
 * threshold is that plus the padding around it. Derived rather than written, so
 * the two cannot drift: a change to either the measured floor or the wrapper's
 * padding moves this with it.
 *
 * Verified by putting the shipped markup in front of containers either side of
 * it, since no viewport reaches a block this narrow through the real page — the
 * grid goes to one column long before the cell does. The last block that draws
 * a shape is 136px and it renders that shape at exactly 110px, which is the
 * floor; 134px draws none. The figure and the header window are present at
 * every width either side, which is the half of this that matters: below the
 * threshold the cell reads as it did before there were shapes.
 */
export const MIN_SPARK_BLOCK_PX =
  MIN_USEFUL_SPARK_WIDTH_PX + DAY_BLOCK_PADDING_PX;

/**
 * True when the grid's own narrowest cell still clears the floor.
 *
 * Exported for the test that asserts it. 132.8px of shape against a 110px
 * floor today, so the rule below never fires — and if a future breakpoint
 * change makes it fire, that is a decision someone should have to make on
 * purpose rather than discover as seven blank strips.
 */
export const NARROWEST_CELL_CLEARS_FLOOR =
  NARROWEST_DAY_BLOCK_PX - DAY_BLOCK_PADDING_PX >= MIN_SPARK_BLOCK_PX;

/** One column of the week. */
export type WeekDay = {
  /** `YYYY-MM-DD` in Pacific. The key every row's cells are looked up by. */
  localDate: string;
  /** That date named for a reader, `Mon, Aug 17`. */
  dayLabel: string;
  /**
   * The same date without its weekday, `Aug 17`.
   *
   * Used only on today's column, which carries a chip reading "Today" beside
   * it. A weekday next to that chip is the most redundant token in the grid,
   * and dropping it is what lets the chip sit on the date's own line instead of
   * reserving a line above it in all seven columns.
   */
  dateLabel: string;
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
  /**
   * This day drawn as a shape, beneath the header and above the figures.
   *
   * A slot on the day rather than a `WeekRow`, and for a different reason than
   * `daylight` is. That one states the scope every row is selected within; this
   * one is the *series* one row's figure was selected out of — the full
   * twenty-four hours the header's window is a slice of. Seven of them are
   * small multiples, so they have to sit at the same height in all seven
   * columns, which a row cannot promise: rows are ragged by design and a day
   * whose wave forecast has run out would carry its shape a line higher than
   * its neighbours.
   *
   * **It restores no figure to this cell, which is what keeps ADR-0023
   * intact.** That decision moved the daylight window into the header and left
   * the rows carrying only the figures inside it, having measured that the
   * labels an "all day" figure needs — "Lowest daylight tide", 170px against
   * 125px of cell — do not fit at any width this grid has. A drawn overnight
   * low needs no label at all. The header window and the figure beneath are
   * untouched; this is the debt ADR-0023 recorded being paid, not that
   * decision being reversed.
   *
   * Optional, so a grid whose series could not be read renders exactly as it
   * did before there was one.
   */
  spark?: ReactNode;
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
  const { selected, choose } = useSelectedDay();
  const hydrated = useHydrated();

  /*
    Which day is marked, and it is not `day.isToday`.

    Before the panel below could be pointed at another day, "today" and "the
    day being shown" were the same thing and one band said both. They come
    apart the moment a reader chooses Thursday, and they are marked by
    different channels because they are different facts: the filled band says
    what is showing below, and the yellow chip -- which is a word, not a colour
    -- still says which day is now. On arrival they coincide, so nothing about
    the grid a reader first sees has changed.
  */
  const showing = resolveSelected(
    selected,
    days.map((day) => day.localDate),
  );

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
              /*
                `@container`, so the shape inside can be dropped on the width of
                its own cell rather than on the width of the window. The two are
                not the same question: this grid is one, two, four and seven
                columns, so a 1024 window gives a *wider* cell than a 1280 one
                and a viewport media query would have to encode the whole
                progression to say one thing about a cell.

                `inline-size` containment only, which is what `@container`
                sets. The block's width already comes from the grid track and
                its height still comes from its contents, so nothing here sizes
                differently for it -- measured before and after: 195.4 x 275.0
                at 1536, unchanged.
              */
              className={`@container overflow-hidden rounded-tile border-[1.5px] bg-white/60 ${
                day.localDate === showing ? "border-ocean" : "border-lavender"
              }`}
            >
              <div
                className={`border-b-[1.5px] px-3 py-2 ${
                  day.localDate === showing
                    ? "border-ocean bg-ocean text-white/85"
                    : "border-lavender bg-mist text-fog"
                }`}
              >
                <h3
                  className={`text-2xs font-extrabold tracking-widest uppercase ${
                    day.localDate === showing ? "text-white" : "text-ocean"
                  }`}
                >
                  {/*
                    **The chip sits after the date, on the date's own line.**
                    It had a reserved line above it, because `TODAY · THU, AUG
                    28` is 151px against 133px of band at 1280 and would wrap
                    on the marked day alone -- putting every row beneath it in
                    that column a line lower than its neighbours. Reserving the
                    line fixed the alignment and cost 22px of empty band at the
                    top of the other six columns, which is what a reader
                    actually saw.

                    What makes the chip fit is `dateLabel`. Measured at 1280:
                    the full `THU, AUG 28` is 89px and the chip is 54px, which
                    with a space between them overruns a 133px band; `AUG 28` is
                    51px and the pair comes to 111px. So today's column drops
                    its weekday and nothing is reserved anywhere.

                    Dropping the weekday costs today's column the least useful
                    token it has. The chip already says which day this is, and
                    the month stays -- so the row still shows the month turning
                    over mid-week, which was the objection to shortening this
                    heading the first time.

                    `leading-none` on the chip, so its padding fits inside the
                    heading's own line box. Without it the chip is 16px against
                    the other columns' 15px, and today's band renders a pixel
                    taller than the six beside it -- which is the same
                    misalignment in miniature that the reserved line was
                    introduced to prevent.

                    Inline rather than a flex row, and with a real space text
                    node before the chip. Two flex items with nothing between
                    them read aloud as "Aug 28Today", which is the
                    concatenation `ReadingCard` records hitting in the
                    accessible-name algorithm.
                  */}
                  {/*
                    The date is the control, and only the date.

                    **Not the whole cell, and that is an accessibility
                    constraint rather than a layout preference.** `button`,
                    `radio` and `tab` all take presentational children, so a
                    cell wrapped in any of them would hide its own figures from
                    the accessibility tree -- and those figures are the week's
                    entire text equivalent. A `button` could not legally hold
                    the `<dl>` below either. So the control is the one piece of
                    phrasing content that already names the day, and everything
                    else in the cell stays readable exactly as it was.

                    **Seven tab stops, not a roving tabindex.** ADR-0027 chose
                    roving for the chart's hour columns because twenty-four
                    stops between a reader and the next region is absurd. Seven
                    named controls is not, and a roving group would need a role
                    to explain itself -- the roles this cell cannot take.

                    `aria-current="date"` rather than `aria-pressed`: this is
                    the current item of a set of dates, which is the token's
                    own definition, where a pressed button is a toggle that
                    stays down.
                  */}
                  {hydrated ? (
                    <button
                      type="button"
                      onClick={() => choose(day.localDate)}
                      aria-current={
                        day.localDate === showing ? "date" : undefined
                      }
                      /*
                        The underline is the second channel, so the selection
                        is not carried by the filled band's colour alone.

                        Typographic rather than a mark, and that is this grid's
                        own rule rather than a preference: `WeekPanel`'s test
                        puts it in one line -- "the header's mark draws rather
                        than spells, so a day block contributes no glyph text
                        of its own" -- and a `▾` character is spelling. Drawing
                        one would have meant an inline SVG for two pixels of
                        triangle. An underline is a change of shape a reader
                        already knows means "this one", it needs no legend, and
                        it leaves the header's text exactly what it was.
                      */
                      className={`${TOUCH_TARGET} md:min-h-0 inline-flex cursor-pointer items-center text-left ${
                        day.localDate === showing
                          ? "text-white underline decoration-2 underline-offset-4"
                          : "text-ocean"
                      }`}
                      data-day-choice={day.localDate}
                    >
                      {day.isToday ? day.dateLabel : day.dayLabel}
                    </button>
                  ) : day.isToday ? (
                    day.dateLabel
                  ) : (
                    day.dayLabel
                  )}
                  {day.isToday && (
                    <>
                      {" "}
                      <span className="leading-none rounded-pill bg-yellow px-1.5 py-0.5 align-[0.1em] text-dark">
                        Today
                      </span>
                    </>
                  )}
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

              {/*
                Between the band and the figures, and at the top of the body
                rather than the foot of it. The rows below are ragged by
                design — a day the wave forecast has not reached carries two
                pairs where its neighbour carries three — so anything anchored
                under them sits at a different height in each column, and seven
                shapes that do not line up are seven charts rather than one
                instrument. Under the band there is nothing above it but the
                date, which is the same height in all seven.

                It is also the line the shading is about: the window printed
                directly above says where the light is, and the band drawn
                directly below is where it is not.

                Padded here rather than in the shape, so the plot is one
                geometry with no margins of its own to keep in step with the
                cell's.
              */}
              {/*
                134px is `MIN_SPARK_BLOCK_PX`, written out because Tailwind
                scans source text and cannot read a constant. The pair is held
                together from the other side: a test asserts the constant is
                still 137, and the `stylesheet` gate asserts this class
                compiled to a real rule. Neither alone is enough -- an
                unregistered variant leaves the class in the markup where jsdom
                still finds it, so the component tests cannot see it fail.

                A container query rather than a viewport one, because the two
                are not the same question here: this grid is one, two, four and
                seven columns, so a 1024 window gives a *wider* cell than a 1280
                one and a media query would have to encode the whole progression
                to say one thing about a cell.
              */}
              {day.spark && (
                <div className="@max-[134px]:hidden px-3 pt-2">{day.spark}</div>
              )}

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
                        columns -- 301px of content at 375, 328px at 768 -- and
                        a 10px label alone on a line that wide is most of the
                        line wasted. The column is sized to the widest label the
                        grid has: `BIGGEST SWELL` at 112px, against `CLOUD
                        COVER` at 100px and `LOW TIDE` at 70px. 116px holds it
                        with a little to spare and leaves 175px for the value at
                        375, which takes every value in the cell except the
                        longest cloud phenomenon (`68% Slight chance rain
                        showers`, 204px, two days of seven) -- and that is the
                        last row, so a wrap there pushes nothing out of line.
                        Measured at 375: a day goes 214px to 169px with this
                        alone, and 250px to 169px against what the grid shipped
                        before ADR-0023.

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
                        className={`text-2xs w-29 shrink-0 font-extrabold tracking-widest uppercase lg:w-auto ${
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
              /*
                `surface="page"`: the grid sits on the page's own ground, not
                on a reading card, and this line printed the card's colour on
                it -- 1.03:1, invisible. It shipped that way, so the fix is
                here rather than in the slice that noticed it.
              */
              <ProvenanceLine
                key={row.label}
                label={row.label}
                surface="page"
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
