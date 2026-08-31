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
  swing: { fromDegT: 281, spreadDeg: 40 },
  figure: "11.5 mph",
  provenance: {
    label: "Biggest wind in daylight",
    source: "this beach's own grid cell",
    network: "National Weather Service, San Diego",
    note: "a forecast, not a reading taken at the beach",
  },
};

function readout(needles: readonly CompassNeedle[]) {
  const { container } = render(<Compass needles={needles} caption="3 PM" />);
  return container;
}

const num = (element: Element, name: string) =>
  Number(element.getAttribute(name));

test("the arrow's tail stands in the direction the wind comes from", () => {
  // Due east, on a glyph with north up: the tail is to the right of the middle
  // and level with it. A sign flip anywhere in the bearing-to-plot conversion
  // moves it to one of the other three sides, which is what this pins.
  const container = readout([{ ...WIND, fromDegT: 90, swing: null }]);

  const arrow = container.querySelector('[data-arrow="wind"]')!;
  expect(num(arrow, "x1")).toBeCloseTo(8, 4);
  expect(num(arrow, "y1")).toBeCloseTo(0, 4);
});

test("north is up, not down", () => {
  // The other half of the same conversion, and the one a y-down drawing space
  // gets wrong: plot y grows southward, so due north is a negative y.
  const container = readout([{ ...WIND, fromDegT: 0, swing: null }]);

  const arrow = container.querySelector('[data-arrow="wind"]')!;
  expect(num(arrow, "x1")).toBeCloseTo(0, 4);
  expect(num(arrow, "y1")).toBeCloseTo(-8, 4);
});

test("the arrow points the way the weather travels", () => {
  // Which end carries the head is the whole reading. Every feed this page reads
  // publishes the direction weather comes *from*, so an easterly wind is drawn
  // travelling west: tail in the east, head in the west.
  const container = readout([{ ...WIND, fromDegT: 90, swing: null }]);

  const arrow = container.querySelector('[data-arrow="wind"]')!;
  expect(num(arrow, "x1")).toBeGreaterThan(0);
  expect(num(arrow, "x2")).toBeLessThan(0);

  // And the head is at the far side rather than in the middle, so the arrow
  // reads as a direction on its own without a beach under it to arrive at.
  const head = container.querySelector('[data-arrow-head="wind"]')!;
  expect(head.getAttribute("points")).toContain("-8.00,0.00");
});

test("the wedge widens with the day's spread", () => {
  const narrow = readout([
    { ...WIND, fromDegT: 270, swing: { fromDegT: 270, spreadDeg: 20 } },
  ]);
  const wide = readout([
    { ...WIND, fromDegT: 270, swing: { fromDegT: 270, spreadDeg: 120 } },
  ]);

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
  const container = readout([
    { ...WIND, fromDegT: 270, swing: { fromDegT: 270, spreadDeg: 60 } },
  ]);

  const wedge = container.querySelector('[data-wedge="wind"]')!;
  expect(wedge.getAttribute("d")).toMatch(/^M0 0 L/);
  expect(wedge.getAttribute("d")).toMatch(/Z$/);
  expect(container.querySelector("circle")).toBeNull();
});

test("a day that never shifted gets no wedge rather than a zero-width one", () => {
  const container = readout([
    { ...WIND, swing: { fromDegT: 281, spreadDeg: 0 } },
  ]);

  expect(container.querySelector('[data-wedge="wind"]')).toBeNull();
  expect(container.querySelector('[data-arrow="wind"]')).not.toBeNull();
});

test("a day with no daylight bearing at all draws the arrow and no wedge", () => {
  // Null rather than a zero-width swing, and the same picture either way: there
  // is nothing to say about where the day sat, and the hour still has an arrow.
  const container = readout([{ ...WIND, swing: null }]);

  expect(container.querySelector('[data-wedge="wind"]')).toBeNull();
  expect(container.querySelector('[data-arrow="wind"]')).not.toBeNull();
});

