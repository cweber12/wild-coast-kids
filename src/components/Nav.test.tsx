import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

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

test("the booking CTA is a link into the art section", () => {
  render(<Nav />);

  const cta = screen.getByRole("link", { name: /book now/i });
  expect(cta.getAttribute("href")).toBe("#art");
});

test("the logo slot is a labeled image placeholder", () => {
  render(<Nav />);

  expect(
    screen.getByRole("img", { name: "Wild Coast Kids logo" }),
  ).toBeDefined();
});
