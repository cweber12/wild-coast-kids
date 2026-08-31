import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayCompass, DayCompassSources, type CompassDay } from "./DayCompass";
import { SelectedDayProvider } from "./selectedDay";
import type { CompassNeedle } from "./Compass";

function needle(fromDegT: number): CompassNeedle {
  return {
    kind: "wind",
    label: "Wind",
    fromDegT,
    spreadDeg: 20,
    figure: "11.5 mph",
    provenance: {
      label: "Biggest wind in daylight",
      source: "this beach's own grid cell",
      network: "National Weather Service, San Diego",
    },
  };
}

const DAYS: CompassDay[] = [
  { localDate: "2026-08-17", needles: [needle(90)] },
  { localDate: "2026-08-18", needles: [needle(270)] },
];

test("the readout opens on the first day, which is today", () => {
  // The provider starts null and every consumer resolves it against its own
  // first column, so the server render and the first client render agree by
  // construction. A readout that read a clock could disagree with the heading.
  render(
    <SelectedDayProvider>
      <DayCompass days={DAYS} />
    </SelectedDayProvider>,
  );

  expect(screen.getByRole("img", { name: /from the east, 90°/ })).toBeDefined();
});

test("a day the compass has nothing for renders no readout", () => {
  const { container } = render(
    <SelectedDayProvider>
      <DayCompass days={[{ localDate: "2026-08-17", needles: [] }]} />
    </SelectedDayProvider>,
  );

  expect(container.querySelector("[data-readout]")).toBeNull();
});

test("a beach with no days at all draws nothing rather than throwing", () => {
  const { container } = render(
    <SelectedDayProvider>
      <DayCompass days={[]} />
      <DayCompassSources days={[]} />
    </SelectedDayProvider>,
  );

  expect(container.textContent).toBe("");
});

test("the readout renders outside the provider, showing its first day", () => {
  // The provider's default is the null state rather than a throw, so a region
  // rendered outside it degrades to "the first day and no choice" -- which is
  // exactly the state a reader with no JavaScript is in.
  render(<DayCompass days={DAYS} />);

  expect(screen.getByRole("img", { name: /from the east, 90°/ })).toBeDefined();
});
