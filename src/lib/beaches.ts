/**
 * The beach inventory and the tide stations it binds to, typed.
 *
 * `src/data/beaches.json` is written by `scripts/seed-beaches.mjs` and is never
 * edited by hand: every station binding there is a join result, re-runnable and
 * diffable with `--check`. `src/data/tide-stations.json` is its counterpart, and
 * holds the one field that is written by hand — a station's water class, which
 * no upstream authority publishes and which the join needs as an input.
 *
 * Nothing here fetches anything. Reading a binding is a file read, and that is
 * the point: the join ran offline, and a reader is served its committed result.
 */

import inventory from "@/data/beaches.json";
import stationTable from "@/data/tide-stations.json";
import buoyTable from "@/data/wave-buoys.json";
import weatherTable from "@/data/weather-stations.json";

export interface Coordinate {
  lat: number;
  lon: number;
}

/**
 * A beach is a shoreline **segment**, because that is how the state publishes
 * it. Code that needs a single point has to say which end it took and why.
 */
export interface BeachSegment {
  upper: Coordinate;
  lower: Coordinate;
}

export interface Beach {
  slug: string;
  name: string;
  /** Display grouping only. Never an input to any join. */
  region: string;
  segment: BeachSegment;
  upstream: {
    usepa_id: string;
    agency: string;
    water_body_name: string;
    water_body_type: string;
    /** Upstream's own value, `UNKNOWN` for most beaches. Never a description of the shore. */
    beach_type: string;
    beach_access: string;
    status: string;
    nearest_city: string;
  };
  /** Joined, never typed. null means the join could not bind one. */
  tide_station: string | null;
  tide_station_distance_m: number | null;
  tide_station_from_end: string | null;
  /** Present exactly when tide_station is null, and required then. */
  tide_station_null_reason?: string;
  /** Joined, never typed. null for every bay, lagoon and inlet. */
  wave_buoy: string | null;
  wave_buoy_distance_m: number | null;
  wave_buoy_from_end: string | null;
  /** Present exactly when wave_buoy is null, and required then. */
  wave_buoy_null_reason?: string;
  /** Joined, never typed. Unlike the buoy, every beach binds one: air reaches a lagoon. */
  weather_station: string | null;
  weather_station_distance_m: number | null;
  weather_station_from_end: string | null;
  /** Present exactly when weather_station is null, and required then. */
  weather_station_null_reason?: string;
}

export interface WaveBuoy {
  name: string;
  cdip: string | null;
  lat: number;
  lon: number;
  /** Measured, not assumed. A buoy that does not deliver is kept and marked. */
  delivers: boolean;
  /** One delivering station carries no wave height at all, so this is separate. */
  publishes_waves: boolean;
  dead_note?: string | null;
}

export interface WeatherStation {
  name: string;
  lat: number;
  lon: number;
  /** Measured, not assumed. A station that does not deliver is kept and marked. */
  delivers: boolean;
  /**
   * Measured separately from `delivers`, and the join's filter. Forty-six of the
   * fifty-six candidates in this county answer perfectly and publish no
   * visibility, including the two nearest the default beach.
   */
  publishes_visibility: boolean;
  dead_note?: string;
}

export interface TideStation {
  name: string;
  lat: number;
  lon: number;
  kind: string;
  /** `open-coast` or `bay`. The join input; see tide-stations.json. */
  water: string;
  /** Measured, not assumed. A station that does not deliver is kept and marked. */
  delivers: boolean;
  dead_note?: string;
}

const BEACHES = inventory.beaches as readonly Beach[];
const STATIONS = stationTable.stations as Readonly<Record<string, TideStation>>;
const BUOYS = buoyTable.buoys as Readonly<Record<string, WaveBuoy>>;
const WEATHER = weatherTable.stations as Readonly<
  Record<string, WeatherStation>
>;

/**
 * The beach the conditions view opens on when no other is asked for.
 *
 * Named rather than derived. "First in the inventory" would be San Onofre, at
 * the county's northern edge and 57 km from the nearest station that publishes
 * predictions, which is the worst-supported reading on the site. This one is
 * central, sits 1.4 km from its station, and is the beach the National Weather
 * Service means when its surf zone forecast says "La Jolla".
 */
