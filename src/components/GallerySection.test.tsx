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

  // The strip renders each placeholder twice for the seamless loop, but the
  // duplicate track is aria-hidden, so by role each image appears once.
  for (const name of [
    "Art class at the park",
    "Watercolor houses",
    "Dinosaur watercolor",
  ]) {
    expect(screen.getAllByRole("img", { name })).toHaveLength(1);
  }
});
