import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { PillLink } from "./PillLink";
import { TOUCH_TARGET } from "./touchTarget";

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

test("every pill clears the touch-target floor below md, and only below md", () => {
  // ADR-0004: 44px on touch. text-sm carries no paired line-height, so the
  // padding in TONES came to ~41px on its own (#30). The floor is asserted on
  // both kinds of tone because the solid and outline paddings differ -- the
  // shared min-height is what lands them on the same outer box, so a tone
  // that lost it would break the pairing the test above exists to hold.
  //
  // md:min-h-0 is half the contract, not a detail: the pill is a visible
  // shape, and 44px at md would grow the capsule on desktop compositions
  // that are finished. Asserting it is what stops the fix spreading upward.
  //
  // Per ADR-0001 jsdom applies no stylesheets, so this proves the class is
  // referenced, not that the box measures 44px. That stays a human check.
  for (const tone of ["yellow", "outline-light"] as const) {
    const { getByRole, unmount } = render(
      <PillLink href="/book" tone={tone}>
        {tone}
      </PillLink>,
    );

    expect(getByRole("link").className).toContain(TOUCH_TARGET);
    expect(getByRole("link").className).toContain("md:min-h-0");
    // inline-flex, not the nav's flex: three call sites put a pill in a bare
    // block container, where a block-level box would fill the width and stop
    // being a pill at all.
    expect(getByRole("link").className).toContain("inline-flex items-center");
    unmount();
  }
});