test("the wedge is drawn from the day's bearing, not from the arrow's", () => {
  // **The regression this caught in its own pull request.** Drawn from the
  // arrow, a wedge is a band of the day's width centred on whatever hour was
  // last clicked -- so it moves on every click, which is exactly the needle
  // ADR-0027 refuses. The two bearings are far apart here, and the wedge sits
  // on the day's: due north, so both its ends are above the middle.
  const container = readout([
    { ...WIND, fromDegT: 180, swing: { fromDegT: 0, spreadDeg: 40 } },
  ]);

  const d = container.querySelector('[data-wedge="wind"]')!.getAttribute("d")!;
  const numbers = d.match(/-?\d+\.?\d*/g)!.map(Number);
  expect(numbers[3]).toBeLessThan(0);
  expect(numbers[numbers.length - 1]).toBeLessThan(0);

  // And the arrow is still the hour's: due south, tail below the middle.
  expect(
    Number(container.querySelector('[data-arrow="wind"]')!.getAttribute("y1")),
  ).toBeGreaterThan(0);
});

test("a spread wider than a half circle takes the long way round", () => {
  // The SVG flag that says which of the two arcs between two points is meant.
  // Without it a 200-degree swing draws as the 160-degree one it is not.
  const container = readout([
    { ...WIND, fromDegT: 214, swing: { fromDegT: 214, spreadDeg: 200 } },
  ]);

  const d = container.querySelector('[data-wedge="wind"]')!.getAttribute("d")!;
  expect(d).toMatch(/A [\d.]+ [\d.]+ 0 1 1 /);
});

