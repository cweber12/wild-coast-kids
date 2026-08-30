import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { projectionFor } from "@/lib/coastline";
import { ShoreMap, type ShoreMarker } from "./ShoreMap";

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

const MARKERS: ShoreMarker[] = [
  {
    kind: "mop-line",
    source: "MOP line D0498",
    network: "CDIP, Scripps Institution of Oceanography",
    distanceKm: "0.3",
    lat: 32.862,
    lon: -117.261,
  },
  {
    kind: "wave-buoy",
    source: "Buoy Scripps Nearshore",
    network: "NDBC",
    distanceKm: "1.6",
    lat: 32.868,
    lon: -117.267,
  },
  {
    kind: "tide-station",
    source: "La Jolla (Scripps Institution Wharf)",
    network: "NOAA Tides & Currents",
    distanceKm: null,
    lat: 32.867,
    lon: -117.257,
  },
];

const PROPS = {
  coast: COAST,
  bounds: BOUNDS,
  // The middle two of the four, which is what a beach occupying part of the
  // window looks like.
  segment: COAST.slice(1, 3),
  markers: MARKERS,
  description: "A map of this beach and the four places its figures come from.",
  absence: "We cannot place this beach on a map.",
  noCoast: "The coastline this site traces does not reach this beach.",
  coastCredit:
    "Coast traced from CDIP's MOP lines, which run a few hundred metres offshore.",
};

/** The provenance lines beside the picture, in order. */
function credits(container: HTMLElement): string[] {
  return [...container.querySelectorAll("li p")].map(
    (node) => node.textContent ?? "",
  );
}

test("every marker names the source it stands for", () => {
  const { container } = render(<ShoreMap {...PROPS} />);
  const lines = credits(container);

  for (const marker of MARKERS) {
    expect(lines.some((line) => line.startsWith(marker.source))).toBe(true);
  }
});

test("a beach with no MOP line draws no MOP marker and does not silently omit it", () => {
  // 26 of the 51 committed beaches bind no MOP line. The marker cannot be
  // drawn, and a map that simply lacked it would read as a map of a beach that
  // has one somewhere off-frame.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      markers={MARKERS.filter((marker) => marker.kind !== "mop-line")}
    />,
  );

  expect(credits(container).some((line) => line.includes("D0498"))).toBe(false);
  expect(screen.getByText(/no swell model/i)).toBeTruthy();
});

test("a beach the traced coast does not reach keeps its markers and says so", () => {
  // 23 of the 51 are in Mission Bay or San Diego Bay, 2.6 to 5.4 km from the
  // nearest MOP line. They still get the markers, which is what ADR-0010 asks
  // the map to draw; what they do not get is a shoreline invented for them.
  const { container } = render(<ShoreMap {...PROPS} coast={[]} />);

  expect(screen.getByText(PROPS.noCoast)).toBeTruthy();
  expect(
    credits(container).some((line) =>
      line.startsWith("Buoy Scripps Nearshore"),
    ),
  ).toBe(true);
});

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

test("markers differ in shape, not only in colour", () => {
  const { container } = render(<ShoreMap {...PROPS} />);

  // The drawn shape rather than the SVG element: a diamond and a triangle are
  // both <polygon>, so comparing tag names would call two different shapes the
  // same and pass for the wrong reason.
  const shapes = [...container.querySelectorAll("[data-marker]")].map((node) =>
    node.getAttribute("data-shape"),
  );

  expect(shapes.length).toBe(MARKERS.length);
  expect(new Set(shapes).size).toBe(MARKERS.length);
});

test("the map says nothing the caller did not give it", () => {
  // ADR-0009's line, drawn rather than written: no depth, no hazard, no verdict
  // about whether the water is safe. The only words are the names and distances
  // handed in. Decoration is stripped first, because a glyph tying a name to
  // its shape is not a claim about the sea.
  const { container } = render(<ShoreMap {...PROPS} />);

  for (const decoration of container.querySelectorAll('[aria-hidden="true"]')) {
    decoration.remove();
  }

  // The credit for the drawn shore, then exactly what ProvenanceLine composes
  // from the fields each marker was handed. Nothing else.
  const given =
    PROPS.coastCredit +
    MARKERS.map(
      (marker) =>
        `${marker.source} · ${marker.network}` +
        (marker.distanceKm
          ? ` · about ${marker.distanceKm} km from this beach`
          : ""),
    ).join("");

  expect((container.textContent ?? "").replace(/\s/g, "")).toBe(
    given.replace(/\s/g, ""),
  );
});

test("the whole picture has one spoken equivalent", () => {
  render(<ShoreMap {...PROPS} />);

  expect(screen.getByRole("img", { name: PROPS.description })).toBeTruthy();
});

