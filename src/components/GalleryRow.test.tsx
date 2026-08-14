import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GalleryRow } from "./GalleryRow";

function renderRow() {
  render(
    <GalleryRow label="Artwork">
      <div>first</div>
      <div>second</div>
    </GalleryRow>,
  );

  const row = screen.getByRole("group", { name: "Artwork" });

  // jsdom has no layout, so the row cannot really scroll and measures zero.
  // Stubbing both is what lets the assertion be about the distance asked for
  // rather than about jsdom.
  const scrollBy = vi.fn();
  row.scrollBy = scrollBy;
  Object.defineProperty(row, "clientWidth", { value: 900, configurable: true });

  return { row, scrollBy };
}

test("the row is reachable and named for a keyboard or screen reader", () => {
  const { row } = renderRow();

  // Without this the row is a scrollable region nobody can enter without a
  // pointer, and one with no accessible name.
  expect(row.getAttribute("tabindex")).toBe("0");
  expect(row.getAttribute("aria-label")).toBe("Artwork");
});

test("next pages forward by a screenful", () => {
  const { scrollBy } = renderRow();

  fireEvent.click(screen.getByRole("button", { name: /next artwork/i }));

  // A screenful, not one item: how many items that is changes with the
  // width, and snap-mandatory pulls the result back onto an item edge, so
  // the control never has to know the count.
  expect(scrollBy).toHaveBeenCalledWith({ left: 900 });
});

test("previous pages back by a screenful", () => {
  const { scrollBy } = renderRow();

  fireEvent.click(screen.getByRole("button", { name: /previous artwork/i }));

  expect(scrollBy).toHaveBeenCalledWith({ left: -900 });
});

test("the row snaps horizontally without moving on its own", () => {
  const { row } = renderRow();

  // jsdom applies no stylesheets, so the class contract is the seam. The
  // absence of the animation is the point of this module.
  expect(row.className).toContain("overflow-x-auto");
  expect(row.className).toContain("snap-x");
  expect(row.className).not.toContain("animate-strip");
});

test("the scrollbar is hidden, because the controls are the affordance", () => {
  const { row } = renderRow();

  expect(row.className).toContain("no-scrollbar");
});

test("the controls do not animate for a reader who asked for less motion", () => {
  const { row } = renderRow();

  // Every other piece of motion here is gated — motion-safe:scroll-smooth on
  // html, motion-reduce:animate-none on the marquee, motion-safe on snapping
  // itself. A bare scroll-smooth would animate every press regardless.
  expect(row.className).toContain("motion-safe:scroll-smooth");
  expect(row.className).not.toMatch(/(^|\s)scroll-smooth/);
});

test("the controls sit on the row's edges", () => {
  renderRow();

  // Overlaid left and right rather than stacked beneath, so the row reads as
  // one paged surface instead of a scroller with buttons parked under it.
  const previous = screen.getByRole("button", { name: /previous artwork/i });
  const next = screen.getByRole("button", { name: /next artwork/i });

  expect(previous.className).toContain("absolute");
  expect(previous.className).toContain("left-3");
  expect(next.className).toContain("absolute");
  expect(next.className).toContain("right-3");
});
