/**
 * The backing a reading card's glyph stands on. See ADR-0015.
 *
 * The glyphs this page uses are pale. 🐚 is a grey-lavender spiral and 💨 is a
 * white puff; rendered on `bg-mist` at any size, both disappear. That is the
 * objection `DESIGN_BRIEF.md` raised against a shell, and it holds -- what does
 * not follow from it is that the glyph has to change, because the thing the
 * glyph stands on can change instead.
 *
 * `bg-ocean` and not `bg-dark`, which also carries all three: `text-ocean` is
 * already this page's accent and sets the eyebrow directly above the chip, so
 * ocean reads as the same system rather than as a foreign black block. Purple
 * leaves the shell pale and yellow washes out the puff; both were rendered as a
 * set before this was chosen.
 *
 * **44px, not the 56px the chip wants to be.** The glyph shares the lead
 * figure's row, so the row is as tall as the taller of the two and the figure is
 * 36px -- every pixel of chip above 36 is a pixel added to all three cards, and
 * the band is what the first screen is spent on. 44 costs 8px; 56 costs 24. The
 * padding goes rather than the glyph: `text-3xl` fills the chip nearly to its
 * edge, which is what an app icon does and what keeps a 30px mark inside a 44px
 * box.
 *
 * 30px is also the rank this page was missing. `ReservedSlot` renders 24px at
 * row density and 48px at section density, so a live reading now marks itself
 * larger than the placeholder rows beside it -- which is the right way round,
 * and was not true when the glyph was 10px.
 *
 * Composing this does not prove the rendered chip is 44px or that the glyph
 * reads on it -- jsdom applies no stylesheets (ADR-0001) -- so tests assert that
 * a card refers to the standard, and a human confirms it at the review viewport.
 */
export const GLYPH_CHIP =
  "rounded-thumb flex size-11 shrink-0 items-center justify-center bg-ocean text-3xl leading-none";
