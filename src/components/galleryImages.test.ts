import { expect, test } from "vitest";
import { GALLERY_IMAGES, type GalleryImage } from "./galleryImages";

const ROW_LENGTH = 3;

/* The rows are chunks of the list rather than a structure in it, so the
   chunking lives here with the assertions that need it. Nothing in the app
   asks for rows yet — the paged row shows three at a time because the tiles
   are sized to fill it — so a helper in the module would be a seam with no
   caller. */
function rows(): GalleryImage[][] {
  const chunks: GalleryImage[][] = [];

  for (let start = 0; start < GALLERY_IMAGES.length; start += ROW_LENGTH) {
    chunks.push(GALLERY_IMAGES.slice(start, start + ROW_LENGTH));
  }

  return chunks;
}

test("the gallery divides into whole rows of three", () => {
  // A tenth image does not make a longer gallery, it makes a row of one
  // against an edge the other rows do not share.
  expect(GALLERY_IMAGES.length % ROW_LENGTH).toBe(0);
});

test("every row is two tall tiles and one wide one", () => {
  // The row's total width is what keeps the grid's edges flush, and it is only
  // constant while every row holds the same set of ratios. Mistag one image
  // and one row gets narrower than the others.
  for (const row of rows()) {
    expect(row.filter((image) => image.aspect === "tall")).toHaveLength(2);
    expect(row.filter((image) => image.aspect === "wide")).toHaveLength(1);
  }
});

test("the wide tile alternates side down the rows", () => {
  // Right, left, right. This is the rhythm the issue asked for, and the only
  // place the rule is written down — the data satisfies it, the layout reads
  // the data, and neither states it.
  rows().forEach((row, index) => {
    const expected = index % 2 === 0 ? ROW_LENGTH - 1 : 0;

    expect(row.findIndex((image) => image.aspect === "wide")).toBe(expected);
  });
});
