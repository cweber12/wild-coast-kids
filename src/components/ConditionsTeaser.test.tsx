import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConditionsTeaser } from "./ConditionsTeaser";

test("the conditions teaser renders its heading and reserved slot", () => {
  render(<ConditionsTeaser />);

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toContain("conditions");
  expect(screen.getByText(/today's low tide is live/i)).toBeDefined();
  expect(
    screen.getByText(/surf, wind and visibility are still to come/i),
  ).toBeDefined();
});

test("the slot's copy is addressed to a visitor, not to whoever builds the site", () => {
  render(<ConditionsTeaser />);

  // It read "Drop the URL and it embeds here automatically" until #59: an
  // instruction to a builder, describing an embed ADR-0009 retired, on the copy
  // a parent actually reads.
  expect(screen.queryByText(/drop the url/i)).toBeNull();
  expect(screen.queryByText(/embed/i)).toBeNull();
});

test("the section teases the full conditions page", () => {
  render(<ConditionsTeaser />);

  expect(
    screen.getByRole("link", { name: /learn more/i }).getAttribute("href"),
  ).toBe("/conditions");
});

test("the section puts its own padding back where there is no stop", () => {
  const { container } = render(<ConditionsTeaser />);

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
