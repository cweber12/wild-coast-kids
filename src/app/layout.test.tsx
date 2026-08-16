import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout from "./layout";

// next/font/google resolves font files inside the Next compiler and throws
// when its loader runs anywhere else, so the test stubs it to its shape.
vi.mock("next/font/google", () => ({
  Montserrat: () => ({ variable: "--font-montserrat" }),
}));

// The nav's routed links read the current pathname from the app router,
// which vitest does not mount.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

test("the layout wraps every page in the shared nav and footer", () => {
  render(
    <RootLayout params={Promise.resolve({})}>
      <main>page content</main>
    </RootLayout>,
  );

  // The chrome must surround whatever page renders, so the seam asserts all
  // three landmarks together: nav and footer from the layout, main from the
  // page passed through as children.
  expect(screen.getByRole("navigation")).toBeDefined();
  expect(screen.getByRole("contentinfo")).toBeDefined();
  expect(screen.getByRole("main")).toBeDefined();
});

test("anchor targets come to rest below the nav, not under it", () => {
  render(
    <RootLayout params={Promise.resolve({})}>
      <main>page content</main>
    </RootLayout>,
  );

  // React hoists <html> and <body> onto the real document rather than into
  // the render container, so the layout's root classes are read from
  // documentElement — querySelect("html") on the container finds nothing.
  const html = document.documentElement.className;
  expect(html).toContain("h-full");

  // html carries motion-safe:scroll-smooth and the hero's CTAs target #art
  // and #coop, so without scroll-padding the browser scrolls those sections
  // flush to the top of the viewport — behind the nav.
  expect(html).toContain("scroll-pt-nav-sm");
  expect(html).toContain("md:scroll-pt-nav");
});

test("snapping is enabled only where a stop fits, and only when motion is safe", () => {
  render(
    <RootLayout params={Promise.resolve({})}>
      <main>page content</main>
    </RootLayout>,
  );

  const html = document.documentElement.className;

  // motion-safe on the enabling classes rather than motion-reduce on a
  // disabling one: that way snapping is never switched on for a reader who
  // asked for reduced motion, with no dependence on which utility the
  // stylesheet happens to emit last.
  expect(html).toContain("motion-safe:stops:snap-y");
  expect(html).toContain("motion-safe:stops:snap-mandatory");
  expect(html).not.toContain("motion-reduce:");

  // Width alone is not enough — three stops overflow a 639px viewport, so
  // snapping over them reads as the page refusing to settle (issue #37).
  expect(html).not.toContain("motion-safe:md:snap");
});
