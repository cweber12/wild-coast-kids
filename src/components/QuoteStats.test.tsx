import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuoteStats } from "./QuoteStats";

test("the parent quote and its attribution are reachable", () => {
  render(<QuoteStats />);

  expect(screen.getByText(/notices every tidepool/i)).toBeDefined();
  expect(screen.getByText(/— Parent, Wild Coast Kids/i)).toBeDefined();
});

test("both stat tiles state the facts parents filter on", () => {
  render(<QuoteStats />);

  expect(screen.getByText("K–8")).toBeDefined();
  expect(screen.getByText("All ages welcome")).toBeDefined();
  expect(screen.getByText("Charter ✓")).toBeDefined();
  expect(screen.getByText("Fund eligible programs")).toBeDefined();
});
