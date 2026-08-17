import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GalleryPager } from "./GalleryPager";

function renderPager() {
  const page = vi.fn();

  render(<GalleryPager controls="gallery-row" page={page} />);

  return {
    page,
    previous: screen.getByRole("button", { name: /previous artwork/i }),
    next: screen.getByRole("button", { name: /next artwork/i }),
  };
}

test("each control names the row it pages", () => {
  const { previous, next } = renderPager();

  // The pair no longer sits on the row, so nothing about their position says
  // what they drive. Without this the relationship is not stated anywhere.
  expect(previous.getAttribute("aria-controls")).toBe("gallery-row");
  expect(next.getAttribute("aria-controls")).toBe("gallery-row");
});

test("next pages forward and previous pages back", () => {
  const { page, previous, next } = renderPager();

  fireEvent.click(next);
  expect(page).toHaveBeenCalledWith(1);

  fireEvent.click(previous);
  expect(page).toHaveBeenCalledWith(-1);
});

test("the controls sit in flow rather than overlaid on the artwork", () => {
  const { previous, next } = renderPager();

  // jsdom applies no stylesheets, so the class contract is the seam. This is
  // the assertion that keeps ADR-0008 from being undone by a stray absolute:
  // the pair used to be positioned onto the row's left and right edges, where
  // a 44px control overhung the gutter by 20px at md+ and 32px below it.
  for (const control of [previous, next]) {
    expect(control.className).not.toContain("absolute");
    expect(control.className).toContain("size-11");
  }
});
