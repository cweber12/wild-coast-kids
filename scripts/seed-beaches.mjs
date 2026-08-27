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
 *
 * AND ONE TRANSFORM SITS BETWEEN THEM. `dropReplacedBuoy` removes a wave buoy
 * this site would not publish where a MOP line stands near enough to answer for
 * the beach instead, so four beaches are served with a modelled wave figure and
 * no measured one. That is the one place in this file where something other
 * than a measurement decides whether a beach exists, it is an amendment to
 * ADR-0011 rather than a tweak to it, and the page carries a disclosure that is
 * part of the same decision. See
 * docs/adr/0019-a-modelled-source-may-qualify-a-beach.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { distanceMetres } from "./geo.mjs";
import { generatedDate } from "./generated-date.mjs";
import { bindAirStation } from "./air-join.mjs";
import { bindGridCell } from "./grid-cell-join.mjs";
import { bindMopLine } from "./mop-join.mjs";
import { bindTideStation } from "./tide-join.mjs";
import { bindWaveBuoy } from "./wave-join.mjs";

const PORTAL = "https://data.cnra.ca.gov";
const RESOURCE = "cc674e59-036c-45c3-bec2-5d3d294e0e3d";
const DATASET =
  "https://data.cnra.ca.gov/dataset/beach-advisories-postings-and-closures-and-beach-water-quality-monitoring";
const MIRROR_RESOURCE = "fcbc9250-06e3-437d-b0c6-3cc5ddde93fc";

