/**
 * The shape every reading on this page shares: a glyph, a heading, one figure
 * that leads, and whatever that particular reading has to say beneath it.
 *
 * **Shared rather than written three times.** `ReservedSlot`'s docstring records
 * why: "the blank line between the headline and the detail is part of the shape,
 * and it is exactly what drifted while six call sites each wrote their own."
 * The same drift had already started here — the three panels rendered their
 * leading figure at `text-4xl`, a raw Tailwind size, while the design system
 * defines `--text-stat` at the same 36px for exactly this. Two names for one
 * decision is one of them waiting to be wrong.
 *
 * **The surface is `mist`, and that pairing is not a guess.** `globals.css`
 * records that `--color-fog` was darkened from the template specifically because
 * the original failed WCAG AA against mist, and the replacement "reads the same
 * and clears 5:1 everywhere". Fog on mist is the one secondary-text pairing this
 * repo has already measured, so the card is built on it.
 *
 * **Quiet surface, loud chrome.** The site's other cards are saturated purple and
 * ocean with white type, and that is right for an offer. This is an instrument
 * reading shown to people taking children into the ocean, and ADR-0009 forbids
 * the site from making a judgement about it. A card that looked like a verdict
 * would be making one in CSS. So the colour goes into the glyph and the eyebrow,
 * and the figure stays dark on light where a number belongs.
 *
 * **The figure slot is never empty.** A caller with nothing to lead on passes
 * null and gets no slot at all, rather than a blank one — an empty space where a
 * number goes reads as a fault, which is the same reason `WindToday` refuses to
 * render an empty primary.
 */

import type { ReactNode } from "react";

type ReadingCardProps = {
  /** Sets the subject at a glance; hidden from assistive tech, which reads the heading. */
  emoji: string;
  /** Ties the heading to the region. Callers own it, because they own the anchor. */
  headingId: string;
  /** What this reading is, and which beach it is for. */
  title: string;
  /**
   * The one figure that leads. `null` renders no slot rather than an empty one.
   */
  figure?: string | null;
  /** Everything this particular reading has to say: sentences, stats, disclosures, provenance. */
  children: ReactNode;
};

/* leading-none on a decorative glyph, for the reason `ProgramCards` gives:
   at this size the default line box adds visible height around an emoji that
   nothing on screen accounts for. */
const EMOJI = "mb-3 block text-[34px] leading-none";

export function ReadingCard({
  emoji,
  headingId,
  title,
  figure = null,
  children,
}: ReadingCardProps) {
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-card bg-mist px-6 py-5"
    >
      <span aria-hidden="true" className={EMOJI}>
        {emoji}
      </span>

      <h2
        id={headingId}
        className="text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase"
      >
        {title}
      </h2>

      {figure !== null && (
        <p className="text-stat leading-none mb-2 font-black italic">
          {figure}
        </p>
      )}

      {children}
    </section>
  );
}