test("the caption names the hour, above the rows it is for", () => {
  // Always present, so the block never changes its numbers with nothing visible
  // saying what they now mean -- and above the rows, because a figure is read
  // against what it is for. It appears on no click, so the reserved box matches
  // the ink in both states and the rows never move under a reader's eye.
  const container = readout([WIND, { ...WIND, kind: "swell", label: "Swell" }]);

  const caption = container.querySelector("[data-readout-caption]")!;
  expect(caption.textContent).toBe("3 PM");
  expect(
    caption.compareDocumentPosition(
      container.querySelector("[data-readout-row='wind']")!,
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test("the block is not a live region", () => {
  // The chart's own readout is, and it announces the same change. Two live
  // regions firing on one arrow-press means a keyboard reader hears it twice,
  // which is the condition ADR-0035 accepts ADR-0027's fourth clause under.
  const container = readout([WIND]);

  expect(container.querySelector("[aria-live]")).toBeNull();
});

test("nothing is rendered when there is no needle to render", () => {
  const container = readout([]);

  expect(container.querySelector("[data-readout]")).toBeNull();
});

test("the row states its word, the direction, the degrees and how much", () => {
  const container = readout([WIND]);

  expect(
    container.querySelector('[data-readout-label="wind"]')!.textContent,
  ).toBe("Wind");
  expect(
    container.querySelector('[data-readout-bearing="wind"]')!.textContent,
  ).toBe("west 281°");
  expect(
    container.querySelector('[data-readout-figure="wind"]')!.textContent,
  ).toBe("11.5 mph");
});

test("the figure is printed exactly as the caller worded it", () => {
  // The rounding is a decision made upstream and has to survive verbatim: the
  // swell's comes from `swellFigure`, so the week grid and this readout cannot
  // print different numbers for one day, and the wind's carries the precision
  // rule #191 is about.
  const container = readout([
    { ...WIND, kind: "swell", label: "Swell", figure: "3.4 ft · 14 s" },
  ]);

  expect(
    container.querySelector('[data-readout-figure="swell"]')!.textContent,
  ).toBe("3.4 ft · 14 s");
});

test("a source with a direction and no magnitude still says the direction", () => {
  // A ragged forecast rather than a fault, so the row says what it knows.
  const container = readout([{ ...WIND, figure: null }]);

  expect(container.querySelector('[data-readout-figure="wind"]')).toBeNull();
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
  render(<Compass needles={[WIND]} caption="3 PM" />);

  expect(
    screen.getByRole("img", {
      name: "Wind at 3 PM, from the west, 281°, 11.5 mph",
    }),
  );
});

test("a wide swing is spoken and a narrow one is not", () => {
  // One compass point is exactly the width the words have, so a swing wider
  // than one is a swing the word cannot describe and a reader is owed the
  // number. The wedge shows it either way; the sentence states it only when
  // the word alone would mislead.
  expect(
    needleSentence(
      { ...WIND, swing: { fromDegT: 281, spreadDeg: 120 } },
      "3 PM",
    ),
  ).toBe(
    "Wind at 3 PM, from the west, 281°, swinging through 120° in daylight, " +
      "11.5 mph",
  );
  expect(
    needleSentence(
      { ...WIND, swing: { fromDegT: 281, spreadDeg: 30 } },
      "3 PM",
    ),
  ).toBe("Wind at 3 PM, from the west, 281°, 11.5 mph");
});

test("a row with no magnitude is spoken without one", () => {
  expect(
    needleSentence(
      { ...WIND, swing: { fromDegT: 281, spreadDeg: 30 }, figure: null },
      "3 PM",
    ),
  ).toBe("Wind at 3 PM, from the west, 281°");
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
    { ...WIND, kind: "wind", swing: null },
    { ...WIND, kind: "swell", label: "Swell", fromDegT: 340, swing: null },
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

test("the sources say where the figures came from, not what they are", () => {
  // The readout is HTML and is in the accessibility tree, so it is its own
  // spoken equivalent. This block used to restate both bearings underneath it,
  // which was a second statement of a figure the page already made.
  const { container } = render(<CompassSources needles={[WIND]} />);

  expect(container.textContent).not.toContain("from the west");
  expect(container.textContent).not.toContain("281°");
  expect(screen.getByText(/this beach's own grid cell/)).toBeDefined();
});

test("each line says which of the two rows it attributes", () => {
  // Two provenance lines under one picture have to say which is which, now
  // that neither restates its own bearing.
  render(
    <CompassSources
      needles={[
        WIND,
        {
          ...WIND,
          kind: "swell",
          label: "Swell",
          provenance: {
            ...WIND.provenance,
            label: "Biggest swell in daylight",
          },
        },
      ]}
    />,
  );

  expect(screen.getByText("Biggest wind in daylight")).toBeDefined();
  expect(screen.getByText("Biggest swell in daylight")).toBeDefined();
});

test("the superlative is stated rather than left to be inferred", () => {
  // `WaveWeek`'s rule and its reason: a single figure under the bare word
  // invites a reader to take it for the day's typical swell, which is the one
  // thing it is not. The readout has no room for the word, so the attribution
  // line beneath the picture carries it.
  render(<CompassSources needles={[WIND]} />);

  expect(screen.getByText("Biggest wind in daylight")).toBeDefined();
});

test("each needle carries its own publisher", () => {
  render(<CompassSources needles={[WIND]} />);

  expect(
    screen.getByText(
      /this beach's own grid cell · National Weather Service, San Diego — a forecast, not a reading taken at the beach/,
    ),
  ).toBeDefined();
});

test("two publishers are attributed separately under one instrument", () => {
  // ADR-0032: one instrument carrying two publishers is a deliberate break of
  // `StatGroup`'s one-group-one-source contract, answered by a line per row
  // rather than by splitting the instrument.
  render(
    <CompassSources
      needles={[
        WIND,
        {
          ...WIND,
          kind: "swell",
          label: "Swell",
          provenance: {
            label: "Biggest swell in daylight",
            source: "MOP line D0498",
            network: "CDIP, Scripps Institution of Oceanography",
            distanceKm: "0.7",
          },
        },
      ]}
    />,
  );

  expect(
    screen.getByText(/this beach's own grid cell · National Weather Service/),
  ).toBeDefined();
  expect(
    screen.getByText(
      /MOP line D0498 · CDIP, Scripps Institution of Oceanography · about 0.7 km from this beach/,
    ),
  ).toBeDefined();
});

test("a day with no bearings gets no sources block, not an empty list", () => {
  // Reachable through `DayCompassSources`, which hands over whatever the day
  // has. An empty `<ul>` under the map would be a list heading nothing.
  const { container } = render(<CompassSources needles={[]} />);

  expect(container.querySelector("ul")).toBeNull();
  expect(container.textContent).toBe("");
});
