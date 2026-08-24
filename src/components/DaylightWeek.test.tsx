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
