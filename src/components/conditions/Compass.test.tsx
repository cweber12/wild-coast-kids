import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Compass,
  CompassSources,
  NEEDLE_GLYPHS,
  needleSentence,
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

function readout(needles: readonly CompassNeedle[]) {
  const { container } = render(<Compass needles={needles} />);
  return container;
}

const num = (element: Element, name: string) =>
  Number(element.getAttribute(name));

test("the arrow's tail stands in the direction the wind comes from", () => {
  // Due east, on a glyph with north up: the tail is to the right of the middle
  // and level with it. A sign flip anywhere in the bearing-to-plot conversion
  // moves it to one of the other three sides, which is what this pins.
  const container = readout([{ ...WIND, fromDegT: 90, spreadDeg: 0 }]);

  const arrow = container.querySelector('[data-arrow="wind"]')!;
  expect(num(arrow, "x1")).toBeCloseTo(8, 4);
  expect(num(arrow, "y1")).toBeCloseTo(0, 4);
});

test("north is up, not down", () => {
  // The other half of the same conversion, and the one a y-down drawing space
  // gets wrong: plot y grows southward, so due north is a negative y.
  const container = readout([{ ...WIND, fromDegT: 0, spreadDeg: 0 }]);

  const arrow = container.querySelector('[data-arrow="wind"]')!;
  expect(num(arrow, "x1")).toBeCloseTo(0, 4);
  expect(num(arrow, "y1")).toBeCloseTo(-8, 4);
});

test("the arrow points the way the weather travels", () => {
  // Which end carries the head is the whole reading. Every feed this page reads
  // publishes the direction weather comes *from*, so an easterly wind is drawn
  // travelling west: tail in the east, head in the west.
  const container = readout([{ ...WIND, fromDegT: 90, spreadDeg: 0 }]);

  const arrow = container.querySelector('[data-arrow="wind"]')!;
  expect(num(arrow, "x1")).toBeGreaterThan(0);
  expect(num(arrow, "x2")).toBeLessThan(0);

  // And the head is at the far side rather than in the middle, so the arrow
  // reads as a direction on its own without a beach under it to arrive at.
  const head = container.querySelector('[data-arrow-head="wind"]')!;
  expect(head.getAttribute("points")).toContain("-8.00,0.00");
});

test("the wedge widens with the day's spread", () => {
  const narrow = readout([{ ...WIND, fromDegT: 270, spreadDeg: 20 }]);
  const wide = readout([{ ...WIND, fromDegT: 270, spreadDeg: 120 }]);

  const ends = (container: Element) => {
    const d = container
      .querySelector('[data-wedge="wind"]')!
      .getAttribute("d")!;
    const numbers = d.match(/-?\d+\.?\d*/g)!.map(Number);
    // "M0 0 L x0 y0 A r r 0 large sweep x1 y1 Z" -- the first drawn pair after
    // the origin, and the last.
    return Math.hypot(
      numbers[2] - numbers[numbers.length - 2],
      numbers[3] - numbers[numbers.length - 1],
    );
  };

  expect(ends(wide)).toBeGreaterThan(ends(narrow));
});

test("the wedge is a cone from the middle, not a ring around it", () => {
  // The ring went with the dial. Its only stated justification was giving the
  // arc something to be a portion of, and at 16px that arc can no longer be
  // judged -- so what is left has to be readable as a filled shape.
  const container = readout([{ ...WIND, fromDegT: 270, spreadDeg: 60 }]);

  const wedge = container.querySelector('[data-wedge="wind"]')!;
  expect(wedge.getAttribute("d")).toMatch(/^M0 0 L/);
  expect(wedge.getAttribute("d")).toMatch(/Z$/);
  expect(container.querySelector("circle")).toBeNull();
});

test("a day that never shifted gets no wedge rather than a zero-width one", () => {
  const container = readout([{ ...WIND, spreadDeg: 0 }]);

  expect(container.querySelector('[data-wedge="wind"]')).toBeNull();
  expect(container.querySelector('[data-arrow="wind"]')).not.toBeNull();
});

test("a spread wider than a half circle takes the long way round", () => {
  // The SVG flag that says which of the two arcs between two points is meant.
  // Without it a 200-degree swing draws as the 160-degree one it is not.
  const container = readout([{ ...WIND, fromDegT: 214, spreadDeg: 200 }]);

  const d = container.querySelector('[data-wedge="wind"]')!.getAttribute("d")!;
  expect(d).toMatch(/A [\d.]+ [\d.]+ 0 1 1 /);
});

test("nothing is rendered when there is no needle to render", () => {
  const container = readout([]);

  expect(container.querySelector("[data-readout]")).toBeNull();
});

test("the row states its word, the direction and the degrees", () => {
  const container = readout([WIND]);

  expect(
    container.querySelector('[data-readout-label="wind"]')!.textContent,
  ).toBe("Wind");
  expect(
    container.querySelector('[data-readout-bearing="wind"]')!.textContent,
  ).toBe("west 281°");
});

test("the row's accessible name is the sentence the visible row abbreviates", () => {
  // `role="img"` with a label is how `DaylightWeek` and `Placeholder` name a
  // thing whose visible content is not its name. This repo does not use
  // `sr-only`, and `ReadingCard` records why: the accessible-name algorithm
  // joins inline text nodes with no separator, so a hidden connective would
  // concatenate with its neighbours rather than read as a phrase.
  render(<Compass needles={[WIND]} />);

  expect(screen.getByRole("img", { name: "Wind, from the west, 281°" }));
});

