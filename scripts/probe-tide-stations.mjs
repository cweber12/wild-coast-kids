/**
 * Whether every tide station still delivers what the table records it as
 * delivering.
 *
 *   node scripts/probe-tide-stations.mjs   report every station; exit 1 on any
 *                                          disagreement, in either direction
 *
 * WHY THIS ONE ONLY CHECKS, WHERE ITS THREE SIBLINGS REGENERATE. `delivers` is
 * the only field in `tide-stations.json` a probe can measure. `water`,
 * `dead_note` and both `unresolved` entries are hand-written prose, and
 * `_provenance` records a filter applied by hand on a date. A generator would
 * have to carry all of that as string literals to reproduce the file it
 * replaced. It would also reorder it: the stations are committed north to south
 * -- 9410230 La Jolla first, TWC0405 last -- and seven of the nine ids are
 * integer-like strings, which JavaScript objects iterate in ascending numeric
 * order whatever order they were inserted in. `JSON.parse` then `JSON.stringify`
 * yields 9410120 first and the geography gone, so a generator would rewrite the
 * whole file on its first run and every diff after it would carry that noise.
 * So this reads and reports, and a human edits the table. See
 * docs/adr/0021-a-station-table-with-prose-gets-a-checker.md.
 *
 * FOUR OUTCOMES, NOT THREE, AND THE FOURTH IS THE POINT. A station can answer
 * usefully, answer with a CO-OPS error object under HTTP 200, or answer with a
 * payload whose shape is not what the parser pins. Those three are what a
 * reader's request would hit, and `src/lib/coops-predictions.ts` already names
 * them. A request that never completes -- a refused connection, a timeout, a
 * non-200 -- is none of them. It is not a measurement that a station stopped
 * delivering, and reporting it as one would manufacture exactly the false alarm
 * this probe exists to prevent. It is reported as `unreachable` and never
 * folded into `not-delivering`.
 *
 * THE CONTRACT IS MIRRORED FROM `src/lib/coops-predictions.ts`, NOT IMPORTED.
 * These scripts run under node unbuilt, so they cannot read TypeScript --
 * `generated-date.mjs` says the same thing about `pacific-time.ts` and spells
 * its zone twice on purpose. A probe that measured a *different* contract would
 * measure nothing, so the duplication is not left on trust: the test imports
 * both sides and pins this file's URL against the site's for the same station
 * and range, and pins this file's classification against the site's parser
 * payload for payload.
 *
 * IT REACHES THE NETWORK, so it is not a gate row -- the same reason its three
 * siblings are not, and the gate stays runnable on a fresh clone with no
 * credentials. Running it on a schedule is issue #160.
 *
 * IT NEVER WRITES. There is no flag for a mode that does, which is the whole
 * decision above.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generatedDate } from "./generated-date.mjs";

const TABLE_PATH = new URL("../src/data/tide-stations.json", import.meta.url);

const USER_AGENT =
  "wild-coast-kids/0.1 (+https://github.com/cweber12/wild-coast-kids) conditions";

/**
 * The request contract, mirrored from `src/lib/coops-predictions.ts`.
 *
 * Every one of these is pinned against its counterpart by test. Changing one
 * here without changing it there fails that test rather than quietly making
 * this probe answer a question the site never asks.
 */
const COOPS_ENDPOINT =
  "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
export const COOPS_DATUM = "MLLW";
export const COOPS_UNITS = "english";
export const COOPS_TIME_ZONE = "gmt";
export const COOPS_APPLICATION = "wild-coast-kids";

/**
 * Build the high/low predictions URL for a station and date range.
 *
 * @param {{stationId: string, beginDate: string, endDate: string}} contract
 * @returns {string}
 */
export function coopsPredictionsUrl(contract) {
  const query = new URLSearchParams({
    product: "predictions",
    application: COOPS_APPLICATION,
    station: contract.stationId,
    begin_date: contract.beginDate,
    end_date: contract.endDate,
    datum: COOPS_DATUM,
    time_zone: COOPS_TIME_ZONE,
    units: COOPS_UNITS,
    interval: "hilo",
    format: "json",
  });
  return `${COOPS_ENDPOINT}?${query.toString()}`;
}

/** The station answered with predictions this stack can read. */
export const DELIVERING = "delivering";

/** CO-OPS said it has nothing for this station, under HTTP 200. */
export const NOT_DELIVERING = "not-delivering";

/** Something answered, and it is not the shape the parser pins. */
export const DRIFT = "drift";

/** No measurement was taken. Never read as "stopped delivering". */
export const UNREACHABLE = "unreachable";

