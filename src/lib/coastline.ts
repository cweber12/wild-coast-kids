/**
 * The county coastline as a drawable polyline, from the MOP lines already
 * committed.
 *
 * `mop-lines.json` holds 1,210 CDIP model lines at about 98 m spacing, keyed
 * `D0001` upward and ordered south to north. `beaches.ts` reads that table one
 * key at a time, to answer "which line does this beach bind". Nothing has ever
 * read it as a *shape* before, and reading it as a shape is what this module is
 * for.
 *
 * **The de-duplication is not housekeeping.** 123 of the 1,210 repeat their
 * neighbour's coordinates exactly, so a polyline built straight from the file
 * carries 123 zero-length segments. A zero-length segment has no direction, so
 * every tangent is undefined there and every left-or-right test against it
 * returns whatever the arithmetic happens to produce — which already gave one
 * wrong answer while this work was being scoped. Removing them first is what
 * makes the geometry below answerable at all.
 *
 * **Not `scripts/geo.mjs`.** That is build-side JavaScript for the joins that
 * produced `beaches.json`, and it runs once, offline, against every beach. This
 * is runtime TypeScript that runs per request against one.
 */

import mopLineTable from "@/data/mop-lines.json";
import type { MopLine } from "./beaches";

const MOP_LINES = mopLineTable.lines as Readonly<Record<string, MopLine>>;

/** One point on the drawn coast, keeping the line id that placed it. */
export interface ShorePoint {
  /** The MOP line id this came from, so a marker can name what it marks. */
  readonly id: string;
  readonly lat: number;
  readonly lon: number;
}

/**
 * The whole county coast, walked south to north, with consecutive duplicates
 * removed.
 *
 * The **first** of each run of repeats is the one kept. That choice is safe to
 * make rather than merely convenient: no beach in `beaches.json` binds a line
 * that this drops, so no marker loses the point it names. A later run that
 * changed that would fail the pinned count in this module's test before it
 * could fail silently on a page.
 */
export function coastline(): readonly ShorePoint[] {
  return withoutRepeats(
    Object.keys(MOP_LINES).map((id) => ({
      id,
      lat: MOP_LINES[id].lat,
      lon: MOP_LINES[id].lon,
    })),
  );
}

/** A lat/lon box a map has to cover. */
export interface Bounds {
  readonly south: number;
  readonly north: number;
  readonly west: number;
  readonly east: number;
}

/** Anything the map has to keep in frame: a segment end, a station, a buoy. */
export interface Position {
  readonly lat: number;
  readonly lon: number;
}

/**
 * The box that holds every position, with an even margin, or null when there is
 * no box to draw.
 *
 * **The margin is a fraction of the larger span, in ground distance rather than
 * in degrees.** Adding the same number of degrees to both axes would put 15
 * percent less sea beside this coast than sky above it, because a degree of
 * longitude is shorter here — so the fraction is converted through the same
 * cosine `projectionFor` uses, and the two agree by construction.
 *
 * **Null when every position is the same place.** `mission-bay-vacation-isle`
 * carries a segment whose upper equals its lower, so this is a committed row
 * rather than a hypothetical: a zero-span box divides by zero in the projection
 * and draws a coast at infinite magnification. The caller renders an absence
 * and says why, which is what that beach is owed.
 *
 * No minimum span, because none is needed: measured across all 51 beaches with
 * their four sources, the tightest box is `shoreline-park` at 1.8 km and the
 * widest `mission-beach` at 17 km. A floor would be a constant standing in for
 * a case the data does not contain.
 */
export function boundsAround(
  positions: readonly Position[],
  margin: number,
): Bounds | null {
  if (positions.length === 0) return null;

  const lats = positions.map((position) => position.lat);
  const lons = positions.map((position) => position.lon);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lons);
  const east = Math.max(...lons);

  if (south === north && west === east) return null;

  const lonScale = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const pad = margin * Math.max(north - south, (east - west) * lonScale);

  return {
    south: south - pad,
    north: north + pad,
    west: west - pad / lonScale,
    east: east + pad / lonScale,
  };
}

/** A point on the drawn plot, in the caller's own units. */
export interface PlotPoint {
  readonly x: number;
  readonly y: number;
}

/** The box a projection fits its bounds into. */
export interface PlotSize {
  readonly width: number;
  readonly height: number;
}

/** Places any position on the plot. See `projectionFor`. */
export type Project = (lat: number, lon: number) => PlotPoint;

/**
 * One mapping from lat/lon onto a plot box, for everything the map draws.
 *
 * **A value rather than a transform over the polyline**, because the coast is
 * not the only thing placed: the beach's own segment, the MOP line, the wave
 * buoy, the tide station and the air station all go on the same picture, and a
 * marker plotted by different arithmetic from the coast beside it is a marker
 * in the wrong place. ADR-0010's requirement is that a reader can tell which
 * station supplied which number; drawing them at their real distances only
 * discharges it if the distances are real.
 *
 * **Equirectangular, corrected by cosine, and no more than that.** A degree of
 * longitude covers cos(latitude) of a degree of latitude on the ground — 0.847
 * at 32.1 degrees north — so plotting raw degrees would stretch this coast
 * east to west by 18 percent and bend it. The correction is one multiplication.
 * Anything more principled is a projection library, and ADR-0025 has already
 * answered what this page spends a dependency on.
 *
 * **The fit letterboxes rather than stretches.** Whichever axis is the tighter
 * fit sets the scale and the other is centred, so the shape is preserved and
 * the whole box is reachable. Filling the frame instead would distort the coast
 * differently on every beach.
 */
