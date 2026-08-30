/**
 * The `sea-side` gate row's verdict: which side of the traced coast is water.
 *
 * `ShoreMap` shades the sea. To shade it, something has to know which side of
 * the drawn coastline the water is on, and the answer this repo relies on is
 * that `mop-lines.json` runs south to north along a west-facing county, so the
 * sea is on the left of the walk. That claim is one sentence and it is holding
 * up a picture, which is exactly the shape ADR-0021 says gets a checker rather
 * than a comment.
 *
 * **What it checks, and why not the obvious thing.** The obvious check is that
 * every wave buoy falls left of the whole polyline. That check fails, and it is
 * the check that is wrong rather than the data: walked end to end the file is
 * not monotonic -- it wraps Point Loma, where 39 of its 1,209 steps run north
 * to south -- so buoy 46232, 22.9 km off that peninsula, matches a segment on
 * the wrap and lands on the right. The map never asks the question that way.
 * It asks inside one beach's window, where the coast runs one way, and inside
 * every such window the rule holds. That is what is checked here.
 *
 * **Read only, and no flag that writes.** ADR-0021's first line. Nothing here
 * can regenerate `mop-lines.json`, because nothing here measured it.
 *
 * **The geometry is spelled twice, and the duplication is pinned.** This runs
 * under plain node for the gate and cannot import `src/lib/coastline.ts`;
 * `generated-date.mjs` already makes the same trade against `pacific-time.ts`,
 * and ADR-0021 requires the mirror be held by a test rather than by trust.
 * `sea-side.test.mjs` runs the whole committed file through both spellings and
 * asserts they agree, rather than sampling a case or two.
 */

/** The side of the walk the ocean is on. The whole point of the file. */
export const SEAWARD = "left";

/**
 * The margin `ShoreMap` frames a beach with, as a fraction of the larger span.
 *
 * Here because the window decides the verdict: a wider frame reaches more coast
 * and can change which segment is nearest. Checking a window the map does not
 * draw would be checking a different claim.
 */
export const WINDOW_MARGIN = 0.1;

/** Consecutive repeats dropped, so no segment has zero length and no direction. */
export function coastFrom(mopLines) {
  const points = [];

  for (const id of Object.keys(mopLines)) {
    const line = mopLines[id];
    const last = points[points.length - 1];
    if (last && last.lat === line.lat && last.lon === line.lon) continue;
    points.push({ id, lat: line.lat, lon: line.lon });
  }

  return points;
}

/** The box holding every position with an even margin, or null when there is none. */
export function boundsAround(positions, margin) {
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

/** The run of coast reaching a box, plus one point past each end. */
export function windowAround(points, bounds) {
  const inside = (point) =>
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

/** Which side of a walked run of coast a position falls on, north being up. */
export function sideOf(points, at) {
  if (points.length < 2) return null;

  const lonScale = Math.cos((at.lat * Math.PI) / 180);
  const east = (lon) => lon * lonScale;

  let nearest = Infinity;
  let cross = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];

    const dx = east(to.lon) - east(from.lon);
    const dy = to.lat - from.lat;
    const length = dx * dx + dy * dy;
    if (length === 0) continue;

    const px = east(at.lon) - east(from.lon);
    const py = at.lat - from.lat;

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

/** Everything one beach puts on its map, so the window is the one drawn. */
function positionsFor(beach, tables) {
  const positions = [beach.segment.upper, beach.segment.lower];

  const add = (table, key) => {
    const row = key ? table[key] : null;
    if (row) positions.push({ lat: row.lat, lon: row.lon });
  };

  add(tables.mopLines, beach.mop_line);
  add(tables.buoys, beach.wave_buoy);
  add(tables.tideStations, beach.tide_station);
  add(tables.observationStations, beach.air_station);

  return positions;
}

/**
 * The rows to print and whether the run passes.
 *
 * Pure over one argument, so a test can hand it a fabricated county and move a
 * buoy inland -- the split ADR-0002 made for the gate runner and ADR-0021
 * repeated for the probes.
 *
 * A beach whose window holds no coast is reported and does not fail. 23 of the
 * 51 committed beaches are in Mission Bay or San Diego Bay, between 2.6 and 5.4
 * km from the nearest MOP line, and this file traces the open coast only. That
 * is a fact about which water is mapped, not a broken rule, and failing on it
 * would cry wolf on nearly half the county. It is still printed, because
 * CLAUDE.md's rule is that nothing skipped is silent.
 */
export function checkSeaSide(tables) {
  const coast = coastFrom(tables.mopLines);
  const wrong = [];
  const skipped = new Map();
  let checked = 0;

  const skip = (reason, slug) => {
    const named = skipped.get(reason) ?? [];
    named.push(slug);
    skipped.set(reason, named);
  };

  for (const beach of tables.beaches) {
    const buoy = beach.wave_buoy ? tables.buoys[beach.wave_buoy] : null;
    if (!buoy) {
      skip("bind no wave buoy", beach.slug);
      continue;
    }

    const bounds = boundsAround(positionsFor(beach, tables), WINDOW_MARGIN);
    if (!bounds) {
      skip("have every source at one place", beach.slug);
      continue;
    }

    const side = sideOf(windowAround(coast, bounds), buoy);
    if (side === null) {
      skip("have no coast in their window", beach.slug);
      continue;
    }

    checked += 1;
    if (side !== SEAWARD) {
      wrong.push(
        `  ${beach.slug}: buoy ${beach.wave_buoy} is on the ${side} of its own ` +
          `coast, where the sea is meant to be on the ${SEAWARD}`,
      );
    }
  }

  const lines = [...wrong];
  lines.push(
    `sea-side: ${checked - wrong.length} of ${checked} beaches put their buoy ` +
      `${SEAWARD} of their own coast`,
  );

  // Grouped by reason with a count. One line per beach was 36 identical lines
  // against the county as it stands, which buries the line above rather than
  // reporting anything -- and CLAUDE.md's rule is that a skip is visible, not
  // that it is repeated. Beaches are named only for a reason that is rare
  // enough to be worth chasing.
  for (const [reason, named] of skipped) {
    const tail = named.length <= NAME_UP_TO ? `: ${named.join(", ")}` : "";
    lines.push(`  ${named.length} ${reason}${tail}`);
  }

  return { ok: wrong.length === 0, lines };
}

/**
 * Above this many, a reason is a category and the names stop being a lead.
 *
 * One or two beaches sharing a reason is an anomaly worth chasing by name.
 * Three is the start of a class, and 36 -- which is what "binds no wave buoy"
 * is against the county as it stands -- is a fact about the inventory.
 */
const NAME_UP_TO = 2;