/**
 * The window to ask each station for, as CO-OPS `YYYYMMDD` compact dates.
 *
 * Two days from the Pacific date the run falls on. The site asks for a wider
 * window and that difference is deliberate: this asks whether a station answers
 * at all, and one that serves today's turning points serves the week's. What
 * has to match is the contract those dates are requested under, which is what
 * the test pins.
 *
 * The second date is stepped as a calendar date rather than by adding
 * milliseconds, so the two days either side of a daylight-saving change are not
 * the two days this quietly asks for the wrong range on.
 *
 * @param {Date} now
 * @returns {{beginDate: string, endDate: string}}
 */
export function predictionsWindow(now) {
  const begin = generatedDate(now);
  const [year, month, day] = begin.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  return {
    beginDate: begin.replaceAll("-", ""),
    endDate: end.replaceAll("-", ""),
  };
}

/** The `t` shape `parseGmtTimestamp` pins. An offsetless string, and nothing more. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

/**
 * Whether one row is the `{t, v, type}` shape the parser accepts.
 *
 * The three checks are `parseGmtTimestamp`, `parseFeet` and `parseKind` in
 * `coops-predictions.ts`, in that order. A row this rejects is a row a reader's
 * request raises `CoopsDriftError` on, which is what makes reporting it as
 * drift rather than as delivery the honest answer.
 *
 * @param {unknown} row
 * @returns {boolean}
 */
function isPrediction(row) {
  if (typeof row !== "object" || row === null) return false;
  if (typeof row.t !== "string" || !TIMESTAMP.test(row.t)) return false;
  if (typeof row.v !== "string" || !Number.isFinite(Number(row.v)))
    return false;
  return row.type === "H" || row.type === "L";
}

/**
 * Which of the three payload outcomes a body falls into.
 *
 * Pure, and deliberately the same decisions in the same order as
 * `parseCoopsHiLo`: an `error` key is CO-OPS reporting under a success code, a
 * missing or empty `predictions` array is drift, and so is a row that is not
 * the pinned shape. An empty array is drift rather than "no tide today" for the
 * parser's own reason -- this product is astronomical, so a station asked for
 * two days of turning points and answering with none has not told us the tide
 * is flat.
 *
 * @param {unknown} payload
 * @returns {{outcome: string, detail: string}}
 */
export function classifyPayload(payload) {
  if (typeof payload !== "object" || payload === null) {
    return { outcome: DRIFT, detail: "the payload was not an object" };
  }

  if ("error" in payload) {
    const message = payload.error?.message;
    return {
      outcome: NOT_DELIVERING,
      detail:
        `CO-OPS reported: ` +
        `${typeof message === "string" ? message : "no message given"} ` +
        `(arriving under HTTP 200, so the status code did not say so)`,
    };
  }

  const rows = payload.predictions;
  if (!Array.isArray(rows)) {
    return {
      outcome: DRIFT,
      detail: `expected a "predictions" array and found ${typeof rows}`,
    };
  }
  if (rows.length === 0) {
    return {
      outcome: DRIFT,
      detail:
        `"predictions" was empty for the range asked. Predictions are ` +
        `astronomical, so an empty range is a broken request, not a flat tide`,
    };
  }

  const bad = rows.findIndex((row) => !isPrediction(row));
  if (bad !== -1) {
    return {
      outcome: DRIFT,
      detail: `prediction row ${bad} is not the pinned {t, v, type} shape`,
    };
  }

  return { outcome: DELIVERING, detail: `${rows.length} turning points` };
}

/**
 * Whether an outcome is a delivery measurement at all.
 *
 * Drift and unreachable are not. Neither says a station stopped delivering, and
 * neither may be compared against the committed flag as though it did.
 *
 * @param {string} outcome
 * @returns {boolean}
 */
function measuresDelivery(outcome) {
  return outcome === DELIVERING || outcome === NOT_DELIVERING;
}

/**
 * Compare what was measured against what is committed, for every station.
 *
 * This is the part that can be wrong, so it is pure and takes both halves as
 * arguments: a fabricated table and fabricated measurements reach it directly.
 * Following ADR-0002, the same split `gates.mjs` makes.
 *
 * A row is `ok` only when the station was actually measured and the measurement
 * agrees. A station that could not be measured is not a passing station -- the
 * committed flag is unconfirmed, and saying nothing about it would be the
 * silent failure `CLAUDE.md` forbids -- but it is reported as unmeasured rather
 * than as a station that changed.
 *
 * @param {Record<string, {delivers: boolean}>} stations  The committed table.
 * @param {Record<string, {outcome: string, detail: string}>} measured
 * @returns {{exitCode: number, rows: Array<{id: string, committed: boolean,
 *   outcome: string, label: string, ok: boolean, detail: string}>}}
 */
