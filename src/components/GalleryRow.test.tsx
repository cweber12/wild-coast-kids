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

  // jsdom has no layout, so the row cannot really scroll and every element
  // measures zero. Stubbing both is what lets the assertion be about the
  // distance asked for rather than about jsdom.
  const scrollBy = vi.fn();
  row.scrollBy = scrollBy;
  screen.getByText("first").getBoundingClientRect = () =>
    ({ width: 320 }) as unknown as DOMRect;

  return { row, scrollBy };
}

test("the row is reachable and named for a keyboard or screen reader", () => {
  const { row } = renderRow();

  // Without this the row is a scrollable region nobody can enter without a
  // pointer, and one with no accessible name.
  expect(row.getAttribute("tabindex")).toBe("0");
  expect(row.getAttribute("aria-label")).toBe("Artwork");
});

test("next scrolls forward by exactly one item", () => {
  const { scrollBy } = renderRow();

  fireEvent.click(screen.getByRole("button", { name: /next artwork/i }));

  // Measured from the item, not assumed: the placeholders are one width
  // below md and another above it.
  expect(scrollBy).toHaveBeenCalledWith({ left: 320 });
});

test("previous scrolls back by exactly one item", () => {
  const { scrollBy } = renderRow();

  fireEvent.click(screen.getByRole("button", { name: /previous artwork/i }));

  expect(scrollBy).toHaveBeenCalledWith({ left: -320 });
});

test("a row with no items falls back to its own width", () => {
  render(<GalleryRow label="Empty">{null}</GalleryRow>);

  const row = screen.getByRole("group", { name: "Empty" });
  const scrollBy = vi.fn();
  row.scrollBy = scrollBy;
  Object.defineProperty(row, "clientWidth", { value: 500 });

  fireEvent.click(screen.getByRole("button", { name: /next artwork/i }));

  // There is no first item to measure, so the step comes from the row. The
  // controls do something harmless rather than dividing by an absent child.
  expect(scrollBy).toHaveBeenCalledWith({ left: 500 });
});

test("the row snaps horizontally without moving on its own", () => {
  const { row } = renderRow();

  // jsdom applies no stylesheets, so the class contract is the seam. The
  // absence of the animation is the point of this module.
  expect(row.className).toContain("overflow-x-auto");
  expect(row.className).toContain("snap-x");
  expect(row.className).not.toContain("animate-strip");
});
