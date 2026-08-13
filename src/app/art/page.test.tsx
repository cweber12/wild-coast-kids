import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Art from "./page";

test("the art page exposes its landmark, heading and reserved slots", () => {
  render(<Art />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("Art");

  expect(screen.getByText(/schedule & pricing coming soon/i)).toBeDefined();
  expect(
    screen.getByRole("img", { name: "Student artwork gallery" }),
  ).toBeDefined();
});

test("the page CTA routes to the booking page", () => {
  render(<Art />);

  expect(
    screen.getByRole("link", { name: /book a class/i }).getAttribute("href"),
  ).toBe("/book");
});
