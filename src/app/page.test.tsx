import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

test("the home route renders a main landmark", () => {
  render(<Home />);

  // getByRole asserts the landmark is reachable the way a screen reader finds
  // it, not merely that some element was constructed.
  expect(screen.getByRole("main")).toBeDefined();
});

test("the landing page is six sections", () => {
  render(<Home />);

  // The seam for the page's composition: this is what catches a section
  // being dropped when the order changes around it.
  expect(screen.getByRole("main").children).toHaveLength(6);
});

test("the parent quotes close the page, below the interest list", () => {
  render(<Home />);

  // The quotes used to sit fourth, interrupting the program cards and the
  // conditions teaser. Asserted by document position rather than by index,
  // so wrapping the sections later cannot quietly satisfy it.
  const form = screen.getByRole("button", { name: /join the interest list/i });
  const quote = screen.getByText(/notices every tidepool/i);

  expect(
    form.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
