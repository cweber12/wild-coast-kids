import { expect, test } from "vitest";
import { allBeaches, beachBySlug, mopLineFor } from "@/lib/beaches";
import type { ShorePoint } from "@/lib/coastline";
import { shoreViewFor } from "./shore";

/** The beach the page opens on, and the one with all four sources bound. */
const LA_JOLLA = beachBySlug("la-jolla-shores-beach")!;

test("the frame holds the beach and the line its coast is drawn from", () => {
  // The map plots no stations, so nothing else belongs in the arithmetic that
  // sizes it. The MOP line stays because it is where the drawn coastline *is*,
  // 117 to 930 m off the sand -- a window without it is a map of a beach with
  // its shoreline cropped off the edge.
  const view = shoreViewFor(LA_JOLLA);
  const bounds = view.bounds!;
  const line = mopLineFor(LA_JOLLA)!;

  for (const at of [LA_JOLLA.segment.upper, LA_JOLLA.segment.lower, line]) {
    expect(at.lat).toBeGreaterThanOrEqual(bounds.south);
    expect(at.lat).toBeLessThanOrEqual(bounds.north);
    expect(at.lon).toBeGreaterThanOrEqual(bounds.west);
    expect(at.lon).toBeLessThanOrEqual(bounds.east);
  }
});

test("a station seven kilometres away no longer decides the frame", () => {
  // The frames used to be sized by the four sources, so a distant station put
  // itself in the picture at its real distance and left the beach a fraction
  // of its own map -- for a reason nothing drawn on it gave, now that none of
  // them is drawn. `pacific-beach` binds the furthest air station in the
  // inventory and frames at about a kilometre.
  const beach = beachBySlug("pacific-beach")!;
  const bounds = shoreViewFor(beach).bounds!;

  const kmPerDegree = 111.32;
  const heightKm = (bounds.north - bounds.south) * kmPerDegree;

  expect(beach.air_station_distance_m).toBe(7365);
  expect(heightKm).toBeLessThan(2);
});

test("a bay beach gets a map and no coast", () => {
  // The traced coast is the open one, and Mission Bay is 2.6 to 5.4 km from
  // the nearest MOP line, so there is a frame to draw but no shoreline in it.
  const bay = beachBySlug("mission-bay-de-anza-cove")!;
  const view = shoreViewFor(bay);

  expect(view.bounds).not.toBeNull();
  expect(view.coast).toHaveLength(0);
});

test("a beach whose two ends are one point draws no segment", () => {
  const isle = beachBySlug("mission-bay-vacation-isle")!;
  const view = shoreViewFor(isle);

  expect(isle.segment.upper).toEqual(isle.segment.lower);
  expect(view.segment).toBeNull();
});

test("every committed beach assembles, and the county's split is pinned", () => {
  // The figures move when the joins move, which is the point of pinning them:
  // a data change that halves the beaches with a coast should fail here rather
  // than quietly ship half the maps without one.
  const views = allBeaches().map(shoreViewFor);

  expect(views).toHaveLength(51);
  expect(views.filter((view) => view.coast.length > 1)).toHaveLength(25);
  expect(views.filter((view) => view.bounds === null)).toHaveLength(1);
});

test("a beach with no coast is still placed on its own map", () => {
  // The chord between the beach's own two ends, which is the only thing that
  // says where it is when no shoreline is drawn.
  const bay = beachBySlug("mission-bay-de-anza-cove")!;
  const view = shoreViewFor(bay);

  expect(view.coast).toHaveLength(0);
  expect(view.segment).toEqual([bay.segment.lower, bay.segment.upper]);
});

test("a beach with no coast and no extent has nothing to draw", () => {
  const isle = beachBySlug("mission-bay-vacation-isle")!;
  const view = shoreViewFor(isle);

  expect(view.bounds).toBeNull();
  expect(view.coast).toHaveLength(0);
  expect(view.segment).toBeNull();
});

test("this beach's stretch is a run of the drawn coast, not a chord across it", () => {
  // Drawn between the two ends `beaches.json` carries -- neither of which is a
  // point on the MOP line -- the stroke lands beside the shore at an angle and
  // reads as a second, wrong coastline.
  const view = shoreViewFor(LA_JOLLA);
  const coast = view.coast as readonly ShorePoint[];
  const segment = view.segment!;

  expect(segment.length).toBeGreaterThan(2);
  for (const point of segment) {
    expect(
      coast.some((at) => at.lat === point.lat && at.lon === point.lon),
    ).toBe(true);
  }
});

test("the stretch is contiguous, and shorter than the coast around it", () => {
  const view = shoreViewFor(LA_JOLLA);
  const coast = view.coast as readonly ShorePoint[];
  const segment = view.segment!;

  const first = coast.findIndex(
    (at) => at.lat === segment[0].lat && at.lon === segment[0].lon,
  );
  segment.forEach((point, step) => {
    expect(coast[first + step].lat).toBe(point.lat);
    expect(coast[first + step].lon).toBe(point.lon);
  });
  expect(segment.length).toBeLessThan(coast.length);
});
