import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Community from "./page";

test("the community page exposes its landmark, heading and reserved slots", () => {
  render(<Community />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("community");

  expect(screen.getByText(/community stories coming soon/i)).toBeDefined();
  expect(
    screen.getByRole("img", { name: "Community photo gallery" }),
  ).toBeDefined();
});

test("the interest-list form rides on the page, not just the landing", () => {
  render(<Community />);

  // The working form is the page's action: reachable controls, not a copy
  // of the landing teaser.
  expect(screen.getByRole("textbox", { name: /your name/i })).toBeDefined();
  expect(
    screen.getByRole("button", { name: /join the interest list/i }),
  ).toBeDefined();
});

test("the page does not offer a link to itself", () => {
  render(<Community />);

  // This page is what the landing teaser's "Meet the community" points at,
  // so that link must not ride along here. Regression: it did, until the
  // form became its own module.
  expect(screen.queryByRole("link", { name: /meet the community/i })).toBe(
    null,
  );
});
