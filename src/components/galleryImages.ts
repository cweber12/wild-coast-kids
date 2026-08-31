/**
 * The gallery's nine photographs, in the order they are laid out.
 *
 * A row of the gallery is three of these — two `tall` and one `wide`, sharing
 * one height, so the wide one is the wider tile rather than the shorter one.
 * The wide slot alternates right, left, right, which is the print-zine rhythm
 * the gallery was asked for. From `lg` the reader meets those rows one at a
 * time, as successive pages of the paged row.
 *
 * Every row holding the same set of ratios is load-bearing rather than tidy.
 * The 0.3/0.3/0.4 shares make three tiles and their two gaps total exactly one
 * content width, which is what lets `GalleryRow`'s scrollBy(clientWidth) land a
 * whole page of three on every press. Mistag one image and its page is short by
 * the difference, and every page after it starts mid-tile.
 *
 * That reason is not the original one. The composition was designed for a
 * static grid, where a constant row width kept the grid's outer edges flush;
 * the grid is parked and the rule outlived it. See
 * docs/plans/gallery-aspect-rhythm.md.
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
  /** Path under `public/`. */
  src: string;
  /** Describes this photograph. It is the tile's accessible name. */
  alt: string;
  aspect: GalleryAspect;
  /**
   * The `object-position` the tile crops around, as `x y`.
   *
   * Every tile is landscape and six of the nine photographs are portrait 3:4,
   * so `object-cover` scales each one to the tile's width and spills the
   * height. Those six are exactly the six `tall` slots, which show 56% of a
   * portrait frame; the three landscape files take the `wide` slots and spill
   * less, but all nine spill something. Which 56% is a decision about the
   * artwork, and the default — dead centre — makes it by accident. The sumi-e
   * card would lose its subject to that default outright: it sits in the top
   * third of its frame.
   *
   * The x half is inert and written anyway. A source narrower than its tile
   * is scaled to fit the width exactly, so there is no horizontal overflow
   * left to position — but that is a fact about these nine files, not about
   * the field, and a landscape photograph arriving in a `tall` slot would
   * start using it without anything here changing.
   */
  crop: string;
};

/* Slot order is a reading order, not a filing order: the row opens on two kids
   holding up work they just finished, and closes on the stegosaurus.

   Which three are wide was decided by which three survive a 16:9 band, and all
   three are landscape files. Two were photographed that way; the stegosaurus
   was cropped to it in #185 and reads better for it, the dinosaur being a long
   horizontal subject a wide crop frames better than a tall one does. */
export const GALLERY_IMAGES: GalleryImage[] = [
  {
    src: "/gallery/kids-with-portraits.jpg",
    alt: "Two kids holding up their finished self-portraits, each mounted on a hand-cut wavy watercolor frame",
    aspect: "tall",
    // Low, but only just: the two held-up frames and the hands gripping them
    // span almost exactly the 900px a 4:3 crop leaves, so there is nowhere
    // else for this one to sit.
    crop: "50% 10%",
  },
  {
    src: "/gallery/neon-marker-robots.jpg",
    alt: "Two robots drawn in neon acrylic marker on black paper, on a stone table in the sun",
    aspect: "tall",
    // Down onto the near robot. The grass and the marker case at the top are
    // what a centred crop would have kept instead.
    crop: "50% 82%",
  },
  {
    src: "/gallery/cherry-blossom-brushwork.jpg",
    alt: "Four cherry blossom brush paintings laid out on the table, each branch worked in a different hand",
    aspect: "wide",
    // Hard to the bottom. All four paintings sit in the lower two thirds and
    // the top third is bare kraft paper.
    crop: "50% 100%",
  },
  {
    src: "/gallery/framed-artwork-overhead.jpg",
    alt: "Five finished pieces laid out on kraft paper, a child's finger pointing at the one with the balloon",
    aspect: "wide",
    // The one crop here that loses something either way: both rows of work
    // plus the pointing hand are taller than a 16:9 band, and there is less to
    // go round than there was. The frame lost 230px off its left edge in #185,
    // taking with it a piece hand-lettered with a child's name, so the band is
    // 771px of 1247 rather than 900 of 1247. Low enough to keep the pointing
    // hand and all three of the lower row, which puts the loss on the top
    // edges of the upper two. Rendered at 25 through 85 and looked: below 55
    // the hand is a fingertip in the corner rather than a gesture, and above
    // 75 the bottom third goes to bare kraft paper.
    crop: "50% 65%",
  },
  {
    src: "/gallery/eeyore-and-balloon.jpg",
    alt: "A watercolor Eeyore hanging from a red balloon, cut out and mounted on a scalloped painted frame",
    aspect: "tall",
    // The most awkward fit in the row: balloon at the top, donkey at the
    // bottom, and more frame between them than a 4:3 band can hold. Anchored
    // to keep Eeyore's face whole, which costs the balloon everything but its
    // lower arc — the other way round crops his muzzle, and the muzzle is the
    // joke. Picked by rendering 48 through 74 and looking: below this the
    // chin goes, above it the balloon does, and this is the only value that
    // keeps both readable.
    crop: "50% 56%",
  },
  {
    src: "/gallery/cactus-collage.jpg",
    alt: "Cut-out cactus paintings arranged beside a finished still life of passion fruit",
    aspect: "tall",
    // Down onto the cut-outs, keeping the taped corner of the still life in
    // the frame above them. Centred, this tile would have been mostly bare
    // table; any higher and the blank back of the still-life card takes a
    // quarter of it.
    crop: "50% 88%",
  },
  {
    src: "/gallery/sumi-e-sun-and-bamboo.jpg",
    alt: "A sumi-e card in progress — orange sun, green bamboo and black brush characters",
    aspect: "tall",
    // Near the top, where the card is. Below it is the printed reference
    // sheet, which is a handout rather than anyone's work.
    crop: "50% 3%",
  },
  {
    src: "/gallery/ink-brush-studies.jpg",
    alt: "Ink brush studies in grey wash, orchids and single strokes practised across two sheets",
    aspect: "tall",
    // Down onto the lower sheet's studies, keeping the near edge of the upper
    // sheet in frame so it still reads as two.
    crop: "50% 72%",
  },
  {
    src: "/gallery/stegosaurus-watercolor.jpg",
    alt: "A watercolor stegosaurus cut out and mounted on white card, its plates painted red and orange",
    aspect: "wide",
    // Barely off the top, where 88% used to be almost the bottom. The file was
    // re-cropped to 1200x800 to take a doodle sheet carrying two children's
    // names out of the published bytes (#185), and what is left is the
    // dinosaur and the card it is mounted on — so a 16:9 band now spills 125px
    // rather than 925, and the old value would have cut the plates off. Picked
    // by rendering the band at 0, 15, 30, 50, 75 and 100 and looking: this is
    // the one that leaves about as much room above the plates as below the
    // tail's curl, and from 30 the top plates start meeting the edge.
    crop: "50% 15%",
  },
];
