import { expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
  // Every tile is landscape and six of the nine files are portrait, so
  // object-cover discards part of every frame's height — 44% of each of those
  // six. Which part it discards is a decision per photograph, and an entry
  // that omits it is not neutral: it silently takes the centre, which is wrong
  // for at least the sumi-e card, whose subject sits in the top third.
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

/* The size of each file as it is committed, in pixels.

   Every crop above was derived by looking at a render of one specific frame,
   and it means nothing without that frame. A wide tile scales its file to the
   tile's width and spills the height, so which band "50% 88%" names depends
   entirely on how tall the file is: at 1200x1600 it is the bottom 42%, and at
   1200x800 the same string is a band 84% as tall as the whole picture. Re-crop
   a file and its crop stops pointing at the thing it was aimed at.

   Nothing else in the repo would notice. GallerySection's width and height
   come from TILE_ASPECT — the tile's ratio, not the file's — so the markup is
   identical either way, the layout does not move, and every other assertion
   here passes. What changes is silently which part of the photograph a reader
   sees.

   So this is the number the crops hang on, written down. It cannot say a crop
   is right; it says the frame it was judged against has not moved underneath
   it. When one of these deliberately changes, the crop above it is re-derived
   by looking at a render, and the new size lands in the same commit. */
const FRAME_SIZES: Record<string, { width: number; height: number }> = {
  "/gallery/kids-with-portraits.jpg": { width: 1200, height: 1600 },
  "/gallery/neon-marker-robots.jpg": { width: 1200, height: 1600 },
  "/gallery/cherry-blossom-brushwork.jpg": { width: 1600, height: 1200 },
  "/gallery/framed-artwork-overhead.jpg": { width: 1600, height: 1247 },
  "/gallery/eeyore-and-balloon.jpg": { width: 1200, height: 1600 },
  "/gallery/cactus-collage.jpg": { width: 1200, height: 1600 },
  "/gallery/sumi-e-sun-and-bamboo.jpg": { width: 1200, height: 1600 },
  "/gallery/ink-brush-studies.jpg": { width: 1200, height: 1600 },
  "/gallery/stegosaurus-watercolor.jpg": { width: 1200, height: 800 },
};

/**
 * Read a JPEG's pixel dimensions out of its frame header.
 *
 * A JPEG is a run of marker segments: `0xFF`, a marker byte, then a two-byte
 * big-endian length that counts itself. The frame header — any SOFn — carries
 * height then width at bytes 3 to 7 of its payload, so reaching it is a walk
 * that skips each segment by its own length. No decoding, and no dependency:
 * `sharp` resolves here today only because Next pulls it in, and reaching for
 * it would put a library this repo never chose between a gate and its answer.
 *
 * SOFn is `0xC0` through `0xCF` less the three of those that are not frames —
 * `0xC4` (Huffman tables), `0xC8` (reserved) and `0xCC` (arithmetic coding
 * conditioning).
 *
 * @param bytes A whole JPEG file.
 */
function readJpegSize(bytes: Buffer): { width: number; height: number } {
  // Past the start-of-image marker, which carries no length.
  let at = 2;

  while (at + 9 <= bytes.length) {
    if (bytes[at] !== 0xff) {
      throw new Error(`expected a marker at byte ${at}, found ${bytes[at]}`);
    }

    const marker = bytes[at + 1];
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isFrame) {
      return {
        width: bytes.readUInt16BE(at + 7),
        height: bytes.readUInt16BE(at + 5),
      };
    }

    at += 2 + bytes.readUInt16BE(at + 2);
  }

  throw new Error("ran out of file before finding a frame header");
}

test("every photograph is still the frame its crop was derived from", () => {
  // Both directions, so a photograph that leaves the gallery takes its pinned
  // size with it rather than leaving a row that asserts nothing.
  expect(Object.keys(FRAME_SIZES).sort()).toEqual(
    GALLERY_IMAGES.map((image) => image.src).sort(),
  );

  for (const { src } of GALLERY_IMAGES) {
    const bytes = readFileSync(join(process.cwd(), "public", src));

    expect(readJpegSize(bytes), `${src} is not the size it was`).toEqual(
      FRAME_SIZES[src],
    );
  }
});
