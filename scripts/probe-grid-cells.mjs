/**
 * Resolving this county's beaches to National Weather Service forecast cells.
 *
 *   node scripts/probe-grid-cells.mjs           write src/data/grid-cells.json
 *   node scripts/probe-grid-cells.mjs --check   exit 1 if the committed file has moved
 *
 * WHY THIS TABLE HOLDS A RESOLUTION AND THE OTHERS DO NOT. `mop-lines.json` and
 * `observation-stations.json` are catalogs of candidates with coordinates, and
 * the join beside each one computes the distance itself. There is no catalog
 * here. A forecast cell is not published as a point to measure against -- the
 * mapping from a coordinate to a cell is `/points`, and it belongs to the
 * National Weather Service. So the measurement recorded here IS that mapping,
 * per segment end, and `grid-cell-join.mjs` stays pure by reading it rather
 * than by recomputing something it cannot compute.
 *
 * TWO REQUESTS PER CELL, AND ONLY ONE PER END. `/points/{lat},{lon}` answers
 * which cell a coordinate falls in; `/gridpoints/{office}/{x},{y}` carries the
 * cell's own mean elevation and its forecast. Ends are resolved individually
 * because a beach is a segment and 17 of 45 straddle a cell boundary, and cells
 * are then fetched once each rather than once per end -- 21 cells served 89
 * ends when this was first run.
 *
 * WHAT `delivers` MEANS HERE, AND WHY IT IS NOT ASSUMED. A cell that answers
 * `/gridpoints` at all is not a cell that publishes sky: `skyCover`,
 * `visibility` and `ceilingHeight` are all declared keys in every payload, and
 * measured 2026-08-26 the last two carried an empty `values` array at every one
 * of the 21 cells while `skyCover` carried 34 to 37 entries. A key is not a
 * value. `delivers` counts entries.
 *
 * A COORDINATE CAN FALL OUTSIDE THE GRID. Border Field State Park's lower end
 * is south of the border and `/points` answers 404 `InvalidPoint` for it. That
 * is recorded against the end rather than dropped, because a beach with one
 * unresolvable end is a different thing from a beach with none, and the join
 * has to be able to tell them apart.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generatedDate } from "./generated-date.mjs";

const API = "https://api.weather.gov";

export const NWS_DOCS =
  "https://www.weather.gov/documentation/services-web-api";

const USER_AGENT =
  "wild-coast-kids/0.1 (+https://github.com/cweber12/wild-coast-kids) conditions";

const TABLE_PATH = new URL("../src/data/grid-cells.json", import.meta.url);
const BEACHES_PATH = new URL("../src/data/beaches.json", import.meta.url);

/** `SGX/55,25`. The office and the two indices, which together name a cell. */
export const CELL_ID = /^[A-Z]{3}\/\d+,\d+$/;

/** What `/points` answers for a coordinate the grid does not cover. */
const INVALID_POINT = "problems/InvalidPoint";

/**
 * The cell a `/points` payload names.
 *
 * @param {unknown} payload
 * @returns {{cellId: string, office: string, x: number, y: number}}
 */
export function parsePoint(payload) {
  const properties = payload?.properties;
  if (!properties || typeof properties !== "object") {
    throw new Error(
      "api.weather.gov /points answered without a properties object",
    );
  }

  const { gridId, gridX, gridY } = properties;
  if (typeof gridId !== "string" || gridId.length === 0) {
    throw new Error(
      `api.weather.gov /points answered gridId ${JSON.stringify(gridId)}, which is not an office`,
    );
  }
  if (!Number.isInteger(gridX) || !Number.isInteger(gridY)) {
    throw new Error(
      `api.weather.gov /points answered gridX ${JSON.stringify(gridX)} and gridY ` +
        `${JSON.stringify(gridY)}; both must be integers`,
    );
  }

  return {
    cellId: `${gridId}/${gridX},${gridY}`,
    office: gridId,
    x: gridX,
    y: gridY,
  };
}

