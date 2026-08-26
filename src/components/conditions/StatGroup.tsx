/**
 * The supporting measurements, as figures rather than as clauses in a sentence.
 *
 * **This is the fix for the complaint that started the redesign.** Six real
 * measurements — swell period, water temperature, wind speed, gust, sky,
 * visibility — were dissolved into three prose sentences, so learning the wind
 * speed meant reading a paragraph. They are numbers, and a reader scanning for
 * one should not have to parse grammar to find it.
 *
 * **What did not move is the plain-language line.** `WavesToday`'s docstring is
 * explicit that "2.6 ft" tells a surfer what they need and tells a parent of an
 * eight-year-old very little, so the figure keeps its companion sentence. The
 * stats sit beneath that sentence rather than replacing it. Turning everything
 * into a table would delete the one thing on the card written for the audience
 * this site is actually for.
 *
 * **A description list, because the pairing is the content.** `dt`/`dd` makes
 * label-to-value structural rather than a visual accident of one line sitting
 * above another — which is what carries the relationship for a reader who cannot
 * see the layout, and is what makes the two-provenance grouping in the air panel
 * survive at all.
 *
 * **A group is one provenance.** Callers with figures from two stations render
 * two groups with two attributions rather than one group of six, because
 * ADR-0010 turns on a reader being able to tell which station supplied which
 * number. One `StatGroup` never spans two sources.
 *
 * **Absence is a value, not a gap.** A `null` renders "Not reported" rather than
 * nothing, for the reason this page states everywhere else: a blank where a
 * measurement goes is read as a calm sea rather than as a quiet instrument. The
 * buoy that publishes waves but no water temperature is a measured fact about
 * that buoy, not a hypothetical.
 *
 * **Size is not what makes these prominent — weight is.** The token scale jumps
 * from 13px to 36px with nothing between, and the site's own direction is that
 * "weight and italics carry the hierarchy". So a value is body-sized, extrabold
 * and ink-dark against the fog-grey prose around it, rather than an off-system
 * size invented here.
 */

import { CARD_MUTED } from "./cardText";

export type Stat = {
  /** What the figure is. Short: it sets in 10px uppercase. */
  label: string;
  /** Already worded and rounded by the caller. `null` states the absence. */
  value: string | null;
};

export function StatGroup({ stats }: { stats: readonly Stat[] }) {
  return (
    <dl className="mb-3 flex flex-wrap gap-x-7 gap-y-2">
      {stats.map(({ label, value }) => (
        <div key={label}>
          <dt
            className={`text-2xs font-extrabold tracking-widest uppercase ${CARD_MUTED}`}
          >
            {label}
          </dt>
          <dd
            className={
              value === null
                ? `text-base italic ${CARD_MUTED}`
                : "text-base font-extrabold text-white"
            }
          >
            {value ?? "Not reported"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
