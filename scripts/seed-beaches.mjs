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
 * TWO PREDICATES DECIDE WHAT IS IN THE FILE, and they differ in kind. The
 * inclusion predicate is data rather than judgement: County San Diego, Status
 * Active, BeachAccess PUBLIC, CountAsBeach 1. The service predicate --
 * `servesBeach` below -- is judgement and says so, because it decides how far a
 * measurement may be taken from the place it is shown for. Every beach the
 * second refuses is written to `_excluded` with the distance that refused it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { distanceMetres } from "./geo.mjs";
import { bindAirStation } from "./air-join.mjs";
import { bindTideStation } from "./tide-join.mjs";
import { bindWaveBuoy } from "./wave-join.mjs";
import { bindWeatherStation } from "./weather-join.mjs";

const PORTAL = "https://data.cnra.ca.gov";
const RESOURCE = "cc674e59-036c-45c3-bec2-5d3d294e0e3d";
const DATASET =
  "https://data.cnra.ca.gov/dataset/beach-advisories-postings-and-closures-and-beach-water-quality-monitoring";
const MIRROR_RESOURCE = "fcbc9250-06e3-437d-b0c6-3cc5ddde93fc";

const BEACHES_PATH = new URL("../src/data/beaches.json", import.meta.url);
const BUOYS_PATH = new URL("../src/data/wave-buoys.json", import.meta.url);
const STATIONS_PATH = new URL(
  "../src/data/tide-stations.json",
  import.meta.url,
);
const WEATHER_PATH = new URL(
  "../src/data/weather-stations.json",
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
 * find their beach in a long list, and the bands are latitudes rather
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

export function build(rows, stations, buoys, weatherStations) {
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
          { slug, segment, waterBodyType: row.WaterBodyType },
          stations,
        );
    const wave = fault
      ? { buoyId: null, reason: fault }
      : bindWaveBuoy(
          { slug, segment, waterBodyType: row.WaterBodyType },
          buoys,
        );
    // No water-class rule here, unlike the wave join: air reaches a lagoon.
    // This binds sky and visibility only -- the airport. Temperature and wind
    // come from the air join below, which does have a water-class rule.
    const weather = fault
      ? { stationId: null, reason: fault }
      : bindWeatherStation({ segment }, weatherStations);
    const air = fault
      ? { stationId: null, reason: fault }
      : bindAirStation(
          { slug, segment, waterBodyType: row.WaterBodyType },
          weatherStations,
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
      wave_buoy: wave.buoyId,
      wave_buoy_distance_m: wave.buoyId ? Math.round(wave.distanceM) : null,
      wave_buoy_from_end: wave.buoyId ? wave.fromEnd : null,
      wave_buoy_null_reason: wave.buoyId ? undefined : wave.reason,
      weather_station: weather.stationId,
      weather_station_distance_m: weather.stationId
        ? Math.round(weather.distanceM)
        : null,
      weather_station_from_end: weather.stationId ? weather.fromEnd : null,
      weather_station_null_reason: weather.stationId
        ? undefined
        : weather.reason,
      air_station: air.stationId,
      air_station_distance_m: air.stationId ? Math.round(air.distanceM) : null,
      air_station_from_end: air.stationId ? air.fromEnd : null,
      air_station_null_reason: air.stationId ? undefined : air.reason,
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

/**
 * How far a reading may travel before this site stops publishing it, in metres.
 *
 * A named constant because it is the one number in this file that is a
 * judgement, and changing it must be a one-line reviewable edit rather than a
 * hunt. Ten kilometres is WMO-No. 8 §1.1.2's stated scale for small-scale and
 * local applications, which is the nearest thing to an anchor that exists: no
 * standard reporting radius does, and docs/reference/sensor-representativeness.md
 * records why. A benchmark rather than a rule, so the figure is ours to defend
 * and not to cite. At 15 km the site would list 49 beaches instead of 41; the
 * whole trade curve is in docs/plans/inventory-bounded-by-stations.md.
 */
export const SERVICE_TOLERANCE_M = 10_000;

const kilometres = (metres) => `${(metres / 1000).toFixed(1)} km`;

/**
 * Why the station networks cannot serve this beach, or null when they can.
 *
 * The second predicate over the inventory, and the one that is judgement. The
 * first -- County, Active, PUBLIC, CountAsBeach, up in `query` -- is a filter
 * over published fields and decides nothing about what is worth listing. This
 * one decides how far a measurement may be taken from the place it is shown
 * for. What keeps it honest is that its inputs are measured: every distance
 * here came out of a join, and every beach it refuses is written to
 * `_excluded` with the distance that refused it.
 *
 * THE RULE: a tide station within the tolerance, and if a wave buoy is bound at
 * all, that buoy within the tolerance. A beach fails when a binding it *has* is
 * too far, never when a join correctly declined to make one -- which is what
 * the wave join does at a bay, where swell does not reach, and at a cove closed
 * off by a breakwater. Stating it that way subsumes the bay exemption rather
 * than special-casing beside it.
 *
 * Air is deliberately not a clause. Every bound beach already reads air within
 * 7.4 km, so adding it would exclude nobody while implying a filter doing work
 * it is not doing. See docs/adr/0011-inventory-bounded-by-station-networks.md.
 *
 * @param {object} beach A built beach, with its bindings and their distances.
 * @param {number} [toleranceM]
 * @returns {string | null}
 */
export function serviceFault(beach, toleranceM = SERVICE_TOLERANCE_M) {
  if (beach.tide_station === null) {
    return `no tide station was bound to it at all: ${beach.tide_station_null_reason}`;
  }

  const tooFar = [];
  if (beach.tide_station_distance_m > toleranceM) {
    tooFar.push(
      `its tide station ${beach.tide_station} is ` +
        `${kilometres(beach.tide_station_distance_m)} away`,
    );
  }
  if (beach.wave_buoy !== null && beach.wave_buoy_distance_m > toleranceM) {
    tooFar.push(
      `its wave buoy ${beach.wave_buoy} is ` +
        `${kilometres(beach.wave_buoy_distance_m)} away`,
    );
  }
  if (tooFar.length === 0) return null;

  return (
    `${tooFar.join(" and ")}, and this site does not publish a reading taken more than ` +
    `${kilometres(toleranceM)} from the beach it is shown for`
  );
}

/**
 * Whether the stations this beach needs reach it.
 *
 * Defined in terms of `serviceFault` so the verdict and the reason recorded
 * beside it cannot drift apart: there is one rule, and the boolean is a reading
 * of it rather than a second copy.
 *
 * @param {object} beach
 * @param {number} [toleranceM]
 * @returns {boolean}
 */
export function servesBeach(beach, toleranceM = SERVICE_TOLERANCE_M) {
  return serviceFault(beach, toleranceM) === null;
}

export function document(built) {
  const beaches = built.filter((beach) => servesBeach(beach));
  const excluded = built
    .filter((beach) => !servesBeach(beach))
    .map((beach) => ({
      slug: beach.slug,
      name: beach.name,
      why: serviceFault(beach),
    }));

  if (beaches.length === 0) {
    throw new Error(
      `the service predicate excluded all ${built.length} beaches. That is a broken join or a ` +
        `moved station table, not a county whose coastline no station reaches; refusing to ` +
        `overwrite the inventory with an empty one.`,
    );
  }

  const withWeather = beaches.filter((b) => b.weather_station !== null);
  const farthestWeather = withWeather.reduce((a, b) =>
    b.weather_station_distance_m > a.weather_station_distance_m ? b : a,
  );
  const weatherKm = withWeather
    .map((b) => b.weather_station_distance_m / 1000)
    .sort((a, b) => a - b);
  const medianWeatherKm = weatherKm[Math.floor(weatherKm.length / 2)];
  const airKm = beaches
    .filter((b) => b.air_station !== null)
    .map((b) => b.air_station_distance_m / 1000)
    .sort((a, b) => a - b);
  const medianAirKm = airKm[Math.floor(airKm.length / 2)];
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
    _served:
      `And then, of those: a tide station within ${kilometres(SERVICE_TOLERANCE_M)}, and if a ` +
      `wave buoy is bound at all, that buoy within ${kilometres(SERVICE_TOLERANCE_M)}. Unlike ` +
      `_inclusion this one IS a judgement -- it decides how far a measurement may be taken ` +
      `from the place it is shown for -- and it is stated here rather than left implicit in ` +
      `how far a join happened to reach. Ten kilometres is WMO-No. 8 §1.1.2's scale for ` +
      `small-scale and local applications; no standard reporting radius exists, so the figure ` +
      `is defended rather than cited. What keeps it honest is that its inputs are measured: ` +
      `every distance came out of a join. Every beach it refuses is in _excluded below, with ` +
      `the binding distance that refused it, so nothing leaves this inventory silently. See ` +
      `docs/adr/0011-inventory-bounded-by-station-networks.md.`,
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
      weather_station:
        "Joined, never typed: the nearest station that both answers and publishes sky. Supplies " +
        "the panel's sky and visibility ONLY -- temperature and wind come from air_station. " +
        "Unlike the wave buoy, every beach binds one -- air reaches a lagoon. null means the " +
        "join could not bind one, and weather_station_null_reason says why.",
      weather_station_distance_m:
        "Great-circle metres from the nearer segment end to the station. Larger than the tide " +
        "and buoy distances by nature: the ten stations that publish sky are all airports.",
      weather_station_from_end:
        "Which end of the segment supplied the distance, upper or lower.",
      air_station:
        "Joined, never typed: the nearest station that answers, publishes air temperature AND " +
        "wind, and suits the beach's water class -- an open-coast beach binds a shore station, " +
        "a bay or lagoon binds the nearest of any kind. Usually not the same station as " +
        "weather_station, and may be on either network; see the `network` field in " +
        "weather-stations.json. null means the join could not bind one, and " +
        "air_station_null_reason says why.",
      air_station_distance_m:
        "Great-circle metres from the nearer segment end to the station. Much smaller than " +
        "weather_station_distance_m, which is the point of the second binding.",
      air_station_from_end:
        "Which end of the segment supplied the distance, upper or lower.",
    },
    beaches,
    // The other half of the same predicate. A beach that vanished with no
    // record of why would be the silent failure the unresolved blocks exist to
    // prevent, and this one is worse than most: the reader cannot miss what
    // they were never shown.
    _excluded: excluded,
    // Written out in full every run, never merged with what is already on disk:
    // carrying entries forward duplicated them on the second run and made
    // --check report movement immediately after a seed. A check that cannot say
    // "unchanged" says nothing.
    unresolved: [
      "beach_type is UNKNOWN upstream for most of these beaches. That is a gap in the resource, " +
        "not a shorthand for sand, and nothing may render it as a description of what the shore " +
        "is made of.",
      `The join binds by nearest station of matching water class, and a beach whose nearest is ` +
        `further than ${kilometres(SERVICE_TOLERANCE_M)} away is not listed here at all rather ` +
        `than listed with a reading from out of range. The farthest any listed beach reads is ` +
        `${farthest.name}'s, at ${kilometres(farthest.tide_station_distance_m)}. See ` +
        `tide-stations.json, whose own unresolved list records that the one open-coast station ` +
        `between La Jolla and Imperial Beach does not deliver predictions.`,
      `${beaches.filter((b) => b.wave_buoy === null).length} of these beaches get no wave height at all. ` +
        `Every NDBC wave buoy sits on the open coast, and ocean swell does not reach into a bay or ` +
        `lagoon, so binding one to the nearest buoy would put an open-ocean number on enclosed water. ` +
        `Their water temperature is missing for the same reason and is not yet filled from another source.`,
      "A tide prediction is for the station, not for the beach. It is the best published figure " +
        "for that stretch of shore and it is not a measurement taken there.",
      `Sky and visibility are read at an airport, because the ten stations in this county that ` +
        `publish them are all airport METARs, and airports sit inland. The median beach reads ` +
        `its sky station ${Math.round(medianWeatherKm * 10) / 10} km away and the farthest ` +
        `reads one ${(farthestWeather.weather_station_distance_m / 1000).toFixed(1)} km away, ` +
        `at ${farthestWeather.name}. Coastal fog is precisely what changes over that distance, ` +
        `so those two figures describe the airport and not the shoreline.`,
      `Air temperature and wind come from a different station than sky and visibility, and the ` +
        `page names both. The median beach reads its air station ` +
        `${Math.round(medianAirKm * 10) / 10} km away against ` +
        `${Math.round(medianWeatherKm * 10) / 10} km for its sky station. Two provenances behind ` +
        `one panel is a deliberate trade: requiring one station to supply all four values meant ` +
        `the scarcest of them, sky, decided where the temperature was measured, which put an ` +
        `inland reading on a coastal beach. See docs/adr/0010-two-provenances-in-the-air-panel.md.`,
      `An air station is still not the beach. It is the nearest measurement of the air the ` +
        `beach is in, chosen for exposure as well as distance -- an open-coast beach binds a ` +
        `station standing in the marine layer at the shoreline, a bay or lagoon binds the ` +
        `nearest of any kind. The shore classification is an author judgement; ` +
        `weather-stations.json records it and says so.`,
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
  const buoys = JSON.parse(readFileSync(BUOYS_PATH, "utf8")).buoys;
  const weatherStations = JSON.parse(
    readFileSync(WEATHER_PATH, "utf8"),
  ).stations;
  let existing = null;
  try {
    existing = JSON.parse(readFileSync(BEACHES_PATH, "utf8"));
  } catch {
    existing = null;
  }

  const rows = await fetchRows();
  const built = document(build(rows, stations, buoys, weatherStations));

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
