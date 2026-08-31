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

/**
 * The same box grown on one side until it is square on the ground.
 *
 * **This is where the empty space is decided, and it is decided here rather
 * than in the projection.** `projectionFor` letterboxes a non-square box into a
 * square frame and splits the leftover evenly, which puts half of it inland on
 * a map whose whole subject is which side the water is on. Squaring the box
 * toward the sea first means the projection has no leftover to split: the
 * growth is real mapped ocean rather than blank padding, so the sea wash covers
 * it and the coast sits against the landward edge.
 *
 * The alternative was a bias inside `projectionFor`, which would have made a
 * generic mapping know which of its two axes was the sea — a fact about a
 * coastline, in a function that deliberately knows only about boxes.
 *
 * Unchanged when the box is already square, and unchanged when the caller has
 * no seaward direction to offer: a beach with no traced coast has no land-sea
 * split to bias toward, so an even letterbox is the honest frame for it.
 */
export function squareToward(
  bounds: Bounds,
  toward: { east: number; north: number },
): Bounds {
  const lonScale = Math.cos(
    (((bounds.south + bounds.north) / 2) * Math.PI) / 180,
  );
  const spanLat = bounds.north - bounds.south;
  const spanLon = (bounds.east - bounds.west) * lonScale;

  if (spanLon < spanLat) {
    const grow = (spanLat - spanLon) / lonScale;
    return toward.east >= 0
      ? { ...bounds, east: bounds.east + grow }
      : { ...bounds, west: bounds.west - grow };
  }

  if (spanLat < spanLon) {
    const grow = spanLon - spanLat;
    return toward.north >= 0
      ? { ...bounds, north: bounds.north + grow }
      : { ...bounds, south: bounds.south - grow };
  }

  return bounds;
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
 * One degree of latitude, in metres. The only ground unit this module needs.
 *
 * Flat arithmetic with the same cosine correction `projectionFor` and
 * `boundsAround` use, rather than the haversine in `scripts/geo.mjs`. That file
 * is build-side and runs once against every beach; this runs per request
 * against one, and a second distance convention inside one module is how two
 * functions come to disagree about the same coast. At this coast's scale the
 * two differ by less than the 98 m spacing of the points being measured.
 */
const METRES_PER_DEGREE = 111_320;

function metresBetween(a: Position, b: Position): number {
  const lonScale = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dx = (a.lon - b.lon) * lonScale;
  const dy = a.lat - b.lat;
  return Math.hypot(dx, dy) * METRES_PER_DEGREE;
}

/**
 * The point of the polyline nearest a position, and how far away it is.
 *
 * **The distance is returned because the caller has to be able to decline.**
 * This file traces the open coast, so asking it for the nearest point to a
 * Mission Bay beach gets an answer 4.9 km away that is somebody else's
 * shoreline. A nearest-point search with no distance is a search that always
 * succeeds, and the caller then draws whatever it found.
 *
 * Null on an empty polyline, which is a caller that has nothing to search
 * rather than a place with no coast.
 */
export function nearestOn(
  points: readonly ShorePoint[],
  at: Position,
): { index: number; metres: number } | null {
  if (points.length === 0) return null;

  let best = Infinity;
  let index = 0;
  points.forEach((point, at_) => {
    const metres = metresBetween(at, point);
    if (metres < best) {
      best = metres;
      index = at_;
    }
  });
  return { index, metres: best };
}

/**
 * The stretch of polyline around an index that no gap interrupts.
 *
 * **The file is ordered by line id, and consecutive ids are not always
 * neighbours on the ground.** Measured across the 1,086 steps: most are about
 * 98 m, 25 exceed 300 m, and exactly one is 2,967 m — `D0226` to `D0228`,
 * across the mouth of San Diego Bay, where the model places no lines because
 * there is no open coast to place them on. Nine steps exceed 500 m and each is
 * a harbour or river mouth of the same kind.
 *
 * A run that crosses one of those draws a straight stroke over open water and
 * calls it shoreline. `coronado-north-beach` did exactly that: its two ends
 * landed on opposite sides of the bay mouth, so the stretch marking a 2.8 km
 * beach was a 4.9 km V with a 3 km diagonal across the channel.
 *
 * This is the same class of problem as the zero-length segments this module
 * already removes, and it is answered the same way: the geometry is made
 * answerable before anything is asked of it. A zero-length step has no
 * direction; a three-kilometre step has no shore.
 */
export function unbrokenAround(
  points: readonly ShorePoint[],
  index: number,
  gapMetres: number,
): { from: number; to: number } {
  let from = Math.max(0, Math.min(index, points.length - 1));
  let to = from;

  while (
    from > 0 &&
    metresBetween(points[from - 1], points[from]) <= gapMetres
  ) {
    from -= 1;
  }
  while (
    to < points.length - 1 &&
    metresBetween(points[to], points[to + 1]) <= gapMetres
  ) {
    to += 1;
  }

  return { from, to };
}

/**
 * The run between two points of the polyline, grown outward to a minimum length
 * of shore.
 *
 * **A length of coast rather than a count of points**, because the points are
 * an artifact of CDIP's grid and the picture is of a shoreline. They sit at
 * about 98 m, so the two are close — and "about" is exactly the word that makes
 * a count the wrong unit for a rule stated in the ground.
 *
 * **It grows from both ends alternately**, so a beach stays in the middle of
 * the context it is given rather than being pushed against one end of it. Where
 * the polyline runs out on one side — the county's two ends — the other side
 * takes the remainder, which is the honest answer: there is no more coast to
 * show, and the map should not pretend by centring on emptiness.
 *
 * Returns the run unchanged when it is already long enough, so a beach longer
 * than the minimum sets its own frame.
 */
export function runAround(
  points: readonly ShorePoint[],
  fromIndex: number,
  toIndex: number,
  minimumMetres: number,
  within: { from: number; to: number } = {
    from: 0,
    to: Math.max(0, points.length - 1),
  },
): readonly ShorePoint[] {
  if (points.length === 0) return [];

  const last = Math.min(points.length - 1, within.to);
  const start = Math.max(0, within.from);
  let from = Math.max(start, Math.min(fromIndex, toIndex));
  let to = Math.min(last, Math.max(fromIndex, toIndex));

  let length = 0;
  for (let index = from; index < to; index += 1) {
    length += metresBetween(points[index], points[index + 1]);
  }

  while (length < minimumMetres && (from > start || to < last)) {
    if (from > start) {
      length += metresBetween(points[from - 1], points[from]);
      from -= 1;
    }
    if (length >= minimumMetres) break;
    if (to < last) {
      length += metresBetween(points[to], points[to + 1]);
      to += 1;
    }
  }

  return points.slice(from, to + 1);
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

/**
 * How much room a beach's map leaves around its sources, as a fraction of the
 * larger span.
 *
 * Named here rather than at the call site because two things have to agree
 * about it. `ShoreMap` frames the window it draws; the `sea-side` gate row
 * checks which side of that window the water is on, and a wider frame reaches
 * more coast and can change which segment is nearest a buoy. A checker run
 * against a window the map does not draw would be checking a different claim.
 *
 * `scripts/sea-side.mjs` spells the number a second time, because it runs under
 * plain node and cannot import this file; `sea-side.test.mjs` asserts the two
 * are equal, so the pair cannot drift silently.
 *
 * 0.1 rather than more, measured. Raising it to reach the 23 beaches with no
 * coast in frame costs the beaches that have one: at 0.1 La Jolla Shores fills
 * 83 percent of its map's height, at 0.5 it fills 50 percent, and at 1.0 it
 * fills 33 while Mission Beach's frame reaches 51 km. Half-fixing the bay
 * beaches by shrinking every open-coast beach is the wrong trade, and the bay
 * beaches are answered by saying so instead.
 */
export const SHORE_WINDOW_MARGIN = 0.1;
