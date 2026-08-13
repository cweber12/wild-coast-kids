import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityForm } from "./CommunityForm";

test("the teaser carries the interest-list form alongside it", () => {
  render(<CommunityForm />);

  // The landing section is the teaser and the form together; the form's own
  // behavior is asserted in InterestListForm.test.tsx.
  expect(screen.getByRole("textbox", { name: /your name/i })).toBeDefined();
  expect(
    screen.getByRole("button", { name: /join the community/i }),
  ).toBeDefined();
});

test("the section teases the full community page", () => {
  render(<CommunityForm />);

  expect(
    screen
      .getByRole("link", { name: /meet the community/i })
      .getAttribute("href"),
  ).toBe("/community");
});
