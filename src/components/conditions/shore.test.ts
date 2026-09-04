import { expect, test } from "vitest";
import { allBeaches, beachBySlug, mopLineFor } from "@/lib/beaches";
import type { Position, ShorePoint } from "@/lib/coastline";
import {
  boundsAround,
  coastline,
  nearestOn,
  runAround,
  SHORE_WINDOW_MARGIN,
  unbrokenAround,
} from "@/lib/coastline";
import {
  coastRunFor,
  seawardFrom,
  shoreViewFor,
  shoreViewForArea,
} from "./shore";
import { areaBySlug, beachesByArea } from "@/lib/areas";

/** The beach the page opens on, and the one with all four sources bound. */
const LA_JOLLA = beachBySlug("la-jolla-shores-beach")!;

test("the frame holds the beach and the line its coast is drawn from", () => {
  // The map plots no stations, so nothing else belongs in the arithmetic that
  // sizes it.
  //
  // The MOP line is still in frame and is no longer *put* there: ADR-0036 took
  // it out of the arithmetic, because along-shore it stretched the box toward
  // a point nothing draws. It stays in view because `coastline()` is built from
  // `MOP_LINES`, so the run the frame is built on contains the beach's own line
  // already -- which is the claim this test now checks rather than assumes.
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

  const stationM = beach.air_station_distance_m!;
  expect(stationM).toBe(7365);
  // Asserted against the station rather than against a constant, because what
  // sets the size has changed and the claim has not. It is the minimum run of
  // shore and its margin now, about 2.2 km, where before it was this beach's
  // own extent -- either way, nothing here reaches for a station 7.4 km off.
  expect(heightKm * 1000).toBeLessThan(stationM / 2);
});

test("a bay beach gets the bay's own shoreline", () => {
  // It used to get a frame and nothing in it. The traced coast was the open
  // one, and Mission Bay is 2.6 to 5.4 km from the nearest MOP line, so 23 of
  // 51 beaches drew an empty square with a chord across it.
  //
  // ADR-0039. CDFW erased the bays out of the ecoregion polygon, which means
  // its boundary follows the bay shore -- so the shoreline was in the committed
  // file from ADR-0037 onward and was being withheld.
  const bay = beachBySlug("mission-bay-de-anza-cove")!;
  const view = shoreViewFor(bay);

  expect(view.bounds).not.toBeNull();
  expect(view.coast.length).toBeGreaterThan(1);

  // And it is the bay's own shore rather than the ocean's three kilometres
  // west, which is the failure this could plausibly have instead: the nearest
  // drawn point is metres from the beach, not kilometres.
  //
  // Not "every point is inside the frame" -- `windowAround` returns one point
  // past each end on purpose, so the stroke leaves the frame rather than
  // stopping short of it with sea on both sides of its ends.
  const nearest = Math.min(
    ...view.coast.map((point) =>
      Math.hypot(
        (point.lon - bay.segment.lower.lon) *
          Math.cos((bay.segment.lower.lat * Math.PI) / 180),
        point.lat - bay.segment.lower.lat,
      ),
    ),
  );
  expect(nearest * 111_320).toBeLessThan(100);
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

  // 50, not 28. ADR-0039 drew the bays; the one without a coast is
  // `mission-bay-vacation-isle`, which is also the one without a frame -- it is
  // on an island the committed mainland ring does not hold, and its two ends
  // are a single point.
  expect(views.filter((view) => view.coast.length > 1)).toHaveLength(50);
  expect(views.filter((view) => view.bounds === null)).toHaveLength(1);
});

