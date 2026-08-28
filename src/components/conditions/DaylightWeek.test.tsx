import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DaylightWeek } from "./DaylightWeek";

test("names both ends of the day rather than its length", () => {
  const { container } = render(
    <DaylightWeek day={{ sunriseLabel: "6:14 AM", sunsetLabel: "7:32 PM" }} />,
  );

  // A duration would be the same information arranged so nobody can use it:
  // the reader is deciding when to leave the house.
  expect(container.textContent).toContain("6:14 AM");
  expect(container.textContent).toContain("7:32 PM");
});

test("sunrise leads, and sunset follows it in reading order", () => {
  const { container } = render(
    <DaylightWeek day={{ sunriseLabel: "6:48 AM", sunsetLabel: "4:47 PM" }} />,
  );

  expect(container.textContent).toBe("6:48 AM to 4:47 PM");
});

/**
 * Regression. The two clock times were once set on two lines because at 13px
 * they did not fit the 88px cell seven columns gave them at 1024. Both halves
 * of that are gone -- the line is 11px and seven columns start at `xl` -- so a
 * `block` here would be reintroducing a break nothing is asking for, and it
 * would cost the height on every one of the seven days.
 */
test("the window sets on one line, at every width", () => {
  const { container } = render(
    <DaylightWeek day={{ sunriseLabel: "6:48 AM", sunsetLabel: "4:47 PM" }} />,
  );

  const classes = [...container.querySelectorAll("span")].flatMap((span) =>
    span.className.split(/\s+/),
  );
  expect(classes).not.toContain("block");
  expect(classes).not.toContain("lg:block");
  expect(classes).toContain("whitespace-nowrap");
});

/**
 * Regression, and it outlived the break that caused it. Two `block` spans with
 * no text node between them read aloud as "6:48 AMto 4:47 PM" -- the
 * concatenation `ReadingCard` records hitting in the accessible-name
 * algorithm. The `aria-label` below is the primary name now, but the fallback
 * must still be a sentence.
 */
test("the visible text does not join the words", () => {
  const { container } = render(
    <DaylightWeek day={{ sunriseLabel: "6:48 AM", sunsetLabel: "4:47 PM" }} />,
  );

  expect(container.textContent).not.toContain("AMto");
});

/**
 * The word "Daylight" is not printed -- it would not fit beside the times in a
 * 125px cell -- so the line has to carry it some other way. `role="img"` with
 * an `aria-label` is how `Placeholder` already names a thing whose visible
 * content is not its name; a `title` tooltip was rejected because it does not
 * appear on touch and is not keyboard-reachable.
 */
test("a reader who cannot see the mark is still told what the window is", () => {
  render(
    <DaylightWeek day={{ sunriseLabel: "6:20 AM", sunsetLabel: "7:20 PM" }} />,
  );

  expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
    "Daylight, 6:20 AM to 7:20 PM",
  );
});

/**
 * ADR-0015: a full-colour emoji at this size is a smudge rather than a mark,
 * which is why no row in this grid carries one. A stroked SVG on
 * `currentColor` is the thing that does work here, and it must stay decorative
 * -- the `aria-label` above is the whole accessible name, and a second one
 * inside it would be read twice.
 */
test("the sun is an SVG on currentColor, and it is decorative", () => {
  const { container } = render(
    <DaylightWeek day={{ sunriseLabel: "6:20 AM", sunsetLabel: "7:20 PM" }} />,
  );

  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();
  expect(svg?.getAttribute("stroke")).toBe("currentColor");
  expect(svg?.getAttribute("aria-hidden")).toBe("true");
  expect(container.textContent).not.toMatch(/[☀-➿]/);
});
