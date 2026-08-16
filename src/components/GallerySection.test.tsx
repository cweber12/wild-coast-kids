import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { GallerySection } from "./GallerySection";

test("the gallery heading is reachable", () => {
  render(<GallerySection />);

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toContain("What kids");
  expect(heading.textContent).toContain("make here.");
});

test("every image slot is exposed to assistive tech exactly once", () => {
  render(<GallerySection />);

  // Each placeholder is now rendered once, full stop — the looping strip
  // rendered every one twice and relied on aria-hidden to keep the copy
  // quiet. One of them is simply a stronger guarantee than the other.
  for (const name of [
    "Art class at the park",
    "Watercolor houses",
    "Dinosaur watercolor",
  ]) {
    expect(screen.getAllByRole("img", { name })).toHaveLength(1);
  }
});

test("a wide tile takes the wider share of the row", () => {
  render(<GallerySection />);

  // jsdom applies no stylesheets, so the class contract is the seam. What it
  // guards is the arithmetic: the shares are the aspect ratios normalised, so
  // 0.4 against 0.3 is what makes three tiles one height and a full row.
  const wide = screen.getByRole("img", { name: "Neon chalk art" });
  const tall = screen.getByRole("img", { name: "Mixed media art" });

  expect(wide.className).toContain("aspect-video");
  expect(wide.className).toContain("lg:w-[calc((100%-3rem)*0.4)]");
  expect(tall.className).toContain("aspect-4/3");
  expect(tall.className).toContain("lg:w-[calc((100%-3rem)*0.3)]");
});

test("tiles are centred rather than stretched", () => {
  render(<GallerySection />);

  // A flex child defaults to stretch, which forces a height and leaves
  // aspect-ratio with nothing to decide — every 16:9 tile would be pulled up
  // to a 4:3 tile's height and the variation would vanish silently.
  expect(
    screen.getByRole("img", { name: "Neon chalk art" }).className,
  ).toContain("self-center");
});

test("the reader drives the row", () => {
  render(<GallerySection />);

  expect(
    screen.getByRole("button", { name: /previous artwork/i }),
  ).toBeDefined();
  expect(screen.getByRole("button", { name: /next artwork/i })).toBeDefined();
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
