import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DaylightWeek } from "./DaylightWeek";

test("names both ends of the day rather than its length", () => {
  render(
    <DaylightWeek day={{ sunriseLabel: "6:14 AM", sunsetLabel: "7:32 PM" }} />,
  );

  // A duration would be the same information arranged so nobody can use it:
  // the reader is deciding when to leave the house.
  expect(screen.getByText("6:14 AM")).toBeDefined();
  expect(screen.getByText("to 7:32 PM")).toBeDefined();
});

test("sunrise leads, and sunset follows it in reading order", () => {
  const { container } = render(
    <DaylightWeek day={{ sunriseLabel: "6:48 AM", sunsetLabel: "4:47 PM" }} />,
  );

  expect(container.textContent).toBe("6:48 AM to 4:47 PM");
});

/**
 * Regression. The two clock times were set on one line, which fitted six days
 * of the week and wrapped on the seventh, taking that column's rows out of line
 * with its neighbours. Breaking them deliberately fixed the grid and, on the
 * first attempt, silently joined the words: two `block` spans with no text node
 * between them read aloud as "6:48 AMto 4:47 PM". A line break a reader can see
 * must not become a word break a reader can hear.
 */
test("breaking the line does not join the words", () => {
  const { container } = render(
    <DaylightWeek day={{ sunriseLabel: "6:48 AM", sunsetLabel: "4:47 PM" }} />,
  );

  expect(container.textContent).toContain("6:48 AM to 4:47 PM");
  expect(container.textContent).not.toContain("AMto");
});