/**
 * What a `/gridpoints` payload says about the cell itself.
 *
 * `delivers` counts `skyCover` entries rather than testing for the key, which
 * is the whole point: every payload declares the key.
 *
 * @param {unknown} payload
 * @returns {{elevationM: number | null, skyCoverEntries: number,
 *   visibilityEntries: number, ceilingEntries: number, delivers: boolean}}
 */
export function parseCell(payload) {
  const properties = payload?.properties;
  if (!properties || typeof properties !== "object") {
    throw new Error(
      "api.weather.gov /gridpoints answered without a properties object",
    );
  }

  const entries = (key) => {
    const series = properties[key];
    if (series === undefined) return 0;
    const values = series?.values;
    return Array.isArray(values) ? values.length : 0;
  };

  const elevation = properties.elevation;
  if (elevation !== undefined && elevation !== null) {
    if (elevation.unitCode !== "wmoUnit:m") {
      throw new Error(
        `api.weather.gov /gridpoints declared elevation in ${JSON.stringify(elevation.unitCode)}; ` +
          `this table records metres and will not convert silently`,
      );
    }
  }

  const skyCoverEntries = entries("skyCover");

  return {
    elevationM: typeof elevation?.value === "number" ? elevation.value : null,
    skyCoverEntries,
    visibilityEntries: entries("visibility"),
    ceilingEntries: entries("ceilingHeight"),
    delivers: skyCoverEntries > 0,
  };
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
  });
  if (!response.ok) {
    const body = await response.text();
    return { ok: false, status: response.status, body };
  }
  return { ok: true, body: await response.json() };
}

/**
 * Build the table from resolved ends and fetched cells.
 *
 * Pure, so the document's shape is asserted without a network.
 *
 * @param {Record<string, Record<string, {cellId: string | null, reason?: string}>>} resolutions
 * @param {Record<string, object>} cells
 */
export function buildTable(resolutions, cells) {
  const sortedCells = Object.fromEntries(
    Object.keys(cells)
      .sort()
      .map((id) => [id, cells[id]]),
  );
  const sortedResolutions = Object.fromEntries(
    Object.keys(resolutions)
      .sort()
      .map((slug) => [slug, resolutions[slug]]),
  );
  return { cells: sortedCells, resolutions: sortedResolutions };
}

