/**
 * Seed and re-join the beach inventory.
 *
 *   node scripts/seed-beaches.mjs           rewrite src/data/beaches.json
 *   node scripts/seed-beaches.mjs --check   exit 1 if the committed file has moved
 *
 * The second mode is the point. A join result nobody can re-run is an assertion;
 * one that can be re-run and diffed is evidence. `--check` re-fetches, re-joins,
 * and compares against what is committed, so "fix the join and re-run it" is
 * something a reviewer can do rather than something a rule asserts.
 *
 * It reaches the network, so it is NOT a gate row. Running it on every push would
 * be both flaky and rude to the publisher.
 *
 * WHAT IS PINNED, and asserted on read rather than assumed:
 *   - the resource id and portal;
 *   - the column names, including `Beach_ UpperLon`, whose embedded space is
 *     upstream's own spelling;
 *   - that the datastore serialises numerics as JSON strings, so coordinates are
 *     converted once, here, and never by a reader.
 *
 * The inclusion predicate is data rather than judgement: County San Diego,
 * Status Active, BeachAccess PUBLIC, CountAsBeach 1.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { bindTideStation, distanceMetres } from "./tide-join.mjs";

const PORTAL = "https://data.cnra.ca.gov";
const RESOURCE = "cc674e59-036c-45c3-bec2-5d3d294e0e3d";
const DATASET =
  "https://data.cnra.ca.gov/dataset/beach-advisories-postings-and-closures-and-beach-water-quality-monitoring";
const MIRROR_RESOURCE = "fcbc9250-06e3-437d-b0c6-3cc5ddde93fc";

const BEACHES_PATH = new URL("../src/data/beaches.json", import.meta.url);
const STATIONS_PATH = new URL(
  "../src/data/tide-stations.json",
  import.meta.url,
);

/** Upstream's own spelling. The space is not a typo here. */
const LON_UPPER_COLUMN = "Beach_ UpperLon";

const COLUMNS = [
  "Beach_Name",
  "BeachType",
  "WaterBodyType",
  "WaterBodyName",
  "BeachAccess",
  "Status",
  "CountAsBeach",
  "NearestCityName",
  "USEPAID",
  "Agency_Name",
  "Beach_UpperLat",
  LON_UPPER_COLUMN,
  "Beach_LowerLat",
  "Beach_LowerLon",
];

function query() {
  const columns = COLUMNS.map((c) => `"${c}"`).join(", ");
  return (
    `SELECT ${columns} FROM "${RESOURCE}" ` +
    `WHERE "County" = 'San Diego' AND "Status" = 'Active' ` +
    `AND "BeachAccess" = 'PUBLIC' AND "CountAsBeach" = '1'`
  );
}

