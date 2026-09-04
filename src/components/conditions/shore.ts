/**
 * What one beach's map is made of, assembled from the joins already committed.
 *
 * `ShoreMap` is presentational and pure — it takes a window, a box and this
 * beach's own stretch. This is the half that knows what a beach is: it windows
 * the county coast down to what this beach can see, and finds the run of it the
 * beach occupies.
 *
 * The split is `series.ts`'s, one region over: the assembler reads, the
 * component draws, and neither does the other's job.
 *
 * **Nothing here computes a distance, because nothing here states one.** The
 * map used to plot the four sources at their real distances and caption each
 * with a figure off `beaches.json`. It does not any more — the page names every
 * source in words, under the group it belongs to, which is what ADR-0010 asks
 * for and always was.
 */

import { allBeaches, type Beach } from "@/lib/beaches";
import type { Area } from "@/lib/areas";
import type { Bounds, Position, ShorePoint } from "@/lib/coastline";
import {
  boundsAround,
  coastline,
  nearestOn,
  runAround,
  unbrokenAround,
  SHORE_WINDOW_MARGIN,
  squareToward,
  windowAround,
} from "@/lib/coastline";

/** Everything `ShoreMap` needs, and nothing it has to look up for itself. */
export type ShoreView = {
  coast: readonly ShorePoint[];
  bounds: Bounds | null;
  /**
   * Where this beach is, drawn heavier than anything around it.
   *
   * The run of `coast` it occupies where there is a coast, and its own two ends
   * where there is not. See `beachStretch`.
   */
  segment: readonly Position[] | null;
};

/**
 * Where this beach is on its own map, or null when it has no extent to draw.
 *
 * **A run of the polyline, never a chord, wherever a coast is drawn.**
 * `beaches.json` carries the beach's bounding extent, and neither end is a
 * point on the MOP line: drawing a straight stroke between them puts a second,
 * heavier shore beside the real one at an angle to it, which is what it did the
 * first time. Marking the coast the beach actually occupies says the same thing
 * and says it on the shape a reader is looking at.
 *
 * Null when the window holds no coast, and null when the two ends land on the
 * same point, which is `mission-bay-vacation-isle`, whose upper equals its
 * lower.
 */
function beachStretch(
  run: CoastRun | null,
  beach: Beach,
): readonly Position[] | null {
  const { upper, lower } = beach.segment;
  const hasExtent = upper.lat !== lower.lat || upper.lon !== lower.lon;

  /*
    No coast to mark a run of, so the beach's own two ends are drawn instead.
    The objection to a chord is that it competes with a drawn shore at an angle
    to it; where no shore is drawn there is nothing to compete with, and this is
    the only thing that says where the beach is. Without it the bay maps are an
    empty frame, which is the one question the picture has to answer.
  */
  if (run === null) return hasExtent ? [lower, upper] : null;

  return run.stretch;
}

/**
 * Farther than this from the traced shore and a beach has no coast to draw.
 *
 * **It stopped separating the open coast from the bays, because the traced
 * shore stopped making that distinction.** Under ADR-0037 this was measured
 * against the model line and reproduced the 28/23 split ADR-0033 and ADR-0036
 * document: a kilometre sat in a wide gap between the beaches CDIP places a
 * line for and the ones in Mission Bay and San Diego Bay. ADR-0039 draws the
 * bays, so there is no longer a partition for it to reproduce, and this becomes
 * what its name always said — the distance past which there is nothing to draw.
 *
 * **Measured, and the gap it sits in is wider than the old one.** Every beach
 * in the inventory is within 36.7 m of the traced shore except
 * `mission-bay-vacation-isle`, which is 416 m from it. Nothing lies between.
 *
 * **The one it excludes is the one that must be excluded**, which is why the
 * threshold is not simply dropped. Vacation Isle is on an island, and the
 * committed shoreline holds the mainland ring only, so its nearest shore is
 * across a channel. Admitted, it would take a run on the far bank, frame on it,
 * and draw the heavy "this is your beach" stroke on somebody else's shoreline.
 * Excluded, it falls back to its own two ends -- which are a single point, so
 * `boundsAround` returns null and the page renders an absence, which is what
 * that beach has always been owed.
 *
 * 200 m rather than 100 or 400: it is the middle of the gap, so neither a beach
 * drifting tens of metres nor the island drifting a hundred crosses it quietly.
 */
