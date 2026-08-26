/**
 * CDIP MOP over THREDDS NCSS: the pinned column layout, and the forecast rows.
 *
 * Pure and offline, like the two parsers beside it. It takes the CSV the point
 * service served and returns typed values or raises.
 *
 * NO NETCDF, AND THAT IS THE POINT OF READING IT THIS WAY. MOP is published as
 * NetCDF over OPeNDAP, which nothing in this repo can parse and which would have
 * cost a fourth runtime dependency or a build step. The same THREDDS server
 * serves the same datasets as CSV through its NetCDF Subset Service, with the
 * units declared per column, so this parser is the same shape as the two next
 * door and the dependency budget is untouched.
 *
 * WHAT IS PINNED, and why each would otherwise produce a confident wrong number:
 *
 *   The column names, in order. NCSS names them in the header and orders them
 *   by the request, so a variable added or reordered upstream would shift every
 *   reading one place.
 *
 *   The units, which -- as with `realtime2` -- the payload states itself, inside
 *   the column name: `waveHs[unit="meter"]`. Read rather than assumed. A switch
 *   to feet would otherwise be invisible and would read as an enormous swell.
 *
 *   The station on every row. The service answers per file, so a response for
 *   the wrong line is a response about the wrong beach, and every row carries
 *   the id to check it against.
 *
 *   The timestamp's `Z`. This feed states its zone, which is what keeps
 *   ADR-0009's offset hazard away from it, and a timestamp that stopped saying
 *   so would age every row by seven or eight hours in silence.
 *
 * `waveFlagPrimary` IS KEPT AT 1 AND DROPPED OTHERWISE, which is the opposite of
 * what #126's body asked for. The variable's own metadata declares
 * `flag_values: 1 2 3 4 9` against `flag_meanings: good not_evaluated
 * questionable bad missing`, so 1 is the good one. Rejecting it would have
 * emptied the row at every beach and presented as a dead feed rather than as a
 * bug. What is dropped is counted, because MOP degrades when its driving buoys
 * malfunction and a run that is mostly flagged is a fact about the model rather
 * than a quiet day.
 *
 * A ROW THAT IS FLAGGED GOOD AND DOES NOT PARSE IS DRIFT, not a missing value.
 * This feed has a marker for missing -- flag 9 -- so a payload that says "good"
 * and then serves something that is not a number is contradicting itself, and
 * guessing which half to believe is how a wrong number gets published.
 */

/**
 * The NetCDF Subset Service's point endpoint, which is the half of THREDDS that
 * serves CSV. `/thredds/ncss/grid/` beside it serves the gridded MOP products
 * and cannot open an alongshore line at all.
 */
const NCSS_POINT =
  "https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore";

/**
 * The variables asked for, and the whole reason the response has eight columns.
 *
 * `waveDp` is requested and not rendered. It costs nothing -- the row is served
 * either way -- and a swell's direction is what the next product to read this
 * feed will want. It is asserted like the other two so that the day it is used,
 * it is already pinned.
 */
const VARIABLES = ["waveHs", "waveTp", "waveDp", "waveFlagPrimary"];

/** What one request for one line's forecast needs. */
export interface MopRequestContract {
  /** The MOP line id, e.g. `D0498`. */
  lineId: string;
  /** Inclusive start, an ISO instant ending in `Z`. */
  startIso: string;
  /** Inclusive end, an ISO instant ending in `Z`. */
  endIso: string;
}

/**
 * The URL for one line's forecast window.
 *
 * The window is always sent. `time=all` on a nowcast returned 914 KB of rolling
 * history back to April 2025; bounded, the whole forecast is about 6 KB.
 *
 * `_forecast` and never `_nowcast`, `_hindcast` or `_ecmwf_fc`. The forecast
 * reaches about three days back and seven forward, so it covers today and the
 * rest of the week in one request; the nowcast only reaches backwards and the
 * hindcast is 155 MB per line.
 */
export function mopForecastUrl(contract: MopRequestContract): string {
  const query = new URLSearchParams();
  for (const variable of VARIABLES) query.append("var", variable);
  query.set("accept", "csv");
  query.set("time_start", contract.startIso);
  query.set("time_end", contract.endIso);
  return `${NCSS_POINT}/${contract.lineId}_forecast.nc?${query.toString()}`;
}

/** The columns, in the order the request asks for them and the header declares them. */
const COLUMNS = [
  "time",
  "station",
  "latitude",
  "longitude",
  "waveHs",
  "waveTp",
  "waveDp",
  "waveFlagPrimary",
] as const;

/**
 * Units each converted column is read from, keyed by column.
 *
 * Latitude and longitude are not here: they arrive with every point response,
 * this parser converts neither, and asserting a unit nothing turns on would
 * fail the read for a change that cannot affect a reading.
 */
const UNITS: Record<string, string> = {
  waveHs: "meter",
  waveTp: "second",
  waveDp: "degreeT",
};

/** `waveHs[unit="meter"]` — the name, and the unit the payload declares for it. */
const DECLARED = /^([A-Za-z]+)(?:\[unit="([^"]*)"\])?$/;

/** An instant this feed states the zone of. Offset-less would be ADR-0009's hazard. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** `waveFlagPrimary`'s good value, from the variable's own `flag_meanings`. */
export const FLAG_GOOD = "1";

