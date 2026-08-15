/**
 * The gallery's nine image slots, in the order they are laid out.
 *
 * A row of the gallery is three of these — two `tall` and one `wide`, sharing
 * one height, so the wide one is the wider tile rather than the shorter one.
 * The wide slot alternates right, left, right down the rows, which is what
 * gives the gallery its print-zine rhythm without ragging its edges: every row
 * holds the same set of ratios, so every row totals the same width whatever
 * the order. See docs/plans/gallery-aspect-rhythm.md.
 *
 * The aspect belongs to the image rather than to its position. Deriving it
 * from the index cannot break, but it silently re-crops the gallery whenever
 * the list is reordered, which stops being harmless the moment photographs
 * replace the placeholders. `galleryImages.test.ts` asserts the composition
 * invariants over this list instead, so a tenth image or a mistagged one fails
 * the gate rather than quietly going ragged.
 */

/** `tall` is 4:3, `wide` is 16:9. */
export type GalleryAspect = "tall" | "wide";

export type GalleryImage = {
  /** Describes the future photograph; doubles as the accessible name. */
  label: string;
  aspect: GalleryAspect;
};

/* PLACEHOLDER TAGGING, to replace with the real content pass. These labels are
   example content carried over from the reference template, not a brief for
   the photographs that will replace them, and which three images are wide is
   the owner's decision once those exist. Positions 3, 4 and 9 are wide here
   because that is what produces the right/left/right rhythm the layout is
   built around — marked rather than left to be discovered, the same way the
   invented quote in QuoteStats is. */
export const GALLERY_IMAGES: GalleryImage[] = [
  { label: "Art class at the park", aspect: "tall" },
  { label: "Mixed media art", aspect: "tall" },
  { label: "Neon chalk art", aspect: "wide" },
  { label: "Sunset painting", aspect: "wide" },
  { label: "Watercolor houses", aspect: "tall" },
  { label: "Cactus collage", aspect: "tall" },
  { label: "Pixel art", aspect: "tall" },
  { label: "Kids with artwork", aspect: "tall" },
  { label: "Dinosaur watercolor", aspect: "wide" },
];
