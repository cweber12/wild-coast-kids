import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuoteStats } from "./QuoteStats";

test("both parent quotes are reachable, each with its attribution", () => {
  render(<QuoteStats />);

  expect(screen.getByText(/notices every tidepool/i)).toBeDefined();
  expect(screen.getByText(/when we can go back/i)).toBeDefined();

  // Two quotes, so two attributions — the section closes the page on parent
  // voices rather than on one voice beside a pair of facts.
  expect(screen.getAllByText(/— Parent, Wild Coast Kids/i)).toHaveLength(2);
});

test("both stat tiles state the facts parents filter on", () => {
  render(<QuoteStats />);

  expect(screen.getByText("K–8")).toBeDefined();
  expect(screen.getByText("All ages welcome")).toBeDefined();
  expect(screen.getByText("Charter ✓")).toBeDefined();
  expect(screen.getByText("Fund eligible programs")).toBeDefined();
});

test("the closing section has no bottom border", () => {
  const { container } = render(<QuoteStats />);

  // jsdom applies no stylesheets, so the class contract is the seam. The
  // bottom edge now meets the footer, not another section.
  const section = container.firstElementChild;
  expect(section?.className).toContain("border-t-[1.5px]");
  expect(section?.className).not.toContain("border-y-[1.5px]");
});