export function projectionFor(bounds: Bounds, size: PlotSize): Project {
  const midLat = (bounds.south + bounds.north) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);

  const spanLat = bounds.north - bounds.south;
  const spanLon = (bounds.east - bounds.west) * lonScale;

  const scale = Math.min(size.width / spanLon, size.height / spanLat);
  const padX = (size.width - spanLon * scale) / 2;
  const padY = (size.height - spanLat * scale) / 2;

  return (lat, lon) => ({
    x: padX + (lon - bounds.west) * lonScale * scale,
    // North is up, so latitude runs the opposite way to y.
    y: padY + (bounds.north - lat) * scale,
  });
}

/**
 * The run of coastline that reaches a box, plus one point past each end.
 *
 * **The overhang is the point of the function.** Clipping to exactly what falls
 * inside draws a coast that stops short of the frame with sea on both sides of
 * its ends, which reads as the land ending rather than as the map ending. One
 * point beyond means the stroke leaves the frame and the reader's eye continues
 * it.
 *
 * Returns the points between the first and last that fall inside, so a run that
 * dips out of the box and back in stays whole rather than becoming two strokes
 * with a gap. Empty when the box reaches no point at all, which is a coast this
 * file does not trace rather than a coast that is not there — a caller must say
 * so rather than drawing nothing.
 */
export function windowAround(
  points: readonly ShorePoint[],
  bounds: Bounds,
): readonly ShorePoint[] {
  const inside = (point: ShorePoint): boolean =>
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lon >= bounds.west &&
    point.lon <= bounds.east;

  const first = points.findIndex(inside);
  if (first === -1) return [];

  let last = first;
  for (let index = points.length - 1; index > first; index -= 1) {
    if (inside(points[index])) {
      last = index;
      break;
    }
  }

  return points.slice(
    Math.max(0, first - 1),
    Math.min(points.length, last + 2),
  );
}

/**
 * The same run of points with every consecutive repeat dropped.
 *
 * Separate from `coastline` because it is the part with a rule in it, and a
 * rule that can only be exercised through a 1,210-entry data file is a rule
 * nobody can write a case for. Only *consecutive* repeats go: two points that
 * coincide at opposite ends of the county are two real places, and collapsing
 * them would join the coast to itself.
 */
export function withoutRepeats(
  points: readonly ShorePoint[],
): readonly ShorePoint[] {
  const kept: ShorePoint[] = [];

  for (const point of points) {
    const last = kept[kept.length - 1];
    if (last && last.lat === point.lat && last.lon === point.lon) continue;
    kept.push(point);
  }

  return kept;
}

/** Which side of a walked polyline a position falls on, north being up. */
export type Side = "left" | "right";

/**
 * The side of a run of coast a position falls on, or null when there is no run.
 *
 * **This is how the map knows which side to shade, and it is the one geometric
 * claim on the page that is checked rather than assumed.** The county coast
 * faces west and `mop-lines.json` runs south to north, so "left of the walk"
 * and "out to sea" are the same side — and the `sea-side` gate row proves that
 * against every committed wave buoy rather than leaving it to this comment.
 *
 * **Measured against the nearest segment, not the nearest point.** A vertex at
 * a bend belongs to two segments pointing different ways, so picking by vertex
 * picks an orientation by luck. The zero-length segments `withoutRepeats`
 * removes are the same failure in its acute form: no length, no direction, and
 * a side test that returns whatever the arithmetic produces.
 *
 * **The nearest segment must come from a window, not the whole county.** Walked
 * end to end the file is not monotonic — it wraps Point Loma, and 39 of its
 * 1,209 steps run north to south. Buoy 46232 sits 22.9 km off that peninsula
 * and matches a segment on the wrap, where left is not seaward. Inside a
 * beach's own window the question is well posed, which is the only place the
 * map ever asks it.
 *
 * **Left here is geographic, not `x` and `y`.** `projectionFor` puts north at
 * the top, so y grows southward and a caller drawing in plot coordinates sees
 * this side on the other hand. Converting is the caller's job, once.
 */
export function sideOf(
  points: readonly ShorePoint[],
  at: Position,
): Side | null {
  const lonScale = Math.cos((at.lat * Math.PI) / 180);
  const east = (lon: number): number => lon * lonScale;

  let nearest = Infinity;
  let cross = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];

    const dx = east(to.lon) - east(from.lon);
    const dy = to.lat - from.lat;
    const length = dx * dx + dy * dy;
    // Looks removable and is not. Without it a repeated point divides by zero,
    // and the NaN that follows is swallowed by `distance < nearest` being false
    // for NaN -- so the answer is right today by accident of one comparison
    // operator. Deleting this passes every test in this file; that is a blind
    // spot in the tests rather than evidence the line is dead.
    if (length === 0) continue;

    const px = east(at.lon) - east(from.lon);
    const py = at.lat - from.lat;

    // Clamped, so a position past an end measures to the end rather than to the
    // segment's infinite line, which would run off across the land.
    const along = Math.min(1, Math.max(0, (px * dx + py * dy) / length));
    const offX = px - along * dx;
    const offY = py - along * dy;
    const distance = offX * offX + offY * offY;

    if (distance < nearest) {
      nearest = distance;
      cross = dx * py - dy * px;
    }
  }

  if (cross === 0) return null;
  return cross > 0 ? "left" : "right";
}
