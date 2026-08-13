import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout from "./layout";

// next/font/google resolves font files inside the Next compiler and throws
// when its loader runs anywhere else, so the test stubs it to its shape.
vi.mock("next/font/google", () => ({
  Montserrat: () => ({ variable: "--font-montserrat" }),
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
