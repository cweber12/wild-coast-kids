import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterestListTeaser } from "./InterestListTeaser";

test("the teaser carries the interest-list form alongside it", () => {
  render(<InterestListTeaser />);

  // The landing section is the teaser and the form together; the form's own
  // behavior is asserted in InterestListForm.test.tsx.
  expect(screen.getByRole("textbox", { name: /your name/i })).toBeDefined();
  expect(
    screen.getByRole("button", { name: /join the interest list/i }),
  ).toBeDefined();
});

test("the section teases the full community page", () => {
  render(<InterestListTeaser />);

  expect(
    screen
      .getByRole("link", { name: /meet the community/i })
      .getAttribute("href"),
  ).toBe("/community");
});

test("the section puts its own padding back where there is no stop", () => {
  const { container } = render(<InterestListTeaser />);

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
