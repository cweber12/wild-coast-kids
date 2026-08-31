import { expect, test } from "vitest";
import {
  boundsAround,
  coastline,
  nearestOn,
  projectionFor,
  runAround,
  sideOf,
  squareToward,
  windowAround,
  withoutRepeats,
} from "./coastline";

test("the committed 1,210 MOP lines reduce to 1,087 distinct points", () => {
  // Pinned against the real file rather than a fixture. 123 of the lines repeat
  // their neighbour's coordinates exactly, and the count is here so a future
  // data change fails loudly instead of silently changing the shape of the
  // coast every consumer draws.
  expect(coastline()).toHaveLength(1087);
});

test("a repeated coordinate is dropped rather than kept as a zero-length step", () => {
  // The shape of the real defect, in miniature: D0002 sits exactly where D0001
  // does. Keeping it would leave a segment with no length and therefore no
  // direction, which is what corrupts a tangent or a side test downstream.
  const kept = withoutRepeats([
    { id: "D0001", lat: 32.5, lon: -117.1 },
    { id: "D0002", lat: 32.5, lon: -117.1 },
    { id: "D0003", lat: 32.6, lon: -117.1 },
  ]);

  expect(kept.map((point) => point.id)).toEqual(["D0001", "D0003"]);
});

test("the window keeps one point past each end so the coast reaches the frame", () => {
  // Clipping to exactly what falls inside would draw a coastline that stops
  // short of the edge with white on both sides of it, which reads as the land
  // ending rather than as the map ending.
  const points = [
    { id: "D0001", lat: 32.0, lon: -117.0 },
    { id: "D0002", lat: 32.1, lon: -117.0 },
    { id: "D0003", lat: 32.2, lon: -117.0 },
    { id: "D0004", lat: 32.3, lon: -117.0 },
    { id: "D0005", lat: 32.4, lon: -117.0 },
    { id: "D0006", lat: 32.5, lon: -117.0 },
  ];

  const kept = windowAround(points, {
    south: 32.15,
    north: 32.35,
    west: -117.1,
    east: -116.9,
  });

  expect(kept.map((point) => point.id)).toEqual([
    "D0002",
    "D0003",
    "D0004",
    "D0005",
  ]);
});

test("a run that leaves the box and comes back stays one stroke", () => {
  // The coast bends: 39 of the 1,209 real steps run north to south. A window
  // that kept only what falls inside would cut a bend into two strokes with a
  // gap where the land is.
  const points = [
    { id: "D0001", lat: 32.2, lon: -117.0 },
    { id: "D0002", lat: 32.2, lon: -116.5 },
    { id: "D0003", lat: 32.2, lon: -117.0 },
  ];

  const kept = windowAround(points, {
    south: 32.1,
    north: 32.3,
    west: -117.1,
    east: -116.9,
  });

  expect(kept.map((point) => point.id)).toEqual(["D0001", "D0002", "D0003"]);
});

test("a box the coast does not reach is empty, which a caller must say", () => {
  // Not the same as a coast that is not there. The caller renders an absence,
  // never a blank frame that reads as open water.
  const kept = windowAround([{ id: "D0001", lat: 32.2, lon: -117.0 }], {
    south: 33.0,
    north: 33.1,
    west: -117.1,
    east: -116.9,
  });

  expect(kept).toEqual([]);
});

test("one mapping places the coast and every marker, centred and undistorted", () => {
  // A marker plotted by different arithmetic from the coast beside it is a
  // marker in the wrong place, so the projection is a value the map hands to
  // everything it draws rather than a transform applied to the polyline.
  const project = projectionFor(
    { south: 32.0, north: 32.2, west: -117.2, east: -117.0 },
    { width: 100, height: 100 },
  );

  const centre = project(32.1, -117.1);
  expect(centre.x).toBeCloseTo(50, 6);
  expect(centre.y).toBeCloseTo(50, 6);

  // North is up: latitude falls as y grows.
  expect(project(32.2, -117.1).y).toBeCloseTo(0, 6);
  expect(project(32.0, -117.1).y).toBeCloseTo(100, 6);

  // A degree of longitude covers cos(32.1 deg) = 0.8471 of a degree of latitude
  // on the ground here, so a square box of degrees is letterboxed east to west
  // rather than stretched to fill. Stretching it would bend the coast.
  expect(project(32.1, -117.2).x).toBeCloseTo(7.6439, 3);
  expect(project(32.1, -117.0).x).toBeCloseTo(92.3561, 3);
});

test("the box covers every source with an even margin on the ground", () => {
  const bounds = boundsAround(
    [
      { lat: 32.0, lon: -117.2 },
      { lat: 32.2, lon: -117.0 },
    ],
    0.1,
  );

  // A tenth of the larger span, added on each side.
  expect(bounds).not.toBeNull();
  expect(bounds!.south).toBeCloseTo(31.98, 10);
  expect(bounds!.north).toBeCloseTo(32.22, 10);

  // The same margin on the *ground* east to west, which takes more degrees of
  // longitude than of latitude here. A margin measured in raw degrees would be
  // 15 percent tighter east-west than north-south at this latitude.
  const cos = Math.cos((32.1 * Math.PI) / 180);
  expect(bounds!.west).toBeCloseTo(-117.2 - 0.02 / cos, 10);
  expect(bounds!.east).toBeCloseTo(-117.0 + 0.02 / cos, 10);
});

test("a box needs two distinct positions, and says so rather than collapsing", () => {
  // `mission-bay-vacation-isle` carries a segment whose upper equals its lower,
  // so this is a real row rather than a hypothetical. A zero-span box divides by
  // zero in the projection and draws a coast at infinite magnification.
  const onePlace = { lat: 32.7737, lon: -117.2402 };

  expect(boundsAround([onePlace, onePlace], 0.1)).toBeNull();
  expect(boundsAround([], 0.1)).toBeNull();
});

