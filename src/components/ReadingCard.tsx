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
  /** The heading's own id. Callers own it, because they own the anchor. */
  headingId: string;
  /** What this reading is. Short: three of these sit side by side. */
  title: string;
  /**
   * Which beach, for the accessible name only.
   *
   * Three cards in a row would each repeat the same beach, and a constant
   * printed three times is noise — the page header and the chooser already say
   * which beach this is. But a landmark named only "Air" loses that context for
   * someone navigating by region, who does not read the page top to bottom. So
   * it stays in the accessible name and leaves the layout.
   *
   * The region takes `aria-label` rather than pointing at the heading and
   * hiding half of it. A visually-hidden span was tried first and does not
   * work: the accessible-name algorithm trims each text node and joins inline
   * ones with no separator, so "Lowest tide today" and " · La Jolla Shores
   * Beach" concatenate to "Lowest tide today· La Jolla Shores Beach". That is
   * spec-correct, not a bug to route around, and a non-breaking space is
   * normalised away too. One string on the region is the arrangement that
   * simply says what it means — and it needs no `sr-only` utility, which this
   * repo does not otherwise use.
   */
  context?: string | null;
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
  context = null,
  figure = null,
  children,
}: ReadingCardProps) {
  return (
    // flex-col so a card fills the height of its row in the now-band. Three
    // cards of unequal content otherwise leave two ragged surfaces beside the
    // tallest, which reads as three different components rather than one row.
    <section
      aria-label={context !== null ? `${title} · ${context}` : title}
      className="rounded-card flex h-full flex-col bg-mist px-6 py-4"
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
