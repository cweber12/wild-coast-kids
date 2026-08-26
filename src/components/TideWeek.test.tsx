import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TIDE_WEEK_ROW, TideWeek } from "./TideWeek";

const DAYLIGHT = { timeLabel: "6:41 PM", feet: 0.9 };
const ALL_DAY = { timeLabel: "3:14 AM", feet: -0.42 };

test("a reading leads with the daylight low, time first", () => {
  // Timing first, height second, for the reason TideToday already records: a
  // parent plans around when to leave the house.
  render(
    <TideWeek
      state={{ kind: "reading", daylight: DAYLIGHT, allDay: ALL_DAY }}
    />,
  );

  expect(screen.getByText("6:41 PM")).toBeDefined();
  expect(screen.getByText("0.9 ft")).toBeDefined();
});

test("the day's lowest follows it rather than replacing it", () => {
  // A -0.4 ft at 3:14 AM is a real prediction and a useless plan, but it is
  // exactly the figure a tidepooler willing to set an alarm wants to exist.
  const { container } = render(
    <TideWeek
      state={{ kind: "reading", daylight: DAYLIGHT, allDay: ALL_DAY }}
    />,
  );

  expect(container.textContent).toContain("all day 3:14 AM -0.4 ft");
});

test("a negative height keeps its sign, which is the figure a tidepooler reads", () => {
  // Rounded to one decimal, the same as the now-band's card, so the two places
  // this station's height appears cannot quote it differently.
  render(
    <TideWeek
      state={{
        kind: "reading",
        daylight: { timeLabel: "7:10 AM", feet: -0.42 },
        allDay: null,
      }}
    />,
  );

  expect(screen.getByText("-0.4 ft")).toBeDefined();
});

test("a daylight low that is also the day's lowest says so, rather than repeating", () => {
  // Printing the same figure twice would read as a fault rather than as
  // agreement.
  const { container } = render(
    <TideWeek state={{ kind: "reading", daylight: DAYLIGHT, allDay: null }} />,
  );

  expect(container.textContent).toContain("all day none lower");
  expect(container.textContent).not.toContain("6:41 PM 0.9 ft all day 6:41 PM");
});

test("a day with no low in daylight still answers, from the line below", () => {
  // Close to unreachable on this coast -- two lows twelve and a half hours
  // apart against ten to fourteen hours of daylight -- and a named absence
  // rather than a blank, because the day's lowest is still there to give.
  const { container } = render(
    <TideWeek state={{ kind: "reading", daylight: null, allDay: ALL_DAY }} />,
  );

  expect(screen.getByText("None")).toBeDefined();
  expect(container.textContent).toContain("all day 3:14 AM -0.4 ft");
});

test("the second line takes the same two lines whichever branch it took", () => {
  // A cell whose height depends on its branch puts every row beneath it out of
  // line with its neighbours, which is the thing a grid exists to prevent. The
  // break is scoped to lg, where the columns being aligned exist.
  for (const state of [
    { kind: "reading", daylight: DAYLIGHT, allDay: ALL_DAY },
    { kind: "reading", daylight: DAYLIGHT, allDay: null },
    { kind: "reading", daylight: null, allDay: ALL_DAY },
  ] as const) {
    const { container } = render(<TideWeek state={state} />);
    const prefix = [...container.querySelectorAll("span")].find(
      (span) => span.textContent === "all day",
    );
    expect(prefix?.className).toContain("lg:block");
  }
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
test("the week's tide row names the selection in words, and carries no glyph", () => {
  // The label has to say "daylight", because the cell no longer shows the
  // day's lowest low as its leading figure and a reader must not assume it.
  expect(TIDE_WEEK_ROW.label).toBe("Lowest daylight tide");
  expect(TIDE_WEEK_ROW).not.toHaveProperty("emoji");
});
