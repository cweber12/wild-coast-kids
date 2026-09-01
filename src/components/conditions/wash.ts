/**
 * The sea, as a polygon that closes on the frame rather than on the coast.
 *
 * **`ShoreMap` shades one side of the drawn shore, and this decides which side
 * and how far.** It is plot-space geometry only: it is handed the coast already
 * projected and the box it is being drawn into, and it knows nothing about
 * latitude, beaches or the county. `needles.ts` sits beside `Compass.tsx` for
 * the same reason — the part with a rule in it is separable from the part that
 * renders, and only one of the two can be wrong in an interesting way.
 *
 * **Which side is seaward is read from the walk, not from a direction.** The
 * proven property is that this coast, walked south to north, has the sea on its
 * left; `scripts/sea-side.mjs` holds it against every committed wave buoy. So
 * the wash needs no seaward vector of its own: it takes the side the walk
 * itself gives, which is exactly what "left of the walk" means. `shore.ts`
 * still computes one, because `squareToward` has to know which way to grow the
 * box, and that is the only thing left that needs an answer as a direction.
 *
 * **It used to close on a normal taken across the run's two ends**, which was
 * exact on a straight shore and approximate on a bent one. The approximation
 * was asked to do more once ADR-0039 gave the bays their own shoreline, because
 * a bay shore turns through more than a right angle inside one frame and no
 * single normal describes both arms. Measured over the 50 beaches with a coast,
 * on a 61-by-61 grid per frame: 834 of 121,794 samples were shaded on the wrong
 * side of their own shore, across ten beaches, worst `coronado-city-beaches` at
 * 25.4 percent of its frame. Ten closing edges reached inside a frame, across
 * eight beaches. Both are zero here. See ADR-0041.
 */

import type { PlotPoint, PlotSize } from "@/lib/coastline";

/**
 * How far outside everything drawn the closing box sits, as a fraction of its
 * larger span.
 *
 * It only has to be more than nothing: the box has to *contain* the frame and
 * every drawn point strictly, so that a run continued from either end leaves it
 * through exactly one edge. A tenth is far enough to be clear of rounding and
 * near enough that the numbers in the emitted path stay readable.
 */
const CLEARANCE = 0.1;

/** A box in plot space, which is the only shape this file closes against. */
type Box = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

/**
 * A box holding the frame and every drawn point, with room to spare.
 *
 * **The frame is in the arithmetic as well as the coast**, which is the whole
 * of this file's correction. The coast can be drawn well outside the box it is
 * framed in — `windowAround` returns a point past each end on purpose, and on a
 * bay run that point can be a long way off — so a closure measured only against
 * the coast can still fall across the picture. Measured before this changed, it
 * did, on eight beaches.
 */
function boxAround(coast: readonly PlotPoint[], size: PlotSize): Box {
  const xs = [0, size.width, ...coast.map((point) => point.x)];
  const ys = [0, size.height, ...coast.map((point) => point.y)];

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const room = CLEARANCE * Math.max(maxX - minX, maxY - minY);

  return {
    minX: minX - room,
    minY: minY - room,
    maxX: maxX + room,
    maxY: maxY + room,
  };
}

/** Where a ray from inside the box crosses its edge. */
function leavingAt(box: Box, from: PlotPoint, along: PlotPoint): PlotPoint {
  const toX =
    along.x > 0
      ? (box.maxX - from.x) / along.x
      : along.x < 0
        ? (box.minX - from.x) / along.x
        : Infinity;
  const toY =
    along.y > 0
      ? (box.maxY - from.y) / along.y
      : along.y < 0
        ? (box.minY - from.y) / along.y
        : Infinity;

  const reach = Math.min(toX, toY);
  return { x: from.x + along.x * reach, y: from.y + along.y * reach };
}

/**
 * How far round the box's edge a point on it sits, in corners.
 *
 * Zero at the top-left corner and rising clockwise, so a whole number is a
 * corner and the walk between two points is a difference. It is the only thing
 * that makes "follow the edge from here to there" expressible without four
 * cases.
 */