export class MopDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MopDriftError";
  }
}

export class MopNoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MopNoDataError";
  }
}

/** One three-hourly estimate, converted to what the page renders. */
export interface MopWaveRow {
  /** Instant of the estimate, epoch milliseconds UTC. */
  atMs: number;
  /** Significant wave height in feet, converted from the metres CDIP publishes. */
  heightFt: number;
  /** Peak period in seconds. */
  periodS: number;
  /** Peak direction in degrees true. */
  directionDegT: number;
}

export interface MopForecast {
  /** The line the payload says it is for, having been checked against the one asked. */
  lineId: string;
  /** Every row the flag passed, oldest first, as the service serves them. */
  rows: MopWaveRow[];
  /**
   * How many rows the flag rejected.
   *
   * Carried rather than discarded because it is the signal the model is
   * degrading: MOP output goes bad when its driving buoys do, and a run that is
   * mostly flagged is a fact about the model. Nothing monitors it yet, so today
   * it reaches the reader only inside the message when every row is rejected --
   * which is the case that would otherwise render an empty row and look like an
   * outage.
   */
  flaggedOut: number;
}

function assertHeader(header: string | undefined, lineId: string): void {
  if (header === undefined) {
    throw new MopDriftError(
      `CDIP ${lineId}: the response carried no header line at all.`,
    );
  }

  const fields = header.split(",");
  if (fields.length !== COLUMNS.length) {
    throw new MopDriftError(
      `CDIP ${lineId}: expected ${COLUMNS.length} columns and the header declares ` +
        `${fields.length}: ${header}. Refusing to read a value by position.`,
    );
  }

  fields.forEach((field, index) => {
    const match = DECLARED.exec(field.trim());
    if (match === null) {
      throw new MopDriftError(
        `CDIP ${lineId}: column ${index} is declared as ${JSON.stringify(field)}, which is ` +
          `not a name or a name with a unit.`,
      );
    }

    const [, name, unit] = match;
    if (name !== COLUMNS[index]) {
      throw new MopDriftError(
        `CDIP ${lineId}: column ${index} is ${JSON.stringify(name)} and should be ` +
          `${JSON.stringify(COLUMNS[index])}. The column layout has drifted.`,
      );
    }

    const expected = UNITS[name];
    if (expected !== undefined && unit !== expected) {
      throw new MopDriftError(
        `CDIP ${lineId}: ${name} is published in ${JSON.stringify(unit)}, not ` +
          `${JSON.stringify(expected)}. The payload states its own units and they have ` +
          `changed; converting on the old assumption would be a wrong number.`,
      );
    }
  });
}

function number(raw: string, column: string, lineId: string): number {
  const parsed = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(parsed)) {
    throw new MopDriftError(
      `CDIP ${lineId}: ${column} was ${JSON.stringify(raw)} on a row this feed flagged good. ` +
        `A missing value has a flag of its own here, so a good row that is not a number is ` +
        `the payload contradicting itself.`,
    );
  }
  return parsed;
}

/**
 * Parse a MOP forecast out of an NCSS CSV response.
 *
 * Raises `MopNoDataError` when the line answered with no rows, or with no rows
 * the flag passed -- both of which are a model that is not forecasting rather
 * than a flat sea -- and `MopDriftError` when the layout, the units, the station
 * or a good row's values are not what is pinned above.
 */
export function parseMopForecast(text: string, lineId: string): MopForecast {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  assertHeader(lines[0], lineId);

  const dataRows = lines.slice(1);
  if (dataRows.length === 0) {
    throw new MopNoDataError(
      `CDIP ${lineId} served a header and no forecast. That is a line which is not being ` +
        `forecast, not a week with no waves in it.`,
    );
  }

  const rows: MopWaveRow[] = [];
  let flaggedOut = 0;

  for (const row of dataRows) {
    const fields = row.split(",");
    if (fields.length !== COLUMNS.length) {
      throw new MopDriftError(
        `CDIP ${lineId}: a row carries ${fields.length} values against ` +
          `${COLUMNS.length} columns: ${row}`,
      );
    }

    const [time, station, , , height, period, direction, flag] = fields;

    if (station !== lineId) {
      throw new MopDriftError(
        `CDIP ${lineId}: a row is for station ${JSON.stringify(station)}. The service answers ` +
          `per line, so a response for another one is a reading about another beach.`,
      );
    }

    if (flag !== FLAG_GOOD) {
      flaggedOut += 1;
      continue;
    }

    if (!INSTANT.test(time)) {
      throw new MopDriftError(
        `CDIP ${lineId}: ${JSON.stringify(time)} is not a UTC instant ending in Z. This feed ` +
          `states its own zone, and reading an offset-less time as UTC would age the row.`,
      );
    }

    rows.push({
      atMs: Date.parse(time),
      heightFt: number(height, "waveHs", lineId) * 3.280839895,
      periodS: number(period, "waveTp", lineId),
      directionDegT: number(direction, "waveDp", lineId),
    });
  }

  if (rows.length === 0) {
    throw new MopNoDataError(
      `CDIP ${lineId} flagged all ${flaggedOut} of its forecast rows as not good. MOP degrades ` +
        `when the buoys driving it malfunction, so this is a model that cannot forecast this ` +
        `stretch of coast right now rather than a flat week.`,
    );
  }

  return { lineId, rows, flaggedOut };
}
