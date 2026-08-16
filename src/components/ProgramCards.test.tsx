import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgramCards } from "./ProgramCards";

test("both program cards expose their titles as headings", () => {
  render(<ProgramCards />);

  const titles = screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent);
  expect(titles.some((t) => t?.includes("Art"))).toBe(true);
  expect(titles.some((t) => t?.includes("Co-op"))).toBe(true);
});

test("each card's CTA points where its flow goes", () => {
  render(<ProgramCards />);

  const book = screen.getByRole("link", { name: /book a class/i });
  expect(book.getAttribute("href")).toBe("/book");

  const join = screen.getByRole("link", { name: /join the interest list/i });
  expect(join.getAttribute("href")).toBe("#community");

  const learnMore = screen
    .getAllByRole("link", { name: /learn more/i })
    .map((link) => link.getAttribute("href"));
  expect(learnMore).toEqual(["/art", "/coop"]);
});

test("the co-op card lists all four activities", () => {
  render(<ProgramCards />);

  for (const name of ["Tidepools", "Hikes", "Nature Journal", "Science"]) {
    expect(screen.getByText(name)).toBeDefined();
  }
});

test("the cards put their own padding back where there is no stop", () => {
  const { container } = render(<ProgramCards />);

  // See GallerySection.test.tsx: the stop supplies this space, and only a
  // window big enough to hold a stop has one.
  // Listed rather than searched for, so a stray vertical padding fails too.
  // Spelling the md-gated class here to assert its absence would compile it
  // into the shipped stylesheet, which is the hazard scripts/built-css.mjs
  // documents.
  const vertical = (container.firstElementChild?.className ?? "")
    .split(/\s+/)
    .filter((className) => /(^|:)p[byt]-/.test(className));

  expect(vertical.sort()).toEqual(["pb-section-sm", "stops:pb-0"].sort());
});
