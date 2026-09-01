import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { projectionFor } from "@/lib/coastline";
import { ShoreMap } from "./ShoreMap";

/** A short run of coast running due north, west-facing like the real one. */
const COAST = [
  { lat: 32.85, lon: -117.26 },
  { lat: 32.86, lon: -117.26 },
  { lat: 32.87, lon: -117.259 },
  { lat: 32.88, lon: -117.258 },
];

const BOUNDS = {
  south: 32.845,
  north: 32.885,
  west: -117.275,
  east: -117.245,
};

const PROPS = {
  coast: COAST,
  bounds: BOUNDS,
  // The middle two of the four, which is what a beach occupying part of the
  // window looks like.
  segment: COAST.slice(1, 3),
  description: "A map of this beach and its own stretch of coast.",
  absence: "We cannot place this beach on a map.",
  noCoast: "The coastline this site traces does not reach this beach.",
  coastCredit:
    "Coast traced from CDIP's MOP lines, which are computed a few hundred metres offshore.",
};

test("no box to draw is a sentence, never an empty frame", () => {
  // An empty frame on a page about the sea reads as open water.
  render(<ShoreMap {...PROPS} bounds={null} />);

  expect(screen.getByText(PROPS.absence)).toBeTruthy();
  expect(document.querySelector("svg")).toBeNull();
});

test("the sea is shaded only where a coast says where it is", () => {
  const { container: drawn } = render(<ShoreMap {...PROPS} />);
  expect(drawn.querySelector("[data-sea]")).toBeTruthy();

  const { container: bare } = render(<ShoreMap {...PROPS} coast={[]} />);
  expect(bare.querySelector("[data-sea]")).toBeNull();
});

test("this beach's own stretch of shore is drawn apart from the rest", () => {
  const { container } = render(<ShoreMap {...PROPS} />);

  const segment = container.querySelector("[data-segment]");
  const coast = container.querySelector("[data-coast]");

  expect(segment).toBeTruthy();
  expect(coast).toBeTruthy();
  // Weight, not only colour: a reader who cannot separate the two hues still
  // sees which part of the coast is the beach they chose.
  expect(Number(segment!.getAttribute("stroke-width"))).toBeGreaterThan(
    Number(coast!.getAttribute("stroke-width")),
  );
});

test("the map plots no stations, buoys or model lines", () => {
  // It used to plot all four at their real distances, which is ADR-0010 drawn
  // rather than written. The page still names every source in words under the
  // group it belongs to, which is what that decision actually requires; the
  // picture is about where this beach is and which way the water lies.
  const { container } = render(<ShoreMap {...PROPS} />);

  expect(container.querySelectorAll("[data-marker]")).toHaveLength(0);
  expect(container.querySelectorAll("circle, rect, polygon")).toHaveLength(0);
});

test("the map says nothing the caller did not give it", () => {
  // ADR-0009's line, drawn rather than written: no depth, no hazard, no verdict
  // about whether the water is safe. The credit for the drawn shore is the only
  // text, because it is the only thing the caller handed in.
  const { container } = render(<ShoreMap {...PROPS} />);

  expect((container.textContent ?? "").replace(/\s/g, "")).toBe(
    PROPS.coastCredit.replace(/\s/g, ""),
  );
});

test("the whole picture has one spoken equivalent", () => {
  render(<ShoreMap {...PROPS} />);

  expect(screen.getByRole("img", { name: PROPS.description })).toBeTruthy();
});