function wayRound(box: Box, at: PlotPoint): number {
  const across = box.maxX - box.minX;
  const down = box.maxY - box.minY;
  const touching = 1e-9 * Math.max(across, down);

  if (Math.abs(at.y - box.minY) <= touching) return (at.x - box.minX) / across;
  if (Math.abs(at.x - box.maxX) <= touching)
    return 1 + (at.y - box.minY) / down;
  if (Math.abs(at.y - box.maxY) <= touching)
    return 2 + (box.maxX - at.x) / across;
  return 3 + (box.maxY - at.y) / down;
}

/** The box's four corners, in the order `wayRound` counts them. */
function cornersOf(box: Box): readonly PlotPoint[] {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
}

const round = (turns: number): number => ((turns % 4) + 4) % 4;

/** The corners passed walking the box's edge from one place to another. */
function cornersFrom(
  box: Box,
  from: number,
  to: number,
  way: 1 | -1,
): readonly PlotPoint[] {
  const span = way > 0 ? round(to - from) : round(from - to);

  return cornersOf(box)
    .map((corner, index) => ({
      corner,
      passed: way > 0 ? round(index - from) : round(from - index),
    }))
    .filter((each) => each.passed > 0 && each.passed < span)
    .sort((a, b) => a.passed - b.passed)
    .map((each) => each.corner);
}

/**
 * Whether a closed ring holds the ground to the left of its own walk.
 *
 * Twice the signed area, by the shoelace sum. The sign is the whole point: the
 * coast divides the box in two and the two ways round the edge give those two
 * halves, so this is what tells them apart — no probe point, no seaward vector,
 * and nothing that has to be right about San Diego in particular.
 *
 * **Negative is left, because y grows downward here.** `projectionFor` puts
 * north at the top, so the plot is a mirror of the usual orientation and the
 * sign of the usual test flips with it. For a walk (dx, dy) the seaward side is
 * (dy, -dx), and a ring holding that side sums negative.
 */
function holdsTheLeft(ring: readonly PlotPoint[]): boolean {
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const from = ring[index];
    const to = ring[(index + 1) % ring.length];
    sum += from.x * to.y - to.x * from.y;
  }
  return sum < 0;
}

/**
 * Which way the shore was heading when it reached one of its ends.
 *
 * Reads outward from the end until two points differ, so a repeated point
 * cannot hand back a direction of zero length. Null when every point is the
 * same place, which is a run with no direction at all.
 */
function headingOut(
  coast: readonly PlotPoint[],
  from: number,
  step: 1 | -1,
): PlotPoint | null {
  const end = coast[from];

  for (
    let index = from + step;
    index >= 0 && index < coast.length;
    index += step
  ) {
    const dx = end.x - coast[index].x;
    const dy = end.y - coast[index].y;
    if (dx === 0 && dy === 0) continue;

    const length = Math.hypot(dx, dy);
    return { x: dx / length, y: dy / length };
  }

  return null;
}

/**
 * The sea as a ring of points, or null when the coast gives no direction.
 *
 * The shore is carried straight off both ends to the closing box, and the box's
 * edge is then walked whichever way holds the water. Exact for any shape the
 * shore takes, including one that turns back on itself, because nothing in it
 * approximates the coast by a line: the coast *is* the boundary, and the only
 * invented geometry is off the picture.
 *
 * **The two continuations are the one thing drawn that the source does not
 * say.** Where the traced shore runs out inside the frame — which is
 * `border-field-state-park`, at the Mexican border, where the committed ring
 * begins — the wash has to reach the edge somehow, and it does it along the
 * line the shore was on. Stopping instead would leave a wedge of unshaded
 * water, which is the defect this file exists to remove.
 */
export function seaWash(
  coast: readonly PlotPoint[],
  size: PlotSize,
): readonly PlotPoint[] | null {
  if (coast.length < 2) return null;

  const back = headingOut(coast, 0, 1);
  const on = headingOut(coast, coast.length - 1, -1);
  if (back === null || on === null) return null;

  const box = boxAround(coast, size);
  const from = leavingAt(box, coast[0], back);
  const to = leavingAt(box, coast[coast.length - 1], on);

  const shore = [from, ...coast, to];
  const start = wayRound(box, to);
  const finish = wayRound(box, from);

  const clockwise = [...shore, ...cornersFrom(box, start, finish, 1)];
  return holdsTheLeft(clockwise)
    ? clockwise
    : [...shore, ...cornersFrom(box, start, finish, -1)];
}
