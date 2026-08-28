/**
 * NOAA CO-OPS tide predictions: the request contracts, and their parsers.
 *
 * Pure and offline. It takes bytes that have already been parsed as JSON plus
 * the contract they were requested under, and returns typed values or raises.
 * Nothing here retries, caches, or knows a URL was fetched -- that is
 * `upstream.ts`, so this file can be asserted against a committed payload with
 * no network at all.
 *
 * TWO INTERVALS OF ONE PRODUCT, and they answer different questions.
 * `interval=hilo` returns the turning points, which is what "the lowest tide
 * today" wants and what the week grid's figures are selected from.
 * `interval=h` returns a height on every hour, which is what a curve wants:
 * four turning points cannot be drawn as the shape of a day, and a reader
 * asking whether the tide falls all afternoon is asking about the hours between
 * the extremes rather than about the extremes. Both are the same station, the
 * same three pinned facts and the same failure vocabulary, which is why they
 * share this file rather than getting one each.
 *
 * Three facts are pinned because a payload cannot state them, and getting any of
 * them wrong produces a confident wrong number rather than an error:
 *
 *   time_zone=gmt   The `t` strings carry NO offset -- "2026-08-17 13:24" and
 *                   nothing more. Asking CO-OPS for local time and then reading
 *                   those strings as UTC ages every row by 7-8 hours, which is a
 *                   mistake that looks like data. GMT is requested so that
 *                   reading them as UTC is correct by construction.
 *   units=english   Heights are feet. There is no unit string in the payload to
 *                   check against, so the request is the only record of it.
 *   datum=MLLW      Heights are relative to mean lower low water, which is what
 *                   makes a negative number meaningful.
 *
 * And one failure mode is asserted rather than assumed: CO-OPS serves
 * `{"error":{"message":...}}` under **HTTP 200**. A caller that trusted the
 * status code would treat that as a payload.
 *
 * Verified against `__fixtures__/coops-9410230-hilo-20260817.json`, captured
 * 2026-08-17. Converting its GMT rows to Pacific yields 3.447 ft at 01:29,
 * 2.006 ft at 06:47 and 4.938 ft at 01:41 PM on 2026-08-18; the National Weather
 * Service surf zone forecast for the same day independently quotes La Jolla at
 * 3.4 ft 01:29 AM, 2.0 ft 06:47 AM and 4.9 ft 01:41 PM. Two products agreeing is
 * what establishes that the offset handling above is right.
 */

/** Requested datum. Heights are feet above mean lower low water. */
export const COOPS_DATUM = "MLLW";

/** Requested unit system. `english` means feet. */
export const COOPS_UNITS = "english";

/** Requested zone. See the header: this is why the timestamps may be read as UTC. */
export const COOPS_TIME_ZONE = "gmt";

/** Courtesy identifier sent to NOAA on every request, so this site is legible in their logs. */
export const COOPS_APPLICATION = "wild-coast-kids";

const COOPS_ENDPOINT =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

/** What was asked for. Carried alongside the payload so failures can name it. */
export interface CoopsRequestContract {
  /** NOAA CO-OPS station id, e.g. `9410230`. */
  stationId: string;
  /** Inclusive start, `YYYYMMDD`. */
  beginDate: string;
  /** Inclusive end, `YYYYMMDD`. */
  endDate: string;
}

/** The payload was not the shape this parser pins. A bug to chase, not a quiet feed. */
export class CoopsDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoopsDriftError";
  }
}

/** CO-OPS reported an error, possibly under HTTP 200. */
export class CoopsUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoopsUpstreamError";
  }
}

export type TideExtremeKind = "low" | "high";

/** One predicted turning point of the tide. */
export interface TideExtreme {
  /** Instant of the extreme, epoch milliseconds UTC. */
  atMs: number;
  /** Predicted height in feet above MLLW. Negative is below the average low. */
  feet: number;
  kind: TideExtremeKind;
}

/**
 * One predicted height, on the hour.
 *
 * No `kind`, because the payload carries none: `interval=h` rows are `{"t":…,
 * "v":…}` and nothing more. An hourly row is not a turning point and must not
 * be typed as one -- an hour near a low is not the low, and calling it one
 * would put a wrong time beside a nearly-right height.
 */
export interface TideHeight {
  /** Start of the hour, epoch milliseconds UTC. */
  atMs: number;
  /** Predicted height in feet above MLLW. Negative is below the average low. */
  feet: number;
}

/**
 * The one URL shape both intervals share, so the three pinned facts are written
 * once. `interval` is the only thing that differs, and it is the only thing a
 * caller chooses.
 */
function predictionsUrl(
  contract: CoopsRequestContract,
  interval: "hilo" | "h",
): string {
  const query = new URLSearchParams({
    product: "predictions",
    application: COOPS_APPLICATION,
    station: contract.stationId,
    begin_date: contract.beginDate,
    end_date: contract.endDate,
    datum: COOPS_DATUM,
    time_zone: COOPS_TIME_ZONE,
    units: COOPS_UNITS,
    interval,
    format: "json",
  });
  return `${COOPS_ENDPOINT}?${query.toString()}`;
}

/**
 * Build the high/low predictions URL for a station and date range.
 *
 * `interval=hilo` asks CO-OPS for the turning points rather than the six-minute
 * series. This page wants "the lowest tide today", and a request for four rows
 * instead of four hundred is the honest size for that question.
 */
export function coopsPredictionsUrl(contract: CoopsRequestContract): string {
  return predictionsUrl(contract, "hilo");
}

