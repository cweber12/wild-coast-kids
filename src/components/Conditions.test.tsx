import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Conditions } from "./Conditions";

test("the conditions heading and embed slot are reachable at #conditions", () => {
  const { container } = render(<Conditions />);

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toContain("conditions");
  expect(screen.getByText(/conditions tool coming soon/i)).toBeDefined();

  // Teasers deep-link here; the id is stable API.
  expect(container.querySelector("section#conditions")).not.toBeNull();
});

test("the section teases the full conditions page", () => {
  render(<Conditions />);

  expect(
    screen.getByRole("link", { name: /learn more/i }).getAttribute("href"),
  ).toBe("/conditions");
});
