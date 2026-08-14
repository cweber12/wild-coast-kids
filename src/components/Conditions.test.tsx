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
