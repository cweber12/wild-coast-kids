import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Coop from "./page";

test("the co-op page exposes its landmark, heading and reserved slots", () => {
  render(<Coop />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("co-op");

  expect(screen.getByText(/full co-op details coming soon/i)).toBeDefined();
  expect(
    screen.getByRole("img", { name: "Co-op adventures photo gallery" }),
  ).toBeDefined();
});

test("the page CTA routes to the landing page's interest list", () => {
  render(<Coop />);

  expect(
    screen
      .getByRole("link", { name: /join the interest list/i })
      .getAttribute("href"),
  ).toBe("/#community");
});
