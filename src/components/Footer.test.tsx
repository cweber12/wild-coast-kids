import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

test("the footer is a contentinfo landmark carrying the wordmark", () => {
  render(<Footer />);

  const footer = screen.getByRole("contentinfo");
  expect(footer.textContent).toContain("Wild Coast Kids");
  expect(footer.textContent).toContain("Charter Eligible · K–8");
});
