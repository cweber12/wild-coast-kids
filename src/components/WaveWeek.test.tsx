import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaveWeek, WAVE_WEEK_ROW } from "./WaveWeek";

test("the row's name states which estimate of the day this is", () => {
  // Fifty-six three-hourly estimates stand behind one cell. Which one is shown
  // is a judgement, and a superlative stated is one a reader can discount.
  expect(WAVE_WEEK_ROW.label).toBe("Biggest swell");
});

test("the height leads and the period follows it", () => {
  // The opposite order to the tide row, and deliberately: a tide is a plan
  // about when to leave the house, a swell is a plan about whether to go.
  const { container } = render(
    <WaveWeek day={{ heightFt: 2.618, periodS: 13.333333 }} />,
  );

  expect(container.textContent).toBe("2.6 ft 13 s");
});

test("the height keeps one decimal, matching the card above", () => {
  render(
    <WaveWeek day={{ heightFt: 0.6402116 * 3.280839895, periodS: 12.5 }} />,
  );

  expect(screen.getByText("2.1 ft")).toBeDefined();
});

test("the period is rounded to whole seconds", () => {
  // CDIP publishes 16.666668 because it is the reciprocal of a spectral
  // frequency bin, not a measurement to six decimal places -- and the buoy card
  // beside this one prints whole seconds because NDBC publishes whole seconds.
  render(<WaveWeek day={{ heightFt: 3.4, periodS: 16.666668 }} />);

  expect(screen.getByText("17 s")).toBeDefined();
});

test("the height is emphasised and the period is not", () => {
  // The same weighting the tide cell uses for its own leading figure, so a
  // reader scanning the grid finds the same thing in the same place.
  const { container } = render(
    <WaveWeek day={{ heightFt: 2.6, periodS: 13 }} />,
  );

  const spans = [...container.querySelectorAll("span")];
  expect(spans[0].className).toContain("font-extrabold");
  expect(spans[1].className).toContain("text-fog");
});

test("no glyph rides along with the figures", () => {
  // ADR-0015: at the 10px the grid's labels are set in, a full-colour emoji is
  // a smudge rather than a mark. A row inside a panel is named in words.
  const { container } = render(
    <WaveWeek day={{ heightFt: 2.6, periodS: 13 }} />,
  );

  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});

test("the two figures stay separate words to a reader who cannot see the gap", () => {
  // The same concatenation `ReadingCard` records hitting in the accessible-name
  // algorithm: without the text node between them this reads "2.6 ft13 s".
  const { container } = render(
    <WaveWeek day={{ heightFt: 2.6, periodS: 13 }} />,
  );

  expect(container.textContent).toContain("ft 13");
});
