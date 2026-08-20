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

test("#community lands on a snap stop, not mid-section", () => {
  const { container } = render(<Home />);

  // The co-op card links to #community, and /book and /coop to /#community.
  // The id has to sit on the section wrapper: on an element inside one, the
  // browser parks at a non-snap position and then snaps somewhere else.
  const target = container.querySelector("#community");

  expect(target?.tagName).toBe("SECTION");
  expect(target?.className).toContain("stops:snap-start");
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

// Hero, Marquee, ProgramCards and QuoteStats all asserted charter-fund
// eligibility, and the site explained it nowhere. The claim was withdrawn
// until copy exists (#104, docs/plans/charter-claim-withdrawn.md). This is one
// assertion rather than four because the landing page renders all four; the
// footer, which carried it too, sits in layout.tsx and is guarded in
// Footer.test.tsx.
test("the landing page makes no funding claim", () => {
  const { container } = render(<Home />);

  expect(container.textContent).not.toMatch(/charter|fund eligible/i);
});
