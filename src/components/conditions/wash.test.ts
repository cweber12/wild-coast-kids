import { expect, test } from "vitest";
import { allBeaches } from "@/lib/beaches";
import type { PlotPoint, ShorePoint } from "@/lib/coastline";
import { projectionFor } from "@/lib/coastline";
import { shoreViewFor } from "./shore";
import { seaWash } from "./wash";

/** The drawing space `ShoreMap` uses, so these read against the real picture. */
const SIZE = { width: 100, height: 100 };

const inFrame = (at: PlotPoint) =>
  at.x >= 0 && at.x <= SIZE.width && at.y >= 0 && at.y <= SIZE.height;

/**
 * Whether a point falls inside a polygon, by ray crossing.
 *
 * The same question the browser answers when it fills the path, asked here so a
 * test can put a point where it knows the water is and read back whether it
 * would be shaded.
 */
function shaded(polygon: readonly PlotPoint[], at: PlotPoint): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > at.y !== b.y > at.y &&
      at.x < ((b.x - a.x) * (at.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
}

/** How far a point sits from a run of segments, and which one is nearest. */
function nearestOn(run: readonly PlotPoint[], at: PlotPoint) {
  let distance = Infinity;
  let index = -1;
  for (let i = 0; i < run.length - 1; i += 1) {
    const from = run[i];
    const to = run[i + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = dx * dx + dy * dy;
    if (span === 0) continue;
    const px = at.x - from.x;
    const py = at.y - from.y;
    const along = Math.min(1, Math.max(0, (px * dx + py * dy) / span));
    const offX = px - along * dx;
    const offY = py - along * dy;
    const off = Math.hypot(offX, offY);
    if (off < distance) {
      distance = off;
      index = i;
    }
  }
  return { distance, index };
}

/**
 * The parts of a wash that are not the drawn shore: what closes it, and the two
 * straight continuations that carry the shore off the edge of the picture.
 *
 * Found by locating the coast inside the returned ring rather than by counting
 * from either end, so the test says what it means instead of restating the
 * order `seaWash` happens to build in.
 */
function closureOf(wash: readonly PlotPoint[], coast: readonly PlotPoint[]) {
  const same = (a: PlotPoint, b: PlotPoint) => a.x === b.x && a.y === b.y;
  const at = wash.findIndex((point) => same(point, coast[0]));
  expect(at).toBeGreaterThanOrEqual(0);
  coast.forEach((point, step) => {
    expect(same(wash[at + step], point)).toBe(true);
  });

  const before = wash[at - 1];
  const after = wash[at + coast.length];
  expect(before).toBeDefined();
  expect(after).toBeDefined();

  // Everything from the far continuation round to the near one, which is the
  // part that has to stay off the picture.
  const rest: PlotPoint[] = [];
  for (let step = at + coast.length; step <= wash.length + at - 1; step += 1) {
    rest.push(wash[step % wash.length]);
  }

  return { before, after, rest };
}

/** A direction, so two runs can be compared without their lengths mattering. */
function heading(from: PlotPoint, to: PlotPoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return { x: dx / length, y: dy / length };
}

/**
 * A short run down a west-facing coast, walked south to north.
 *
 * Plot space, so north is up and y runs the other way to latitude. The sea is
 * to the west of it, which on this picture is smaller x.
 */
const STRAIGHT: PlotPoint[] = [
  { x: 60, y: 95 },
  { x: 60, y: 60 },
  { x: 60, y: 20 },
  { x: 60, y: 5 },
];

/**
 * The same walk, turning a right angle partway.
 *
 * This is the shape the old construction could not draw: north up the first
 * arm, then east along the second, so the water is west of one and north of the
 * other and no single normal describes both. A bay mouth is this shape.
 */
const BENT: PlotPoint[] = [
  { x: 50, y: 95 },
  { x: 50, y: 60 },
  { x: 50, y: 50 },
  { x: 70, y: 50 },
  { x: 95, y: 50 },
];

test("a run with nothing to give it a direction has no wash", () => {
  // Both are unreachable through `ShoreMap`, which draws no sea without a
  // coast, and both are the kind of guard that stops being unreachable when
  // someone changes the caller.
  expect(seaWash([], SIZE)).toBeNull();
  expect(seaWash([{ x: 10, y: 10 }], SIZE)).toBeNull();
  expect(
    seaWash(
      [
        { x: 10, y: 10 },
        { x: 10, y: 10 },
      ],
      SIZE,
    ),
  ).toBeNull();
});

test("the sea is shaded and the land is not, on a straight shore", () => {
  const wash = seaWash(STRAIGHT, SIZE)!;

  // West of the line is the Pacific; east of it is the county.
  expect(shaded(wash, { x: 20, y: 50 })).toBe(true);
  expect(shaded(wash, { x: 90, y: 50 })).toBe(false);
});

test("a shore that turns a corner keeps the sea on its left the whole way", () => {
  // The defect in #200, at its smallest. One normal taken across the run's two
  // ends points north-west here, which covers the water off neither arm
  // properly: it leaves a corner of the frame unshaded and washes a corner of
  // the land instead.
  const wash = seaWash(BENT, SIZE)!;

  // West of the first arm, which is water.
  expect(shaded(wash, { x: 20, y: 80 })).toBe(true);
  // North of the second arm, which is also water.
  expect(shaded(wash, { x: 85, y: 25 })).toBe(true);
  // And the wedge the two arms enclose is land, all the way into the corner.
  expect(shaded(wash, { x: 80, y: 80 })).toBe(false);
  expect(shaded(wash, { x: 95, y: 95 })).toBe(false);
});

test("walked the other way, the same shore washes the other side", () => {
  // The sea is left of the walk rather than a fixed compass direction, which is
  // the one convention here that is easy to get exactly backwards -- and
  // getting it backwards would put every map's water over the land while still
  // looking deliberate.
  const wash = seaWash([...STRAIGHT].reverse(), SIZE)!;

  expect(shaded(wash, { x: 20, y: 50 })).toBe(false);
  expect(shaded(wash, { x: 90, y: 50 })).toBe(true);
});

test("the wash closes outside the picture, never across it", () => {
  // The complaint #200 opens with. What closes the polygon is a walk round the
  // corners of a box that already holds the whole frame, so none of it can
  // appear as a straight edge inside the picture.
  const wash = seaWash(BENT, SIZE)!;
  const { rest } = closureOf(wash, BENT);

  for (let i = 0; i < rest.length - 1; i += 1) {
    for (let step = 0; step <= 40; step += 1) {
      const at = {
        x: rest[i].x + ((rest[i + 1].x - rest[i].x) * step) / 40,
        y: rest[i].y + ((rest[i + 1].y - rest[i].y) * step) / 40,
      };
      expect(inFrame(at)).toBe(false);
    }
  }
});

test("where the shore leaves the picture the wash leaves it along the same line", () => {
  // The two edges that do reach inside the frame are the shore's own
  // continuations, so the only boundary a reader sees between water and land is
  // the drawn line or the line it was heading along when it ran out.
  const wash = seaWash(BENT, SIZE)!;
  const { before, after } = closureOf(wash, BENT);

  const back = heading(BENT[1], BENT[0]);
  const on = heading(BENT[BENT.length - 2], BENT[BENT.length - 1]);

  expect(heading(BENT[0], before).x).toBeCloseTo(back.x, 10);
  expect(heading(BENT[0], before).y).toBeCloseTo(back.y, 10);
  expect(heading(BENT[BENT.length - 1], after).x).toBeCloseTo(on.x, 10);
  expect(heading(BENT[BENT.length - 1], after).y).toBeCloseTo(on.y, 10);
});

/** Every beach that has a coast to draw, as `ShoreMap` would receive it. */
function drawnCounty() {
  const drawn: { slug: string; coast: PlotPoint[] }[] = [];

  for (const beach of allBeaches()) {
    const view = shoreViewFor(beach);
    if (view.bounds === null || view.coast.length < 2) continue;
    const project = projectionFor(view.bounds, SIZE);
    drawn.push({
      slug: beach.slug,
      coast: view.coast.map((point) => project(point.lat, point.lon)),
    });
  }

  return drawn;
}

test("the whole county has a coast to wash, and it is drawn", () => {
  // The denominator the three sweeps below run over, pinned here so a data
  // change that halves it fails as a change rather than as three checks that
  // quietly got easier.
  expect(drawnCounty()).toHaveLength(50);
});

test("no beach's wash leaves the seaward side of its own drawn shore", () => {
  // The property the picture has to have, asserted where it is well posed: at
  // each drawn segment, against that segment's own normal.
  //
  // **A probe the segment does not own is skipped, and that is not a loophole.**
  // A point a hair to the left of a 20 m spur in the county's linework is
  // nearer to the piece of shore on the other side of the spur, so it says
  // nothing about the spur. 593 of 5,533 probes are declined that way; the
  // 4,940 that stand cover every beach.
  const strayed: string[] = [];

  for (const { slug, coast } of drawnCounty()) {
    for (let i = 0; i < coast.length - 1; i += 1) {
      const from = coast[i];
      const to = coast[i + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;

      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      if (!inFrame(mid)) continue;

      // Plot space puts north at the top, so y grows southward and the
      // geographic left of the walk appears on the other hand: for a walk
      // (dx, dy) the seaward normal is (dy, -dx).
      const reach = Math.min(0.2, length / 2);
      const sea = {
        x: mid.x + (dy / length) * reach,
        y: mid.y - (dx / length) * reach,
      };
      const land = {
        x: mid.x - (dy / length) * reach,
        y: mid.y + (dx / length) * reach,
      };
      if (nearestOn(coast, sea).index !== i) continue;
      if (nearestOn(coast, land).index !== i) continue;

      const wash = seaWash(coast, SIZE)!;
      if (!shaded(wash, sea)) strayed.push(`${slug}: segment ${i} left dry`);
      if (shaded(wash, land)) strayed.push(`${slug}: segment ${i} washed land`);
    }
  }

  expect(strayed).toEqual([]);
});

test("no beach's wash closes inside its own picture", () => {
  // Measured before the change: ten closing edges reached inside a frame,
  // across eight beaches, because a coast can be drawn well outside the box it
  // is framed in and the old closure was offset from *it* rather than from the
  // frame.
  const crossed: string[] = [];

  for (const { slug, coast } of drawnCounty()) {
    const { rest } = closureOf(seaWash(coast, SIZE)!, coast);

    for (let i = 0; i < rest.length - 1; i += 1) {
      for (let step = 0; step <= 40; step += 1) {
        const at = {
          x: rest[i].x + ((rest[i + 1].x - rest[i].x) * step) / 40,
          y: rest[i].y + ((rest[i + 1].y - rest[i].y) * step) / 40,
        };
        if (inFrame(at)) {
          crossed.push(`${slug}: closing edge ${i} reaches the picture`);
          break;
        }
      }
    }
  }

  expect(crossed).toEqual([]);
});

/**
 * How near a point is to a run of segments, squared, and which way it lies off
 * the nearest of them.
 *
 * Squared and in plot units because it is called on every sample of every
 * frame: no square root, no allocation, and no second spelling of the cosine
 * correction, which the projection has already applied. The projection is a
 * uniform scale with north at the top, so a side in plot space is the same side
 * on the ground -- read with the flip the rest of this file uses, where the
 * seaward normal of a walk (dx, dy) is (dy, -dx).
 */
function agreedSide(
  coast: readonly PlotPoint[],
  at: PlotPoint,
  reach: number,
  slack: number,
  off: Float64Array,
  toward: Float64Array,
): "sea" | "land" | null {
  let nearest = Infinity;

  // Written out rather than called through a helper, and filling two buffers
  // the caller owns rather than returning a pair. This runs 121,794 times over
  // runs of up to 856 segments, so a closure and an object per segment is the
  // difference between a sweep and a slow one.
  for (let index = 0; index < coast.length - 1; index += 1) {
    const from = coast[index];
    const to = coast[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = dx * dx + dy * dy;
    if (span === 0) {
      off[index] = Infinity;
      continue;
    }

    const px = at.x - from.x;
    const py = at.y - from.y;
    const along = Math.min(1, Math.max(0, (px * dx + py * dy) / span));
    const offX = px - along * dx;
    const offY = py - along * dy;

    off[index] = offX * offX + offY * offY;
    toward[index] = px * dy - py * dx;
    if (off[index] < nearest) nearest = off[index];
  }
  if (nearest > reach * reach) return null;

  // Every segment that could plausibly be the nearest has to agree, or the
  // question has no answer here. Squared, so the one percent is applied twice.
  const plausible = nearest * (1 + slack) * (1 + slack);
  let sea = false;
  let land = false;

  for (let index = 0; index < coast.length - 1; index += 1) {
    if (off[index] > plausible) continue;
    if (toward[index] > 0) sea = true;
    if (toward[index] < 0) land = true;
    if (toward[index] === 0) return null;
  }

  if (sea === land) return null;
  return sea ? "sea" : "land";
}

// The budget is raised because the work is the assertion, which is the
// distinction `gate-scope.test.mjs` draws when it declines to raise one: there
// the seconds were a cold resolver being warmed inside a test, and moving them
// to a hook was the repair. Here they are 121,794 point-in-polygon tests
// against runs of up to 856 segments, and there is nowhere else for that to
// happen. It costs 2.5s under v8's coverage instrumentation on an idle machine
// -- 4.8s before the buffers below -- and 5s has no room left for a loaded run.
test(
  "every beach's wash agrees with the shore it is drawn from",
  { timeout: 60_000 },
  () => {
    // #200's own verification: sampled on a grid over every frame and compared
    // against the side the coastline itself gives, which is the ground truth
    // `scripts/sea-side.mjs` already uses one scale up.
    //
    // **Asked only where that ground truth has an answer**, which is the
    // correction the issue's own wording needs. The side of a coast is decided by
    // the nearest segment, and far from shore that is decided by millimetres
    // between segments pointing opposite ways: at `torrey-pines-state-beach` a
    // 20 m reversed spur in the county's linework wins by 0.01 m from 5.9 km
    // away, and flips the verdict for a quarter of the frame. So a sample counts
    // only within 500 m of the drawn shore, and only where every segment within
    // one percent of the nearest agrees on the answer. That leaves 121,794 of
    // 185,928 samples, spread over all 50 beaches.
    //
    // Measured before the change: 834 of those were shaded on the wrong side,
    // across ten beaches, worst `coronado-city-beaches` at 25.4 percent of its
    // frame. See docs/adr/0041.
    const REACH_M = 500;
    const SLACK = 0.01;
    const METRES_PER_DEGREE = 111_320;
    const STEPS = 60;

    const wrong: string[] = [];

    for (const beach of allBeaches()) {
      const view = shoreViewFor(beach);
      if (view.bounds === null || view.coast.length < 2) continue;

      const bounds = view.bounds;
      const project = projectionFor(bounds, SIZE);
      const coast = view.coast.map((point) => project(point.lat, point.lon));
      const wash = seaWash(coast, SIZE)!;

      // One metre, in this frame's own plot units, taken off the projection
      // rather than rebuilt from its scale factors.
      const metre = Math.abs(
        project(bounds.south + 1 / METRES_PER_DEGREE, bounds.west).y -
          project(bounds.south, bounds.west).y,
      );
      // Two buffers per beach, reused by every sample of its frame. See
      // `agreedSide`.
      const off = new Float64Array(coast.length);
      const toward = new Float64Array(coast.length);
      let missed = 0;

      for (let row = 0; row <= STEPS; row += 1) {
        for (let column = 0; column <= STEPS; column += 1) {
          const at = project(
            bounds.south + ((bounds.north - bounds.south) * row) / STEPS,
            bounds.west + ((bounds.east - bounds.west) * column) / STEPS,
          );
          if (!inFrame(at)) continue;

          const side = agreedSide(
            coast,
            at,
            REACH_M * metre,
            SLACK,
            off,
            toward,
          );
          if (side === null) continue;
          if (shaded(wash, at) !== (side === "sea")) missed += 1;
        }
      }

      if (missed > 0) {
        wrong.push(`${beach.slug}: ${missed} samples washed wrongly`);
      }
    }

    expect(wrong).toEqual([]);
  },
);
