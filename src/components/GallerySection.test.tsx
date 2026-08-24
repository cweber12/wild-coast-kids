import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { GallerySection } from "./GallerySection";
import { GALLERY_IMAGES } from "./galleryImages";

test("the gallery heading is reachable", () => {
  render(<GallerySection />);

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toContain("What kids");
  expect(heading.textContent).toContain("make here.");
});

test("every photograph is exposed to assistive tech exactly once", () => {
  render(<GallerySection />);

  // Each tile is now rendered once, full stop — the looping strip rendered
  // every one twice and relied on aria-hidden to keep the copy quiet. One of
  // them is simply a stronger guarantee than the other. Driven off the list
  // rather than a sample of it, so a tenth photograph is covered the day it
  // lands instead of the day someone remembers to add it here.
  for (const { alt } of GALLERY_IMAGES) {
    expect(screen.getAllByRole("img", { name: alt })).toHaveLength(1);
  }
});

test("every tile resolves to its own file in public/", () => {
  render(<GallerySection />);

  // getByRole, so this asserts the frame a screen reader reaches rather than
  // that an <img> was constructed. The src is matched loosely because
  // next/image rewrites it through the optimizer: what has to hold is that
  // each tile resolves to the file its entry names, not the exact query it is
  // fetched with. Without this the whole row could point at one photograph.
  for (const { src, alt } of GALLERY_IMAGES) {
    const filename = src.split("/").pop();

    expect(
      screen.getByRole("img", { name: alt }).getAttribute("src"),
      `${alt} does not resolve to ${filename}`,
    ).toContain(filename);
  }
});

test("every tile crops around its own anchor", () => {
  render(<GallerySection />);

  // The seam for the one decision that is per photograph. object-cover throws
  // away 44% to 58% of a portrait frame's height, and the default keeps the
  // middle — which loses the stegosaurus, who sits in the bottom third of his
  // frame. jsdom has no stylesheet, so a class name here would assert only
  // that a string was spelled; an inline objectPosition it reads back exactly.
  for (const { alt, crop } of GALLERY_IMAGES) {
    const tile = screen.getByRole("img", { name: alt });

    expect(tile.style.objectPosition, `${alt} is cropped wrong`).toBe(crop);
  }
});

test("a wide tile takes the wider share of the row", () => {
  render(<GallerySection />);

  // jsdom applies no stylesheets, so the class contract is the seam. What it
  // guards is the arithmetic: the shares are the aspect ratios normalised, so
  // 0.4 against 0.3 is what makes three tiles one height and a full row.
  const wide = screen.getByRole("img", { name: /stegosaurus/i });
  const tall = screen.getByRole("img", { name: /neon acrylic marker/i });

  expect(wide.className).toContain("aspect-video");
  expect(wide.className).toContain("lg:w-[calc((100%-3rem)*0.4)]");
  expect(tall.className).toContain("aspect-4/3");
  expect(tall.className).toContain("lg:w-[calc((100%-3rem)*0.3)]");
});

test("a tile fills its frame rather than sitting inside it", () => {
  render(<GallerySection />);

  // The tile IS the <img> now, so its aspect box is only a crop while
  // object-cover is on it. Without that the browser uses the replaced
  // element's own ratio and every portrait photograph squashes into a
  // landscape box.
  expect(screen.getByRole("img", { name: /stegosaurus/i }).className).toContain(
    "object-cover",
  );
});

test("tiles are centred rather than stretched", () => {
  render(<GallerySection />);

  // A flex child defaults to stretch, which forces a height and leaves
  // aspect-ratio with nothing to decide — every 16:9 tile would be pulled up
  // to a 4:3 tile's height and the variation would vanish silently.
  expect(screen.getByRole("img", { name: /stegosaurus/i }).className).toContain(
    "self-center",
  );
});

test("the reader drives the row", () => {
  render(<GallerySection />);

  expect(
    screen.getByRole("button", { name: /previous artwork/i }),
  ).toBeDefined();
  expect(screen.getByRole("button", { name: /next artwork/i })).toBeDefined();
});

test("the controls sit in the heading block, not on the artwork", () => {
  render(<GallerySection />);

  // Where the pair sits is the whole of ADR-0008, and it is the one part of
  // that decision jsdom can see: the heading block is a different element from
  // the row, so containment is a real assertion even without a stylesheet.
  const headingBlock = screen.getByRole("heading", { level: 2 }).parentElement;
  const row = screen.getByRole("group", {
    name: /artwork from wild coast kids/i,
  });

  for (const name of [/previous artwork/i, /next artwork/i]) {
    const control = screen.getByRole("button", { name });
    expect(headingBlock?.contains(control)).toBe(true);
    expect(row.contains(control)).toBe(false);
  }
});

test("the controls name the row they page", () => {
  render(<GallerySection />);

  // Wired here rather than in either component, so a row and a pager that
  // disagree about the id fail rather than quietly controlling nothing.
  const row = screen.getByRole("group", {
    name: /artwork from wild coast kids/i,
  });

  expect(row.id).not.toBe("");
  expect(
    screen
      .getByRole("button", { name: /previous artwork/i })
      .getAttribute("aria-controls"),
  ).toBe(row.id);
});

test("the section puts its own padding back where there is no stop", () => {
  const { container } = render(<GallerySection />);

  // A stop supplies this section's vertical space, so the section drops its
  // own to avoid counting it twice — but only where a stop exists. Gated on
  // md instead, a 639px window would get six sections butted flush together
  // (issue #37).
  // Listed rather than searched for, so a stray vertical padding fails too.
  // Spelling the md-gated class here to assert its absence would compile it
  // into the shipped stylesheet, which is the hazard scripts/built-css.mjs
  // documents.
  const vertical = (container.firstElementChild?.className ?? "")
    .split(/\s+/)
    .filter((className) => /(^|:)p[byt]-/.test(className));

  expect(vertical.sort()).toEqual(["py-section-sm", "stops:py-0"].sort());
});
