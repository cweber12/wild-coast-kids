import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Compass,
  CompassSources,
  DIAL_RADIUS,
  type CompassNeedle,
} from "./Compass";

const WIND: CompassNeedle = {
  kind: "wind",
  label: "Wind",
  fromDegT: 281,
  spreadDeg: 40,
  source: "this beach's own grid cell",
  network: "National Weather Service, San Diego",
  note: "a forecast, not a reading taken at the beach",
};

/** The dial draws around its own origin, so a bare `<svg>` is the whole rig. */
function dial(needles: readonly CompassNeedle[]) {
  const { container } = render(
    <svg>
      <Compass needles={needles} />
    </svg>,
  );
  return container;
}

const num = (element: Element, name: string) =>
  Number(element.getAttribute(name));

test("the needle's tail stands in the direction the wind comes from", () => {
  // Due east, on a map with north up: the tail is to the right of the beach
  // and level with it. A sign flip anywhere in the bearing-to-plot conversion
  // moves it to one of the other three sides, which is what this pins.
  const container = dial([{ ...WIND, fromDegT: 90, spreadDeg: 0 }]);

  const needle = container.querySelector('[data-needle="wind"]')!;
  expect(num(needle, "x1")).toBeCloseTo(DIAL_RADIUS, 4);
  expect(num(needle, "y1")).toBeCloseTo(0, 4);
});

test("north is up, not down", () => {
  // The other half of the same conversion, and the one a y-down drawing space
  // gets wrong: plot y grows southward, so due north is a negative y.
  const container = dial([{ ...WIND, fromDegT: 0, spreadDeg: 0 }]);

  const needle = container.querySelector('[data-needle="wind"]')!;
  expect(num(needle, "x1")).toBeCloseTo(0, 4);
  expect(num(needle, "y1")).toBeCloseTo(-DIAL_RADIUS, 4);
});

test("the needle points inward, at the beach it arrives at", () => {
  // Which end carries the head is the whole reading. An arrow from the beach
  // outward says the wind is going that way; this one says it comes from
  // there, which is what every figure on this page means by a direction.
  const container = dial([{ ...WIND, fromDegT: 90, spreadDeg: 0 }]);

  const needle = container.querySelector('[data-needle="wind"]')!;
  expect(Math.abs(num(needle, "x2"))).toBeLessThan(Math.abs(num(needle, "x1")));
});

test("the arc widens with the day's spread", () => {
  const narrow = dial([{ ...WIND, fromDegT: 270, spreadDeg: 20 }]);
  const wide = dial([{ ...WIND, fromDegT: 270, spreadDeg: 120 }]);

  const ends = (container: Element) => {
    const d = container.querySelector('[data-arc="wind"]')!.getAttribute("d")!;
    const numbers = d.match(/-?\d+\.?\d*/g)!.map(Number);
    // "M x0 y0 A r r 0 large sweep x1 y1" -- the first pair and the last.
    return Math.hypot(
      numbers[0] - numbers[numbers.length - 2],
      numbers[1] - numbers[numbers.length - 1],
    );
  };

  expect(ends(wide)).toBeGreaterThan(ends(narrow));
});

test("a day that never shifted gets no arc rather than a zero-length one", () => {
  const container = dial([{ ...WIND, spreadDeg: 0 }]);

  expect(container.querySelector('[data-arc="wind"]')).toBeNull();
  expect(container.querySelector('[data-needle="wind"]')).not.toBeNull();
});

test("an arc wider than a half circle takes the long way round", () => {
  // The SVG flag that says which of the two arcs between two points is meant.
  // Without it a 200-degree swing draws as the 160-degree one it is not.
  const container = dial([{ ...WIND, fromDegT: 214, spreadDeg: 200 }]);

  const d = container.querySelector('[data-arc="wind"]')!.getAttribute("d")!;
  expect(d).toMatch(/A [\d.]+ [\d.]+ 0 1 1 /);
});

test("nothing is drawn when there is no needle to draw", () => {
  const container = dial([]);

  expect(container.querySelector("[data-compass-dial]")).toBeNull();
});

test("the sources state the bearing in words and in degrees", () => {
  render(<CompassSources needles={[WIND]} />);

  expect(screen.getByText(/Wind, from the west, 281°/)).toBeDefined();
});

test("a wide swing is stated and a narrow one is not", () => {
  const { unmount } = render(
    <CompassSources needles={[{ ...WIND, spreadDeg: 120 }]} />,
  );
  expect(screen.getByText(/swinging through 120° in daylight/)).toBeDefined();
  unmount();

  render(<CompassSources needles={[{ ...WIND, spreadDeg: 30 }]} />);
  expect(screen.queryByText(/swinging through/)).toBeNull();
});

test("each needle carries its own publisher", () => {
  render(<CompassSources needles={[WIND]} />);

  expect(
    screen.getByText(
      /this beach's own grid cell · National Weather Service, San Diego — a forecast, not a reading taken at the beach/,
    ),
  ).toBeDefined();
});