const BEACHES_PATH = new URL("../src/data/beaches.json", import.meta.url);
const BUOYS_PATH = new URL("../src/data/wave-buoys.json", import.meta.url);
const MOP_LINES_PATH = new URL("../src/data/mop-lines.json", import.meta.url);
const GRID_CELLS_PATH = new URL("../src/data/grid-cells.json", import.meta.url);
const STATIONS_PATH = new URL(
  "../src/data/tide-stations.json",
  import.meta.url,
);
const OBSERVATION_STATIONS_PATH = new URL(
  "../src/data/observation-stations.json",
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

export function build(
  rows,
  stations,
  buoys,
  observationStations,
  mopLines,
  gridCells,
) {
  const seen = new Map();

  const joined = rows.map((row) => {
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
    // The second wave binding, and a separate one on purpose: the buoy answers
    // for now and the line answers for the week, they fail on different days,
    // and a buoy dying must not take a coastline's forecast with it. Same
    // water-class refusal, read from the same table -- see mop-join.mjs.
    const mop = fault
      ? { lineId: null, reason: fault }
      : bindMopLine(
          { slug, segment, waterBodyType: row.WaterBodyType },
          mopLines,
        );
    // Neither a distance nor a water class decides this one. A forecast cell is
    // an area, so there is nothing to be nearer by; the end is chosen by which
    // cell averages nearer sea level, which is where a beach is. It reads a
    // resolution rather than computing one because /points owns the mapping
    // from a coordinate to a cell -- see grid-cell-join.mjs and ADR-0020.
    const grid = fault
      ? { cellId: null, reason: fault }
      : bindGridCell({ slug }, gridCells);
    const air = fault
      ? { stationId: null, reason: fault }
      : bindAirStation(
          { slug, segment, waterBodyType: row.WaterBodyType },
          observationStations,
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
      mop_line: mop.lineId,
      mop_line_distance_m: mop.lineId ? Math.round(mop.distanceM) : null,
      mop_line_from_end: mop.lineId ? mop.fromEnd : null,
      mop_line_null_reason: mop.lineId ? undefined : mop.reason,
      grid_cell: grid.cellId,
      grid_cell_from_end: grid.cellId ? grid.fromEnd : null,
      grid_cell_elevation_m: grid.cellId ? grid.elevationM : null,
      grid_cell_null_reason: grid.cellId ? undefined : grid.reason,
      air_station: air.stationId,
      air_station_distance_m: air.stationId ? Math.round(air.distanceM) : null,
      air_station_from_end: air.stationId ? air.fromEnd : null,
      air_station_null_reason: air.stationId ? undefined : air.reason,
    };
  });

  // After every join and before the predicate reads them: a buoy this site
  // would not publish is dropped where a MOP line stands near enough to answer
  // instead. Wrapped rather than passed by reference, because `map` would hand
  // the index in as the tolerance. See `dropReplacedBuoy` and ADR-0019.
  const beaches = joined.map((beach) => dropReplacedBuoy(beach));

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

/**
 * How near a MOP line must sit before the model may answer for a beach alone.
 *
 * A SECOND CONSTANT RATHER THAN A REUSE OF THE ONE ABOVE, because the two ask
 * different questions and collapsing them makes the second unanswerable. That
 * one bounds how far a *reading* may travel from the place it is shown for.
 * This one asks whether the beach is on the coast the *model* describes at all
 * -- which is the only thing a distance to a model can honestly test, since
 * nothing was taken anywhere for it to have travelled from.
 *
 * Measured 2026-08-26 over all 73 upstream beaches: 45 bind a line, and 43 of
 * them sit between 117 m and 930 m. The other two are `tide-beach-park` at
 * 2,594 m and `tijana-river` at 6,395 m -- exactly the two ADR-0011 already
 * records as published where their names are not, one 34 km from the city it
 * names and one 6-7 km inland up a river. So this is not a threshold tuned to
 * an outcome: at ~100 m alongshore spacing, a line kilometres away does not
 * mean the model is coarse there, it means the nearest open coast is kilometres
 * away and the segment is not on it.
 *
 * See docs/adr/0019-a-modelled-source-may-qualify-a-beach.md.
 */
export const MODELLED_SOURCE_TOLERANCE_M = 1_000;

const kilometres = (metres) => `${(metres / 1000).toFixed(1)} km`;

/**
 * Drop a wave buoy this site would not publish, where the model replaces it.
 *
 * ADR-0019, and the whole of what makes it defensible rather than a loophole.
 * A beach 28 km from the nearest delivering buoy is not served by publishing
 * that buoy: the reading would look like every other number on the site and
 * describe water most of the way to the next county. So the binding is dropped
 * -- null, with the distance that refused it and the line that answers instead
 * -- and the service predicate then passes the beach on its tide alone, exactly
 * the way it already passes every bay.
 *
 * IT FIRES ONLY WHERE THE BUOY IS THE SOLE FAULT, and that guard is load-bearing
 * rather than tidy. Without it the rule also fires on seven beaches excluded on
 * tide -- Carlsbad Municipal, Ocean Beach, Dog Beach O.B., Sunset Cliffs and the
 * three Coronado entries -- stripping the wave clause out of each one's
 * `_excluded` reason. They stay excluded either way, so the entire effect would
 * be that their exclusion record tells a reader less than it did. Measured, the
 * guarded form moves four beaches and reworks no surviving entry.
 *
 * A TRANSFORM AND NOT A JOIN. `wave-join.mjs` binds the nearest delivering buoy
 * and has no opinion about whether this site will publish it; that split is what
 * lets `_excluded` say a buoy was refused rather than silently omitting one, and
 * it is the shape that lost both Scripps Pier stations before #80 when it was
 * not kept. So this runs after the joins, at the altitude of the predicate it
 * feeds.
 *
 * @param {object} beach A built beach, with its bindings and their distances.
 * @param {number} [toleranceM] How far a reading may travel.
 * @param {number} [modelledM] How near the line must be to answer alone.
 * @returns {object} The beach, or a copy of it with the buoy binding dropped.
 */
export function dropReplacedBuoy(
  beach,
  toleranceM = SERVICE_TOLERANCE_M,
  modelledM = MODELLED_SOURCE_TOLERANCE_M,
) {
  // Sole fault: the tide reaches, the buoy does not, and a line stands near
  // enough to answer in its place. Any other shape is left exactly as joined.
  if (beach.tide_station === null || beach.tide_station_distance_m > toleranceM)
    return beach;
  if (beach.wave_buoy === null || beach.wave_buoy_distance_m <= toleranceM)
    return beach;
  if (beach.mop_line === null || beach.mop_line_distance_m > modelledM)
    return beach;

  return {
    ...beach,
    wave_buoy: null,
    wave_buoy_distance_m: null,
    wave_buoy_from_end: null,
    // Both halves, because either alone misleads: the distance without the
    // replacement reads as a beach with no waves at all, and the replacement
    // without the distance hides that a measurement was refused.
    wave_buoy_null_reason:
      `the nearest delivering buoy ${beach.wave_buoy} is ` +
      `${kilometres(beach.wave_buoy_distance_m)} away, further than this site publishes a ` +
      `reading from, so it is not read here; MOP line ${beach.mop_line} answers for the ` +
      `waves at ${kilometres(beach.mop_line_distance_m)}, and it is a model rather than a ` +
      `measurement`,
  };
}

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
 * Air is deliberately not a clause, and neither is the MOP line. Every bound
 * beach already reads air within 7.4 km and a MOP line within 1 km, so adding
 * either would exclude nobody while implying a filter doing work it is not
 * doing.
 *
 * THE MOP LINE REACHES THIS PREDICATE ANYWAY, but through `dropReplacedBuoy`
 * above rather than as a clause here. That is deliberate: a line near enough to
 * answer alone does not *pass* a beach, it removes the buoy binding that was
 * failing it, so the rule below still reads the way it always did and there is
 * still exactly one thing that can refuse a beach on waves -- a binding it has
 * that is too far. See docs/adr/0011-inventory-bounded-by-station-networks.md
 * and docs/adr/0019-a-modelled-source-may-qualify-a-beach.md.
 *
 * @param {object} beach A built beach, with its bindings and their distances.
 * @param {number} [toleranceM]
 * @returns {string | null}
 */
export function serviceFault(
  beach,
  toleranceM = SERVICE_TOLERANCE_M,
  modelledM = MODELLED_SOURCE_TOLERANCE_M,
) {
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
  const buoyTooFar =
    beach.wave_buoy !== null && beach.wave_buoy_distance_m > toleranceM;
  if (buoyTooFar) {
    tooFar.push(
      `its wave buoy ${beach.wave_buoy} is ` +
        `${kilometres(beach.wave_buoy_distance_m)} away`,
    );
  }
  if (tooFar.length === 0) return null;

  // ADR-0019 made this sentence incomplete on its own. A reader who finds
  // Border Field State Park listed and Tijana River not, both refused for a
  // buoy tens of kilometres away, has been told the same reason for two
  // different outcomes. So where the buoy is what refused the beach and a line
  // was near enough to have stood in but is not, say that too -- derived from
  // the binding rather than written against a slug, so it explains any beach in
  // that state and stops explaining one that leaves it.
  const modelCouldNotStandIn =
    buoyTooFar &&
    beach.mop_line !== null &&
    beach.mop_line_distance_m > modelledM
      ? `. A model can answer for the waves where no buoy is in range, but not here: the ` +
        `nearest MOP line is ${kilometres(beach.mop_line_distance_m)} away, and every beach ` +
        `on this coast binds one inside ${kilometres(modelledM)}`
      : "";

  return (
    `${tooFar.join(" and ")}, and this site does not publish a reading taken more than ` +
    `${kilometres(toleranceM)} from the beach it is shown for${modelCouldNotStandIn}`
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

export function document(built, now = new Date()) {
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

  const airKm = beaches
    .filter((b) => b.air_station !== null)
    .map((b) => b.air_station_distance_m / 1000)
    .sort((a, b) => a - b);
  const medianAirKm = airKm[Math.floor(airKm.length / 2)];
  // Null when no beach binds a line at all, which is a real state rather than
  // an oversight: an inventory of nothing but bays reaches no line, and a
  // sentence about how far the lines are would then be about nothing.
  const withMop = beaches.filter((b) => b.mop_line !== null);
  const mopReach =
    withMop.length === 0
      ? null
      : {
          medianM: withMop
            .map((b) => b.mop_line_distance_m)
            .sort((a, b) => a - b)[Math.floor(withMop.length / 2)],
          farthest: withMop.reduce((a, b) =>
            b.mop_line_distance_m > a.mop_line_distance_m ? b : a,
          ),
        };
  const farthest = beaches
    .filter((b) => b.tide_station !== null)
    .reduce((a, b) =>
      b.tide_station_distance_m > a.tide_station_distance_m ? b : a,
    );

  return {
    version: "0.2.0",
    generated: generatedDate(now),
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
      `the binding distance that refused it, so nothing leaves this inventory silently. ` +
      `ONE THING IS NOT A MEASUREMENT, and it is the newer half: where the tide reaches a ` +
      `beach but no buoy does, a CDIP MOP line within ` +
      `${kilometres(MODELLED_SOURCE_TOLERANCE_M)} may answer for the waves instead, and the ` +
      `buoy binding is dropped rather than published -- so those beaches carry wave_buoy null ` +
      `with the distance that refused it, and their only wave figure is model output. The ` +
      `page says so where it shows one. See ` +
      `docs/adr/0011-inventory-bounded-by-station-networks.md and ` +
      `docs/adr/0019-a-modelled-source-may-qualify-a-beach.md.`,
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
      wave_buoy:
        "Joined, never typed: the nearest delivering NDBC buoy that publishes waves, and the " +
        "only measurement of the sea itself on this page. null carries TWO meanings and " +
        "wave_buoy_null_reason always distinguishes them: the join declined to bind one -- " +
        "every bay and lagoon, and the cove closed off by a breakwater -- or the join bound " +
        "one and this site declined to publish it, because it sits further away than _served " +
        "allows and a MOP line answers in its place. The second is the newer case, it names " +
        "both the refused distance and the line that replaced it, and it means the beach's " +
        "only wave figure is modelled. See docs/adr/0019-a-modelled-source-may-qualify-a-beach.md.",
      wave_buoy_distance_m:
        "Great-circle metres from the nearer segment end to the buoy. Always within _served's " +
        "tolerance when it is present at all: a buoy further than that is dropped rather than " +
        "recorded, so this field never carries a distance the site would not publish.",
      wave_buoy_from_end:
        "Which end of the segment supplied the distance, upper or lower.",
      mop_line:
        "Joined, never typed: the nearest delivering CDIP MOP line, subject to the same " +
        "water-class refusal as wave_buoy -- every line sits at 10 m depth on the open coast. " +
        "USUALLY a second wave binding rather than a replacement: wave_buoy answers for now " +
        "and this answers for the week ahead. At the four beaches no buoy reaches it is the " +
        "only wave source, which is a decision rather than a join result and is why _served " +
        "names it. null means the join could not bind one, and mop_line_null_reason says why. " +
        "See mop-lines.json.",
      mop_line_distance_m:
        "Great-circle metres from the nearer segment end to the line. Much smaller than " +
        "wave_buoy_distance_m wherever both are present -- the lines are about 100 m apart -- " +
        "which is why the water-class refusal above is a rule about the water and not a " +
        "distance. A distance rule exists all the same, and answers a different question: a " +
        "line beyond _served's modelled tolerance cannot answer for a beach ALONE, because at " +
        "this spacing a line kilometres away means the nearest open coast is kilometres away " +
        "rather than that the model is coarse there. It still binds, and still fills the week.",
      mop_line_from_end:
        "Which end of the segment supplied the distance, upper or lower.",
      grid_cell:
        "Joined, never typed: the National Weather Service forecast cell this beach falls in, " +
        "as office/x,y. NOT a nearest-anything -- a cell is an area about 2.5 km square and " +
        "every coordinate inside it is equally inside it, so there is no distance to be " +
        "nearer by and this field has none beside it. The mapping from a coordinate to a cell " +
        "belongs to the National Weather Service and cannot be recomputed offline, so it is " +
        "measured into grid-cells.json and read from there. null means no cell answers, and " +
        "grid_cell_null_reason says why -- which for an excluded beach is simply that the " +
        "table records coordinates only for the beaches this site serves.",
      grid_cell_from_end:
        "Which end of the segment fell in the bound cell. Load-bearing rather than " +
        "decoration: a beach is a segment and 17 of 45 straddle a cell boundary, so an end " +
        "had to be chosen and this records which. The criterion is elevation, not distance.",
      grid_cell_elevation_m:
        "The bound cell's own mean elevation in metres. This is the cell's TERRAIN and not a " +
        "statement about the forecast: it is what chose between the beach's two ends, on the " +
        "grounds that a beach is at sea level and the lower cell is the one describing this " +
        "shore. Three beaches have no low-lying end and read a cell averaging over 100 m; the " +
        "page says so where it shows one. See docs/adr/0020-sky-leaves-the-card-for-the-week.md.",
      air_station:
        "Joined, never typed: the nearest station that answers, publishes air temperature AND " +
        "wind, and suits the beach's water class -- an open-coast beach binds a shore station, " +
        "a bay or lagoon binds the nearest of any kind. Usually not the same station as " +
        "the sky station this table used to carry, and may be on either network; see the " +
        "`network` field in " +
        "observation-stations.json. null means the join could not bind one, and " +
        "air_station_null_reason says why.",
      air_station_distance_m:
        "Great-circle metres from the nearer segment end to the station. Much smaller than the " +
        "sky station's was -- p50 3.7 km against 7.9 km -- which is what the second binding " +
        "existed to protect and is why this one outlived it.",
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
      `${beaches.filter((b) => b.wave_buoy === null).length} of these beaches get no MEASURED wave ` +
        `height, for two different reasons that their wave_buoy_null_reason tells apart. At ` +
        `${beaches.filter((b) => b.wave_buoy === null && b.mop_line === null).length} of them the ` +
        `join bound no buoy: every NDBC wave buoy sits on the open coast, and ocean swell does not ` +
        `reach into a bay or lagoon, so binding one to the nearest buoy would put an open-ocean ` +
        `number on enclosed water. Their water temperature is missing for the same reason and is ` +
        `not yet filled from another source. At the other ` +
        `${beaches.filter((b) => b.wave_buoy === null && b.mop_line !== null).length} the join DID ` +
        `bind a buoy and this site declined to publish it, because the only one left is far past ` +
        `${kilometres(SERVICE_TOLERANCE_M)} -- 46235 Imperial Beach Nearshore died in May 2026 and ` +
        `was the only buoy south of Point Loma. Those beaches are open coast and do get a wave ` +
        `figure, from a model rather than an instrument, and the page says which it is. See ` +
        `docs/adr/0019-a-modelled-source-may-qualify-a-beach.md.`,
      `${beaches.filter((b) => b.mop_line === null).length} beaches get no wave forecast, and ` +
        `the refusal costs more here than it does for the buoy: MOP lines sit about 100 m ` +
        `apart, so the nearest one to an enclosed beach is close enough to look right. It would ` +
        `still be describing the open coast outside.` +
        (mopReach === null
          ? ""
          : ` The median bound beach reads a line ${mopReach.medianM} m away and the farthest ` +
            `reads one ${mopReach.farthest.mop_line_distance_m} m away, at ` +
            `${mopReach.farthest.name}. Every one is inside a kilometre, and that closeness is ` +
            `now load-bearing rather than merely reassuring: where no buoy is in range, a line ` +
            `within ${kilometres(MODELLED_SOURCE_TOLERANCE_M)} answers for the beach on its own ` +
            `and the beach is listed on the strength of it. A model deciding what this site ` +
            `covers is a change of kind, and it is argued in ` +
            `docs/adr/0019-a-modelled-source-may-qualify-a-beach.md rather than assumed here.`),
      "A tide prediction is for the station, not for the beach. It is the best published figure " +
        "for that stretch of shore and it is not a measurement taken there.",
      "Cloud comes from a forecast rather than a reading, and there is no visibility figure " +
        "at all. The ten stations in this county publishing either one are airport METARs, and " +
        "an aerodrome observation describes its own field: this site read one until 2026-08-27 " +
        "and stopped. The week grid shows cloud forecast for each beach's own square of the " +
        "National Weather Service's map instead. See " +
        "docs/adr/0020-sky-leaves-the-card-for-the-week.md.",
      `Air temperature and wind come from the station nearest the shore, and the page names ` +
        `it with its distance. The median beach reads its air station ` +
        `${Math.round(medianAirKm * 10) / 10} km away. That binding exists separately because ` +
        `requiring one station to supply sky as well meant the scarcest value decided where the ` +
        `temperature was measured, which put an inland reading on a coastal beach; the sky ` +
        `binding has since gone entirely and this one is what it was protecting. See ` +
        `docs/adr/0010-two-provenances-in-the-air-panel.md.`,
      `An air station is still not the beach. It is the nearest measurement of the air the ` +
        `beach is in, chosen for exposure as well as distance -- an open-coast beach binds a ` +
        `station standing in the marine layer at the shoreline, a bay or lagoon binds the ` +
        `nearest of any kind. The shore classification is an author judgement; ` +
        `observation-stations.json records it and says so.`,
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
  const mopLines = JSON.parse(readFileSync(MOP_LINES_PATH, "utf8")).lines;
  const gridCells = JSON.parse(readFileSync(GRID_CELLS_PATH, "utf8"));
  const observationStations = JSON.parse(
    readFileSync(OBSERVATION_STATIONS_PATH, "utf8"),
  ).stations;
  let existing = null;
  try {
    existing = JSON.parse(readFileSync(BEACHES_PATH, "utf8"));
  } catch {
    existing = null;
  }

  const rows = await fetchRows();
  const built = document(
    build(rows, stations, buoys, observationStations, mopLines, gridCells),
  );

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
