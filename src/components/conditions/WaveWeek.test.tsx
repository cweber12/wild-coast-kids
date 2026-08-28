import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaveWeek, WAVE_WEEK_ROW } from "./WaveWeek";

const DAYLIGHT = { timeLabel: "2:00 PM", heightFt: 2.618, periodS: 13.333333 };

test("the row is named in one word, since the header states the window", () => {
  // ADR-0023. Fifty-six three-hourly estimates stand behind one cell and which
  // one is shown is a judgement, which "Biggest daylight swell" named in the
  // label -- at 187px against a 125px cell, so it wrapped at every width the
  // grid has had. The day header says the window once for all three rows now.
  expect(WAVE_WEEK_ROW.label).toBe("Swell");
});

test("the daylight swell leads: time, then height and period", () => {
  // Every row of this grid opens with a time -- the lowest daylight low,
  // sunrise -- so a reader scanning down one day reads "when, when, when".
  const { container } = render(<WaveWeek day={{ daylight: DAYLIGHT }} />);

  expect(container.textContent).toContain("2:00 PM 2.6 ft · 13 s");
});

/**
 * ADR-0023, the counterpart of the assertion in `TideWeek.test.tsx`. The day's
 * own biggest fell outside daylight on six of seven days measured -- four of
 * those at 11 PM or 2 AM -- so the cell carried it under an "all day" prefix
 * and the label had to say which figure was which. It is on the card above for
 * today and in the day view for the rest; here it is an absence, because
 * restoring it will look like restoring information.
 */
test("the day's own biggest is not in this cell", () => {
  const { container } = render(<WaveWeek day={{ daylight: DAYLIGHT }} />);

  expect(container.textContent).toBe("2:00 PM 2.6 ft · 13 s");
  expect(container.textContent).not.toContain("all day");
});

test("the height keeps one decimal, matching the card above", () => {
  render(
    <WaveWeek
      day={{
        daylight: { ...DAYLIGHT, heightFt: 0.6402116 * 3.280839895 },
      }}
    />,
  );

  expect(screen.getByText(/2\.1 ft/)).toBeDefined();
});

test("the period is rounded to whole seconds", () => {
  // CDIP publishes 16.666668 because it is the reciprocal of a spectral
  // frequency bin, not a measurement to six decimal places -- and the buoy card
  // beside this one prints whole seconds because NDBC publishes whole seconds.
  const { container } = render(
    <WaveWeek day={{ daylight: { ...DAYLIGHT, periodS: 16.666668 } }} />,
  );

  expect(container.textContent).toContain("17 s");
});

test("a day with no estimate in daylight says so rather than rendering blank", () => {
  // A ragged forecast can cover only part of a day. A named absence rather
  // than a blank, for the reason `TideWeek` gives: an empty cell in a forecast
  // row reads as a flat, quiet day.
  render(<WaveWeek day={{ daylight: null }} />);

  expect(screen.getByText("None")).toBeDefined();
});

test("the time is emphasised and the figures beneath it are not", () => {
  // The same weighting the tide cell uses for its own leading figure, so a
  // reader scanning the grid finds the same thing in the same place.
  const { container } = render(<WaveWeek day={{ daylight: DAYLIGHT }} />);

  const spans = [...container.querySelectorAll("span")];
  expect(spans[0].className).toContain("font-extrabold");
  expect(spans[0].textContent).toBe("2:00 PM");
  expect(spans[1].className).toContain("text-fog");
});

/**
 * Regression. This cell carried three forced breaks at `lg`, which kept seven
 * columns in step while it ran to four lines. It is one line now --
 * `11:00 AM 0.7 ft · 6 s` is 117px, the longest line the cell has, against
 * 125px in the narrowest seven-column cell -- so a `block` left behind would
 * cost height on all seven days for nothing.
 */
test("nothing in the cell forces a line break", () => {
  const { container } = render(<WaveWeek day={{ daylight: DAYLIGHT }} />);

  const classes = [...container.querySelectorAll("span")].flatMap((span) =>
    span.className.split(/\s+/),
  );
  expect(classes).not.toContain("block");
  expect(classes).not.toContain("lg:block");
});

test("no glyph rides along with the figures", () => {
  // ADR-0015: at the 10px the grid's labels are set in, a full-colour emoji is
  // a smudge rather than a mark. A row inside a panel is named in words.
  const { container } = render(<WaveWeek day={{ daylight: DAYLIGHT }} />);

  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});

test("the time stays a separate word from the height it precedes", () => {
  // The same concatenation `ReadingCard` records hitting in the accessible-name
  // algorithm: without the text node between them this reads "2:00 PM2.6 ft".
  const { container } = render(<WaveWeek day={{ daylight: DAYLIGHT }} />);

  expect(container.textContent).toContain("PM 2.6");
});