test("the shaded side is the one the wave buoy is on", () => {
  // The test the other sea assertion cannot make. A polygon closed on the wrong
  // side draws the land as water and every existing assertion still passes:
  // there is a [data-sea] path either way, and it is the same colour. The buoy
  // is the one thing on this map known to be in the water.
  const { container } = render(<ShoreMap {...PROPS} />);

  const sea = container.querySelector("[data-sea]")!.getAttribute("d")!;
  const buoyMark = container.querySelector('[data-marker="wave-buoy"]')!;
  const buoyX = Number(buoyMark.getAttribute("points")!.split(",")[0]);

  // The polygon closes on two points pushed off-frame to the seaward side.
  const xs = [...sea.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
  const closing = xs.slice(-2);
  const coastXs = xs.slice(0, -2);

  // Off-frame to the west, the same way the buoy sits from the coast.
  expect(Math.max(...closing)).toBeLessThan(Math.min(...coastXs));
  expect(buoyX).toBeLessThan(Math.max(...coastXs));
});

test("the sea fades away from the line rather than ending at it", () => {
  // The line is CDIP's model line, 117 to 930 m offshore, not the shoreline --
  // at La Jolla the tide gauge and the pier are both over water and both fall
  // on its landward side. A hard edge would claim a boundary the data does not
  // have, so the wash is transparent where the line is and opaque out to sea.
  const { container } = render(<ShoreMap {...PROPS} />);

  const sea = container.querySelector("[data-sea]")!;
  const gradient = container.querySelector("linearGradient");

  expect(gradient).toBeTruthy();
  expect(sea.getAttribute("fill")).toBe(
    `url(#${gradient!.getAttribute("id")})`,
  );

  const stops = [...gradient!.querySelectorAll("stop")].map((stop) =>
    Number(stop.getAttribute("stop-opacity")),
  );
  expect(stops[0]).toBe(0);
  expect(stops[stops.length - 1]).toBeGreaterThan(0);
});

test("the fade is a real distance, so it shrinks as the frame widens", () => {
  // The blur stands for the offset itself, so on a 20 km frame it is a few
  // units and on a 4 km frame it is a sixth of the picture. A fade measured in
  // frame units instead would blur a wide map by kilometres.
  const near = render(<ShoreMap {...PROPS} />).container;
  const wide = render(
    <ShoreMap
      {...PROPS}
      bounds={{ south: 32.6, north: 33.0, west: -117.5, east: -117.1 }}
    />,
  ).container;

  const spread = (root: HTMLElement): number => {
    const g = root.querySelector("linearGradient")!;
    return Math.hypot(
      Number(g.getAttribute("x2")) - Number(g.getAttribute("x1")),
      Number(g.getAttribute("y2")) - Number(g.getAttribute("y1")),
    );
  };

  expect(spread(wide)).toBeLessThan(spread(near));
});

test("the drawn coast names what it was drawn from", () => {
  // The markers are attributed one by one and the shape they sit on was not,
  // which is the defect this branch's own design review raised against the day
  // chart. A line drawn from a published dataset is a figure like any other.
  const { container } = render(<ShoreMap {...PROPS} />);

  expect(screen.getByText(PROPS.coastCredit)).toBeTruthy();

  // Nothing to attribute when nothing is drawn.
  const bare = render(<ShoreMap {...PROPS} coast={[]} />).container;
  expect(bare.textContent).not.toContain(PROPS.coastCredit);
});

test("the dial is anchored on the beach, not in the middle of the frame", () => {
  // The frame is sized by the sources, so at `mission-beach` a station nine
  // kilometres away puts the frame's centre out in the county. A dial there
  // would draw needles arriving at open water rather than at the sand.
  const { container } = render(
    <ShoreMap {...PROPS} compass={<circle data-test-dial="" r={1} />} />,
  );

  const anchor = container.querySelector("svg [data-compass-anchor]")!;
  const project = projectionFor(BOUNDS, { width: 100, height: 100 });
  const middle = PROPS.segment[Math.floor(PROPS.segment.length / 2)];
  const at = project(middle.lat, middle.lon);

  expect(anchor.getAttribute("transform")).toBe(
    `translate(${at.x.toFixed(2)} ${at.y.toFixed(2)})`,
  );
  expect(anchor.querySelector("[data-test-dial]")).not.toBeNull();
});

test("a beach the coast does not reach gets its markers and no dial", () => {
  // Cole's rule, and the reason for it: a bearing is worth reading against a
  // coastline and is a bare gauge without one -- which is the anti-reference
  // the brief opens with. 23 of 51 beaches are in this state.
  //
  // The segment here is the beach's own two ends and NOT null, because that is
  // what `shore.ts` draws on 22 of those 23: with no coast to mark a run of, a
  // chord is the only thing that says where the beach is. Written with a null
  // segment this test passes with the coast check deleted, which is what
  // mutating it revealed -- it was asserting `mission-bay-vacation-isle`, the
  // one beach of the 23 whose ends coincide, and nothing about the other 22.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      coast={[]}
      segment={[
        { lat: 32.77, lon: -117.24 },
        { lat: 32.78, lon: -117.235 },
      ]}
      compass={<circle data-test-dial="" r={1} />}
      compassSources={<p>Wind, from the west, 281°</p>}
    />,
  );

  expect(container.querySelector("[data-compass-anchor]")).toBeNull();
  expect(container.querySelector("[data-test-dial]")).toBeNull();
  expect(screen.queryByText("Wind, from the west, 281°")).toBeNull();
  // The markers are the part that works without a coastline, and they stay.
  expect(screen.getByText(/Buoy Scripps Nearshore/)).toBeTruthy();
});

test("a beach whose two ends are one point gets no dial either", () => {
  // `mission-bay-vacation-isle`, whose segment upper equals its lower, so
  // there is neither a coast nor a chord to stand a dial on.
  const { container } = render(
    <ShoreMap
      {...PROPS}
      coast={[]}
      segment={null}
      compass={<circle data-test-dial="" r={1} />}
    />,
  );

  expect(container.querySelector("[data-compass-anchor]")).toBeNull();
});

test("the needles' sources are listed beside the picture with the markers'", () => {
  render(
    <ShoreMap
      {...PROPS}
      compass={<circle data-test-dial="" r={1} />}
      compassSources={<p>Wind, from the west, 281°</p>}
    />,
  );

  expect(screen.getByText("Wind, from the west, 281°")).toBeTruthy();
});