test("a wide swing is spoken and a narrow one is not", () => {
  // One compass point is exactly the width the words have, so a swing wider
  // than one is a swing the word cannot describe and a reader is owed the
  // number. The wedge shows it either way; the sentence states it only when
  // the word alone would mislead.
  expect(needleSentence({ ...WIND, spreadDeg: 120 })).toBe(
    "Wind, from the west, 281°, swinging through 120° in daylight",
  );
  expect(needleSentence({ ...WIND, spreadDeg: 30 })).toBe(
    "Wind, from the west, 281°",
  );
});

test("the glyph itself is not in the accessibility tree twice", () => {
  // The row is one `role="img"` with a sentence on it; the drawing inside it is
  // the same fact drawn, so it is hidden rather than named again.
  const container = readout([WIND]);

  expect(
    container
      .querySelector('[data-readout-glyph="wind"]')!
      .getAttribute("aria-hidden"),
  ).toBe("true");
});

test("the two rows differ in shape and in weight, not only in colour", () => {
  // The brief's rule and the one a small graphic breaks most easily: a 16px
  // glyph is the size at which two hues are the weakest way to tell two marks
  // apart, and these two are read as a pair, one above the other.
  const container = readout([
    { ...WIND, kind: "wind", spreadDeg: 0 },
    { ...WIND, kind: "swell", label: "Swell", fromDegT: 340, spreadDeg: 0 },
  ]);

  const windHead = container.querySelector('[data-arrow-head="wind"]')!;
  const swellHead = container.querySelector('[data-arrow-head="swell"]')!;

  // Shape: an open chevron against a solid blade, which survives greyscale.
  expect(windHead.tagName.toLowerCase()).toBe("polyline");
  expect(swellHead.tagName.toLowerCase()).toBe("polygon");

  // Weight: a different stroke, which survives greyscale too.
  expect(NEEDLE_GLYPHS.wind.width).toBeLessThan(NEEDLE_GLYPHS.swell.width);
  expect(
    num(container.querySelector('[data-arrow="wind"]')!, "stroke-width"),
  ).toBeLessThan(
    num(container.querySelector('[data-arrow="swell"]')!, "stroke-width"),
  );
});

test("both rows are rendered when a day has both", () => {
  const container = readout([
    { ...WIND, kind: "wind" },
    { ...WIND, kind: "swell", label: "Swell", fromDegT: 340 },
  ]);

  expect(container.querySelectorAll("[data-readout-row]")).toHaveLength(2);
});

test("the rows read in the order the sources beneath them do", () => {
  // Wind first: it is the one a reader can feel standing on the sand, the one
  // that changes most between days, and the one whose relationship to the coast
  // decides whether the water is choppy or glassy. The dial painted
  // heaviest-first and nothing read that order; two rows in a column are read
  // in the order they are written, so the order is now a reading decision.
  const container = readout([
    { ...WIND, kind: "wind" },
    { ...WIND, kind: "swell", label: "Swell", fromDegT: 340 },
  ]);

  const kinds = [...container.querySelectorAll("[data-readout-row]")].map(
    (row) => row.getAttribute("data-readout-row"),
  );
  expect(kinds).toEqual(["wind", "swell"]);
});

test("the sources state the bearing in words and in degrees", () => {
  render(<CompassSources needles={[WIND]} />);

  expect(screen.getByText(/Wind, from the west, 281°/)).toBeDefined();
});

test("the sources state a wide swing and pass over a narrow one", () => {
  // The same rule the row's own sentence keeps, stated in the same words. It is
  // in two places for this slice only: the sources block loses its bearing
  // sentence in the next one, when the magnitudes arrive and it drops to bare
  // provenance.
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

test("the sources state both bearings, in words and in degrees", () => {
  // The design brief's own example of what the map's text equivalent says.
  render(
    <CompassSources
      needles={[
        { ...WIND, kind: "wind", fromDegT: 281, spreadDeg: 20 },
        {
          ...WIND,
          kind: "swell",
          label: "Swell",
          fromDegT: 340,
          spreadDeg: 20,
          source: "MOP line D0498",
          network: "CDIP, Scripps Institution of Oceanography",
        },
      ]}
    />,
  );

  expect(screen.getByText(/Wind, from the west, 281°/)).toBeDefined();
  expect(screen.getByText(/MOP line D0498 · CDIP/)).toBeDefined();

  // 340 reads "north" and not "north-west", and this is where the eight-point
  // rose costs something. The design brief's example name for this very
  // bearing is "swell from the northwest, 340 degrees", which is a sixteen-
  // point reading; `bearing.ts` records why the page has eight. The degrees
  // are what carry the difference, and they are stated beside the word.
  expect(screen.getByText(/Swell, from the north, 340°/)).toBeDefined();
});

test("a day with no bearings gets no sources block, not an empty list", () => {
  // Reachable through `DayCompassSources`, which hands over whatever the day
  // has. An empty `<ul>` under the map would be a list heading nothing.
  const { container } = render(<CompassSources needles={[]} />);

  expect(container.querySelector("ul")).toBeNull();
  expect(container.textContent).toBe("");
});
