/**
 * What the instruments say, in one line, above everything the page predicts.
 *
 * **Every figure here was measured, and exactly one thing was not.** The buoy
 * and the shore station are the only instruments this site reports at all;
 * everything else on `/conditions` is a prediction or a model — NOAA's harmonic
 * tide, CDIP's swell, the National Weather Service's grid cell.
 *
 * The exception is the air segment's **mark**, which is the forecast sky for
 * this hour (ADR-0057). It is a glyph and never a figure, and that line is what
 * makes it safe: a cloud percentage printed beside `73°F · 7 mph` would put a
 * modelled number inside a block claiming to be measured, which is the blur
 * ADR-0009 exists to prevent. The attribution names it as a forecast.
 *
 * **It was two dark cards until ADR-0056**, roughly 180px of a 639px viewport,
 * sitting between a headline and the two regions a reader came for. What
 * decided the shape was a count rather than a preference: only 15 of the 51
 * beaches have a wave buoy, and applying ADR-0048 over the areas leaves a
 * measured wave height on 18 of 69 routes — so the two-figure layout the cards
 * were built around was the minority case, and on the other three quarters the
 * wave card was a paragraph explaining an absence.
 *
 * **Now only, and it takes no day.** It sits outside `SelectedDayProvider`, so
 * there is no day in scope to accidentally read: an instrument answers for an
 * instant, and the only instant it answers for is this one. A later change
 * cannot quietly make these figures follow Thursday, because there is nothing
 * to follow.
 *
 * **Two segments, never one merged sentence.** ADR-0010 permits two provenances
 * behind one panel and refuses them behind one sentence, and this component is
 * the panel. Each source keeps its glyph, its figures and its own plain-words
 * line; "about waist high, mild with a light breeze" is the shape that decision
 * forbids and `bandText.ts` does not build it.
 *
 * **The glyphs are ADR-0015's closed vocabulary**, and the clock has none. 🏄
 * and 💨 came across from the cards they anchored; a third glyph for the time
 * would be a new word in a vocabulary that is closed.
 *
 * **`bg-dark`, which the cards had and the first draft of this band gave up.**
 * On cream the band read as one more paragraph in a column of them: the whole
 * page is `--color-cream`, and a bordered box on it is a weaker signal than a
 * surface. What the dark surface buys is the distinction the brief's second
 * principle asks for, legible before a word is read — a dark block of stated
 * figures against a light drawn curve — and it is the same argument
 * `MeasuredToday` made for not moving off it.
 *
 * The colours come back with it, and they are the measured pairings rather than
 * a guess: `CARD_PROSE` is white/75 at **10.02:1** on `--color-dark` and
 * `CARD_MUTED` is white/55 at **5.96:1**, both recorded in `cardText.ts`. What
 * must not follow them onto any lighter ground is the point of that file: white
 * at 55% on cream paints **1.03:1**, the bug #175 fixed in three places.
 *
 * **One region with an `aria-label`, and no visible heading.** The two card
 * `<h2>`s leave the outline with the cards, which becomes `h1` → region `h2` →
 * day `h3` with no card level between. The name goes on `aria-label` rather
 * than a hidden heading for the reason `ReadingCard` recorded: the
 * accessible-name algorithm joins adjacent inline text nodes with no separator,
 * and this repo does not use `sr-only` anywhere.
 */

import { CARD_MUTED, CARD_PROSE } from "./cardText";
import { bandView, type MeasuredReadings } from "./bandText";
import { NowClock } from "./NowClock";
import { localTimeOf } from "@/lib/pacific-time";

export type { MeasuredReadings };

