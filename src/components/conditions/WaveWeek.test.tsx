import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaveWeek, WAVE_WEEK_ROW } from "./WaveWeek";

const DAYLIGHT = { timeLabel: "2:00 PM", heightFt: 2.618, periodS: 13.333333 };
const ALL_DAY = { timeLabel: "2:00 AM", heightFt: 4.1, periodS: 5 };

test("the row's name states which estimate of the day this is", () => {
  // Fifty-six three-hourly estimates stand behind one cell. Which two are shown
  // is a judgement, and a superlative stated is one a reader can discount.
  expect(WAVE_WEEK_ROW.label).toBe("Biggest daylight swell");
});

test("the daylight swell leads: time, then height and period", () => {
  // Every row of this grid opens with a time -- the lowest daylight low,
  // sunrise -- so a reader scanning down one day reads "when, when, when".
  const { container } = render(
    <WaveWeek day={{ daylight: DAYLIGHT, allDay: ALL_DAY }} />,
  );

  expect(container.textContent).toContain("2:00 PM 2.6 ft · 13 s");
});

test("the day's biggest follows it, without repeating the period", () => {
  // The period qualifies the swell a reader is deciding about; the day's own
  // estimate is context for that decision rather than a second one to weigh.
  const { container } = render(
    <WaveWeek day={{ daylight: DAYLIGHT, allDay: ALL_DAY }} />,
  );

  expect(container.textContent).toContain("all day 2:00 AM 4.1 ft");
  expect(container.textContent).not.toContain("4.1 ft · 5 s");
});

test("the height keeps one decimal, matching the card above", () => {
  render(
    <WaveWeek
      day={{
        daylight: { ...DAYLIGHT, heightFt: 0.6402116 * 3.280839895 },
        allDay: null,
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
    <WaveWeek
      day={{ daylight: { ...DAYLIGHT, periodS: 16.666668 }, allDay: null }}
    />,
  );

  expect(container.textContent).toContain("17 s");
});

test("a daylight swell that is also the day's biggest says so, rather than repeating", () => {
  const { container } = render(
    <WaveWeek day={{ daylight: DAYLIGHT, allDay: null }} />,
  );

  expect(container.textContent).toContain("all day none bigger");
});

test("a day with no estimate in daylight still answers, from the line below", () => {
  // A ragged forecast can cover only part of a day. A named absence rather
  // than a blank, because the day's biggest is still there to give.
  const { container } = render(
    <WaveWeek day={{ daylight: null, allDay: ALL_DAY }} />,
  );

  expect(screen.getByText("None")).toBeDefined();
  expect(container.textContent).toContain("all day 2:00 AM 4.1 ft");
});

test("the time is emphasised and the figures beneath it are not", () => {
  // The same weighting the tide cell uses for its own leading figure, so a
  // reader scanning the grid finds the same thing in the same place.
  const { container } = render(
    <WaveWeek day={{ daylight: DAYLIGHT, allDay: ALL_DAY }} />,
  );

  const spans = [...container.querySelectorAll("span")];
  expect(spans[0].className).toContain("font-extrabold");
  expect(spans[0].textContent).toBe("2:00 PM");
  expect(spans[1].className).toContain("text-fog");
});

test("every deliberate break is scoped to lg, where the columns it aligns exist", () => {
  // Below lg a day is a full-width row: nothing wraps, no neighbour is being
  // lined up against, and the break is 35px a day across seven days.
  const { container } = render(
    <WaveWeek day={{ daylight: DAYLIGHT, allDay: ALL_DAY }} />,
  );

  const spans = [...container.querySelectorAll("span")];
  const broken = spans.filter((span) =>
    span.className.split(/\s+/).includes("lg:block"),
  );

  // The leading time, the figures under it, and the "all day" prefix.
  expect(broken).toHaveLength(3);
  for (const span of broken) {
    expect(span.className.split(/\s+/)).not.toContain("block");
  }
  expect(broken.at(-1)!.textContent).toBe("all day");
});

test("no glyph rides along with the figures", () => {
  // ADR-0015: at the 10px the grid's labels are set in, a full-colour emoji is
  // a smudge rather than a mark. A row inside a panel is named in words.
  const { container } = render(
    <WaveWeek day={{ daylight: DAYLIGHT, allDay: ALL_DAY }} />,
  );

  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});

test("the time stays a separate word from the height it precedes", () => {
  // The same concatenation `ReadingCard` records hitting in the accessible-name
  // algorithm: without the text node between them this reads "2:00 PM2.6 ft".
  const { container } = render(
    <WaveWeek day={{ daylight: DAYLIGHT, allDay: ALL_DAY }} />,
  );

  expect(container.textContent).toContain("PM 2.6");
});
