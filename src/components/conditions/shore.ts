/**
 * What one beach's map is made of, assembled from the joins already committed.
 *
 * `ShoreMap` is presentational and pure — it takes a window, a box and a list
 * of markers. This is the half that knows what a buoy is: it resolves the four
 * sources through `beaches.ts`, words each one the way the rest of the page
 * words it, and windows the county coast down to what this beach can see.
 *
 * The split is `series.ts`'s, one region over: the assembler reads, the
 * component draws, and neither does the other's job.
 *
 * **Nothing here computes a distance.** Every figure comes off `beaches.json`,
 * where the joins measured it once, offline, and `--check` can reproduce it.
 * Recomputing at request time would be a second answer to a question already
 * answered, and the two could disagree.
 */

import type { Beach } from "@/lib/beaches";
import {
  airStationFor,
  mopLineFor,
  tideStationFor,
  waveBuoyFor,
} from "@/lib/beaches";
import type { Bounds, Position, ShorePoint } from "@/lib/coastline";
import {
  boundsAround,
  coastline,
  SHORE_WINDOW_MARGIN,
  windowAround,
} from "@/lib/coastline";
import { MOP_NETWORK, mopLineSource } from "./mopLine";
import type { ShoreMarker } from "./ShoreMap";
import { TIDE_NETWORK } from "./tideStation";

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
  markers: readonly ShoreMarker[];
};

/**
 * How far a source stands, for the map, in kilometres and already rounded.
 *
 * **Always stated, unlike on a card, and that is the difference the map makes.**
 * `tideStationDistanceKm` withholds anything under 5 km and the sea card
 * withholds a near buoy, both for the same good reason: beside a figure, "0.3
 * km" adds nothing a reader came for. Beside a *picture of the distances* it is
 * the caption. A marker drawn a third of the way across the frame with no
 * number under it asks the reader to estimate the thing the map exists to say.
 *
 * The rounding is `MeasuredToday`'s, deliberately: one decimal under 10 km
 * where the difference between 1.4 and 1.8 is a different walk, whole
 * kilometres above it where a decimal would be false precision about a station
 * in the next bay. Spelled here rather than imported because it is private to
 * that component; lifting it into a shared module is a refactor of two files
 * and belongs to its own slice.
 *
 * **The whole-kilometre half is unreachable through the committed inventory**,
 * where the furthest source is 9.2 km, and it is kept and tested directly
 * anyway. The rule is one statement about how a distance is worded, the cards
 * already word it both ways, and a map that agreed with them only up to 10 km
 * would be a second rule wearing the first one's clothes. Exported for that
 * test, which is the only caller outside this file.
 */
export function shoreDistanceKm(metres: number | null): string | null {
  if (metres === null) return null;
  const km = metres / 1000;
  return km < 10 ? km.toFixed(1) : km.toFixed(0);
}

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
 * Null when the window holds no coast — 23 of 51 beaches — and null when the
 * two ends land on the same point, which is `mission-bay-vacation-isle`, whose
 * upper equals its lower.
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
    the only thing that says where the beach is. Without it the 23 bay maps are
    markers floating in an empty frame, which is the one question the picture
    has to answer.
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
 * The four sources, in the order they are drawn and listed.
 *
 * Nearest-first is not the order: the list reads sea, then shore, then air,
 * which is the order the page already introduces them in and the order the
 * measured block puts them in. A list re-sorted by distance would change from
 * beach to beach and stop being learnable.
 *
 * A source the join did not bind is absent from this list rather than present
 * and empty. `ShoreMap` turns the absence into a sentence, because 26 of 51
 * beaches bind no MOP line and 36 bind no wave buoy, and a map quietly short a
 * marker reads as a map whose buoy is off-frame.
 */
function markersFor(beach: Beach): ShoreMarker[] {
  const markers: ShoreMarker[] = [];

  const mopLine = mopLineFor(beach);
  if (mopLine !== null) {
    markers.push({
      kind: "mop-line",
      source: mopLineSource(mopLine.id),
      network: MOP_NETWORK,
      distanceKm: shoreDistanceKm(beach.mop_line_distance_m),
      lat: mopLine.lat,
      lon: mopLine.lon,
    });
  }

  const buoy = waveBuoyFor(beach);
  if (buoy !== null) {
    markers.push({
      kind: "wave-buoy",
      source: `Buoy ${buoy.name}`,
      network: "NDBC",
      distanceKm: shoreDistanceKm(beach.wave_buoy_distance_m),
      lat: buoy.lat,
      lon: buoy.lon,
    });
  }

  const tide = tideStationFor(beach);
  if (tide !== null) {
    markers.push({
      kind: "tide-station",
      source: tide.name,
      network: TIDE_NETWORK,
      distanceKm: shoreDistanceKm(beach.tide_station_distance_m),
      lat: tide.lat,
      lon: tide.lon,
    });
  }

  const air = airStationFor(beach);
  if (air !== null) {
    markers.push({
      kind: "air-station",
      // `display_name` and never `name`: the published one is a callsign for
      // most of these, which is the distinction that field exists to make.
      source: air.display_name,
      // No network, and not a guess. An air station may be on the NWS or the
      // NDBC network and the binding does not record which, so the air card has
      // never named one either.
      network: null,
      distanceKm: shoreDistanceKm(beach.air_station_distance_m),
      lat: air.lat,
      lon: air.lon,
    });
  }

  return markers;
}

/**
 * One beach's map, ready to draw.
 *
 * The window is framed on the sources rather than on the sand, so a station 9
 * km away puts itself in the picture at 9 km. That is what makes this ADR-0010
 * drawn rather than written, and it is why `mission-beach` gets a 20 km frame
 * in which its own beach is a fifth of the height.
 */
export function shoreViewFor(beach: Beach): ShoreView {
  const markers = markersFor(beach);
  const bounds = boundsAround(
    [beach.segment.upper, beach.segment.lower, ...markers],
    SHORE_WINDOW_MARGIN,
  );

  const coast = bounds === null ? [] : windowAround(coastline(), bounds);

  return {
    coast,
    bounds,
    segment: beachStretch(coast, beach),
    markers,
  };
}
