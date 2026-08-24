import { expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GALLERY_IMAGES, type GalleryImage } from "./galleryImages";

const ROW_LENGTH = 3;

/* The rows are chunks of the list rather than a structure in it, so the
   chunking lives here with the assertions that need it. Nothing in the app
   asks for rows — the paged row shows three at a time because the tiles are
   sized to fill it — so a helper in the module would be a seam with no caller.
   The static grid that would have asked for them is parked, so this is the
   arrangement to write against rather than an interim one. */
function rows(): GalleryImage[][] {
  const chunks: GalleryImage[][] = [];

  for (let start = 0; start < GALLERY_IMAGES.length; start += ROW_LENGTH) {
    chunks.push(GALLERY_IMAGES.slice(start, start + ROW_LENGTH));
  }

  return chunks;
}

test("the gallery divides into whole rows of three", () => {
  // A tenth image does not make a longer gallery, it makes a final page
  // holding one tile against a screenful of empty row.
  expect(GALLERY_IMAGES.length % ROW_LENGTH).toBe(0);
});

test("every row is two tall tiles and one wide one", () => {
  // Three tiles and their two gaps total exactly one content width only while
  // every row holds the same set of ratios, and that total is what makes
  // GalleryRow's scrollBy(clientWidth) land a whole page of three. Mistag one
  // image and its page is short by the difference, so every press after it
  // leaves the row starting mid-tile.
  for (const row of rows()) {
    expect(row.filter((image) => image.aspect === "tall")).toHaveLength(2);
    expect(row.filter((image) => image.aspect === "wide")).toHaveLength(1);
  }
});

test("the wide tile alternates side down the rows", () => {
  // Right, left, right. This is the rhythm the issue asked for, and the only
  // place the rule is written down — the data satisfies it, the layout reads
  // the data, and neither states it. The reader meets it as three successive
  // pages rather than as three stacked rows, which is a weaker reading of the
  // same rule but still the variation the gallery was asked for.
  rows().forEach((row, index) => {
    const expected = index % 2 === 0 ? ROW_LENGTH - 1 : 0;

    expect(row.findIndex((image) => image.aspect === "wide")).toBe(expected);
  });
});

test("every photograph names a file that is actually in public/", () => {
  // The one thing about these entries no other gate can see. A typo'd path
  // type-checks, renders an <img> with a real accessible name, and passes
  // every class-contract assertion in GallerySection.test.tsx — jsdom never
  // fetches it. What a reader gets is a broken tile.
  for (const { src } of GALLERY_IMAGES) {
    expect(src.startsWith("/")).toBe(true);
    expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
  }
});

test("every photograph says where its crop is anchored", () => {
  // Every tile is landscape and seven of the nine files are portrait, so
  // object-cover discards between 44% and 58% of each frame's height. Which
  // part it discards is a decision per photograph, and an entry that omits it
  // is not neutral — it silently takes the centre, which is wrong for at
  // least the stegosaurus and the sumi-e card.
  for (const { src, crop } of GALLERY_IMAGES) {
    expect(crop, `${src} has no crop`).toMatch(/^\d+% \d+%$/);
  }
});

test("no two slots hold the same photograph", () => {
  // The list is nine hand-placed entries and the tiles key off src, so a
  // duplicated path is both a repeated picture and two React children
  // claiming one key.
  const paths = GALLERY_IMAGES.map((image) => image.src);

  expect(new Set(paths).size).toBe(paths.length);
});

test("every photograph describes itself rather than its slot", () => {
  // CONTEXT.md's rule, asserted: a Placeholder's label says what the slot is
  // for, and a photograph's alt says what the photograph shows. The hero's
  // slot label was already wrong by the time its picture arrived, so these
  // are written against the files rather than inherited from the labels they
  // replaced. Length is the only part of that a gate can hold on to.
  for (const { src, alt } of GALLERY_IMAGES) {
    expect(alt.length, `${src} has a thin alt`).toBeGreaterThan(30);
  }
});
