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

// MUST FAIL: the bug this asserts against is live. See the note in
// src/app/community/page.test.tsx for why test.fails stands in for the gate
// table's mustFail flag. The fix commit turns this into a plain test().
//
// The h-full assertion above the scroll-pt ones is deliberate: it proves the
// className was read from somewhere real, so this cannot pass by throwing on
// an undefined it never found.
test.fails("anchor targets come to rest below the nav, not under it", () => {
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
