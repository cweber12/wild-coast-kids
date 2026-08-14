import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { PillLink } from "./PillLink";

test("the destination reaches the rendered link", () => {
  render(
    <PillLink href="/book" tone="yellow">
      Book a class →
    </PillLink>,
  );

  expect(
    screen.getByRole("link", { name: /book a class/i }).getAttribute("href"),
  ).toBe("/book");
});

test("a hash destination stays a working same-page anchor", () => {
  render(
    <PillLink href="#community" tone="yellow">
      Join the interest list →
    </PillLink>,
  );

  // Hashes go through next/link like any other href rather than branching on
  // a leading "#", which would be an invariant the types do not show.
  expect(
    screen
      .getByRole("link", { name: /join the interest list/i })
      .getAttribute("href"),
  ).toBe("#community");
});

test("each tone brings its own surface", () => {
  const tones = [
    ["yellow", "bg-yellow"],
    ["purple", "bg-purple"],
    ["ocean", "bg-ocean"],
    ["outline-light", "border-white/50"],
    ["outline-dark", "border-lavender"],
  ] as const;

  for (const [tone, expected] of tones) {
    const { getByRole, unmount } = render(
      <PillLink href="/book" tone={tone}>
        {tone}
      </PillLink>,
    );
    expect(getByRole("link").className).toContain(expected);
    unmount();
  }
});

test("every pill shares one geometry", () => {
  // The whole point of the module: "Book a class" rendered one size on the
  // program card and another on /art before this existed.
  const { getByRole: solid, unmount } = render(
    <PillLink href="/book" tone="yellow">
      solid
    </PillLink>,
  );
  expect(solid("link").className).toContain("px-7 py-3.25");
  unmount();

  const { getByRole: outline } = render(
    <PillLink href="/art" tone="outline-light">
      outline
    </PillLink>,
  );
  // 2px narrower each side, so the border lands the outer box in the same
  // place as the solid pill's.
  expect(outline("link").className).toContain("px-6.5 py-2.75");
});