export function verdict(stations, measured) {
  const rows = Object.entries(stations).map(([id, station]) => {
    const measurement = measured[id] ?? {
      outcome: UNREACHABLE,
      detail: "no measurement was taken for this station",
    };
    const { outcome, detail } = measurement;

    if (!measuresDelivery(outcome)) {
      return {
        id,
        committed: station.delivers,
        outcome,
        label: "NOT MEASURED",
        ok: false,
        detail,
      };
    }

    const agrees = (outcome === DELIVERING) === station.delivers;
    return {
      id,
      committed: station.delivers,
      outcome,
      label: agrees ? "agrees" : "DISAGREES",
      ok: agrees,
      detail,
    };
  });

  return { exitCode: rows.every((row) => row.ok) ? 0 : 1, rows };
}

/**
 * One line per station, agreeing or not. Nothing is filtered out: a probe that
 * printed only its complaints would leave a reader unable to tell a clean run
 * from a run that never reached half the table.
 *
 * @param {ReturnType<typeof verdict>["rows"]} rows
 * @returns {string}
 */
export function formatRows(rows) {
  const idWidth = Math.max(...rows.map((row) => row.id.length));
  const outcomeWidth = Math.max(...rows.map((row) => row.outcome.length));
  return rows
    .map(
      (row) =>
        `${row.id.padEnd(idWidth)}  committed=${String(row.committed).padEnd(5)}  ` +
        `${row.outcome.padEnd(outcomeWidth)}  ${row.label}\n` +
        `${" ".repeat(idWidth + 2)}${row.detail}`,
    )
    .join("\n");
}

/**
 * Ask one station the question the site asks.
 *
 * The three failure modes are separated here rather than in the classifier
 * because only this half can tell them apart: a thrown fetch and a 503 never
 * produce a payload to classify.
 *
 * @param {string} stationId
 * @param {{beginDate: string, endDate: string}} window
 * @returns {Promise<{outcome: string, detail: string}>}
 */
export async function measureStation(stationId, window) {
  const url = coopsPredictionsUrl({ stationId, ...window });

  let response;
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  } catch (cause) {
    return {
      outcome: UNREACHABLE,
      detail: `the request did not complete: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  if (!response.ok) {
    return {
      outcome: UNREACHABLE,
      detail: `NOAA answered HTTP ${response.status}, so no payload was measured`,
    };
  }

  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    return {
      outcome: DRIFT,
      detail: `the body under HTTP 200 was not JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  return classifyPayload(payload);
}

/**
 * Measure every station in the table, in order.
 *
 * Serially, because nine requests to one publisher is not worth a burst.
 *
 * @param {Record<string, object>} stations
 * @param {{beginDate: string, endDate: string}} window
 * @returns {Promise<Record<string, {outcome: string, detail: string}>>}
 */
export async function measureAll(stations, window) {
  const measured = {};
  for (const id of Object.keys(stations)) {
    measured[id] = await measureStation(id, window);
  }
  return measured;
}

/**
 * The command-line half, kept behind a guard so everything with a rule in it
 * can be imported and asserted without reaching the network.
 */
async function main() {
  const { stations } = JSON.parse(readFileSync(TABLE_PATH, "utf8"));
  const window = predictionsWindow(new Date());

  console.error(
    `Asking ${Object.keys(stations).length} stations for ${window.beginDate}-${window.endDate} ` +
      `predictions, datum=${COOPS_DATUM} units=${COOPS_UNITS} time_zone=${COOPS_TIME_ZONE} interval=hilo...`,
  );

  const measured = await measureAll(stations, window);
  const { exitCode, rows } = verdict(stations, measured);

  console.log(formatRows(rows));

  const disagreeing = rows.filter((row) => row.label === "DISAGREES");
  const unmeasured = rows.filter((row) => row.label === "NOT MEASURED");

  if (exitCode === 0) {
    console.log(
      `\nAll ${rows.length} stations deliver what tide-stations.json says they deliver.`,
    );
  } else {
    console.error(
      `\n${disagreeing.length} station(s) disagree with the committed delivers flag and ` +
        `${unmeasured.length} could not be measured. tide-stations.json is edited by hand: ` +
        `read the rows above, and say in the commit message what changed upstream.`,
    );
  }

  process.exit(exitCode);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