test("the three beaches on the open coast that drew none of it now do", () => {
  // 25 became 28 above, and which three matters more than the number. None of
  // them binds a MOP line, which is why each framed at tens of metres and
  // caught nothing -- and none of them is in a bay: they are 0.33, 0.74 and
  // 0.83 km from the traced coast, against 1.17 km for the nearest bay beach.
  // ADR-0036 names them for this reason.
  for (const slug of [
    "childrens-pool",
    "tijuana-slough-national-wildlife-refuge",
    "coronado-cays-nr",
  ]) {
    const view = shoreViewFor(beachBySlug(slug)!);
    expect(view.coast.length).toBeGreaterThan(1);
    expect(view.segment).not.toBeNull();
  }
});

test("the stretch is drawn on the beach, not beside the line off it", () => {
  // The defect in #199, asserted where it was worst. `la-jolla-cove`'s heavy
  // stroke was drawn at its MOP line about 400 m away, because `beachStretch`
  // snapped the beach's ends to the nearest point *in the window* and the
  // window -- 200 m across, built without reference to the coast -- held three
  // points, all of them up beside the line.
  //
  // Every beach, not just that one: a bound that only the worst case can
  // breach is a bound that stops testing once the worst case is fixed.
  //
  // **Not "the stroke is near the beach", which would fail on a correct map.**
  // The drawn line is CDIP's model line 117 to 930 m offshore (ADR-0030), so
  // every stretch is a few hundred metres from the sand by construction. The
  // property is that the stroke sits on the *nearest available* coast: the
  // closest point of the drawn stretch is the closest point of the whole
  // coastline. That is what was false before -- `la-jolla-cove`'s stretch sat
  // 400 m off where the nearest traced point is 120 m.
  const kmPerDegree = 111.32;
  const metresApart = (a: Position, b: Position) => {
    const lonScale = Math.cos((a.lat * Math.PI) / 180);
    return (
      Math.hypot((a.lon - b.lon) * lonScale, a.lat - b.lat) * kmPerDegree * 1000
    );
  };

  const points = coastline();
  const strayed: { slug: string; drawn: number; nearest: number }[] = [];

  for (const beach of allBeaches()) {
    const view = shoreViewFor(beach);
    if (view.segment === null || view.coast.length < 2) continue;

    const nearest = Math.min(
      nearestOn(points, beach.segment.lower)!.metres,
      nearestOn(points, beach.segment.upper)!.metres,
    );
    const drawn = Math.min(
      ...view.segment.map((point) =>
        Math.min(
          metresApart(point, beach.segment.lower),
          metresApart(point, beach.segment.upper),
        ),
      ),
    );

    if (drawn > nearest + 1) {
      strayed.push({ slug: beach.slug, drawn, nearest });
    }
  }

  expect(strayed).toEqual([]);
});

test("a beach shorter than the gap between points still draws a stretch", () => {
  // `la-jolla-cove` is about 70 m of shore and the points available to mark it
  // sit at about 98, so both its ends snap to one of them. That used to return
  // null and draw no stretch at all; the beach then had nothing on the map
  // saying where it was.
  const view = shoreViewFor(beachBySlug("la-jolla-cove")!);

  expect(view.segment).not.toBeNull();
  expect(view.segment!.length).toBeGreaterThanOrEqual(2);
});

