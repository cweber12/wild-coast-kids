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

/**
 * ADR-0023. The cell used to carry the day's own lowest under an "all day"
 * prefix, and the label that distinguished the two — "Lowest daylight tide" —
 * renders 170px against 125px of cell. The window is stated once in the day
 * header now, so there is no second figure for it to distinguish this one
 * from.
 *
 * The figure is not gone from the site: the day view below draws all twenty-four
 * hours with night shaded, so every day's overnight low is there as a dip, and
 * `WeekPanel` says so in a sentence beneath the grid. Asserted here as an
 * absence because restoring it will look like restoring information.
 */
test("the day's own lowest is not in this cell", () => {
  const { container } = render(
    <TideWeek
      state={{ kind: "reading", daylight: DAYLIGHT, allDay: ALL_DAY }}
    />,
  );

  expect(container.textContent).toBe("6:41 PM 0.9 ft");
  expect(container.textContent).not.toContain("all day");
  expect(container.textContent).not.toContain("3:14 AM");
});

test("a negative height keeps its sign, which is the figure a tidepooler reads", () => {
  // Rounded to one decimal, the same as the day chart's own axis, so the two
  // places this station's height appears cannot quote it differently.
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

test("whether the two extremes agree changes nothing a reader sees", () => {
  // `allDay` is null when the daylight low is also the day's lowest. That
  // distinction drove the old second line ("none lower" against a figure) and
  // now drives nothing, so the two must render identically.
  const agreed = render(
    <TideWeek state={{ kind: "reading", daylight: DAYLIGHT, allDay: null }} />,
  );
  const differed = render(
    <TideWeek
      state={{ kind: "reading", daylight: DAYLIGHT, allDay: ALL_DAY }}
    />,
  );

  expect(agreed.container.textContent).toBe(differed.container.textContent);
  expect(agreed.container.textContent).not.toContain("none lower");
});

test("a day with no low in daylight says the low is after dark", () => {
  // Reached twice in one week on the default page, 2026-09-17, on a coast
  // whose tides go diurnal for a few days at a time -- the docstring that
  // called this close to unreachable was wrong. A named absence rather than a
  // blank, because an empty cell in a tide row reads as a flat sea; and words
  // a parent can act on rather than "None", which under LOW TIDE read as no
  // tide at all. The overnight figure itself stays out: the day view draws it.
  const { container } = render(
    <TideWeek state={{ kind: "reading", daylight: null, allDay: ALL_DAY }} />,
  );

  expect(screen.getByText("Lowest after dark")).toBeDefined();
  expect(container.textContent).not.toContain("None");
  expect(container.textContent).not.toContain("3:14 AM");
});

/**
 * Regression. Every branch of this cell was two lines at `lg`, because a cell
 * whose height depended on which branch it took put every row beneath it out
 * of line with its neighbours. With one line there is no branch to equalise,
 * and a `block` left behind would cost height on all seven days for nothing.
 */
test("no branch of the cell forces a line break", () => {
  for (const state of [
    { kind: "reading", daylight: DAYLIGHT, allDay: ALL_DAY },
    { kind: "reading", daylight: DAYLIGHT, allDay: null },
    { kind: "reading", daylight: null, allDay: ALL_DAY },
    { kind: "no-low" },
  ] as const) {
    const { container } = render(<TideWeek state={state} />);
    const classes = [...container.querySelectorAll("span")].flatMap((span) =>
      span.className.split(/\s+/),
    );
    expect(classes).not.toContain("block");
    expect(classes).not.toContain("lg:block");
  }
});

test("a date with no low at all says so rather than rendering a blank", () => {
  render(<TideWeek state={{ kind: "no-low" }} />);

  // A blank cell in a tide row reads as a calm sea. It said "Not in range"
  // until 2026-09-17, on the belief that this state was a fact about the
  // window we asked NOAA for; it is a fact about the sea. When the tide runs
  // diurnal -- one low per lunar day, a few days at a time on this coast -- a
  // calendar date can hold no low turning point, and a Saturday inside a
  // seven-day request printed the request-fault wording. `conditions.test.ts`
  // reaches the state from real-shaped predictions.
  expect(screen.getByText("No low tide today")).toBeDefined();
  expect(screen.queryByText(/Not in range/)).toBeNull();
});

/**
 * ADR-0015. The row carried 🐚 to match the tide card the page then had, and at the 10px a
 * week label is set in it rendered as a grey smudge on the pale cell -- the
 * exact pale-on-pale failure the card was given a dark surface to escape. The
 * row is named in words instead, so there is no glyph here to keep in step.
 */
test("the week's tide row is named in words, and carries no glyph", () => {
  // ADR-0023: two words, because the day header says which window they fall
  // in. "Lowest daylight tide" said it in the label and rendered 170px wide
  // against a 125px cell, so it wrapped at every width the grid has had.
  expect(TIDE_WEEK_ROW.label).toBe("Low tide");
  expect(TIDE_WEEK_ROW).not.toHaveProperty("emoji");
});
