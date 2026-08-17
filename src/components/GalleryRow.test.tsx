import { expect, test } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { GalleryRow } from "./GalleryRow";

function renderRow() {
  const rowRef = createRef<HTMLDivElement>();

  render(
    <GalleryRow id="gallery-row" label="Artwork" rowRef={rowRef}>
      <div>first</div>
      <div>second</div>
    </GalleryRow>,
  );

  return { row: screen.getByRole("group", { name: "Artwork" }), rowRef };
}

test("the row is reachable and named for a keyboard or screen reader", () => {
  const { row } = renderRow();

  // Without this the row is a scrollable region nobody can enter without a
  // pointer, and one with no accessible name.
  expect(row.getAttribute("tabindex")).toBe("0");
  expect(row.getAttribute("aria-label")).toBe("Artwork");
});

test("the row carries the id its pager points at", () => {
  const { row } = renderRow();

  // The pager sits outside the row now, so aria-controls is the only thing
  // tying the two together — and it can only name an id that is really here.
  expect(row.id).toBe("gallery-row");
});

test("the row hands itself to the paging mechanic", () => {
  const { row, rowRef } = renderRow();

  // page() measures clientWidth off this element. A ref pointed anywhere else
  // scrolls nothing, silently.
  expect(rowRef.current).toBe(row);
});

test("the row snaps horizontally without moving on its own", () => {
  const { row } = renderRow();

  // jsdom applies no stylesheets, so the class contract is the seam. The
  // absence of the animation is the point of this module.
  expect(row.className).toContain("overflow-x-auto");
  expect(row.className).toContain("snap-x");
  expect(row.className).not.toContain("animate-strip");
});

test("the row's snap positions account for its own gutter", () => {
  const { row } = renderRow();

  // A snapport is the scrollport reduced by scroll-padding. With none, and
  // snap-start on the tiles, the first tile's snap position is the padding box
  // start — so under snap-mandatory the row rests at scrollLeft: padding-left,
  // one whole gutter in, with the artwork flush to the screen edge and the
  // gutter consumed. Measured at 48 (1536) and 24 (375) before this matched;
  // see docs/plans/gallery-row-gutter.md.
  expect(row.className).toContain("scroll-pl-gutter-sm");
  expect(row.className).toContain("md:scroll-pl-gutter");
});

test("the scrollbar is hidden, because the controls are the affordance", () => {
  const { row } = renderRow();

  expect(row.className).toContain("no-scrollbar");
});

test("the row does not animate for a reader who asked for less motion", () => {
  const { row } = renderRow();

  // Every other piece of motion here is gated — motion-safe:scroll-smooth on
  // html, motion-reduce:animate-none on the marquee, motion-safe on snapping
  // itself. A bare scroll-smooth would animate every press regardless.
  expect(row.className).toContain("motion-safe:scroll-smooth");
  expect(row.className).not.toMatch(/(^|\s)scroll-smooth/);
});

test("the row carries no control of its own", () => {
  const { row } = renderRow();

  // This replaces an assertion that the controls sat absolutely positioned on
  // the row's left and right edges. That arrangement is what ADR-0008 removed:
  // a 44px control does not fit a 24px gutter below md, and padding is empty
  // space only at the scroll extremes, so an overlaid control covers artwork
  // at some scroll position whatever the padding is.
  expect(row.querySelector("button")).toBeNull();
  expect(row.className).not.toContain("relative");
});