export function document(table, now = new Date()) {
  const cells = Object.values(table.cells);
  const delivering = cells.filter((cell) => cell.delivers).length;
  const withVisibility = cells.filter(
    (cell) => cell.visibility_entries > 0,
  ).length;

  return {
    version: "0.1.0",
    generated: generatedDate(now),
    _provenance:
      `Measured by scripts/probe-grid-cells.mjs against ${API}; re-runnable and diffable ` +
      `with --check. Each beach segment end is resolved by /points, which is the National ` +
      `Weather Service's own mapping from a coordinate to a forecast cell and cannot be ` +
      `recomputed offline; each distinct cell is then read once from /gridpoints for its ` +
      `mean elevation and its published series. See ${NWS_DOCS}.`,
    _what_was_measured:
      `${cells.length} distinct cells serve this inventory, of which ${delivering} publish a ` +
      `sky cover series. ${withVisibility} publish a visibility series -- a key present with ` +
      `an empty values array is not a published variable, and every cell declares visibility ` +
      `and ceilingHeight whether or not it fills them. That is why delivers counts entries.`,
    _schema: {
      "cells.<id>.office: ": "The forecast office, from /points gridId.",
      "cells.<id>.x": "Grid column, from /points gridX.",
      "cells.<id>.y": "Grid row, from /points gridY.",
      "cells.<id>.elevation_m":
        "The cell's own mean elevation in metres, as /gridpoints publishes it. This is the " +
        "cell's terrain rather than a statement about the forecast, and the join uses it to " +
        "choose between a beach's two ends. See docs/adr/0020-sky-leaves-the-card-for-the-week.md.",
      "cells.<id>.sky_cover_entries":
        "How many skyCover values the cell published when measured. Zero means the cell " +
        "answers and does not forecast sky.",
      "cells.<id>.visibility_entries":
        "How many visibility values the cell published. Measured zero everywhere; recorded " +
        "rather than assumed, so a change upstream shows up as a diff.",
      "cells.<id>.ceiling_entries": "The same count for ceilingHeight.",
      "cells.<id>.delivers":
        "Whether the cell publishes sky cover. Derived from sky_cover_entries, never from " +
        "the presence of the key.",
      "resolutions.<slug>.<end>.cell":
        "The cell that segment end falls in, or null when the grid does not cover it.",
      "resolutions.<slug>.<end>.reason":
        "Present only when cell is null. What /points said.",
    },
    ...table,
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");

  const beaches = JSON.parse(readFileSync(BEACHES_PATH, "utf8")).beaches;

  const resolutions = {};
  const cellIds = new Set();

  for (const beach of beaches) {
    resolutions[beach.slug] = {};
    for (const end of ["upper", "lower"]) {
      const { lat, lon } = beach.segment[end];
      const result = await getJson(`${API}/points/${lat},${lon}`);
      if (!result.ok) {
        const outside = result.body.includes(INVALID_POINT);
        resolutions[beach.slug][end] = {
          cell: null,
          reason: outside
            ? `the National Weather Service grid does not cover ${lat},${lon}`
            : `/points answered HTTP ${result.status} for ${lat},${lon}`,
        };
        process.stderr.write(`x ${beach.slug}/${end} HTTP ${result.status}\n`);
        continue;
      }
      const { cellId } = parsePoint(result.body);
      resolutions[beach.slug][end] = { cell: cellId };
      cellIds.add(cellId);
      process.stderr.write(`. ${beach.slug}/${end} -> ${cellId}\n`);
    }
  }

  const cells = {};
  for (const cellId of [...cellIds].sort()) {
    const result = await getJson(`${API}/gridpoints/${cellId}`);
    if (!result.ok) {
      throw new Error(
        `/gridpoints answered HTTP ${result.status} for ${cellId}, which /points had just ` +
          `named. The grid has moved under this table; re-run and read the diff.`,
      );
    }
    const parsed = parseCell(result.body);
    const [office, indices] = cellId.split("/");
    const [x, y] = indices.split(",").map(Number);
    cells[cellId] = {
      office,
      x,
      y,
      elevation_m: parsed.elevationM,
      sky_cover_entries: parsed.skyCoverEntries,
      visibility_entries: parsed.visibilityEntries,
      ceiling_entries: parsed.ceilingEntries,
      delivers: parsed.delivers,
    };
    process.stderr.write(
      `. ${cellId} sky=${parsed.skyCoverEntries} vis=${parsed.visibilityEntries} ` +
        `elev=${parsed.elevationM}\n`,
    );
  }

  const built = document(buildTable(resolutions, cells));
  const serialised = `${JSON.stringify(built, null, 2)}\n`;

  if (checkOnly) {
    let committed;
    try {
      committed = readFileSync(TABLE_PATH, "utf8");
    } catch {
      throw new Error(
        "grid-cells.json is missing. Run without --check to write it.",
      );
    }
    // The generated date moves on every run and is not a measurement, so it is
    // excluded from the comparison the way probe-mop-lines.mjs excludes its own.
    const strip = (text) => text.replace(/"generated": "[^"]*"/, "");
    if (strip(committed) !== strip(serialised)) {
      throw new Error(
        "grid-cells.json has moved. Re-run without --check, read the diff, and say in the " +
          "commit message what changed upstream.",
      );
    }
    process.stderr.write("grid-cells.json is unchanged.\n");
    return;
  }

  writeFileSync(TABLE_PATH, serialised, "utf8");
  process.stderr.write(
    `wrote grid-cells.json: ${Object.keys(cells).length} cells, ` +
      `${Object.keys(resolutions).length} beaches\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
