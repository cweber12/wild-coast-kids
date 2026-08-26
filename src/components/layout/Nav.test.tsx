import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

// The routed links read the current pathname; tests render Nav as seen
// from the landing page.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

test("the nav exposes all four section links by name", () => {
  render(<Nav />);

  for (const name of [
    "Art Classes",
    "Tuesday Co-op",
    "Conditions",
    "Community",
  ]) {
    expect(screen.getByRole("link", { name })).toBeDefined();
  }
});

test("each section link points at its page", () => {
  render(<Nav />);

  for (const [name, href] of [
    ["Art Classes", "/art"],
    ["Tuesday Co-op", "/coop"],
    ["Conditions", "/conditions"],
    ["Community", "/community"],
  ]) {
    expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
  }
});

test("the booking CTA routes to the booking page", () => {
  render(<Nav />);

  const cta = screen.getByRole("link", { name: /book now/i });
  expect(cta.getAttribute("href")).toBe("/book");
});

test("the nav occupies its own space instead of floating over the page", () => {
  render(<Nav />);

  // jsdom applies no stylesheets, so the class contract is the seam (as in
  // StripTrack.test.tsx). This one is load-bearing: while the nav was fixed,
  // five pages and Hero each carried their own copy of its height to leave
  // room for it. Sticky means nothing has to know.
  const nav = screen.getByRole("navigation");
  expect(nav.className).toContain("sticky");
  expect(nav.className).not.toContain("fixed");
});

test("the nav takes its height from the nav tokens", () => {
  render(<Nav />);

  // The token is the source of the height, not a description of it. The
  // hero's poster and scroll-padding-top both subtract these same tokens.
  const nav = screen.getByRole("navigation");
  expect(nav.className).toContain("min-h-nav-sm");
  expect(nav.className).toContain("md:min-h-nav");
});

test("every target in the nav carries the 44px touch target", () => {
  render(<Nav />);

  // Iterating every link rather than asserting a literal per element is the
  // point: this fails when a fifth link is added or the pill is restyled
  // without composing TOUCH_TARGET, which is the drift that actually happens.
  // It cannot prove the rendered box is 44px -- jsdom applies no stylesheets
  // (ADR-0001) -- so that stays a human check at 375px.
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(5);

  for (const link of links) {
    expect(link.className).toContain("min-h-11");
  }
});

test("the current-page underline sits on the label, not on the link box", () => {
  render(<Nav />);

  // A bottom border is drawn at its own element's box edge, so an indicator
  // on the anchor would move with the touch target. Keeping it on an inner
  // span is what lets the anchor grow to 44px without the yellow rule
  // drifting below the text. group-* wiring is part of the contract: without
  // it the enlarged target would respond only over the glyphs.
  for (const name of [
    "Art Classes",
    "Tuesday Co-op",
    "Conditions",
    "Community",
  ]) {
    const link = screen.getByRole("link", { name });
    const label = link.firstElementChild;

    expect(link.className).not.toContain("border-b");
    expect(link.classList.contains("group")).toBe(true);
    expect(label?.className).toContain("border-b-2");
    expect(label?.className).toContain("group-hover:border-yellow");
    expect(label?.className).toContain(
      "group-aria-[current=page]:border-yellow",
    );
  }
});

test("the logo slot is a labeled image placeholder", () => {
  render(<Nav />);

  expect(
    screen.getByRole("img", { name: "Wild Coast Kids logo" }),
  ).toBeDefined();
});
