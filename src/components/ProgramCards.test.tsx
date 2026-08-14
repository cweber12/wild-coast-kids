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