export function MeasuredBand({ readings }: { readings: MeasuredReadings }) {
  const { segments, observedAtMs, attribution } = bandView(readings);

  return (
    /*
      Full width, under the page header rather than beside the chooser.

      The chooser's column is `md:w-72` -- 288px -- and this content is six
      stacked lines there, about 130px, which would have grown the header row
      from roughly 100px to 246px and returned about 70px of the 216px the cards
      and their margin occupied. A badge needs horizontal room; 288px is a
      narrow card. Across the page there is about 1440px at the review viewport,
      where the segments set on one line. See ADR-0056.
    */
    <section
      aria-label={`Measured now · ${labelFor(readings)}`}
      className="rounded-card bg-dark px-5 py-3"
    >
      {/*
        `flex-wrap` with a gap rather than a grid: the segments are two runs of
        text of unequal and unpredictable width -- a wind bearing is "from the
        west" or "from the north-north-west" -- so a column that fitted one
        beach would leave a gap at the next. Wrapping puts them on their own
        lines at a phone width, which is where the 342px column cannot hold
        both.
      */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        {segments.map((segment) => (
          <p
            key={segment.emoji}
            className="flex flex-wrap items-baseline gap-x-2"
          >
            <span aria-hidden="true" className="text-base leading-none">
              {segment.emoji}
            </span>
            <span className="text-base font-extrabold text-white">
              {segment.text}
            </span>
            {segment.gloss !== null && (
              <span className={`leading-relaxed text-base ${CARD_PROSE}`}>
                {segment.gloss}
              </span>
            )}
          </p>
        ))}
      </div>

      {/*
        The two clocks and the two instruments, in the subordinate register.

        One run rather than two lines. Measured at 1536x639, the three parts set
        in about 580px of the 1440 available, so forcing the attribution onto
        its own line cost the band 15px and bought nothing; below `md` they wrap
        on their own.

        **Every separator belongs to the part that can be absent**, which is all
        three of them: the clock vanishes without JavaScript, the bound vanishes
        when nothing was measured, and the attribution vanishes when no
        instrument answered. A separator written on the fixed side of a pair
        where neither side is fixed is the bug this line already shipped once.

        The reader does the subtraction, and both halves are always true while
        they do it: `NowClock` is a client value that cannot be stale, and the
        observation time is a fact about the past that caching cannot corrupt.

        **A bound, not a point.** Up to three rows sit behind these figures --
        the buoy's, and the air station's temperature and wind, which NDBC ages
        independently -- so "nothing older than" is true where "readings from"
        would be false of the newest of them. A bound over a set also attributes
        nothing to any figure in it, which is what keeps two networks from
        standing behind one claim (ADR-0010, ADR-0054).
      */}
      <p className={`text-2xs leading-relaxed mt-2 ${CARD_MUTED}`}>
        {/*
          The separator belongs to the clock, which is the half that can
          disappear: it renders nothing on the server and for a reader with no
          JavaScript. Written on the bound's side instead, it left every such
          render opening on a stray interpunct.
        */}
        <NowClock trailing={observedAtMs !== null || attribution !== null} />
        {observedAtMs !== null && (
          <span>nothing older than {localTimeOf(observedAtMs)}</span>
        )}
        {attribution !== null && (
          <span>
            {observedAtMs !== null ? " · " : ""}
            {attribution}
          </span>
        )}
      </p>
    </section>
  );
}

/**
 * Which place the band is about, for the landmark's name only.
 *
 * Not printed: the page header and the chooser already say which beach this is,
 * and a constant repeated is noise. But a landmark named only "Measured now"
 * loses that context for somebody navigating by region, who does not read the
 * page top to bottom — which is the argument `ReadingCard` made for keeping the
 * beach in its own accessible name.
 *
 * **The air slot alone supplies it**, because it is the slot that is always
 * present: all 51 beaches bind a station and all 18 areas share one, so it is
 * the one of the two that can never be missing. Falling back to the wave slot
 * would be a branch for a state that cannot occur, which is the speculative
 * flexibility CLAUDE.md refuses -- and an unreachable branch is one the tests
 * cannot honestly cover.
 *
 * On an area page `MeasuredPanel` has already relabelled `beachName` with the
 * area's name, so this reads the area there without asking which scope it is
 * in.
 */
function labelFor(readings: MeasuredReadings): string {
  const { air } = readings;
  return "agreement" in air ? air.areaName : air.beachName;
}