test("the shaded side is the seaward one", () => {
  // The test the other sea assertion cannot make. A polygon closed on the wrong
  // side draws the land as water and every other assertion here still passes:
  // there is a [data-sea] path either way, and it is the same colour.
  //
  // This fixture's coast runs south to north down a west-facing shore, so the
  // water is to the west — smaller longitude, and therefore smaller x once
  // projected. It used to be checked against the plotted wave buoy, which was
  // the one thing on the map known to be in the water; the map plots no buoy
  // now, so the fixture's own geometry carries it.
  const { container } = render(<ShoreMap {...PROPS} />);

  const sea = container.querySelector("[data-sea]")!.getAttribute("d")!;
  const xs = [...sea.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));

  // The wash runs off the western edge of the picture and stops short of the
  // eastern one. Where exactly its corners fall is `wash.ts`'s business and is
  // checked there, against every committed beach rather than one fixture.
  expect(Math.min(...xs)).toBeLessThan(0);
  expect(Math.max(...xs)).toBeLessThan(100);
  expect(sea.endsWith("Z")).toBe(true);

  // And the drawn coast is well inside the frame, so "runs off the west edge"
  // is a claim about the wash rather than about where the window happens to be.
  const project = projectionFor(BOUNDS, { width: 100, height: 100 });
  const coastXs = COAST.map((point) => project(point.lat, point.lon).x);
  expect(Math.min(...coastXs)).toBeGreaterThan(0);
});

test("the water is one solid wash, not a gradient", () => {
  // It used to fade from transparent at the line out to full strength 644 m
  // seaward, because the line is CDIP's model line rather than a shoreline and
  // a hard edge would claim a boundary the data does not have. The reason for
  // that was the two instruments it drew onto the beach, and the map plots no
  // instruments now. What the fade left behind was a straight-edged wash across
  // a coastline that is not straight.
  const { container } = render(<ShoreMap {...PROPS} />);

  const sea = container.querySelector("[data-sea]")!;

  expect(container.querySelector("linearGradient")).toBeNull();
  expect(sea.getAttribute("fill")).toBeNull();
  expect(sea.getAttribute("class")).toContain("fill-ocean");
  expect(Number(sea.getAttribute("fill-opacity"))).toBeGreaterThan(0);
});

test("the drawn coast names what it was drawn from", () => {
  // A line drawn from a published dataset is a figure like any other, and this
  // matters more than for most: nothing about looking at a line down a coast
  // says it is a model line computed offshore rather than the shore itself.
  const { container } = render(<ShoreMap {...PROPS} />);

  expect(screen.getByText(PROPS.coastCredit)).toBeTruthy();

  // Nothing to attribute when nothing is drawn.
  const bare = render(<ShoreMap {...PROPS} coast={[]} />).container;
  expect(bare.textContent).not.toContain(PROPS.coastCredit);
  expect(container).toBeTruthy();
});

test("the readout stands under the picture and covers none of it", () => {
  // ADR-0038, reversing ADR-0034's placement. The block used to be an overlay
  // in whichever corner the drawn geometry left free, which stopped having an
  // answer: a bay shore surrounds the frame, so two beaches had no clear corner
  // at any box size.
  //
  // Never inside the SVG either -- that was ADR-0034's own correction and it
  // still holds. The dial was once translated into the map's drawing space,
  // where it covered the one thing the map exists to show and its type was
  // measured in hundredths of a frame.
  const { container } = render(
    <ShoreMap {...PROPS} readout={<p data-test-readout="">Wind</p>} />,
  );

  expect(container.querySelector("svg [data-test-readout]")).toBeNull();

  const block = container.querySelector("[data-readout]")!;
  expect(block.querySelector("[data-test-readout]")).not.toBeNull();

  // Under the picture, not over it: nothing positions it against the frame, so
  // there is no corner to choose and no footprint to keep clear.
  expect(container.querySelector("[data-readout-corner]")).toBeNull();
  expect((block as HTMLElement).style.position).toBe("");
});

test("the readout follows the map in the document, before its sources", () => {
  // The order a reader meets them, and the order a screen reader announces:
  // picture, then the figures read off it, then where those figures came from.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      readout={<p data-test-readout="">Wind</p>}
      readoutSources={<p data-test-sources="">Biggest wind in daylight</p>}
    />,
  );

  const nodes = [
    ...container.querySelectorAll("svg, [data-readout], [data-test-sources]"),
  ];
  expect(nodes.map((node) => node.tagName.toLowerCase() === "svg")).toEqual([
    true,
    false,
    false,
  ]);
  expect(nodes[1].hasAttribute("data-readout")).toBe(true);
  expect(nodes[2].hasAttribute("data-test-sources")).toBe(true);
});

