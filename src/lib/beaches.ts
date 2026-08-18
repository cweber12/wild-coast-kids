/**
 * The beach inventory, typed.
 *
 * `src/data/beaches.json` is the record; this is the only way to read it, so a
 * caller cannot reach past the types into a raw shape. The JSON is
 * machine-formatted on purpose -- a generator may rewrite it -- and the types
 * here are hand-written until a generator exists to emit them.
 *
 * Nothing in this module fetches anything. A beach's bindings are values
 * resolved against upstream authorities and committed; reading them is a file
 * read, and that is the point.
 */

import inventory from "@/data/beaches.json";

export interface Coordinate {
  lat: number;
  lon: number;
}

/**
 * A beach is a shoreline **segment**, upper and lower endpoints, because that is
 * how the state publishes it. It is not a point, and code that needs one has to
 * say which end it took and why.
 */
export interface BeachSegment {
  upper: Coordinate;
  lower: Coordinate;
}

export interface Beach {
  slug: string;
  name: string;
  segment: BeachSegment;
  /** Fields reproduced from the upstream resource, unmodified. */
  upstream: {
    usepa_id: string;
    agency: string;
    water_body_name: string;
    water_body_type: string;
    /**
     * Upstream's own value, which is `UNKNOWN` for some beaches. That is a gap in
     * the resource and must never be rendered as a description of the shore.
     */
    beach_type: string;
    beach_access: string;
    status: string;
    nearest_city: string;
  };
  tide_station: string;
  tide_station_basis: string;
}

export interface TideStation {
  name: string;
  /** `open coast` or `bay side only`. Reading a bay station for an open-coast beach yields a wrong curve. */
  role: string;
}

const BEACHES = inventory.beaches as readonly Beach[];
const TIDE_STATIONS = inventory.tide_stations as Readonly<
  Record<string, TideStation>
>;

/** Every beach in the inventory, in file order. */
export function allBeaches(): readonly Beach[] {
  return BEACHES;
}

/** One beach by slug, or null. Null means the slug is not in the inventory. */
export function beachBySlug(slug: string): Beach | null {
  return BEACHES.find((beach) => beach.slug === slug) ?? null;
}

/**
 * The tide station a beach reads, with its role.
 *
 * Throws when a beach names a station the inventory does not describe. That is a
 * broken data file rather than a missing reading, and it should stop a build
 * rather than render an unlabelled number.
 */
export function tideStationFor(beach: Beach): TideStation & { id: string } {
  const station = TIDE_STATIONS[beach.tide_station];
  if (!station) {
    throw new Error(
      `beaches.json: ${beach.slug} names tide station ${beach.tide_station}, ` +
        `which has no entry under tide_stations.`,
    );
  }
  return { id: beach.tide_station, ...station };
}

/** Caveats carried by the inventory. Every one of these owes the reader a rendering. */
export function inventoryCaveats(): readonly string[] {
  return inventory.unresolved as readonly string[];
}
