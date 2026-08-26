import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavLink } from "./NavLink";

// usePathname needs a mounted app router; tests steer it per case instead.
const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

test("the link to the current page carries aria-current", () => {
  pathname.current = "/book";

  render(<NavLink href="/book">Book Now</NavLink>);

  expect(
    screen.getByRole("link", { name: "Book Now" }).getAttribute("aria-current"),
  ).toBe("page");
});

test("links to other pages carry no aria-current", () => {
  pathname.current = "/";

  render(<NavLink href="/book">Book Now</NavLink>);

  expect(
    screen.getByRole("link", { name: "Book Now" }).getAttribute("aria-current"),
  ).toBeNull();
});
