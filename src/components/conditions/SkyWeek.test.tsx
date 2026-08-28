import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { SKY_WEEK_ROW, SkyWeek } from "./SkyWeek";

/** A burn-off day: cloudy first third, clear after. The shape of every day measured. */
const BURN_OFF = { am: 65, mid: 32, eve: 31 };

test("the day is shown in three parts, in reading order", () => {
  const { container } = render(
    <SkyWeek day={{ thirds: BURN_OFF, phenomenon: null }} />,
  );

  expect(container.textContent).toContain("AM");
  expect(container.textContent).toContain("Mid");
  expect(container.textContent).toContain("Eve");
  expect(container.textContent).toMatch(
    /AM[\s\S]*65%[\s\S]*Mid[\s\S]*32%[\s\S]*Eve[\s\S]*31%/,
  );
});

/**
 * ADR-0024, and the reason the row changed at all. The mean of this day is
 * 43%, a figure that describes neither the foggy morning nor the clear
 * afternoon. Measured against the live cell on 2026-08-28, all seven days of
 * the week were this shape.
 *
 * Asserted as an absence because restoring the mean will look like restoring
 * information.
 */
test("the daylight mean is not printed beside the parts", () => {
  const { container } = render(
    <SkyWeek day={{ thirds: BURN_OFF, phenomenon: null }} />,
  );

  expect(container.textContent).not.toContain("43%");
  expect(container.textContent?.match(/%/g)).toHaveLength(3);
});

/**
 * "46% Partly cloudy" was the obvious companion fix, and banding the mean on
 * the National Weather Service's own sky-condition scale contradicts its own
 * published wording on three of six measured days -- we would print "Partly
 * cloudy" where its forecast endpoint says "Mostly Sunny". The words exist and
 * they are the National Weather Service's to give, from a second endpoint this
 * page does not yet read.
 */
test("no band word is computed here, on any figure", () => {
  for (const thirds of [
    { am: 5, mid: 4, eve: 3 },
    { am: 30, mid: 28, eve: 25 },
    { am: 46, mid: 50, eve: 44 },
    { am: 95, mid: 92, eve: 90 },
  ]) {
    const { container } = render(
      <SkyWeek day={{ thirds, phenomenon: null }} />,
    );
    expect(container.textContent).not.toMatch(/sunny|cloudy|overcast|clear/i);
  }
});

test("a day with fog forecast says so, above the figures", () => {
  const { container } = render(
    <SkyWeek
      day={{
        thirds: BURN_OFF,
        phenomenon: { weather: "fog", coverage: "patchy" },
      }}
    />,
  );

  // A parent plans around fog rather than around a percentage, so it leads.
  expect(screen.getByText("Patchy fog")).toBeDefined();
  expect(container.textContent).toMatch(/Patchy fog[\s\S]*AM/);
});

test("a day with no phenomenon prints no empty line for one", () => {
  // Most days. An ordinary day rather than a missing reading: the figures
  // still answer, and a blank line would read as something that failed.
  const { container } = render(
    <SkyWeek day={{ thirds: BURN_OFF, phenomenon: null }} />,
  );

  expect(container.textContent?.startsWith("AM")).toBe(true);
});

/**
 * The forecast does not run backwards, so on the day the reader is standing in
 * the first third is usually gone. A zero there would report a cloudless
 * morning that nobody observed -- the exact failure a blank cell in this grid
 * is built to avoid.
 */
test("a third the forecast did not reach is a dash, never a zero", () => {
  const { container } = render(
    <SkyWeek
      day={{ thirds: { am: null, mid: 32, eve: 31 }, phenomenon: null }}
    />,
  );

  expect(container.textContent).toContain("—");
  expect(container.textContent).not.toContain("0%");
  // The label stays, so the three columns still line up across the week.
  expect(container.textContent).toContain("AM");
});

test("the three parts are equal columns, so the figures compare by eye", () => {
  const { container } = render(
    <SkyWeek day={{ thirds: BURN_OFF, phenomenon: null }} />,
  );

  const parts = [...container.querySelectorAll("span.flex > span")];
  expect(parts).toHaveLength(3);
  for (const part of parts) {
    expect(part.className).toContain("flex-1");
    expect(part.className).toContain("text-center");
  }
});

test("the label claims no superlative, because these are means", () => {
  // It used to say "Cloud by day" against two labels opening "Lowest" and
  // "Biggest", and that contrast was what said this row is an average rather
  // than a peak. ADR-0023 shortened those two, so the contrast is gone and
  // `ConditionsNotes` carries the distinction. What is still assertable here,
  // and still the risk, is that the label never claims an extreme.
  expect(SKY_WEEK_ROW.label).toBe("Cloud cover");
  expect(SKY_WEEK_ROW.label).not.toMatch(/cloudiest|clearest|most|least/i);
  // "Cover" rather than "coverage": the term the National Weather Service uses
  // for this quantity, and 100px against 133px of cell where "cloud coverage"
  // is 128px and leaves five.
  expect(SKY_WEEK_ROW.label).not.toMatch(/coverage/i);
});

test("no glyph rides along with the figures", () => {
  // ADR-0015: at the 10px this grid's labels are set in, a full-colour emoji is
  // a smudge rather than a mark. A row inside a panel is named in words.
  const { container } = render(
    <SkyWeek day={{ thirds: BURN_OFF, phenomenon: null }} />,
  );

  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
});