async function fetchRows() {
  const url = `${PORTAL}/api/3/action/datastore_search_sql?sql=${encodeURIComponent(query())}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "wild-coast-kids/0.1 (+https://github.com/cweber12/wild-coast-kids) beach-seed",
    },
  });
  if (!response.ok) {
    throw new Error(
      `${PORTAL} returned HTTP ${response.status} for the beach resource.`,
    );
  }
  const payload = await response.json();
  if (payload.success !== true) {
    throw new Error(
      `${PORTAL} reported failure: ${JSON.stringify(payload.error ?? {})}`,
    );
  }
  const rows = payload.result?.records;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      `${PORTAL} returned no beaches. An empty result is a broken query, not a coastline with no beaches.`,
    );
  }
  return rows;
}

/** Numerics arrive as strings. Convert once, here, and refuse anything unreadable. */
function coordinate(row, latColumn, lonColumn) {
  const lat = Number(row[latColumn]);
  const lon = Number(row[lonColumn]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(
      `${row.Beach_Name}: ${latColumn}/${lonColumn} did not parse as numbers ` +
        `(${JSON.stringify(row[latColumn])}, ${JSON.stringify(row[lonColumn])}).`,
    );
  }
  return { lat, lon };
}

/**
 * Where a San Diego County beach can plausibly be. Generous on purpose: the
 * north-west corner has to hold San Onofre at roughly -117.59, so this rejects
 * only coordinates that are not in the county at all.
 */
const COUNTY_BOUNDS = {
  minLat: 32.5,
  maxLat: 33.5,
  minLon: -117.7,
  maxLon: -117.0,
};

/**
 * The longest a single published beach segment can sensibly be. The real ones
 * top out around 5 km; 25 km is far past any of them and well short of the
 * distances a transposed coordinate produces.
 */
const MAX_SEGMENT_M = 25_000;

/**
 * Why a segment cannot be used, or null if it can.
 *
 * Upstream publishes at least one row whose latitude and longitude fragments are
 * transposed — "Imperial Beach pier area" on 2026-08-18 gave an upper longitude
 * of -117.5866 and a lower latitude of 32.1327, against neighbouring rows at
 * 32.5866/-117.1327 — which describes a fifty-kilometre beach running from well
 * offshore to inside Baja California. Correcting it here would be inventing
 * coordinates, so it is detected, refused, and reported instead. Two checks
 * rather than one: the bounding box alone misses an endpoint that lands in the
 * ocean at a plausible latitude.
 */
export function segmentFault(segment) {
  for (const [end, point] of Object.entries(segment)) {
    if (
      point.lat < COUNTY_BOUNDS.minLat ||
      point.lat > COUNTY_BOUNDS.maxLat ||
      point.lon < COUNTY_BOUNDS.minLon ||
      point.lon > COUNTY_BOUNDS.maxLon
    ) {
      return (
        `the ${end} endpoint published upstream (${point.lat}, ${point.lon}) is outside ` +
        `San Diego County, so no station can be joined to it`
      );
    }
  }

  const span = distanceMetres(segment.upper, segment.lower);
  if (span > MAX_SEGMENT_M) {
    return (
      `the endpoints published upstream are ${(span / 1000).toFixed(1)} km apart, which is not ` +
      `a beach, so no station can be joined to them`
    );
  }

  return null;
}

export function slugify(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug === "") throw new Error(`${name}: slugified to nothing.`);
  return slug;
}

/**
 * Display grouping only. Never an input to any join — it exists so a reader can
 * find their beach in a list of seventy-odd, and the bands are latitudes rather
 * than anyone's idea of where a neighbourhood ends. Bay and inlet sites group
 * together regardless of latitude, because that is how someone looks for them.
 */
export function regionOf(waterClass, meanLat) {
  if (waterClass === "bay") return "Bays, lagoons and inlets";
  if (meanLat >= 33.0) return "North County coast";
  if (meanLat >= 32.8) return "La Jolla and Pacific Beach";
  if (meanLat >= 32.65) return "Point Loma and Ocean Beach";
  return "South County coast";
}

export function build(rows, stations) {
  const seen = new Map();

  const beaches = rows.map((row) => {
    for (const column of COLUMNS) {
      if (!(column in row)) {
        throw new Error(
          `${row.Beach_Name ?? "a row"}: column ${JSON.stringify(column)} is missing. ` +
            `The resource's shape has drifted; refusing to guess.`,
        );
      }
    }

    const segment = {
      upper: coordinate(row, "Beach_UpperLat", LON_UPPER_COLUMN),
      lower: coordinate(row, "Beach_LowerLat", "Beach_LowerLon"),
    };

    const slug = slugify(row.Beach_Name);
    if (seen.has(slug)) {
      throw new Error(
        `slug "${slug}" is claimed by both ${JSON.stringify(seen.get(slug))} and ` +
          `${JSON.stringify(row.Beach_Name)}. A slug is a primary key; disambiguating one ` +
          `automatically would make it unstable, so this stops instead.`,
      );
    }
    seen.set(slug, row.Beach_Name);

    const fault = segmentFault(segment);
    const bound = fault
      ? { stationId: null, reason: fault }
      : bindTideStation(
          { segment, waterBodyType: row.WaterBodyType },
          stations,
        );

    const meanLat = (segment.upper.lat + segment.lower.lat) / 2;

    return {
      slug,
      name: row.Beach_Name,
      region: regionOf(bound.stationId ? bound.waterClass : null, meanLat),
      segment,
      upstream: {
        usepa_id: row.USEPAID,
        agency: row.Agency_Name,
        water_body_name: row.WaterBodyName,
        water_body_type: row.WaterBodyType,
        beach_type: row.BeachType,
        beach_access: row.BeachAccess,
        status: row.Status,
        nearest_city: row.NearestCityName,
      },
      tide_station: bound.stationId,
      tide_station_distance_m: bound.stationId
        ? Math.round(bound.distanceM)
        : null,
      tide_station_from_end: bound.stationId ? bound.fromEnd : null,
      tide_station_null_reason: bound.stationId ? undefined : bound.reason,
    };
  });

  // North to south, then by slug, so the file's order is a property of the data
  // rather than of the order the portal happened to return rows in.
  beaches.sort((a, b) => {
    const aLat = (a.segment.upper.lat + a.segment.lower.lat) / 2;
    const bLat = (b.segment.upper.lat + b.segment.lower.lat) / 2;
    return bLat - aLat || a.slug.localeCompare(b.slug);
  });

  return beaches;
}

