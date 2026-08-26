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
 * **The surface is `dark`, and it is what makes the glyphs legible.** See
 * ADR-0015. The card was `mist`, which sits at 1.10:1 against the page it is on
 * -- a fill that barely exists -- and which loses a shell and a wind puff
 * entirely, both being pale glyphs. Nothing about the text needed the pale
 * surface: `text-fog` was measured against mist and is simply replaced here, by
 * `text-white` for figures and the two roles named in `cardText.ts` for
 * everything else, each re-measured on this surface.
 *
 * **Dark rather than purple or ocean, and that is the whole of the choice.**
 * The site's other cards are saturated purple and ocean with white type, and
 * that is right for an offer. This is an instrument reading shown to people
 * taking children into the ocean, and ADR-0009 forbids the site from making a
 * judgement about it -- so it must not be dressed as the thing next to it that
 * *is* selling something. `--color-dark` is the footer's colour: present,
 * saturated, and not already spoken for.
 *
 * A verdict would be *differential* colour, a green card beside a red one. All
 * three take this surface whatever the water is doing.
 *
 * **The glyph sits beside the figure rather than above the heading.** It was a
 * 34px block with a 12px margin on a line of its own -- 46px per card, in every
 * card -- and that cost was real, so it became 10px of inline text inside the
 * heading. At 10px a full-colour emoji is not a mark, it is a smudge in front
 * of an otherwise crisp eyebrow: the fix traded the glyph away rather than
 * moving it.
 *
 * The row above the heading is not the only place a glyph can go. The lead
 * figure's row already exists and is already 36px tall, and a 30px glyph fits
 * inside it -- so the size comes back for nothing, and the 46px stays bought.
 *
 * `WeekGrid` keeps its inline `<dt>` glyph and is not converted with this. Its
 * cells are 148px on a pale surface, which is a different problem from a glyph
 * beside a 36px figure on a dark one; one page marking a product two ways is
 * the lesser cost here.
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
      className="rounded-card flex h-full flex-col bg-dark px-6 py-4"
    >
      <h2
        id={headingId}
        className="text-2xs mb-3 font-extrabold tracking-widest text-yellow uppercase"
      >
        {title}
      </h2>

      {/*
        One row for the glyph and the figure, and the row renders whether or not
        there is a figure. A card with no station still has a subject, and
        dropping its mark when the reading goes quiet makes the card read as
        more broken than it is -- the same argument the empty figure slot loses
        on, in the opposite direction.
      */}
      <div className="mb-2 flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl leading-none">
          {emoji}
        </span>

        {figure !== null && (
          <p className="text-stat leading-none font-black text-white italic">
            {figure}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}