test("a bay beach's stretch is a run of the shore, not a chord across it", () => {
  // While the bays drew no coastline this was the beach's own two ends, joined
  // by a chord -- the only thing that said where it was. Now there is a shore
  // to mark a run of, so the chord goes: a straight stroke at an angle to a
  // drawn shoreline reads as a second, wrong shoreline, which is the whole of
  // `beachStretch`'s argument and it now applies in the bays too.
  const bay = beachBySlug("mission-bay-de-anza-cove")!;
  const view = shoreViewFor(bay);

  expect(view.coast.length).toBeGreaterThan(1);
  expect(view.segment).not.toEqual([bay.segment.lower, bay.segment.upper]);

  // Every point of the stretch is a point of the drawn coast.
  const drawn = new Set(view.coast.map((point) => `${point.lat},${point.lon}`));
  for (const point of view.segment!) {
    expect(drawn.has(`${point.lat},${point.lon}`)).toBe(true);
  }
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

test("the sea is a quarter turn left of the walk, which is where it is", () => {
  // The one convention in this file that is easy to get exactly backwards, and
  // getting it backwards would put every map's empty space over the land while
  // still looking deliberate. `scripts/sea-side.mjs` proves the premise for
  // every beach against the wave buoy; this asserts the arithmetic that reads
  // it.
  const northward = [
    { lat: 32.85, lon: -117.27 },
    { lat: 32.87, lon: -117.27 },
  ];
  const seaward = seawardFrom(northward)!;
  expect(seaward.east).toBeLessThan(0); // west, which is where the Pacific is
  expect(Math.abs(seaward.north)).toBeLessThan(Math.abs(seaward.east));

  // Walked the other way the same coast has the sea on the right, so the
  // rotation has to move with it rather than being a fixed compass direction.
  const southward = [...northward].reverse();
  expect(seawardFrom(southward)!.east).toBeGreaterThan(0);
});

test("a run with no direction offers no seaward side", () => {
  // Both are unreachable through `shoreViewFor` and both are the kind of guard
  // that stops being unreachable when someone changes the caller.
  expect(seawardFrom([{ lat: 32.85, lon: -117.27 }])).toBeNull();
  expect(
    seawardFrom([
      { lat: 32.85, lon: -117.27 },
      { lat: 32.85, lon: -117.27 },
    ]),
  ).toBeNull();
});

test("the frame's extra ground is put on the sea side, not shared out", () => {
  // End to end on a committed beach, because the arithmetic being right and the
  // result being right are different claims. La Jolla's coast runs north with
  // the Pacific to the west, so the box grows west: the coast ends up toward
  // the landward edge and the sea wash fills what is left.
  // The run alone, which is what the frame is built from: the beach's own sand
  // is not drawn where a coast is, so it is not in the arithmetic either.
  const boxed = boundsAround(
    coastRunFor(LA_JOLLA)!.points,
    SHORE_WINDOW_MARGIN,
  );
  const framed = shoreViewFor(LA_JOLLA).bounds!;

  expect(framed.west).toBeLessThan(boxed!.west);
  expect(framed.east).toBeCloseTo(boxed!.east, 10);
  expect(framed.north).toBeCloseTo(boxed!.north, 10);
  expect(framed.south).toBeCloseTo(boxed!.south, 10);
});

test("a beach with no coast at all keeps an even frame", () => {
  // No coast means no land-sea split to lean the picture toward, so the box is
  // left as `boundsAround` made it rather than being pushed at a guess.
  //
  // This used to be a bay beach. ADR-0039 gave the bays a shore, so the only
  // beach left in this state is the island -- and its two ends are one point,
  // which `boundsAround` answers with null. So the branch is now reached only
  // where there is no box either, and it is asserted through `beachStretch`'s
  // own fallback rather than through a beach that no longer exists.
  const isle = beachBySlug("mission-bay-vacation-isle")!;
  const view = shoreViewFor(isle);

  expect(view.bounds).toBeNull();
  expect(view.coast).toHaveLength(0);
  expect(view.segment).toBeNull();

  // The even frame itself, on a fabricated beach with two ends and no shore
  // near them -- which is the state the rule is about, and which the committed
  // inventory no longer contains.
  const offshore = {
    ...isle,
    segment: {
      upper: { lat: 32.6, lon: -118.5 },
      lower: { lat: 32.61, lon: -118.5 },
    },
  };
  const framed = shoreViewFor(offshore).bounds!;
  const boxed = boundsAround(
    [offshore.segment.upper, offshore.segment.lower],
    SHORE_WINDOW_MARGIN,
  )!;

  expect(framed).toEqual(boxed);
});

test("no beach's stretch is drawn across a gap in the model", () => {
  // `coronado-north-beach` sits by the mouth of San Diego Bay, where the model
  // leaves a 2,967 m gap because there is no open coast to place lines on.
  // Searching the whole coastline for the beach's two ends -- which is what
  // ADR-0036 changed -- let them land on opposite sides of it, so the stretch
  // marking a 2.8 km beach came out as a 4.9 km V with a three-kilometre
  // diagonal drawn straight across the channel, in the heavy stroke that means
  // "this is your beach".
  //
  // Asserted for every beach and against the step rather than the total: a
  // stretch is allowed to be longer than its beach, and is never allowed to
  // contain a step no shoreline could.
  const kmPerDegree = 111.32;
  const stepMetres = (a: Position, b: Position) => {
    const lonScale = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
    return (
      Math.hypot((a.lon - b.lon) * lonScale, a.lat - b.lat) * kmPerDegree * 1000
    );
  };

  const jumped: string[] = [];
  for (const beach of allBeaches()) {
    const run = coastRunFor(beach);
    if (run === null) continue;

    for (const points of [run.points, run.stretch]) {
      for (let index = 0; index < points.length - 1; index += 1) {
        const step = stepMetres(points[index], points[index + 1]);
        if (step > 500) {
          jumped.push(`${beach.slug}: ${step.toFixed(0)} m`);
          break;
        }
      }
    }
  }

  expect(jumped).toEqual([]);
});

test("a run stops at a gap rather than growing through it", () => {
  // The unit behind the inventory check above. Two fragments 3 km apart, and a
  // minimum long enough that a run would cross the gap if nothing stopped it.
  const points = [
    { lat: 32.0, lon: -117.0 },
    { lat: 32.001, lon: -117.0 },
    { lat: 32.03, lon: -117.0 },
    { lat: 32.031, lon: -117.0 },
  ];

  const whole = unbrokenAround(points, 0, 500);
  expect(whole).toEqual({ from: 0, to: 1 });

  const run = runAround(points, 0, 0, 5_000, whole);
  expect(run.map((point) => point.lat)).toEqual([32.0, 32.001]);

  // And from the far fragment, the other way.
  expect(unbrokenAround(points, 3, 500)).toEqual({ from: 2, to: 3 });
});

/* =========================================================================
 * The area's map
 * ========================================================================= */

/** Metres per degree of latitude, the same figure `coastline.ts` uses. */
const M_PER_DEGREE = 111_320;

function spanMetres(bounds: {
  south: number;
  north: number;
  west: number;
  east: number;
}) {
  const midLat = (bounds.south + bounds.north) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  return {
    ns: (bounds.north - bounds.south) * M_PER_DEGREE,
    ew: (bounds.east - bounds.west) * M_PER_DEGREE * lonScale,
  };
}

/**
 * The frame is square, and this is the assertion the decision to make it square
 * rests on.
 *
 * The plan asked for each area's own bbox aspect. Measured at the map column's
 * real width of 472px that makes Imperial Beach 1,908px tall and Coronado a
 * 199px letterbox — a ten-fold swing between areas, seven of the twelve over a
 * thousand pixels in a 639px window. `squareToward` is what this trades that
 * for, and it is the frame the beach map beside it already uses. See ADR-0051.
 *
 * Asserted in metres rather than in degrees, because a degree of longitude is
 * shorter than a degree of latitude at this latitude and a box that is square
 * in degrees is not square on the ground.
 */
test("an area's frame is square on the ground, at every area", () => {
  for (const { area } of beachesByArea()) {
    const { bounds } = shoreViewForArea(area);
    expect(bounds, area.slug).not.toBeNull();

    const { ns, ew } = spanMetres(bounds!);
    // Within a tenth of a percent: `squareToward` grows one axis to match the
    // other, and the cosine is taken at the box's own mid-latitude.
    expect(Math.abs(ns - ew) / ns, area.slug).toBeLessThan(0.001);
  }
});

/**
 * And it holds every member's coast, which is what makes it the *area's* frame
 * rather than one member's with the others hanging off the edge.
 *
 * `mission-bay-vacation-isle` contributes no run — the committed mainland ring
 * does not reach its island — so it is skipped here rather than asserted about.
 * That it is still marked is the tick slice's claim, not this one's.
 */
test("an area's frame holds every member's own coast run", () => {
  let skipped = 0;

  for (const { area, beaches } of beachesByArea()) {
    const { bounds } = shoreViewForArea(area);

    for (const beach of beaches) {
      const run = coastRunFor(beach);
      if (run === null) {
        skipped += 1;
        continue;
      }
      for (const point of run.points) {
        expect(point.lat, `${area.slug}/${beach.slug}`).toBeGreaterThanOrEqual(
          bounds!.south,
        );
        expect(point.lat, `${area.slug}/${beach.slug}`).toBeLessThanOrEqual(
          bounds!.north,
        );
        expect(point.lon, `${area.slug}/${beach.slug}`).toBeGreaterThanOrEqual(
          bounds!.west,
        );
        expect(point.lon, `${area.slug}/${beach.slug}`).toBeLessThanOrEqual(
          bounds!.east,
        );
      }
    }
  }

  // The probe: one beach in the inventory has no traced coast, and a run where
  // none were skipped would mean the loop above stopped exercising that path.
  expect(skipped).toBe(1);
});

/**
 * An area map is wider than any of its beaches' maps, which is the thing a
 * reader is actually being shown: where this beach sits on a coast, rather than
 * the beach alone.
 */
test("an area's frame is wider than its members' own", () => {
  const area = areaBySlug("la-jolla")!;
  const areaSpan = spanMetres(shoreViewForArea(area).bounds!);

  for (const slug of area.beaches) {
    const beach = beachBySlug(slug)!;
    const own = shoreViewFor(beach).bounds;
    if (own === null) continue;
    expect(spanMetres(own).ns, slug).toBeLessThan(areaSpan.ns);
  }
});

/**
 * Nothing is drawn heavy on an area map, and that is the rule rather than a
 * property of the area it was tried on: no one beach is the subject, so
 * picking one out would be the representative-beach lie ADR-0048 refuses,
 * drawn instead of stated.
 */
test("an area map marks no one beach as its subject", () => {
  for (const { area } of beachesByArea()) {
    expect(shoreViewForArea(area).segment, area.slug).toBeNull();
  }
});

/**
 * Two data files disagreeing should stop a build rather than quietly draw a
 * coast with a beach missing from it — the guard `areaSources` and
 * `beachesByArea` both carry, for the same reason.
 */
test("it refuses an area naming a beach the inventory does not have", () => {
  expect(() =>
    shoreViewForArea({
      slug: "invented",
      name: "Invented",
      beaches: ["not-a-beach"],
    }),
  ).toThrow(/beaches.json has no such beach/);
});

/**
 * An area the traced coast reaches nowhere has no frame, and says so rather
 * than drawing an empty square — which on a page about the sea reads as open
 * water.
 *
 * No committed area is in that state: `mission-bay-vacation-isle` is the one
 * beach the mainland ring does not hold, and it sits in Mission Bay – West
 * among seven that it does. The state is reachable by an authored table putting
 * it alone, which is an edit somebody could make, so it returns an absence
 * rather than a box built from nothing.
 */
test("an area with no traced coast anywhere in it has no frame", () => {
  const view = shoreViewForArea({
    slug: "island-only",
    name: "Island Only",
    beaches: ["mission-bay-vacation-isle"],
  });

  expect(view.bounds).toBeNull();
  expect(view.coast).toEqual([]);
  expect(view.segment).toBeNull();

  // The probe: that beach really is the one with no run, so this test is about
  // the state it names rather than about a slug that happens to be quiet.
  expect(coastRunFor(beachBySlug("mission-bay-vacation-isle")!)).toBeNull();
});