export function document(beaches) {
  const unbound = beaches.filter((b) => b.tide_station === null);
  const farthest = beaches
    .filter((b) => b.tide_station !== null)
    .reduce((a, b) =>
      b.tide_station_distance_m > a.tide_station_distance_m ? b : a,
    );

  return {
    version: "0.2.0",
    generated: new Date().toISOString().slice(0, 10),
    time_zone: "America/Los_Angeles",
    _provenance:
      `Seeded from the Beach Detail Information resource of "Beach Advisories (Postings and ` +
      `Closures) and Beach Water Quality Monitoring", published by the California State Water ` +
      `Resources Control Board: ${DATASET}, resource ${RESOURCE}. The data.ca.gov copy ` +
      `(resource ${MIRROR_RESOURCE}) serves identical content and is the mirror. Rebuilt by ` +
      `scripts/seed-beaches.mjs; re-runnable and diffable with --check. Field values are ` +
      `reproduced as the resource serves them, including BeachType "UNKNOWN".`,
    _inclusion:
      "County San Diego, Status Active, BeachAccess PUBLIC, CountAsBeach 1. A predicate over " +
      "published fields rather than a judgement about which beaches are worth listing.",
    _pinned: {
      field_name_with_a_space:
        "Upstream names one field 'Beach_ UpperLon', with an embedded space. That is the " +
        "resource's own spelling, and the seeding script asserts it rather than tolerating " +
        "its absence.",
      numerics_are_strings:
        "The datastore serialises numeric columns as JSON strings. They are converted once, " +
        "at seed time, and anything that does not parse stops the seed.",
      a_beach_is_a_segment:
        "Coordinates arrive as an upper/lower pair, so a beach is a shoreline segment and not " +
        "a point. tide_station_from_end records which end the join measured from.",
    },
    _schema: {
      slug: "Stable primary key, from the published name. Never change after first write.",
      name: "Display name, as the resource publishes it.",
      region:
        "Display grouping only, derived from water class and mean latitude. Never a join input.",
      segment:
        "The shoreline extent, upper and lower endpoints, WGS84 decimal degrees.",
      upstream: "Fields reproduced from the resource, unmodified.",
      tide_station:
        "Joined, never typed: the nearest delivering station of the beach's own water class. " +
        "Re-runnable with scripts/seed-beaches.mjs --check. null means the join could not " +
        "bind one, and tide_station_null_reason says why.",
      tide_station_distance_m:
        "Great-circle metres from the nearer segment end to the station.",
      tide_station_from_end:
        "Which end of the segment supplied the distance, upper or lower.",
    },
    beaches,
    // Written out in full every run, never merged with what is already on disk:
    // carrying entries forward duplicated them on the second run and made
    // --check report movement immediately after a seed. A check that cannot say
    // "unchanged" says nothing.
    unresolved: [
      "beach_type is UNKNOWN upstream for most of these beaches. That is a gap in the resource, " +
        "not a shorthand for sand, and nothing may render it as a description of what the shore " +
        "is made of.",
      `The join binds by nearest station of matching water class, and the distances are large ` +
        `where NOAA publishes no nearby station: the farthest is ${farthest.name} at ` +
        `${(farthest.tide_station_distance_m / 1000).toFixed(1)} km. See tide-stations.json, ` +
        `whose own unresolved list records that the one open-coast station between La Jolla and ` +
        `Imperial Beach does not deliver predictions.`,
      "A tide prediction is for the station, not for the beach. It is the best published figure " +
        "for that stretch of shore and it is not a measurement taken there.",
      ...(unbound.length > 0
        ? [
            `${unbound.length} beach(es) could not be bound to a station: ` +
              unbound
                .map((b) => `${b.name} (${b.tide_station_null_reason})`)
                .join("; ") +
              ". A null station must never render as a reading.",
          ]
        : []),
      "The network module carries no build-time guard against being imported by a browser " +
        "bundle. The `server-only` package is the intended enforcement and is not installed: " +
        "importing it breaks the tests under jsdom until vitest is configured with the " +
        "`react-server` resolve condition. Today the guarantee rests on the module having no " +
        "client-side importer, which nothing checks.",
    ],
  };
}

/**
 * The command-line half, kept behind a guard so the pure half above can be
 * imported and asserted without reaching the network or writing a file. Only the
 * fetching, the file IO and the exit codes live in here; everything with a rule
 * in it is exported and tested.
 */
async function main() {
  const checkOnly = process.argv.includes("--check");

  const stations = JSON.parse(readFileSync(STATIONS_PATH, "utf8")).stations;
  let existing = null;
  try {
    existing = JSON.parse(readFileSync(BEACHES_PATH, "utf8"));
  } catch {
    existing = null;
  }

  const rows = await fetchRows();
  const built = document(build(rows, stations));

  // `generated` is the one field that moves on every run by design, so comparing
  // it would make every check fail and mean nothing.
  const comparable = (doc) =>
    JSON.stringify({ ...doc, generated: null }, null, 2);
  const next = comparable(built);

  if (checkOnly) {
    if (existing === null) {
      console.error("beaches.json is missing. Run without --check to seed it.");
      process.exit(1);
    }
    if (comparable(existing) === next) {
      console.log(
        `beaches.json is current: ${built.beaches.length} beaches, join unchanged.`,
      );
      process.exit(0);
    }
    console.error(
      "beaches.json has moved. Re-run without --check, read the diff, and say in the commit " +
        "what moved upstream and why.",
    );
    process.exit(1);
  }

  writeFileSync(
    BEACHES_PATH,
    `${JSON.stringify(built, null, 2)}
`,
    "utf8",
  );
  console.log(
    `Wrote ${built.beaches.length} beaches to src/data/beaches.json.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
