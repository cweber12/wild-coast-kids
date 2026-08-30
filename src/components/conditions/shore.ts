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

import type { Beach } from "@/lib/beaches";
import { mopLineFor } from "@/lib/beaches";
import type { Bounds, Position, ShorePoint } from "@/lib/coastline";
import {
  boundsAround,
  coastline,
  SHORE_WINDOW_MARGIN,
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
  coast: readonly ShorePoint[],
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
  if (coast.length < 2) return hasExtent ? [lower, upper] : null;

  const nearest = (at: Position): number => {
    const lonScale = Math.cos((at.lat * Math.PI) / 180);
    let best = Infinity;
    let index = 0;
    coast.forEach((point, at_) => {
      const dx = (point.lon - at.lon) * lonScale;
      const dy = point.lat - at.lat;
      const distance = dx * dx + dy * dy;
      if (distance < best) {
        best = distance;
        index = at_;
      }
    });
    return index;
  };

  const from = nearest(beach.segment.lower);
  const to = nearest(beach.segment.upper);
  if (from === to) return null;

  return coast.slice(Math.min(from, to), Math.max(from, to) + 1);
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
 * The bound MOP line stays in the frame's arithmetic while being absent from
 * its drawing, and that is not the same mistake. It is not an instrument
 * standing somewhere: it is where the drawn coastline *is*, sitting 117 to 930
 * metres off the sand, so a window that excluded it would be a map of a beach
 * with the shoreline cropped off the edge. Measured across the inventory,
 * framing on the beach alone leaves 14 of 51 beaches with a coast in view;
 * framing on the beach and its line leaves 26, and the median frame falls from
 * 4.0 km to 3.1 km.
 */
export function shoreViewFor(beach: Beach): ShoreView {
  const line = mopLineFor(beach);

  const bounds = boundsAround(
    [
      beach.segment.upper,
      beach.segment.lower,
      ...(line === null ? [] : [{ lat: line.lat, lon: line.lon }]),
    ],
    SHORE_WINDOW_MARGIN,
  );

  const coast = bounds === null ? [] : windowAround(coastline(), bounds);

  return { coast, bounds, segment: beachStretch(coast, beach) };
}