const COAST_REACH_M = 200;

/**
 * The least shore a map shows, when the beach itself is shorter than this.
 *
 * The number ADR-0036 says will be argued about, in the one place it is stated.
 * At 2 km `la-jolla-cove` uses 47 percent of its frame's height where it used
 * 23, and nothing in the inventory is clipped. Larger makes a small beach a
 * detail inside somebody else's coastline; smaller stops showing enough shore
 * for the bend a reader is orienting by.
 *
 * A beach longer than this keeps its own run, so the rule costs the large
 * beaches nothing.
 */
const MIN_RUN_M = 2_000;

/**
 * A step longer than this is a chord across water rather than a piece of shore.
 *
 * `unbrokenAround` holds the argument; this is where the figure is chosen.
 *
 * **The figure survived ADR-0037 and its reason was replaced.** Against the
 * model line it read: the polyline steps about 98 m, so 500 m means the model
 * placed nothing for five lines running, and nine of the 1,086 steps exceeded
 * it -- each a harbour or river mouth, the largest 2,967 m at the mouth of San
 * Diego Bay.
 *
 * The traced shore is a continuous ring, so it has no gaps in that sense at
 * all, and simplifying it produced long steps for the opposite reason: a
 * straight coast needs no vertices, which left one step of 1,834 m across open
 * beach north of Oceanside. `probe-coastline.mjs` answers that by restoring
 * published vertices to a 200 m cap, which is what makes this number mean
 * something again. Measured on the committed file afterwards: steps run a
 * median 50 m, and exactly nine exceed 500 m -- the largest 970 m, and every
 * one of the nine a chord the source's "bays erased" step drew straight across
 * the entrances of San Diego Bay and Mission Bay.
 *
 * So it still separates shore from water, on a different mechanism, with the
 * same count by coincidence. Not tighter, because 133 steps fall between the
 * cap and this and every one is ordinary coast the publisher sampled sparsely.
 */
const COAST_GAP_M = 500;

/** The run of coast a map is framed on, and the part of it this beach is. */
type CoastRun = {
  /** What the frame is built from: the beach's shore plus its context. */
  points: readonly ShorePoint[];
  /** The part this beach occupies, drawn heavier. Always at least two points. */
  stretch: readonly ShorePoint[];
};

/**
 * The run of coastline this beach occupies, with enough either side to frame on.
 *
 * **Searched against the whole coastline rather than against a window**, which
 * is the correction ADR-0036 turns on. Finding the beach's ends inside a frame
 * that was itself built without reference to the coast meant a small frame
 * caught few points and the beach snapped to whichever of them was least wrong:
 * on `la-jolla-cove` the stretch was drawn beside the MOP line, about 400 m
 * from the beach.
 *
 * Null where the traced coast does not reach, which is a fact about the
 * geometry rather than a failure. That was 23 beaches until ADR-0039 and is now
 * one: `mission-bay-vacation-isle`, on an island the committed mainland ring
 * does not hold. The caller draws the beach's own ends instead — and that
 * beach's two ends are one point, so it draws nothing and says so.
 */
export function coastRunFor(beach: Beach): CoastRun | null {
  const points = coastline();
  const lower = nearestOn(points, beach.segment.lower);
  const upper = nearestOn(points, beach.segment.upper);
  if (lower === null || upper === null) return null;
  if (Math.min(lower.metres, upper.metres) > COAST_REACH_M) return null;

  /*
    Both ends are pulled onto one unbroken piece of shore before anything is
    sliced.

    Searching the whole coastline made this reachable where a small window could
    not: `coronado-north-beach` sits by the mouth of San Diego Bay, its two ends
    snapped to opposite sides of the 2,967 m gap the model leaves there, and the
    stretch marking a 2.8 km beach came out as a 4.9 km V with a three-kilometre
    diagonal drawn across the channel. The nearer end is the one to trust, so
    its own fragment is what both ends are clamped into.
  */
  const anchor = lower.metres <= upper.metres ? lower.index : upper.index;
  const whole = unbrokenAround(points, anchor, COAST_GAP_M);

  const from = Math.max(whole.from, Math.min(lower.index, upper.index));
  const to = Math.min(whole.to, Math.max(lower.index, upper.index));

  /*
    A stretch of one point draws nothing, and several beaches are shorter than
    the 98 m between the points available to mark them -- `la-jolla-cove` is
    about 70 m of shore. Taking the neighbour rather than falling back to the
    beach's own two ends keeps the heavy stroke *on* the drawn line, which is
    the whole of `beachStretch`'s argument against a chord: a stroke at an angle
    to the shore beside it reads as a second, wrong shore.
  */
  const end = to === from ? Math.min(whole.to, from + 1) : to;

  return {
    points: runAround(points, from, to, MIN_RUN_M, whole),
    stretch: points.slice(from, end + 1),
  };
}

