import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayCompass, DayCompassSources, type CompassDay } from "./DayCompass";
import { SelectedDayProvider } from "./selectedDay";
import { SelectedHourProvider } from "./selectedHour";
import type { CompassNeedle } from "./Compass";

function needle(fromDegT: number): CompassNeedle {
  return {
    kind: "wind",
    label: "Wind",
    fromDegT,
    swing: { fromDegT, spreadDeg: 20 },
    figure: "11.5 mph",
    provenance: {
      label: "Biggest wind in daylight, 11.5 mph at 2:00 PM",
      source: "this beach's own grid cell",
      network: "National Weather Service, San Diego",
    },
  };
}

/**
 * Two days, each of two hours, with a different bearing in every one.
 *
 * Different per hour as well as per day because both selections reach this
 * component, and a readout showing the right day at the wrong hour is the
 * failure the second one introduces.
 */
const DAYS: CompassDay[] = [
  {
    localDate: "2026-08-17",
    hours: [
      { hour: 9, caption: "9 AM", needles: [needle(90)] },
      { hour: 14, caption: "2 PM", needles: [needle(180)] },
    ],
  },
  {
    localDate: "2026-08-18",
    hours: [
      { hour: 9, caption: "9 AM", needles: [needle(0)] },
      { hour: 14, caption: "2 PM", needles: [needle(270)] },
    ],
  },
];

function renderReadout(currentHour: number | null, days = DAYS) {
  return render(
    <SelectedDayProvider>
      <SelectedHourProvider currentHour={currentHour}>
        <DayCompass days={days} />
        <DayCompassSources days={days} />
      </SelectedHourProvider>
    </SelectedDayProvider>,
  );
}

test("the readout opens on the first day at the hour it is now", () => {
  // Both defaults at once, and neither is resolved here: the day comes from
  // `selectedDay`'s first column and the hour from the clock the server read.
  // A readout that resolved either itself could disagree with the chart beside
  // it on a page nobody had clicked yet.
  const { container } = renderReadout(14);

  expect(
    screen.getByRole("img", { name: /^Wind at 2 PM, from the south, 180°/ }),
  ).toBeDefined();
  expect(container.querySelector("[data-readout-caption]")!.textContent).toBe(
    "2 PM",
  );
});

test("an hour this day cannot answer draws no readout", () => {
  // The far end of the week runs out of forecast, and a day whose hours are
  // ragged is a forecast doing what forecasts do. A caption over two empty rows
  // would be a block claiming to have said something.
  const { container } = renderReadout(3);

  expect(container.querySelector("[data-readout]")).toBeNull();
  expect(container.textContent).toBe("");
});

test("a beach with no days at all draws nothing rather than throwing", () => {
  const { container } = renderReadout(14, []);

  expect(container.textContent).toBe("");
});

test("the attribution moves with the rows it attributes", () => {
  // The two halves go together, and they are two components because they render
  // in two places: the rows over a corner of the picture, the lines beneath it.
  // A line naming the publisher of a figure that is not being shown is the
  // failure ADR-0032's rule exists to prevent.
  renderReadout(14);

  expect(screen.getByText(/this beach's own grid cell/).textContent).toContain(
    "National Weather Service, San Diego",
  );
});

test("outside the providers there is no hour, so there is nothing to draw", () => {
  // A change from the day this block showed before. `selectedDay`'s default
  // resolves to the first column, so a day was always available; the hour's
  // default is the one the server read off its own clock, and outside the
  // provider there is neither. Selecting midnight to have something to draw
  // would be a plausible figure standing in for a missing one.
  const { container } = render(<DayCompass days={DAYS} />);

  expect(container.textContent).toBe("");
});
