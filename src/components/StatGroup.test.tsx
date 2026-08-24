import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatGroup } from "./StatGroup";

test("each figure is shown with the label that says what it is", () => {
  render(
    <StatGroup
      stats={[
        { label: "Period", value: "6 s" },
        { label: "Water", value: "74°F" },
      ]}
    />,
  );

  expect(screen.getByText("Period")).toBeDefined();
  expect(screen.getByText("6 s")).toBeDefined();
  expect(screen.getByText("Water")).toBeDefined();
  expect(screen.getByText("74°F")).toBeDefined();
});

/**
 * The pairing is the content, so it is structural rather than a visual accident
 * of one line sitting above another. This is what carries the relationship for
 * a reader who cannot see the layout, and what lets the air panel's two
 * provenance groups stay distinguishable without sight.
 */
test("labels and figures are paired as a description list", () => {
  const { container } = render(
    <StatGroup
      stats={[
        { label: "Period", value: "6 s" },
        { label: "Water", value: "74°F" },
      ]}
    />,
  );

  expect(container.querySelectorAll("dl").length).toBe(1);
  expect(container.querySelectorAll("dt").length).toBe(2);
  expect(container.querySelectorAll("dd").length).toBe(2);
});

/**
 * The rule this page keeps everywhere: a blank where a measurement goes reads
 * as a calm sea rather than as a quiet instrument. A buoy publishing waves and
 * no water temperature is measured, not hypothetical.
 */
test("a missing figure states its absence rather than rendering blank", () => {
  render(<StatGroup stats={[{ label: "Water", value: null }]} />);

  expect(screen.getByText("Water")).toBeDefined();
  expect(screen.getByText("Not reported")).toBeDefined();
});

test("a missing figure is never dropped from the list", () => {
  const { container } = render(
    <StatGroup
      stats={[
        { label: "Period", value: "6 s" },
        { label: "Water", value: null },
      ]}
    />,
  );

  // Two rows, not one. An omitted row reads as an oversight.
  expect(container.querySelectorAll("dt").length).toBe(2);
  expect(container.querySelectorAll("dd").length).toBe(2);
});

/**
 * Prominence comes from weight, not size. The token scale jumps 13px to 36px
 * with nothing between, and the site's direction is that "weight and italics
 * carry the hierarchy" — so a figure is body-sized and extrabold against the
 * fog-grey prose around it rather than an off-system size invented here.
 */
test("a figure is set heavier than the prose it sits among", () => {
  const { container } = render(
    <StatGroup stats={[{ label: "Period", value: "6 s" }]} />,
  );

  const value = container.querySelector("dd");
  expect(value?.className).toContain("font-extrabold");
  expect(value?.className).toContain("text-dark");
});

test("an absent figure is set apart from a real one, not styled as a value", () => {
  const { container } = render(
    <StatGroup stats={[{ label: "Water", value: null }]} />,
  );

  const value = container.querySelector("dd");
  expect(value?.className).not.toContain("font-extrabold");
});