/**
 * One beach's map, ready to draw.
 *
 * **Framed on the beach and the line off it, not on the county's instruments.**
 * The frame used to be sized by the four sources, so that a station nine
 * kilometres inland put itself in the picture at nine kilometres — ADR-0010
 * drawn rather than written. The sources are not drawn any more, and a frame
 * sized by things a reader cannot see is the kind of invisible rule this repo
 * refuses: `mission-beach`'s map was twenty kilometres tall with its own sand
 * occupying a fifth of it, for a reason nothing on the picture gave.
 *
 * **The frame is built from the coast it draws, which is ADR-0036 and reverses
 * what this docstring said before.** The bound MOP line used to be in the
 * arithmetic on the argument that it "is where the drawn coastline *is*". That
 * is true of its distance offshore and false of its displacement along shore --
 * 2.59 km at `la-jolla-community-beach` -- and along that axis it stretched the
 * frame toward a point ADR-0033 had already stopped drawing. Nothing is lost by
 * removing it: `coastline()` is built from `MOP_LINES`, so the run contains the
 * beach's own line already.
 *
 * The dependency also ran backwards. The frame decided which coastline was
 * drawn, so a frame too small to show the coast was also too small to place the
 * beach on it, and `la-jolla-cove` drew its heavy stroke 400 m from the beach.
 * The run is found first, against the whole polyline, and the frame is built
 * from it -- so the coast is in view by construction rather than by luck.
 */
/**
 * Which way the open water lies from a run of coast, as east and north parts.
 *
 * **Left of the walk**, which is this coast's own proven property: walked south
 * to north, San Diego's shore has the sea on its left. `scripts/sea-side.mjs`
 * is the gate that holds it, for every beach, against the wave buoy as ground
 * truth — so this reads a fact that is checked rather than assuming one.
 *
 * Taken from the run's two ends rather than segment by segment, because the
 * only caller is `squareToward` and a box grows in one direction: the question
 * being asked is which way the frame should lean overall, not which side of any
 * particular bend the water is on.
 *
 * **The wash used to ask the second question with this answer, and stopped.**
 * `ShoreMap` closed its polygon on a normal built the same way, which is exact
 * on a straight shore and wrong wherever one turns — so ADR-0041 gave the wash
 * a construction that reads the side from the walk itself and needs no
 * direction at all. Nothing here is shared with it now, which is why the two
 * can no longer disagree.
 *
 * Null on a run too short to have a direction, which is a beach with no traced
 * coast.
 */
export function seawardFrom(
  run: readonly ShorePoint[],
): { east: number; north: number } | null {
  if (run.length < 2) return null;

  const first = run[0];
  const last = run[run.length - 1];
  const lonScale = Math.cos((((first.lat + last.lat) / 2) * Math.PI) / 180);
  const east = (last.lon - first.lon) * lonScale;
  const north = last.lat - first.lat;
  if (east === 0 && north === 0) return null;

  // Rotate the walk a quarter turn to the left: (east, north) -> (-north, east).
  return { east: -north, north: east };
}

