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

test("the stat tile states the fact parents filter on", () => {
  render(<QuoteStats />);

  expect(screen.getByText("K–8")).toBeDefined();
  expect(screen.getByText("All ages welcome")).toBeDefined();
});

// The second tile claimed charter-fund eligibility the site could not explain
// anywhere, and went with the rest of that claim (#104). It comes back with
// the copy, not before — see docs/plans/charter-claim-withdrawn.md.
test("the closing section makes no funding claim", () => {
  const { container } = render(<QuoteStats />);

  expect(container.textContent).not.toMatch(/charter|fund/i);
});

test("the closing section carries no divider at all", () => {
  const { container } = render(<QuoteStats />);

  // jsdom applies no stylesheets, so the class contract is the seam. A top
  // border here draws hard against the nav once the stop fills its screen,
  // and it separates nothing: the section above is never on screen with it.
  expect(container.firstElementChild?.className).not.toContain("border-");
});

test("the section puts its own padding back where there is no stop", () => {
  const { container } = render(<QuoteStats />);

  // See GallerySection.test.tsx: the stop supplies this space, and only a
  // window big enough to hold a stop has one.
  // Listed rather than searched for, so a stray vertical padding fails too.
  // Spelling the md-gated class here to assert its absence would compile it
  // into the shipped stylesheet, which is the hazard scripts/built-css.mjs
  // documents.
  const vertical = (container.firstElementChild?.className ?? "")
    .split(/\s+/)
    .filter((className) => /(^|:)p[byt]-/.test(className));

  expect(vertical.sort()).toEqual(["py-section-sm", "stops:py-0"].sort());
});
