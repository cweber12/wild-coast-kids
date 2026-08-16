import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Conditions } from "./Conditions";

test("the conditions teaser renders its heading and embed slot", () => {
  render(<Conditions />);

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toContain("conditions");
  expect(screen.getByText(/conditions tool coming soon/i)).toBeDefined();
});

test("the section teases the full conditions page", () => {
  render(<Conditions />);

  expect(
    screen.getByRole("link", { name: /learn more/i }).getAttribute("href"),
  ).toBe("/conditions");
});

test("the section puts its own padding back where there is no stop", () => {
  const { container } = render(<Conditions />);

  // See GallerySection.test.tsx: the stop supplies this space, and only a
  // window big enough to hold a stop has one.
  // Listed rather than searched for, so a stray vertical padding fails too.
  // Spelling the md-gated class here to assert its absence would compile it
  // into the shipped stylesheet, which is the hazard scripts/built-css.mjs
  // documents.
  const vertical = (container.firstElementChild?.className ?? "")
    .split(/\s+/)
    .filter((className) => /(^|:)p[byt]-/.test(className));

  expect(vertical.sort()).toEqual(["py-section-sm", "stops:py-0"].sort());
});
