import { expect, test } from "vitest";
import { allBeaches, beachBySlug } from "@/lib/beaches";
import type { ShorePoint } from "@/lib/coastline";
import { shoreDistanceKm, shoreViewFor } from "./shore";

/** The beach the page opens on, and the one with all four sources bound. */
const LA_JOLLA = beachBySlug("la-jolla-shores-beach")!;

test("all four sources are drawn, in the order the page introduces them", () => {
  // Sea, shore, air -- the measured block's own order. Sorting by distance
  // would reorder the list from beach to beach and stop it being learnable.
  const view = shoreViewFor(LA_JOLLA);

  expect(view.markers.map((marker) => marker.kind)).toEqual([
    "mop-line",
    "wave-buoy",
    "tide-station",
    "air-station",
  ]);
});

test("every marker states its distance, including the near ones", () => {
  // The cards withhold a distance under their thresholds, because beside a
  // figure "0.3 km" adds nothing. Beside a picture of the distances it is the
  // caption, and the MOP line at 0.3 km is the one this would drop.
  const view = shoreViewFor(LA_JOLLA);

  for (const marker of view.markers) {
    expect(marker.distanceKm).not.toBeNull();
  }
  expect(
    view.markers.find((marker) => marker.kind === "mop-line")?.distanceKm,
  ).toBe("0.3");
});

test("the distances are the join's, not recomputed at request time", () => {
  // beaches.json measured these once, offline, reproducibly. A second answer
  // computed here could disagree with the one the provenance lines print.
  const view = shoreViewFor(LA_JOLLA);
  const air = view.markers.find((marker) => marker.kind === "air-station");

  expect(LA_JOLLA.air_station_distance_m).toBe(1381);
  expect(air?.distanceKm).toBe("1.4");
});

test("the frame holds every source, so nothing is drawn off the map", () => {
  const view = shoreViewFor(LA_JOLLA);
  const bounds = view.bounds!;

  for (const marker of view.markers) {
    expect(marker.lat).toBeGreaterThanOrEqual(bounds.south);
    expect(marker.lat).toBeLessThanOrEqual(bounds.north);
    expect(marker.lon).toBeGreaterThanOrEqual(bounds.west);
    expect(marker.lon).toBeLessThanOrEqual(bounds.east);
  }
});

test("a bay beach gets its markers and no coast", () => {
  // 23 of 51. The traced coast is the open one, and Mission Bay is 2.6 to 5.4
  // km from the nearest MOP line, so there is a map to draw but no shoreline
  // on it.
  const view = shoreViewFor(beachBySlug("mission-bay-sail-bay")!);

  expect(view.coast).toEqual([]);
  expect(view.markers.length).toBeGreaterThan(0);
  expect(view.bounds).not.toBeNull();
});

test("a beach whose two ends are one point draws no segment", () => {
  // mission-bay-vacation-isle carries an upper equal to its lower. A stroke
  // from a point to itself is invisible and claims the beach has no length.
  const view = shoreViewFor(beachBySlug("mission-bay-vacation-isle")!);

  expect(view.segment).toBeNull();
  // It still has a box, because its stations are somewhere else.
  expect(view.bounds).not.toBeNull();
});

test("a beach with no MOP line carries no MOP marker", () => {
  // 26 of 51 bind none. ShoreMap turns the gap into a sentence; this is the
  // half that has to leave the gap rather than invent a position for it.
  // childrens-pool is one, and it is an open-coast beach rather than a bay one
  // -- no MOP line and no wave buoy is not the same fact as no coast in frame.
  const view = shoreViewFor(beachBySlug("childrens-pool")!);

  expect(view.markers.some((marker) => marker.kind === "mop-line")).toBe(false);
});

