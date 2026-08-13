import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgramCards } from "./ProgramCards";

test("both program cards expose their titles as headings", () => {
  const { container } = render(<ProgramCards />);

  const titles = screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent);
  expect(titles.some((t) => t?.includes("Art"))).toBe(true);
  expect(titles.some((t) => t?.includes("Co-op"))).toBe(true);

  // The nav and hero deep-link here; the ids are stable API.
  expect(container.querySelector("#art")).not.toBeNull();
  expect(container.querySelector("#coop")).not.toBeNull();
});

test("each card's CTA points where its flow goes", () => {
  render(<ProgramCards />);

  const book = screen.getByRole("link", { name: /book a class/i });
  expect(book.getAttribute("href")).toBe("/book");

  const join = screen.getByRole("link", { name: /join interest list/i });
  expect(join.getAttribute("href")).toBe("#community");
});

test("the co-op card lists all four activities", () => {
  render(<ProgramCards />);

  for (const name of ["Tidepools", "Hikes", "Nature Journal", "Science"]) {
    expect(screen.getByText(name)).toBeDefined();
  }
});
