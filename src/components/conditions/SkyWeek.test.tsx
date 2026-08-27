import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkyWeek, SKY_WEEK_ROW } from "./SkyWeek";
import { gridCellCaveat, phenomenonWords } from "./gridCell";

test("the day's figure is a percentage, and it leads", () => {
  const { container } = render(
    <SkyWeek day={{ cloudPercent: 44, phenomenon: null }} />,
  );

  expect(screen.getByText("44%")).toBeDefined();
  // The lead figure is the bold one, the way every other cell in this grid
  // leads with its own first fact.
  expect(container.querySelector(".font-extrabold")?.textContent).toBe("44%");
});

test("the label names an average, not a superlative", () => {
  // `TideWeek` and `WaveWeek` say "Lowest" and "Biggest" because they show one
  // of a day's estimates. This shows all of them, averaged, and a reader who
  // read the label as a superlative would be wrong about the number.
  expect(SKY_WEEK_ROW.label).toBe("Cloud by day");
  expect(SKY_WEEK_ROW.label).not.toMatch(/cloudiest|clearest|most|least/i);
});

test("a day with fog forecast says so, under the figure", () => {
  render(
    <SkyWeek
      day={{
        cloudPercent: 67,
        phenomenon: { weather: "fog", coverage: "patchy" },
      }}
    />,
  );

  expect(screen.getByText("Patchy fog")).toBeDefined();
});

test("a day with no phenomenon renders the figure alone, not an empty line", () => {
  const { container } = render(
    <SkyWeek day={{ cloudPercent: 30, phenomenon: null }} />,
  );

  // Most days name nothing. A blank second line would read as a reading that
  // failed rather than as an ordinary day.
  expect(container.textContent?.trim()).toBe("30%");
});

test("the accessible text does not run the two facts together", () => {
  // The space between the spans is a real text node; two blocks collapse it
  // visually but a screen reader still needs it, or this reads "67%Patchy fog".
  const { container } = render(
    <SkyWeek
      day={{
        cloudPercent: 67,
        phenomenon: { weather: "fog", coverage: "patchy" },
      }}
    />,
  );

  expect(container.textContent).toContain("67% Patchy fog");
});

test("no glyph and no attribution inside the cell", () => {
  const { container } = render(
    <SkyWeek day={{ cloudPercent: 44, phenomenon: null }} />,
  );

  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  expect(container.textContent).not.toMatch(/National Weather Service/);
});

/* =========================================================================
 * gridCell.ts
 * ========================================================================= */

test("a phenomenon is relayed in the service's own words", () => {
  // ADR-0009: this site relays a forecaster's judgement rather than forming
  // one. The underscore and the capital are the only changes made.
  expect(phenomenonWords({ weather: "fog", coverage: "patchy" })).toBe(
    "Patchy fog",
  );
  expect(phenomenonWords({ weather: "rain_showers", coverage: "chance" })).toBe(
    "Chance rain showers",
  );
});

test("a phenomenon with no coverage still reads as a sentence fragment", () => {
  expect(phenomenonWords({ weather: "fog", coverage: null })).toBe("Fog");
});

test("only a cell that covers the bluff carries the caveat", () => {
  // Three beaches read one: Torrey Pines State at 102 m, Torrey Pines City at
  // 117 m and La Jolla Cove at 106 m, against a median of 2.1 m across the
  // inventory. ADR-0020 serves them and discloses rather than withholding, and
  // this sentence is the half of that decision no gate can assert.
  expect(gridCellCaveat(117.0432)).toMatch(/covers the bluff/);
  expect(gridCellCaveat(117.0432)).toMatch(/117 m/);
  expect(gridCellCaveat(2.1336)).toBeNull();
  expect(gridCellCaveat(0)).toBeNull();
});

test("a cell with no published elevation makes no claim either way", () => {
  expect(gridCellCaveat(null)).toBeNull();
});
