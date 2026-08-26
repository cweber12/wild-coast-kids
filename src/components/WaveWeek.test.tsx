import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaveWeek, WAVE_WEEK_ROW } from "./WaveWeek";

const DAY = { timeLabel: "2:00 PM", heightFt: 2.618, periodS: 13.333333 };

test("the row's name states which estimate of the day this is", () => {
  // Fifty-six three-hourly estimates stand behind one cell. Which one is shown
  // is a judgement, and a superlative stated is one a reader can discount.
  expect(WAVE_WEEK_ROW.label).toBe("Biggest swell");
});

test("the time leads, then the height and the period", () => {
  // Every row of this grid opens with a time -- the lowest low, sunrise -- so a
  // reader scanning down one day reads "when, when, when". A fourth row opening
  // with a number would break the column they are reading.
  const { container } = render(<WaveWeek day={DAY} />);

  expect(container.textContent).toBe("2:00 PM 2.6 ft · 13 s");
});

test("the height keeps one decimal, matching the card above", () => {
  render(
    <WaveWeek
      day={{ ...DAY, heightFt: 0.6402116 * 3.280839895, periodS: 12.5 }}
    />,
  );

  expect(screen.getByText(/2\.1 ft/)).toBeDefined();
});

test("the period is rounded to whole seconds", () => {
  // CDIP publishes 16.666668 because it is the reciprocal of a spectral
  // frequency bin, not a measurement to six decimal places -- and the buoy card
  // beside this one prints whole seconds because NDBC publishes whole seconds.
  const { container } = render(
    <WaveWeek day={{ ...DAY, heightFt: 3.4, periodS: 16.666668 }} />,
  );

  expect(container.textContent).toContain("17 s");
});

test("the time is emphasised and the figures beneath it are not", () => {
  // The same weighting the tide cell uses for its own leading figure, so a
  // reader scanning the grid finds the same thing in the same place.
  const { container } = render(<WaveWeek day={DAY} />);

  const spans = [...container.querySelectorAll("span")];
  expect(spans[0].className).toContain("font-extrabold");
  expect(spans[0].textContent).toBe("2:00 PM");
  expect(spans[1].className).toContain("text-fog");
});

test("the break is scoped to lg, where the columns it aligns exist", () => {
  // Below lg a day is a full-width row: nothing wraps, no neighbour is being
  // lined up against, and the break is 35px a day across seven days.
  const { container } = render(<WaveWeek day={DAY} />);

  for (const span of container.querySelectorAll("span")) {
    expect(span.className).toContain("lg:block");
    expect(span.className.split(/\s+/)).not.toContain("block");
  }
});

test("no glyph rides along with the figures", () => {
  // ADR-0015: at the 10px the grid's labels are set in, a full-colour emoji is
  // a smudge rather than a mark. A row inside a panel is named in words.
  const { container } = render(<WaveWeek day={DAY} />);

  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});

test("the time stays a separate word from the height it precedes", () => {
  // The same concatenation `ReadingCard` records hitting in the accessible-name
  // algorithm: without the text node between them this reads "2:00 PM2.6 ft".
  const { container } = render(<WaveWeek day={DAY} />);

  expect(container.textContent).toContain("PM 2.6");
});
