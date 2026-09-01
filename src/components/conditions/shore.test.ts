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
import { coastRunFor, seawardFrom, shoreViewFor } from "./shore";

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
  expect(views.filter((view) => view.coast.length > 1)).toHaveLength(28);
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

test("a beach with no traced coast keeps an even frame", () => {
  // No coast means no land-sea split to lean the picture toward, so the box is
  // left as `boundsAround` made it rather than being pushed at a guess.
  const bay = beachBySlug("mission-bay-de-anza-cove")!;
  const boxed = boundsAround(
    [bay.segment.upper, bay.segment.lower],
    SHORE_WINDOW_MARGIN,
  )!;
  const framed = shoreViewFor(bay).bounds!;

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
