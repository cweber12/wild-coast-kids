import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { AreaBeaches } from "./AreaBeaches";
import { TOUCH_TARGET } from "../ui/touchTarget";

const LA_JOLLA = [
  { slug: "la-jolla-shores-beach", name: "La Jolla Shores Beach" },
  { slug: "la-jolla-cove", name: "La Jolla Cove" },
  { slug: "windansea-beach", name: "WindanSea Beach" },
];

test("each beach links into its own area, not to the redirecting URL", () => {
  render(
    <AreaBeaches
      areaSlug="la-jolla"
      areaName="La Jolla"
      beaches={LA_JOLLA}
      current={null}
    />,
  );

  const link = screen.getByRole("link", { name: "La Jolla Cove" });
  // The nested form. `/conditions/la-jolla-cove` would resolve and redirect,
  // so a bare slug here would work while costing every reader a round trip.
  expect(link.getAttribute("href")).toBe("/conditions/la-jolla/la-jolla-cove");
});

/**
 * The current beach stays in the list rather than being dropped from it: a list
 * that removes its own entry changes length as a reader moves through it, and
 * they lose the place they were comparing from.
 */
test("the beach being shown is marked, not removed", () => {
  render(
    <AreaBeaches
      areaSlug="la-jolla"
      areaName="La Jolla"
      beaches={LA_JOLLA}
      current="la-jolla-cove"
    />,
  );

  expect(screen.getAllByRole("link")).toHaveLength(3);
  expect(
    screen
      .getByRole("link", { name: "La Jolla Cove" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen
      .getByRole("link", { name: "WindanSea Beach" })
      .getAttribute("aria-current"),
  ).toBeNull();
});

/*
  A test stood here requiring a one-beach area to say "The beach in Sunset
  Cliffs" rather than "Beaches". The branch it covered is gone: an area of one
  does not render this list at all -- it shows its beach instead. The behaviour
  that replaced it is asserted where it now lives, in `[area]/page.test.tsx` and
  `ConditionsSection.test.tsx`.
*/

test("beaches are listed in the order given, which is north to south", () => {
  render(
    <AreaBeaches
      areaSlug="la-jolla"
      areaName="La Jolla"
      beaches={LA_JOLLA}
      current={null}
    />,
  );

  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "La Jolla Shores Beach",
    "La Jolla Cove",
    "WindanSea Beach",
  ]);
});

/**
 * ADR-0004's 44px floor. jsdom applies no stylesheets (ADR-0001), so this
 * asserts each link composes the standard rather than measuring a box.
 */
test("every link composes the touch-target floor", () => {
  render(
    <AreaBeaches
      areaSlug="la-jolla"
      areaName="La Jolla"
      beaches={LA_JOLLA}
      current={null}
    />,
  );

  for (const link of screen.getAllByRole("link")) {
    expect(link.className).toContain(TOUCH_TARGET);
  }
});
