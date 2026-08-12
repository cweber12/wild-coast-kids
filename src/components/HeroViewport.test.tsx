import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroViewport } from "./HeroViewport";

test("the hero headline is the page's h1", () => {
  render(<HeroViewport />);

  // The headline breaks across <br> elements, which contribute no space to
  // the accessible name — so match by level and content, not full name.
  const headline = screen.getByRole("heading", { level: 1 });
  expect(headline.textContent).toContain("Kids who");
  expect(headline.textContent).toContain("wonder.");
});

test("both hero CTAs link to their program anchors", () => {
  render(<HeroViewport />);

  expect(
    screen.getByRole("link", { name: /book art class/i }).getAttribute("href"),
  ).toBe("#art");
  expect(
    screen.getByRole("link", { name: /tuesday co-op/i }).getAttribute("href"),
  ).toBe("#coop");
});

test("the hero photo slot shows its label while it is a placeholder", () => {
  render(<HeroViewport />);

  // Without the visible label the slot is invisible over the purple and the
  // poster's right half reads as empty (design review, finding 2).
  expect(
    screen.getByText("Hero photo of kids exploring the coast"),
  ).toBeDefined();
});

test("the marquee rides inside the viewport block", () => {
  render(<HeroViewport />);

  expect(screen.getAllByText("Art Classes").length).toBeGreaterThan(0);
});