test("no readout means no empty block under the map", () => {
  // The caller withholds both halves on a day no feed gave a bearing for, and
  // an empty div with a margin would leave a gap the reader cannot account for.
  const { container } = render(<ShoreMap {...PROPS} />);
  expect(container.querySelector("[data-readout]")).toBeNull();
});

test("a beach the coast does not reach still gets its readout", () => {
  // 23 of 51 beaches are in this state, and the dial was withheld on all of
  // them -- so nearly half the inventory printed no wind figure anywhere on the
  // picture, for a rule about a needle drawn over an empty frame. A labelled
  // block with units and a publisher under it is not that thing. ADR-0034.
  //
  // The segment here is the beach's own two ends and NOT null, because that is
  // what `shore.ts` draws on 22 of those 23: with no coast to mark a run of, a
  // chord is the only thing that says where the beach is.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      coast={[]}
      segment={[
        { lat: 32.77, lon: -117.24 },
        { lat: 32.78, lon: -117.235 },
      ]}
      readout={<p data-test-readout="">Wind</p>}
      readoutSources={<p>Biggest wind in daylight</p>}
    />,
  );

  expect(container.querySelector("[data-test-readout]")).not.toBeNull();
  expect(screen.getByText("Biggest wind in daylight")).toBeTruthy();
  // The beach is still placed, which is the one question the picture has to
  // answer when there is no shoreline to draw, and the readout does not cover
  // the chord that answers it.
  expect(container.querySelector("[data-segment]")).not.toBeNull();
  // And the map still says the traced coast does not reach here, which the
  // readout neither replaces nor contradicts.
  expect(screen.getByText(PROPS.noCoast)).toBeTruthy();
});

test("a beach with nothing drawn at all still gets its readout", () => {
  // `mission-bay-vacation-isle`, whose segment upper equals its lower, so there
  // is neither a coast nor a chord on the picture. Every corner is clear, so
  // the first is taken -- there is nothing for the block to be measured against
  // and nothing for it to cover.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      coast={[]}
      segment={null}
      readout={<p data-test-readout="">Wind</p>}
    />,
  );

  expect(container.querySelector("[data-test-readout]")).not.toBeNull();
});

test("a day with no bearings gets no readout and no sources", () => {
  // The withholding that remains, and it is the caller's rather than the
  // coast's: `DayCompass` renders nothing on a day no feed gave a bearing for,
  // and the sources go with it rather than naming a row nobody can see.
  const { container } = render(
    <ShoreMap {...PROPS} readout={null} readoutSources={<p>Orphaned</p>} />,
  );

  expect(container.querySelector("[data-readout-corner]")).toBeNull();
  expect(screen.queryByText("Orphaned")).toBeNull();
});

test("the readout's sources are listed beneath the picture", () => {
  render(
    <ShoreMap
      {...PROPS}
      readout={<p data-test-readout="">Wind</p>}
      readoutSources={<p>Wind, from the west, 281°</p>}
    />,
  );

  expect(screen.getByText("Wind, from the west, 281°")).toBeTruthy();
});

test("the map's drawing space holds the picture and nothing else", () => {
  // What the overlay's footprint used to depend on, kept for a different
  // reason. The readout is no longer measured against this box, but the box is
  // still square by construction and the projection still letterboxes into it,
  // so prose or a block finding its way inside the `<svg>` would distort the
  // coast rather than sit beside it.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      readout={<p data-test-readout="">Wind</p>}
      readoutSources={<p data-test-sources="">Biggest wind in daylight</p>}
    />,
  );

  const svg = container.querySelector("svg")!;
  expect(svg.querySelector("[data-test-readout]")).toBeNull();
  expect(svg.querySelector("[data-test-sources]")).toBeNull();
  expect(svg.textContent).not.toContain(PROPS.coastCredit);
});
