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

test("both hero CTAs go to a page, not down the page", () => {
  render(<HeroViewport />);

  // Under snapping, scrolling one screen is what the scroll gesture already
  // does; both program cards share a stop, so anchors would have sent these
  // two buttons to one identical place.
  expect(
    screen.getByRole("link", { name: /book art class/i }).getAttribute("href"),
  ).toBe("/book");
  expect(
    screen.getByRole("link", { name: /tuesday co-op/i }).getAttribute("href"),
  ).toBe("/coop");
});

test("the hero photo is the photograph, reachable by its own name", () => {
  render(<HeroViewport />);

  // getByRole, so this asserts the frame a screen reader reaches rather than
  // that an <img> was constructed. The src is matched loosely because
  // next/image rewrites it through the optimizer: what has to hold is that it
  // resolves to the file in public/, not the exact query it is fetched with.
  const photo = screen.getByRole("img", {
    name: /kids drawing at easels on the bluff above the beach/i,
  });

  expect(photo.getAttribute("src")).toContain("hero-art-class.jpg");
});

test("the marquee rides inside the viewport block", () => {
  render(<HeroViewport />);

  expect(screen.getAllByText("Art Classes").length).toBeGreaterThan(0);
});

test("the poster is the window less the nav, at both widths", () => {
  const { container } = render(<HeroViewport />);

  // The marquee sits at the poster's bottom edge, so if this block were a
  // full 100dvh the nav above it would push the marquee off screen. Both
  // breakpoints subtract, because the nav is taller on the two-row layout.
  const poster = container.firstElementChild;
  expect(poster?.className).toContain(
    "min-h-[calc(100dvh-var(--spacing-nav-sm))]",
  );
  expect(poster?.className).toContain(
    "md:min-h-[calc(100dvh-var(--spacing-nav))]",
  );
});
