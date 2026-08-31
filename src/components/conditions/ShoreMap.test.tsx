import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { projectionFor } from "@/lib/coastline";
import { READOUT_BOX } from "./corner";
import { ShoreMap } from "./ShoreMap";

/** A short run of coast running due north, west-facing like the real one. */
const COAST = [
  { id: "D0500", lat: 32.85, lon: -117.26 },
  { id: "D0501", lat: 32.86, lon: -117.26 },
  { id: "D0502", lat: 32.87, lon: -117.259 },
  { id: "D0503", lat: 32.88, lon: -117.258 },
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

  // The polygon closes on two points pushed off-frame to the seaward side.
  const closing = xs.slice(-2);
  const coastXs = xs.slice(0, -2);

  expect(Math.max(...closing)).toBeLessThan(Math.min(...coastXs));

  // And a point known to be out at sea falls west of every drawn coast point,
  // which is the direction the closing corners went.
  const project = projectionFor(BOUNDS, { width: 100, height: 100 });
  const offshore = project(32.865, -117.272);
  expect(offshore.x).toBeLessThan(Math.min(...coastXs));
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

test("the readout lies over the picture, not inside its drawing space", () => {
  // ADR-0034. The dial used to be translated onto the beach's own stretch of
  // coast, where it covered the one thing the map exists to show. This is an
  // HTML overlay positioned against the map's box, so it is in the
  // accessibility tree and its type is not measured in hundredths of a frame.
  const { container } = render(
    <ShoreMap {...PROPS} readout={<p data-test-readout="">Wind</p>} />,
  );

  expect(container.querySelector("svg [data-test-readout]")).toBeNull();
  const overlay = container.querySelector("[data-readout-corner]")!;
  expect(overlay.querySelector("[data-test-readout]")).not.toBeNull();
});

test("the readout stands in a corner the coastline leaves free", () => {
  // The corner is measured rather than fixed, and `corner.test.ts` holds that
  // for the whole inventory. This is the wiring: whichever corner is chosen,
  // the overlay is anchored to that corner's two sides and reserves the box
  // `corner.ts` kept clear.
  const { container } = render(
    <ShoreMap {...PROPS} readout={<p data-test-readout="">Wind</p>} />,
  );

  const overlay = container.querySelector(
    "[data-readout-corner]",
  )! as HTMLElement;
  const corner = overlay.getAttribute("data-readout-corner")!;

  expect(["top-left", "top-right", "bottom-left", "bottom-right"]).toContain(
    corner,
  );
  expect(overlay.style.width).toBe(`${READOUT_BOX.width}%`);
  expect(overlay.style.maxHeight).toBe(`${READOUT_BOX.height}%`);

  // This window's coast runs up the middle of the frame, so the top-left is
  // free and the block stays where the reader's eye starts.
  expect(corner).toBe("top-left");
  expect(overlay.style.top).toBe("0px");
  expect(overlay.style.left).toBe("0px");
});

test("the readout moves to the side the drawing leaves open", () => {
  // A coast running through the top-left, which is the shape 21 of 47 beaches
  // have and the reason the corner is not fixed.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      coast={[
        { id: "D0500", lat: 32.884, lon: -117.274 },
        { id: "D0501", lat: 32.87, lon: -117.26 },
        { id: "D0502", lat: 32.85, lon: -117.25 },
      ]}
      segment={[
        { lat: 32.884, lon: -117.274 },
        { lat: 32.87, lon: -117.26 },
      ]}
      readout={<p data-test-readout="">Wind</p>}
    />,
  );

  const overlay = container.querySelector("[data-readout-corner]")!;
  expect(overlay.getAttribute("data-readout-corner")).not.toBe("top-left");
});

test("a beach the coast does not reach gets no readout", () => {
  // Cole's rule, and the reason for it: a bearing is worth reading against a
  // coastline and is a bare gauge without one -- which is the anti-reference
  // the brief opens with. 23 of 51 beaches are in this state.
  //
  // The segment here is the beach's own two ends and NOT null, because that is
  // what `shore.ts` draws on 22 of those 23: with no coast to mark a run of, a
  // chord is the only thing that says where the beach is. Written with a null
  // segment this test passes with the coast check deleted, which is what
  // mutating it revealed.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      coast={[]}
      segment={[
        { lat: 32.77, lon: -117.24 },
        { lat: 32.78, lon: -117.235 },
      ]}
      readout={<p data-test-readout="">Wind</p>}
      readoutSources={<p>Wind, from the west, 281°</p>}
    />,
  );

  expect(container.querySelector("[data-readout-corner]")).toBeNull();
  expect(container.querySelector("[data-test-readout]")).toBeNull();
  expect(screen.queryByText("Wind, from the west, 281°")).toBeNull();
  // The beach is still placed, which is the one question the picture has to
  // answer when there is no shoreline to draw.
  expect(container.querySelector("[data-segment]")).not.toBeNull();
});

test("a beach whose two ends are one point gets no readout either", () => {
  // `mission-bay-vacation-isle`, whose segment upper equals its lower, so
  // there is neither a coast nor a chord on the picture.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      coast={[]}
      segment={null}
      readout={<p data-test-readout="">Wind</p>}
    />,
  );

  expect(container.querySelector("[data-readout-corner]")).toBeNull();
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

test("the overlay is measured against the picture alone", () => {
  // The wrapper the readout is positioned against holds the `<svg>` and nothing
  // else. With the coast credit inside it the box would not be square, and the
  // readout's footprint is stated in the map's own drawing units precisely
  // because the two agree.
  const { container } = render(
    <ShoreMap {...PROPS} readout={<p data-test-readout="">Wind</p>} />,
  );

  const positioned = container.querySelector(
    "[data-readout-corner]",
  )!.parentElement!;

  expect(positioned.querySelector("svg")).not.toBeNull();
  expect(positioned.textContent).not.toContain(PROPS.coastCredit);
});
