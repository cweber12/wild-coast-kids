import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Community from "./page";

test("the community page exposes its landmark, heading and reserved slots", () => {
  render(<Community />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("community");

  expect(screen.getByText(/community stories coming soon/i)).toBeDefined();
  expect(
    screen.getByRole("img", { name: "Community photo gallery" }),
  ).toBeDefined();
});

test("the interest-list form rides on the page, not just the landing", () => {
  render(<Community />);

  // The working form is the page's action: reachable controls, not a copy
  // of the landing teaser.
  expect(screen.getByRole("textbox", { name: /your name/i })).toBeDefined();
  expect(
    screen.getByRole("button", { name: /join the community/i }),
  ).toBeDefined();
});

// MUST FAIL, per CLAUDE.md's rule that a bugfix starts with a regression test
// that failed first. The gate table's mustFail flag judges a whole gate, and
// the test gate runs the whole suite, so it cannot express "one test in this
// suite must fail". test.fails is that at test granularity: it passes only
// while the body throws, so this commit proves the defect and leaves the gate
// green. The fix commit turns it into a plain test().
test.fails("the page does not offer a link to itself", () => {
  render(<Community />);

  // The landing teaser rides in on CommunityForm, and its CTA points at
  // /community — the page the reader is already on.
  expect(screen.queryByRole("link", { name: /meet the community/i })).toBe(
    null,
  );
});
