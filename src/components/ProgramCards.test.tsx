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

// The card links to /book, so what a class costs is the most decision-relevant
// fact on the page it points at, and it said nothing about it until #105. The
// number is TIERS[0].price in src/app/art/page.tsx; they are duplicated
// literals and #113 is open about single-sourcing them.
test("the art card names what a class costs", () => {
  render(<ProgramCards />);

  expect(screen.getByText("$20 drop-in")).toBeDefined();
});

// The card predated /art's copy and claimed "Every session is different",
// which is the weaker half of what the page claims: the technique is shared
// and only the results differ (#105). This pins the claim, not the wording
// around it, so the sentence can be edited without the test dictating prose.
test("the art card carries the page's claim, not its opposite", () => {
  render(<ProgramCards />);

  const art = screen.getByText(/watercolors, ink, collage/i);
  expect(art.textContent).toMatch(/nobody goes home with the same picture/i);
  expect(art.textContent).not.toMatch(/every session is different/i);
});

// The co-op is the outdoor program; art is studio work "inspired by the
// coast", which is not the same claim (#105).
test("the art card does not claim to be outdoors", () => {
  render(<ProgramCards />);

  expect(screen.queryByText("Outdoors")).toBeNull();
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
