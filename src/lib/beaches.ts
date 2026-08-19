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
  /**
   * Joined, never typed. Supplies sky and visibility only: it is the nearest
   * station that publishes them, which in this county is always an airport.
   * Temperature and wind come from `air_station`.
   */
  weather_station: string | null;
  weather_station_distance_m: number | null;
  weather_station_from_end: string | null;
  /** Present exactly when weather_station is null, and required then. */
  weather_station_null_reason?: string;
  /**
   * Joined, never typed. Supplies air temperature and wind: the nearest station
   * that publishes both and suits this beach's water class. Usually a different
   * station from `weather_station`, and much nearer.
   */
  air_station: string | null;
  air_station_distance_m: number | null;
  air_station_from_end: string | null;
  /** Present exactly when air_station is null, and required then. */
  air_station_null_reason?: string;
}

export interface WaveBuoy {
  name: string;
  cdip: string | null;
  lat: number;
  lon: number;
  /** Measured, not assumed. A buoy that does not deliver is kept and marked. */
  delivers: boolean;
  /**
   * The wave join's verdict on a station, not a count of WVHT rows. The one
   * station it excludes does publish waves, and is left out for its distance --
   * see `waves_note` and wave-buoys.json's schema.
   */
  publishes_waves: boolean;
  /** Present when `publishes_waves` is false for a reason other than absence. */
  waves_note?: string | null;
  dead_note?: string | null;
}

export interface WeatherStation {
  /**
   * As the station's network publishes it, callsign and padding included. The
   * record of what upstream said, and never what is rendered -- see
   * `display_name`.
   */
  name: string;
  /**
   * What the page calls this station. Hand-written in the probe, because the
   * published name is an identifier rather than prose for most of these.
   */
  display_name: string;
  lat: number;
  lon: number;
  /** Measured, not assumed. A station that does not deliver is kept and marked. */
  delivers: boolean;
  /**
   * Metres above sea level as the network publishes it, or null where it
   * publishes none. Measured metadata rather than a join input: it is most of
   * what the hand-written `shore` flag beside it is read from.
   */
  elevation_m: number | null;
  /**
   * Whether the station stands in the marine layer at the shoreline. An input to
   * the air join, hand-written like `TideStation.water` and for the same reason:
   * no authority publishes the classification.
   */
  shore: boolean;
  /** Which publisher serves this station, and so which fetcher reads it. */
  network: "nws" | "ndbc";
  /** Whether the station published an air temperature when probed. */
  publishes_air_temp: boolean;
  /** Whether it published a wind speed. */
  publishes_wind: boolean;
  /**
   * Measured separately from `delivers`, and the sky join's filter. Only ten of
   * the sixty-two candidates in this county carry a sky description, every one
   * an airport, and the two nearest the default beach carry none.
   */
  publishes_sky: boolean;
  dead_note?: string;
}

/**
 * A beach San Diego County lists that this site does not answer for.
 *
 * Written into `beaches.json`'s `_excluded` block by the same predicate in
 * `scripts/seed-beaches.mjs` that decides which beaches are in `beaches`, so
 * the two cannot disagree about one. Nothing here is hand-maintained.
 */
export interface ExcludedBeach {
  /** Stable, and not a route: `/conditions/<slug>` 404s for every one of these. */
  slug: string;
  name: string;
  /**
   * The binding distance that disqualified it, or the fault that stopped a
   * binding being made at all. A beach that disappeared without one would be
   * the silent failure this repo's `unresolved` blocks exist to prevent, and a
   * worse one: a reader cannot notice what they were never shown.
   */
  why: string;
}

/** How far this site's answer reaches, counted in beaches. */
export interface InventoryReach {
  /** What the county's list holds: the beaches served plus the beaches excluded. */
  listed: number;
  /** What this site answers for. */
  served: number;
  excluded: readonly ExcludedBeach[];
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
const EXCLUDED = inventory._excluded as readonly ExcludedBeach[];
const STATIONS = stationTable.stations as Readonly<Record<string, TideStation>>;
const BUOYS = buoyTable.buoys as Readonly<Record<string, WaveBuoy>>;
const WEATHER = weatherTable.stations as Readonly<
  Record<string, WeatherStation>
>;

/**
 * The beach the conditions view opens on when no other is asked for.
 *
 * Named rather than derived. "First in the inventory" meant San Onofre until
 * the service predicate removed it, 57 km from the nearest station that
 * publishes predictions; it now means Del Mar City Beach, which is served but
 * sits at the northern edge of what survives and would move again the next time
 * upstream adds a row. This one is central, sits 1.4 km from its station, and is
 * the beach the National Weather Service means when its surf zone forecast says
 * "La Jolla".
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
 * The station a beach reads for sky and visibility, or null when the join bound
 * none. Not the station it reads for temperature and wind -- see
 * `airStationFor` -- and the difference is the whole of ADR 0010.
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

/**
 * The station a beach reads for air temperature and wind, or null when the join
 * bound none. Same table as `weatherStationFor`, different filter.
 */
export function airStationFor(
  beach: Beach,
): (WeatherStation & { id: string }) | null {
  if (beach.air_station === null) return null;

  const station = WEATHER[beach.air_station];
  if (!station) {
    throw new Error(
      `beaches.json: ${beach.slug} names air station ${beach.air_station}, ` +
        `which has no entry in weather-stations.json.`,
    );
  }
  return { id: beach.air_station, ...station };
}

/**
 * What this site covers, and what it leaves out.
 *
 * `listed` is derived from the two halves rather than written down, because a
 * count of somebody else's list that this repo maintains by hand goes stale the
 * first time that list moves -- and the number a reader is owed is the one that
 * makes the site's own reach checkable.
 */
export function inventoryReach(): InventoryReach {
  return {
    listed: BEACHES.length + EXCLUDED.length,
    served: BEACHES.length,
    excluded: EXCLUDED,
  };
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
