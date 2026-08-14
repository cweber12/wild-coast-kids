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

test("the reader drives the row", () => {
  render(<GallerySection />);

  expect(
    screen.getByRole("button", { name: /previous artwork/i }),
  ).toBeDefined();
  expect(screen.getByRole("button", { name: /next artwork/i })).toBeDefined();
});
