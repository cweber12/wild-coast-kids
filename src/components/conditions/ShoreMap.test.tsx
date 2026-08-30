import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
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
    name: "MOP line D0498",
    lat: 32.862,
    lon: -117.261,
    distance: "about 0.3 km from this beach",
  },
  {
    kind: "wave-buoy",
    name: "Buoy Scripps Nearshore",
    lat: 32.868,
    lon: -117.267,
    distance: "about 1.6 km from this beach",
  },
  {
    kind: "tide-station",
    name: "La Jolla (Scripps Institution Wharf)",
    lat: 32.867,
    lon: -117.257,
    distance: "about 1.4 km from this beach",
  },
];

const PROPS = {
  coast: COAST,
  bounds: BOUNDS,
  segment: [
    { lat: 32.855, lon: -117.259 },
    { lat: 32.884, lon: -117.253 },
  ] as const,
  markers: MARKERS,
  description: "A map of this beach and the four places its figures come from.",
  absence: "We cannot place this beach on a map.",
  noCoast: "The coastline this site traces does not reach this beach.",
};

test("every marker names the source it stands for", () => {
  render(<ShoreMap {...PROPS} />);

  for (const marker of MARKERS) {
    expect(screen.getByText(marker.name)).toBeTruthy();
  }
});

test("a beach with no MOP line draws no MOP marker and does not silently omit it", () => {
  // 26 of the 51 committed beaches bind no MOP line. The marker cannot be
  // drawn, and a map that simply lacked it would read as a map of a beach that
  // has one somewhere off-frame.
  render(
    <ShoreMap
      {...PROPS}
      markers={MARKERS.filter((marker) => marker.kind !== "mop-line")}
    />,
  );

  expect(screen.queryByText("MOP line D0498")).toBeNull();
  expect(screen.getByText(/no swell model/i)).toBeTruthy();
});

test("a beach the traced coast does not reach keeps its markers and says so", () => {
  // 23 of the 51 are in Mission Bay or San Diego Bay, 2.6 to 5.4 km from the
  // nearest MOP line. They still get the markers, which is what ADR-0010 asks
  // the map to draw; what they do not get is a shoreline invented for them.
  render(<ShoreMap {...PROPS} coast={[]} />);

  expect(screen.getByText(PROPS.noCoast)).toBeTruthy();
  expect(screen.getByText("Buoy Scripps Nearshore")).toBeTruthy();
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

  const shapes = [...container.querySelectorAll("[data-marker]")].map((node) =>
    node.tagName.toLowerCase(),
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

  const given = MARKERS.map(
    (marker) => `${marker.name} · ${marker.distance}`,
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