export function shoreViewFor(beach: Beach): ShoreView {
  const run = coastRunFor(beach);

  /*
    The beach's own two ends are in the arithmetic only where nothing else is.

    Where a coast is drawn they are not, and leaving them in was the same fault
    as leaving the MOP line in, one step further along: the sand is not drawn
    either. The stretch marking this beach is a run of the drawn line rather
    than of the sand, so including the sand stretched the box toward the land
    and the picture spent the difference on an empty band.

    ADR-0037 shrank that difference without removing the rule. The drawn line
    was CDIP's model line, a few hundred metres offshore -- at
    `coronado-central-beach` the sand sat 0.93 km inland of it. The traced shore
    puts that beach 36.7 m from the line and is the worst of the 50. The gap is
    now small enough not to distort a frame, and the reason for the rule stands:
    what the box is built from should be what the box shows.
  */
  const boxed = boundsAround(
    run === null ? [beach.segment.upper, beach.segment.lower] : run.points,
    SHORE_WINDOW_MARGIN,
  );

  const seaward = run === null ? null : seawardFrom(run.points);
  const bounds =
    boxed === null || seaward === null ? boxed : squareToward(boxed, seaward);

  /*
    Still both conditions, and the second one is no longer about the bays.

    ADR-0037 made this explicit because the traced shore reached beaches
    `coastRunFor` was declining to draw, and an empty coast that had been an
    accident of the source needed to become a decision. ADR-0039 removed the
    declining, so the only beach left is the island: no run, its own two ends
    for a frame, and those are one point -- so `bounds` is null and this returns
    empty by the first condition anyway. The second is kept because it is the
    honest statement of the rule and costs nothing.
  */
  const coast =
    run === null || bounds === null ? [] : windowAround(coastline(), bounds);

  return { coast, bounds, segment: beachStretch(run, beach) };
}

/**
 * The map an area is drawn on: its whole coast, in one square frame.
 *
 * The area counterpart of `shoreViewFor`, and deliberately the same shape --
 * `ShoreMap` is handed a window, a box and nothing it has to look up, whichever
 * scope it is drawing.
 *
 * **The frame is square, which reverses the plan that asked for the bbox's own
 * aspect.** That plan rejected a square because it "would spend two thirds to
 * four fifths of the width on slack"; measured at the map column's real width
 * of 472px, taking each area's own aspect makes Imperial Beach 1,908px tall and
 * Coronado a 199px letterbox -- a ten-fold swing, and seven of the twelve areas
 * over a thousand pixels in a 639px window. What it buys is the tightest pair
 * of marks going from 5.5px to 11.4px, on an axis the plan had already conceded
 * reads as a cluster either way. The slack is not empty either: ADR-0041's wash
 * closes on the frame, so it is drawn as sea. See ADR-0051.
 *
 * **No stretch drawn heavy, because no one beach is the subject.** `segment` is
 * null here where a beach map carries its own run. That is the zoom the plan
 * describes, and it needs no mechanism: `/conditions/<area>` gets this frame
 * and `/conditions/<area>/<beach>` gets `shoreViewFor`'s, swapped by the route.
 *
 * **The seaward direction is read off the coastline's own walk**, not off the
 * members' runs concatenated. Members are ordered north to south, so joining
 * their runs end to end makes a walk that doubles back -- and `seawardFrom`
 * takes a run's two ends, so it would answer about a chord across the doubling
 * rather than about the coast. Windowing the county line to the draft box gives
 * the walk in the order `coastline()` holds it, which is the order that
 * property is true in.
 *
 * Throws for an area naming a beach the inventory does not have, like
 * `areaSources` and for the same reason: two data files disagreeing should stop
 * a build rather than quietly draw a coast with a beach missing from it.
 */
export function shoreViewForArea(area: Area): ShoreView {
  const bySlug = new Map(allBeaches().map((beach) => [beach.slug, beach]));

  const runs = area.beaches.flatMap((slug) => {
    const beach = bySlug.get(slug);
    if (!beach) {
      throw new Error(
        `areas.json puts ${slug} in ${area.slug}, but beaches.json has no such beach.`,
      );
    }
    const run = coastRunFor(beach);
    return run === null ? [] : [run];
  });

  /*
    Built from the members' own runs rather than from their sand, which is the
    rule `shoreViewFor` states one scope down: what the box is built from should
    be what the box shows. A member the traced coast does not reach contributes
    nothing here and is still marked -- `mission-bay-vacation-isle` is the one,
    and its mark lands inside the frame its neighbours build.
  */
  const boxed = boundsAround(
    runs.flatMap((run) => run.points),
    SHORE_WINDOW_MARGIN,
  );
  if (boxed === null) return { coast: [], bounds: null, segment: null };

  const draft = windowAround(coastline(), boxed);
  const seaward = seawardFrom(draft);
  const bounds = seaward === null ? boxed : squareToward(boxed, seaward);

  return { coast: windowAround(coastline(), bounds), bounds, segment: null };
}