test("west of a coast walked south to north is its seaward side", () => {
  // The whole county coast faces west, and the file runs south to north, so
  // "left of the walk" and "out to sea" are the same side. The map shades by
  // this, so it is stated once here and checked against the committed buoys by
  // the `sea-side` gate row rather than assumed.
  const northward = [
    { id: "D0001", lat: 32.0, lon: -117.0 },
    { id: "D0002", lat: 32.1, lon: -117.0 },
  ];

  expect(sideOf(northward, { lat: 32.05, lon: -117.1 })).toBe("left");
  expect(sideOf(northward, { lat: 32.05, lon: -116.9 })).toBe("right");
});

test("a run with no segment in it has no sides", () => {
  // What a bay beach's window is: the traced coast does not reach it, so there
  // is nothing to be on a side of. The map says so rather than shading a guess.
  expect(sideOf([], { lat: 32.0, lon: -117.0 })).toBeNull();
  expect(
    sideOf([{ id: "D0001", lat: 32.0, lon: -117.0 }], {
      lat: 32.0,
      lon: -117.1,
    }),
  ).toBeNull();
});

test("a zero-length segment is stepped over rather than divided by", () => {
  // withoutRepeats takes these out of the county coast, but sideOf is handed
  // runs by callers and a repeat here would divide by zero and answer with a
  // NaN that compares false both ways -- silently landward.
  const withRepeat = [
    { id: "D0001", lat: 32.0, lon: -117.0 },
    { id: "D0002", lat: 32.0, lon: -117.0 },
    { id: "D0003", lat: 32.1, lon: -117.0 },
  ];

  expect(sideOf(withRepeat, { lat: 32.05, lon: -117.1 })).toBe("left");
});

test("a position on the line itself is on neither side", () => {
  // The MOP line a beach binds sits on this polyline, so this is the answer for
  // the one marker that cannot be seaward or landward of the coast it traces.
  const northward = [
    { id: "D0001", lat: 32.0, lon: -117.0 },
    { id: "D0002", lat: 32.1, lon: -117.0 },
  ];

  expect(sideOf(northward, { lat: 32.05, lon: -117.0 })).toBeNull();
});

/**
 * A box a quarter degree of latitude tall, at this coast's latitude, so the two
 * spans can be compared in ground units rather than in degrees.
 */
const BOX = { south: 32.8, north: 33.0, west: -117.3, east: -117.28 };

test("a tall box grows sideways, on the side the sea is", () => {
  // Which is the shape almost every beach here has: the coast runs north and
  // the box is a narrow strip along it.
  const west = squareToward(BOX, { east: -1, north: 0 });
  expect(west.west).toBeLessThan(BOX.west);
  expect(west.east).toBe(BOX.east);
  expect(west.north).toBe(BOX.north);
  expect(west.south).toBe(BOX.south);

  const east = squareToward(BOX, { east: 1, north: 0 });
  expect(east.east).toBeGreaterThan(BOX.east);
  expect(east.west).toBe(BOX.west);
});

test("a wide box grows up or down instead", () => {
  // Point Loma and Coronado run east to west, so the sea is north or south of
  // the run rather than beside it.
  const wide = { south: 32.66, north: 32.67, west: -117.2, east: -117.15 };

  const north = squareToward(wide, { east: 0, north: 1 });
  expect(north.north).toBeGreaterThan(wide.north);
  expect(north.south).toBe(wide.south);

  const south = squareToward(wide, { east: 0, north: -1 });
  expect(south.south).toBeLessThan(wide.south);
  expect(south.north).toBe(wide.north);
});

test("the growth is exactly what it takes to square the box, and no more", () => {
  // The point of the function: after it, the projection has no leftover to
  // split, so nothing decides where the empty space goes by default.
  const squared = squareToward(BOX, { east: -1, north: 0 });
  const lonScale = Math.cos(
    (((squared.south + squared.north) / 2) * Math.PI) / 180,
  );

  expect((squared.east - squared.west) * lonScale).toBeCloseTo(
    squared.north - squared.south,
    12,
  );
});

test("a box that is already square is left alone", () => {
  const squared = squareToward(BOX, { east: -1, north: 0 });
  expect(squareToward(squared, { east: -1, north: 0 })).toEqual(squared);
});

test("the nearest point carries how far away it is, so a caller can decline", () => {
  const points = coastline();
  const laJolla = { lat: 32.8577, lon: -117.2565 };
  const inland = { lat: 32.8577, lon: -116.5 };

  expect(nearestOn(points, laJolla)!.metres).toBeLessThan(1_000);
  expect(nearestOn(points, inland)!.metres).toBeGreaterThan(50_000);
  expect(nearestOn([], laJolla)).toBeNull();
});

test("a run grows from both ends until it is long enough", () => {
  const points = coastline();

  // One point asked for, two kilometres demanded: it reaches both ways.
  const grown = runAround(points, 500, 500, 2_000);
  expect(grown.length).toBeGreaterThan(10);

  // A run already longer than the minimum is returned untouched, so a long
  // beach frames on itself.
  const long = runAround(points, 400, 500, 2_000);
  expect(long).toHaveLength(101);

  // At the county's end there is no more coast one way, and the other side
  // takes the remainder rather than the run being centred on nothing.
  const atEnd = runAround(points, 0, 0, 2_000);
  expect(atEnd[0]).toEqual(points[0]);
  expect(atEnd.length).toBeGreaterThan(10);

  expect(runAround([], 0, 0, 2_000)).toEqual([]);
});
