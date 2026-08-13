import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Book from "./page";

test("the book page exposes its landmark, heading and coming-soon slot", () => {
  render(<Book />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("Book");

  expect(screen.getByText(/online booking coming soon/i)).toBeDefined();
});

test("the interim CTA routes to the landing page's interest list", () => {
  render(<Book />);

  expect(
    screen
      .getByRole("link", { name: /join the interest list/i })
      .getAttribute("href"),
  ).toBe("/#community");
});