test("every committed beach assembles, and the county's split is pinned", () => {
  // beaches.ts throws when a slug names a station no table holds, so running
  // the whole inventory is the drift guard. The two counts are pinned because
  // they are what ShoreMap's absence sentences are sized for: a data change
  // that moved them should fail here rather than quietly change what half the
  // county's map says.
  const views = allBeaches().map((beach) => shoreViewFor(beach));

  expect(views).toHaveLength(51);
  expect(views.filter((view) => view.coast.length === 0)).toHaveLength(23);
  expect(
    views.filter((view) =>
      view.markers.some((marker) => marker.kind === "mop-line"),
    ),
  ).toHaveLength(25);
});

test("a distance is worded the way the cards word it, on both sides of 10 km", () => {
  // The committed inventory reaches 9.2 km, so the whole-kilometre half is one
  // join away rather than in use. It is asserted here because the map has to
  // agree with the measured block about how far away means, and agreeing only
  // up to 10 km would be a second rule.
  expect(shoreDistanceKm(325)).toBe("0.3");
  expect(shoreDistanceKm(1381)).toBe("1.4");
  expect(shoreDistanceKm(9160)).toBe("9.2");
  expect(shoreDistanceKm(12400)).toBe("12");
  expect(shoreDistanceKm(null)).toBeNull();
});

test("a beach whose every source is one point gets no box and no coast", () => {
  // boundsAround returns null rather than a zero-span box, because a zero span
  // divides by zero in the projection. No committed beach reaches this -- even
  // vacation-isle's stations are somewhere else -- so it is built rather than
  // found, and the map says so instead of drawing a coast at infinite
  // magnification.
  const isle = beachBySlug("mission-bay-vacation-isle")!;
  const nowhere = {
    ...isle,
    mop_line: null,
    wave_buoy: null,
    tide_station: null,
    air_station: null,
  };

  const view = shoreViewFor(nowhere);

  expect(view.bounds).toBeNull();
  expect(view.coast).toEqual([]);
  expect(view.markers).toEqual([]);
});

test("this beach's stretch is a run of the drawn coast, not a chord across it", () => {
  // beaches.json's segment is the beach's bounding extent, and its two ends are
  // not points on the MOP polyline. A straight line between them floats off the
  // coastline and reads as a second, wrong shore -- which is what it drew.
  const view = shoreViewFor(LA_JOLLA);
  const ids = view.coast.map((point) => point.id);
  // Where a coast is drawn the stretch is taken from it, so every point in it
  // carries the line id that placed it.
  const run = view.segment as readonly ShorePoint[];

  expect(run).not.toBeNull();
  expect(run.length).toBeGreaterThan(1);
  for (const point of run) {
    expect(ids).toContain(point.id);
  }
});

test("the stretch is contiguous, and shorter than the coast around it", () => {
  const view = shoreViewFor(LA_JOLLA);
  const ids = view.coast.map((point) => point.id);
  const run = view.segment as readonly ShorePoint[];
  const first = ids.indexOf(run[0].id);

  expect(run.map((point) => point.id)).toEqual(
    ids.slice(first, first + run.length),
  );
  expect(run.length).toBeLessThan(view.coast.length);
});

test("a beach with no coast is still placed on its own map", () => {
  // Without this the bay maps are two markers floating in an empty frame with
  // nothing saying where the beach is, which is the one thing the picture has
  // to show. The chord objection is about a stroke competing with a drawn
  // shore; where no shore is drawn there is nothing to compete with, and the
  // beach's own two ends are the best statement available.
  const view = shoreViewFor(beachBySlug("mission-bay-sail-bay")!);
  const beach = beachBySlug("mission-bay-sail-bay")!;

  expect(view.coast).toEqual([]);
  expect(view.segment).not.toBeNull();
  expect(view.segment).toEqual([beach.segment.lower, beach.segment.upper]);
});

test("a beach with no coast and no extent has nothing to draw", () => {
  // mission-bay-vacation-isle, whose upper equals its lower. One point is not a
  // stretch of shore, and a stroke from a point to itself claims a beach with
  // no length.
  const view = shoreViewFor(beachBySlug("mission-bay-vacation-isle")!);

  expect(view.segment).toBeNull();
});