export const DEFAULT_BEACH_SLUG = "la-jolla-shores-beach";

/** Every beach, north to south. */
export function allBeaches(): readonly Beach[] {
  return BEACHES;
}

/**
 * The default beach, or a loud failure.
 *
 * The inventory is rewritten by a script from an upstream resource, so a rename
 * upstream could take the default slug with it. That must stop a build rather
 * than render an empty page.
 */
export function defaultBeach(): Beach {
  const beach = beachBySlug(DEFAULT_BEACH_SLUG);
  if (!beach) {
    throw new Error(
      `beaches.json no longer contains ${DEFAULT_BEACH_SLUG}, which the conditions view ` +
        `opens on. Upstream may have renamed it; pick a new default deliberately.`,
    );
  }
  return beach;
}

/** One beach by slug, or null. Null means the slug is not in the inventory. */
export function beachBySlug(slug: string): Beach | null {
  return BEACHES.find((beach) => beach.slug === slug) ?? null;
}

/**
 * Beaches grouped for a chooser, in inventory order within each group and with
 * the groups in the order they first appear — which, the inventory being sorted
 * north to south, runs down the coast.
 */
export function beachesByRegion(): {
  region: string;
  beaches: readonly Beach[];
}[] {
  const groups = new Map<string, Beach[]>();
  for (const beach of BEACHES) {
    const existing = groups.get(beach.region);
    if (existing) existing.push(beach);
    else groups.set(beach.region, [beach]);
  }
  return [...groups].map(([region, beaches]) => ({ region, beaches }));
}

/**
 * The station a beach reads, or null when the join could not bind one.
 *
 * Throws when a beach names a station the table does not describe. That is a
 * broken pair of data files rather than a missing reading, and it should stop a
 * build rather than render an unlabelled number.
 */
export function tideStationFor(
  beach: Beach,
): (TideStation & { id: string }) | null {
  if (beach.tide_station === null) return null;

  const station = STATIONS[beach.tide_station];
  if (!station) {
    throw new Error(
      `beaches.json: ${beach.slug} names tide station ${beach.tide_station}, ` +
        `which has no entry in tide-stations.json.`,
    );
  }
  return { id: beach.tide_station, ...station };
}

/**
 * The wave buoy a beach reads, or null when the join bound none.
 *
 * Throws when a beach names a buoy the table does not describe -- a broken pair
 * of data files, which should stop a build rather than render an unlabelled
 * number.
 */
export function waveBuoyFor(beach: Beach): (WaveBuoy & { id: string }) | null {
  if (beach.wave_buoy === null) return null;

  const buoy = BUOYS[beach.wave_buoy];
  if (!buoy) {
    throw new Error(
      `beaches.json: ${beach.slug} names wave buoy ${beach.wave_buoy}, ` +
        `which has no entry in wave-buoys.json.`,
    );
  }
  return { id: beach.wave_buoy, ...buoy };
}

/**
 * The observation station a beach reads, or null when the join bound none.
 *
 * Throws when a beach names a station the table does not describe -- a broken
 * pair of data files, which should stop a build rather than render an
 * unlabelled number.
 */
export function weatherStationFor(
  beach: Beach,
): (WeatherStation & { id: string }) | null {
  if (beach.weather_station === null) return null;

  const station = WEATHER[beach.weather_station];
  if (!station) {
    throw new Error(
      `beaches.json: ${beach.slug} names weather station ${beach.weather_station}, ` +
        `which has no entry in weather-stations.json.`,
    );
  }
  return { id: beach.weather_station, ...station };
}

/** Caveats carried by every data file. Every one owes the reader a rendering. */
export function inventoryCaveats(): readonly string[] {
  return [
    ...(inventory.unresolved as readonly string[]),
    ...(stationTable.unresolved as readonly string[]),
    ...(buoyTable.unresolved as readonly string[]),
    ...(weatherTable.unresolved as readonly string[]),
  ];
}
