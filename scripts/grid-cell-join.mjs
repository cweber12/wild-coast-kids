/**
 * Binding a beach to its National Weather Service forecast cell.
 *
 * Pure, like the four joins beside it, and the same contract: a binding with
 * the end it came from, or a null with a reason. What differs is what decides
 * it, and the difference is forced rather than chosen.
 *
 * DISTANCE CANNOT CHOOSE THE END HERE. Every other join measures a beach
 * against a point -- a station, a buoy, a model line -- and takes the nearer
 * end. A forecast cell is an area about 2.5 km square, and every coordinate
 * inside it is equally inside it: there is no distance to be nearer by. A beach
 * is a segment, and 17 of the 45 served straddle a cell boundary, so an end
 * still has to be picked.
 *
 * SO IT IS PICKED BY ELEVATION, WHICH IS ABOUT THE BEACH RATHER THAN ABOUT US.
 * A beach is at sea level. Of two cells a beach's ends fall in, the one whose
 * mean elevation is nearer sea level is the one describing this shore rather
 * than the terrain behind it. Measured 2026-08-26 that moves Del Mar City Beach
 * from a cell averaging 102 m to one averaging 22 m, and La Jolla Shores Beach
 * from 117 m to 0 m. It does not rescue everything -- three beaches have no
 * low-lying end to pick -- and ADR-0020 records why they are served anyway and
 * how weak the proxy is.
 *
 * THE CRITERION IS NOT FITTED TO THE OUTCOME, and the distinction matters
 * because ADR-0019 was explicit that a bound derived from the answer you wanted
 * is not a bound. Sea level is where a beach is; it was not chosen because of
 * which beaches it happened to move.
 *
 * IT READS A RESOLUTION RATHER THAN COMPUTING ONE. `/points` owns the mapping
 * from a coordinate to a cell and it cannot be recomputed offline, so
 * `probe-grid-cells.mjs` records it and this reads it. That keeps the join pure
 * and testable, which is the same trade the other four make against their own
 * tables.
 */

/** How far above sea level a cell may average before the page says so. */
export const BLUFF_ELEVATION_M = 50;

/**
 * Bind one beach to a forecast cell.
 *
 * @param {{slug: string}} beach
 * @param {{cells: Record<string, {elevation_m: number | null, delivers: boolean}>,
 *   resolutions: Record<string, Record<string, {cell: string | null, reason?: string}>>}} table
 * @returns {{cellId: string, fromEnd: string, elevationM: number | null}
 *   | {cellId: null, reason: string}}
 */
export function bindGridCell(beach, table) {
  const resolution = table.resolutions[beach.slug];

  if (resolution === undefined) {
    // Two different situations reach here and the wording has to fit both.
    // `/points` needs a coordinate, and the only coordinates this repo holds
    // are the served inventory's -- an excluded beach records why it was
    // excluded and nothing else -- so the table covers the served beaches and
    // the seed asks it about all 73. For an excluded beach this is expected and
    // the binding is discarded; for a served one it means the inventory moved
    // since the last probe, which `seed-beaches.mjs` raises rather than files
    // away. Claiming staleness in both cases would cry wolf on 28 beaches
    // every run.
    return {
      cellId: null,
      reason:
        `the forecast-cell table does not list ${beach.slug}; it covers the beaches this ` +
        `site serves, because resolving a cell needs a coordinate and an excluded beach ` +
        `has none recorded`,
    };
  }

  const candidates = [];
  const refusals = [];

  for (const end of ["lower", "upper"]) {
    const resolved = resolution[end];
    if (resolved === undefined) continue;
    if (resolved.cell === null) {
      refusals.push(`${end}: ${resolved.reason}`);
      continue;
    }
    const cell = table.cells[resolved.cell];
    if (cell === undefined) {
      refusals.push(
        `${end}: cell ${resolved.cell} is named by the resolution and missing from the table`,
      );
      continue;
    }
    if (!cell.delivers) {
      refusals.push(
        `${end}: cell ${resolved.cell} answers but publishes no sky cover series`,
      );
      continue;
    }
    candidates.push({
      cellId: resolved.cell,
      fromEnd: end,
      elevationM: cell.elevation_m,
    });
  }

  if (candidates.length === 0) {
    return {
      cellId: null,
      reason:
        refusals.length > 0
          ? `no forecast cell answers for this beach -- ${refusals.join("; ")}`
          : "this beach's segment resolved to no forecast cell at either end",
    };
  }

  let best = null;
  for (const candidate of candidates) {
    // A cell with no published elevation cannot win on elevation, but it can
    // still be the only candidate. Sorting it last rather than dropping it is
    // what keeps a beach bound when the figure is missing rather than high.
    const height = candidate.elevationM ?? Number.POSITIVE_INFINITY;
    const bestHeight =
      best === null ? null : (best.elevationM ?? Number.POSITIVE_INFINITY);
    // Ties break on the cell id, so two runs over the same inputs agree and the
    // re-join's diff keeps meaning something. Both ends of 27 of 45 beaches
    // resolve into one cell, where the tie is the common case rather than the
    // edge one.
    if (
      best === null ||
      height < bestHeight ||
      (height === bestHeight && candidate.cellId < best.cellId)
    ) {
      best = candidate;
    }
  }

  return best;
}

/**
 * Whether a bound cell averages far enough above sea level that the page owes
 * the reader a sentence about it.
 *
 * Separate from the binding because it is a fact about the cell rather than a
 * reason to refuse one: ADR-0020 serves these beaches and discloses, rather
 * than withholding.
 *
 * @param {number | null} elevationM
 * @returns {boolean}
 */
export function spansBluff(elevationM) {
  return elevationM !== null && elevationM > BLUFF_ELEVATION_M;
}
