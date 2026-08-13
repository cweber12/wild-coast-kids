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

test("the logo slot is a labeled image placeholder", () => {
  render(<Nav />);

  expect(
    screen.getByRole("img", { name: "Wild Coast Kids logo" }),
  ).toBeDefined();
});
