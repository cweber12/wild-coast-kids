/**
 * NDBC `realtime2`: the pinned column layout, and the newest observation.
 *
 * Pure and offline, like the CO-OPS parser beside it. It takes the text a buoy
 * served and returns typed values or raises.
 *
 * WHAT IS PINNED, and why each would otherwise produce a confident wrong number:
 *
 *   The column names, in order. This is a fixed-width-ish text table with no
 *   schema, so the only way to know that the ninth field is wave height is to
 *   assert the header still says so. A column inserted upstream would silently
 *   shift every reading one place.
 *
 *   The units, which -- unusually and helpfully -- the payload states on its
 *   second header line. So they are read rather than assumed: `m` for wave
 *   height, `degC` for water temperature, `sec` for period. An upstream switch
 *   to feet would otherwise be invisible and would read as a very calm day.
 *
 *   `MM` as the missing marker. Every nearshore buoy in this corridor leaves
 *   wind, gusts and visibility as `MM` on every row, so a parser that read `MM`
 *   as a number would report a dead calm at every beach on the coast.
 *
 * The newest observation is the FIRST data row. NDBC serves newest-first, which
 * is the opposite of CO-OPS, and taking the last row would report a reading
 * several days old as current.
 */

/** The 19 columns, in the order the header declares them. */
const COLUMNS = [
  "YY",
  "MM",
  "DD",
  "hh",
  "mm",
  "WDIR",
  "WSPD",
  "GST",
  "WVHT",
  "DPD",
  "APD",
  "MWD",
  "PRES",
  "ATMP",
  "WTMP",
  "DEWP",
  "VIS",
  "PTDY",
  "TIDE",
] as const;

/** Units this parser knows how to convert from, keyed by column. */
const EXPECTED_UNITS: Record<string, string> = {
  WVHT: "m",
  DPD: "sec",
  WTMP: "degC",
  MWD: "degT",
};

/** NDBC's missing-value marker. */
const MISSING = "MM";

export class NdbcDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NdbcDriftError";
  }
}

export class NdbcNoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NdbcNoDataError";
  }
}

export interface WaveObservation {
  /** Instant of the observation, epoch milliseconds UTC. */
  atMs: number;
  /** Significant wave height in feet, converted from the metres NDBC publishes. */
  heightFt: number;
  /** Dominant period in seconds, or null when the buoy left it missing. */
  periodS: number | null;
  /** Mean wave direction in degrees true, or null. */
  directionDegT: number | null;
  /** Water temperature in Fahrenheit, converted from Celsius, or null. */
  waterTempF: number | null;
}

function assertHeader(lines: string[], buoyId: string): void {
  const [names, units] = lines;
  if (!names?.startsWith("#") || !units?.startsWith("#")) {
    throw new NdbcDriftError(
      `NDBC ${buoyId}: expected two '#' header lines and did not find them.`,
    );
  }

  const declared = names.slice(1).trim().split(/\s+/);
  if (
    declared.length !== COLUMNS.length ||
    declared.some((c, i) => c !== COLUMNS[i])
  ) {
    throw new NdbcDriftError(
      `NDBC ${buoyId}: the column layout has drifted. Expected ${COLUMNS.length} columns ` +
        `starting ${COLUMNS.slice(0, 9).join(" ")}, and found ${declared.length}: ` +
        `${declared.slice(0, 9).join(" ")}. Refusing to read a value by position.`,
    );
  }

  const declaredUnits = units.slice(1).trim().split(/\s+/);
  for (const [column, expected] of Object.entries(EXPECTED_UNITS)) {
    const actual =
      declaredUnits[COLUMNS.indexOf(column as (typeof COLUMNS)[number])];
    if (actual !== expected) {
      throw new NdbcDriftError(
        `NDBC ${buoyId}: ${column} is published in ${JSON.stringify(actual)}, not ` +
          `${JSON.stringify(expected)}. The payload states its own units and they have ` +
          `changed; converting on the old assumption would be a wrong number.`,
      );
    }
  }
}

function value(
  fields: string[],
  column: (typeof COLUMNS)[number],
): string | null {
  const raw = fields[COLUMNS.indexOf(column)];
  return raw === undefined || raw === MISSING ? null : raw;
}

function numberOrNull(
  raw: string | null,
  column: string,
  buoyId: string,
): number | null {
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new NdbcDriftError(
      `NDBC ${buoyId}: ${column} was ${JSON.stringify(raw)}, not a number.`,
    );
  }
  return parsed;
}

/**
 * Parse the newest observation out of a `realtime2` payload.
 *
 * Raises `NdbcNoDataError` when the buoy answered with no rows -- which is a
 * quiet buoy rather than a calm sea -- and `NdbcDriftError` when the layout or
 * the units are not what is pinned above.
 */
export function parseNdbcRealtime2(
  text: string,
  buoyId: string,
): WaveObservation {
  const lines = text.split("\n").map((line) => line.trimEnd());
  assertHeader(lines, buoyId);

  const rows = lines.filter((line) => line !== "" && !line.startsWith("#"));
  if (rows.length === 0) {
    throw new NdbcNoDataError(
      `NDBC ${buoyId} served headers and no observations. That is a buoy which is not ` +
        `reporting, not a calm sea.`,
    );
  }

  // Newest first. Taking the last row would report a days-old reading as current.
  const fields = rows[0].split(/\s+/);

  const [year, month, day, hour, minute] = fields
    .slice(0, 5)
    .map((part) => Number(part));
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) {
    throw new NdbcDriftError(
      `NDBC ${buoyId}: the newest row's timestamp fields did not parse: ` +
        `${fields.slice(0, 5).join(" ")}.`,
    );
  }

  const heightM = numberOrNull(value(fields, "WVHT"), "WVHT", buoyId);
  if (heightM === null) {
    throw new NdbcNoDataError(
      `NDBC ${buoyId}'s newest observation carries no wave height. The buoy is reporting, ` +
        `and not reporting waves.`,
    );
  }

  const waterTempC = numberOrNull(value(fields, "WTMP"), "WTMP", buoyId);

  return {
    // The header's date fields carry no zone. NDBC publishes realtime2 in UTC.
    atMs: Date.UTC(year, month - 1, day, hour, minute),
    heightFt: heightM * 3.280839895,
    periodS: numberOrNull(value(fields, "DPD"), "DPD", buoyId),
    directionDegT: numberOrNull(value(fields, "MWD"), "MWD", buoyId),
    waterTempF: waterTempC === null ? null : waterTempC * 1.8 + 32,
  };
}