/**
 * Build the hourly predictions URL for a station and date range.
 *
 * `interval=h` asks for a height on every hour, which is the resolution a drawn
 * day needs and the turning points cannot supply. Measured 2026-08-28: 9,113
 * bytes for the ten days this page's window covers at station 9410230, 240 rows
 * with no gaps. The six-minute series is the other option and is forty times
 * the bytes for a curve nobody can see the difference in at 161px.
 *
 * A second URL means a second request, not a replacement: the extremes still
 * come from `coopsPredictionsUrl`, because the figure a week cell leads with is
 * a turning point and reading it off an hourly series would round it to the
 * nearest hour.
 */
export function coopsHourlyUrl(contract: CoopsRequestContract): string {
  return predictionsUrl(contract, "h");
}

/**
 * The `t` strings have no offset, and this is the only place that decides what
 * clock they are on. The shape is asserted rather than fed to `Date.parse`,
 * whose behaviour on an offsetless string is implementation-defined -- the
 * difference between correct and seven hours wrong.
 */
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

function parseGmtTimestamp(raw: unknown, stationId: string): number {
  if (typeof raw !== "string") {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: a prediction's "t" was ${typeof raw}, not a string.`,
    );
  }
  const parts = TIMESTAMP.exec(raw);
  if (!parts) {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: timestamp "${raw}" is not the pinned "YYYY-MM-DD HH:MM". ` +
        `Refusing to guess what clock it is on.`,
    );
  }
  const [, year, month, day, hour, minute] = parts;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
}

function parseKind(raw: unknown, stationId: string): TideExtremeKind {
  if (raw === "L") return "low";
  if (raw === "H") return "high";
  throw new CoopsDriftError(
    `CO-OPS ${stationId}: prediction type ${JSON.stringify(raw)} is neither "H" nor "L".`,
  );
}

function parseFeet(raw: unknown, stationId: string): number {
  if (typeof raw !== "string") {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: a prediction's "v" was ${typeof raw}, not a string.`,
    );
  }
  const feet = Number(raw);
  if (!Number.isFinite(feet)) {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: height "${raw}" is not a number.`,
    );
  }
  return feet;
}

/**
 * The checks both intervals share, returning the rows once they have passed.
 *
 * Both payloads are the same envelope -- `{"predictions":[…]}`, or an `error`
 * object under HTTP 200 -- so the four ways it can be wrong are the same four
 * whichever interval was asked for. Written once so the two parsers cannot
 * disagree about what a dead response looks like.
 *
 * An empty prediction list is drift rather than an empty result: this product
 * is astronomical, so a station asked for a range and answering with none has
 * not told us the tide is flat.
 */
function predictionRows(
  payload: unknown,
  contract: CoopsRequestContract,
): unknown[] {
  const { stationId } = contract;

  if (typeof payload !== "object" || payload === null) {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: payload was not an object.`,
    );
  }

  const body = payload as Record<string, unknown>;

  if ("error" in body) {
    const error = body.error as { message?: unknown } | null;
    const message =
      error && typeof error.message === "string"
        ? error.message
        : "no message given";
    throw new CoopsUpstreamError(
      `CO-OPS ${stationId} reported an error: ${message}. ` +
        `Note this arrives under HTTP 200, so the status code did not say so.`,
    );
  }

  const rows = body.predictions;
  if (!Array.isArray(rows)) {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: expected a "predictions" array and found ${typeof rows}.`,
    );
  }
  if (rows.length === 0) {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: "predictions" was empty for ${contract.beginDate}-${contract.endDate}. ` +
        `Predictions are astronomical, so an empty range is a broken request, not a flat tide.`,
    );
  }

  return rows;
}

/** The two fields every prediction row carries, whichever interval asked. */
function parseRow(
  row: unknown,
  stationId: string,
): { atMs: number; feet: number; record: Record<string, unknown> } {
  if (typeof row !== "object" || row === null) {
    throw new CoopsDriftError(
      `CO-OPS ${stationId}: a prediction row was not an object.`,
    );
  }
  const record = row as Record<string, unknown>;
  return {
    atMs: parseGmtTimestamp(record.t, stationId),
    feet: parseFeet(record.v, stationId),
    record,
  };
}

/**
 * Parse a high/low predictions payload into typed extremes, in payload order.
 *
 * Raises `CoopsUpstreamError` when CO-OPS reported an error -- including under
 * HTTP 200 -- and `CoopsDriftError` when the shape is not what is pinned above.
 */
export function parseCoopsHiLo(
  payload: unknown,
  contract: CoopsRequestContract,
): TideExtreme[] {
  const { stationId } = contract;

  return predictionRows(payload, contract).map((row): TideExtreme => {
    const { atMs, feet, record } = parseRow(row, stationId);
    return { atMs, feet, kind: parseKind(record.type, stationId) };
  });
}

/**
 * Parse an hourly predictions payload into typed heights, in payload order.
 *
 * The same refusals as `parseCoopsHiLo` and one fewer field: `interval=h` rows
 * carry no `type`, so nothing here reads one. A row missing `t` or `v`, or
 * carrying either in the wrong shape, raises rather than being skipped --
 * skipping would put a hole in a curve, and a curve drawn through a hole is a
 * claim about hours nobody published.
 *
 * Verified against `__fixtures__/coops-9410230-hourly-20260828.json`, captured
 * 2026-08-28: 240 rows on the hour from 2026-08-27 00:00 to 2026-09-05 23:00
 * GMT, which is the ten-day window `predictionsWindow` asks for.
 */
export function parseCoopsHourly(
  payload: unknown,
  contract: CoopsRequestContract,
): TideHeight[] {
  const { stationId } = contract;

  return predictionRows(payload, contract).map((row): TideHeight => {
    const { atMs, feet } = parseRow(row, stationId);
    return { atMs, feet };
  });
}
