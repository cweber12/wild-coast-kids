import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TIDE_WEEK_ROW, TideWeek } from "./TideWeek";

test("a reading leads with the time and keeps the height beside it", () => {
  render(
    <TideWeek state={{ kind: "reading", timeLabel: "6:41 PM", feet: 0.9 }} />,
  );

  // Timing first, height second, for the reason TideToday already records: a
  // parent plans around when to leave the house.
  expect(screen.getByText("6:41 PM")).toBeDefined();
  expect(screen.getByText("0.9 ft")).toBeDefined();
});

test("a negative height keeps its sign, which is the figure a tidepooler reads", () => {
  render(
    <TideWeek state={{ kind: "reading", timeLabel: "7:10 AM", feet: -0.42 }} />,
  );

  // Rounded to one decimal, the same as the now-band's card, so the two places
  // this station's height appears cannot quote it differently.
  expect(screen.getByText("-0.4 ft")).toBeDefined();
});

test("a day the window did not cover says so rather than rendering a blank", () => {
  render(<TideWeek state={{ kind: "no-low" }} />);

  // A blank cell in a tide row reads as a calm sea. This one says the range did
  // not reach, which is a fact about our request rather than about the sea.
  expect(screen.getByText(/Not in range/)).toBeDefined();
});

/**
 * ADR-0015. The row carried 🐚 to match the now-band's card, and at the 10px a
 * week label is set in it rendered as a grey smudge on the pale cell -- the
 * exact pale-on-pale failure the card was given a dark surface to escape. The
 * row is named in words instead, so there is no glyph here to keep in step.
 */
test("the week's tide row is named in words and carries no glyph", () => {
  expect(TIDE_WEEK_ROW.label).toBe("Lowest tide");
  expect(TIDE_WEEK_ROW).not.toHaveProperty("emoji");
});
