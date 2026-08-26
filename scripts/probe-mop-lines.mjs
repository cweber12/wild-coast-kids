/**
 * Measure the MOP lines CDIP publishes for this county, and write the table.
 *
 *   node scripts/probe-mop-lines.mjs           rewrite src/data/mop-lines.json
 *   node scripts/probe-mop-lines.mjs --check   exit 1 if the committed file has moved
 *
 * A MOP line is a point CDIP's Monitoring and Prediction model publishes wave
 * estimates for, at 10 m depth, spaced about 100 m along the shore. San Diego's
 * are prefixed `D` and numbered south to north from the Mexican border.
 *
 * WHY THIS IS TWO REQUESTS AND NOT TWELVE HUNDRED. Each line is its own file,
 * and none of them carries its coordinates anywhere a cheap request can read
 * them: the alongshore catalog lists names and sizes only, and the point
 * service answers per file. The refraction-coefficient catalog is the way in --
 * it names every California line with its coordinates *in the filename*:
 *
 *   D0498_32.85520-117.26200_ref.nc
 *
 * So the geometry is one request. The alongshore catalog is the second, and it
 * answers a different question: which lines actually publish a forecast. Both
 * are large -- 3.6 MB and 12.5 MB when this was written -- which is the price of
 * not making 1,210 requests to the same publisher for the same facts.
 *
 * WHAT IS PINNED, and asserted on read rather than assumed:
 *   - the filename shape above. The coordinates are separated by the
 *     longitude's own minus sign, so a line in the eastern hemisphere would be
 *     unreadable; a name that does not parse raises rather than being skipped.
 *   - that a line appears in both catalogs. `delivers` is the cross-reference:
 *     geometry with no forecast is a line this site cannot read.
 *
 * IT REACHES THE NETWORK, so it is not a gate row -- for the same reason
 * `seed-beaches.mjs` and `probe-observation-stations.mjs` are not.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generatedDate } from "./generated-date.mjs";

const THREDDS = "https://thredds.cdip.ucsd.edu/thredds/catalog/cdip/model";
const GEOMETRY_CATALOG = `${THREDDS}/R_CA_coefficients/catalog.xml`;
const ALONGSHORE_CATALOG = `${THREDDS}/MOP_alongshore/catalog.xml`;

/** CDIP's product docs for the model these lines belong to. */
export const MOP_DOCS =
  "https://cdip.ucsd.edu/documents/index/product_docs/mops/mop_intro.html";

const USER_AGENT =
  "wild-coast-kids/0.1 (+https://github.com/cweber12/wild-coast-kids) mop-line-probe";

const TABLE_PATH = new URL("../src/data/mop-lines.json", import.meta.url);

/**
 * San Diego's county prefix, and the whole membership rule.
 *
 * `D` and exactly four digits. Not a coordinate box: CDIP assigns the prefix,
 * the prefix is what the filenames are keyed by, and `DN` is Del Norte at the
 * Oregon border -- eight hundred kilometres away and matched by a looser
 * pattern.
 */
export const LINE_ID = /^D\d{4}$/;

/** A refraction-coefficient dataset for a San Diego line, coordinates and all. */
const REF_DATASET = /name="(D\d{4})_([^"]*)_ref\.nc"/g;

/** A forecast dataset for a San Diego line. Not `_nowcast`, `_hindcast` or `_ecmwf_fc`. */
const FORECAST_DATASET = /name="(D\d{4})_forecast\.nc"/g;

/** `32.85520-117.26200`: latitude, then a longitude whose minus sign is the separator. */
const COORDINATES = /^(\d+\.\d+)(-\d+\.\d+)$/;

/**
 * Every San Diego line the refraction catalog names, with where it sits.
 *
 * Raises on a filename that does not parse rather than skipping it. A skipped
 * line is a line no beach can bind and nobody can notice, which is the silent
 * failure the `unresolved` blocks in these files exist to prevent.
 *
 * @param {string} xml
 * @returns {Map<string, {lat: number, lon: number}>}
 */
export function parseLineGeometry(xml) {
  const lines = new Map();

  for (const [name, id, middle] of xml.matchAll(REF_DATASET)) {
    const match = COORDINATES.exec(middle);
    if (match === null) {
      throw new Error(
        `probe-mop-lines: ${JSON.stringify(name)} does not carry a lat/lon pair in the shape ` +
          `this probe reads. Coordinates are separated by the longitude's minus sign, so a ` +
          `positive longitude would be unreadable. Refusing to guess where the line is.`,
      );
    }
    lines.set(id, { lat: Number(match[1]), lon: Number(match[2]) });
  }

  if (lines.size === 0) {
    throw new Error(
      `probe-mop-lines: the refraction catalog named no San Diego lines. An empty result is a ` +
        `broken query, not a county with no coast.`,
    );
  }

  return lines;
}

/**
 * Every San Diego line the alongshore catalog publishes a forecast for.
 *
 * The forecast product only. The nowcast reaches backwards, the hindcast is
 * 155 MB per line, and the ECMWF run is a second forecast this site does not
 * read -- a line that published one of those and no forecast would be a line
 * this site cannot use.
 *
 * @param {string} xml
 * @returns {Set<string>}
 */
export function parseForecastLines(xml) {
  const lines = new Set();
  for (const [, id] of xml.matchAll(FORECAST_DATASET)) lines.add(id);

  if (lines.size === 0) {
    throw new Error(
      `probe-mop-lines: the alongshore catalog published no San Diego forecasts. An empty ` +
        `result is a broken query, not a model that stopped running.`,
    );
  }

  return lines;
}

/**
 * The table, in the publisher's own order: by line number, which runs south to
 * north from the Mexican border.
 *
 * The sibling tables sort north to south by latitude, and this one does not,
 * because these ids *are* an ordering and a thousand rows sorted against it
 * would be a file nobody can read a diff of. Two runs over the same catalogs
 * produce the same file either way, which is the property that matters.
 *
 * @param {Map<string, {lat: number, lon: number}>} geometry
 * @param {Set<string>} publishing
 */
export function buildTable(geometry, publishing) {
  const table = {};

  for (const id of [...geometry.keys()].sort()) {
    const { lat, lon } = geometry.get(id);
    const delivers = publishing.has(id);
    table[id] = {
      lat,
      lon,
      delivers,
      ...(delivers
        ? {}
        : {
            dead_note:
              "The refraction catalog names this line and the alongshore catalog publishes " +
              "no forecast for it. There is geometry and nothing to read.",
          }),
    };
  }

  return table;
}

/**
 * Lines the alongshore catalog forecasts and the refraction catalog does not
 * place.
 *
 * Reported rather than ignored: this site could read such a line and could not
 * say where it is, so it cannot be bound and its absence has to be visible.
 *
 * @param {Map<string, {lat: number, lon: number}>} geometry
 * @param {Set<string>} publishing
 */
export function unplacedLines(geometry, publishing) {
  return [...publishing].filter((id) => !geometry.has(id)).sort();
}

export function document(table, unplaced, now = new Date()) {
  const rows = Object.values(table);
  const delivering = rows.filter((row) => row.delivers);
  const latitudes = rows.map((row) => row.lat);

  return {
    version: "0.1.0",
    generated: generatedDate(now),
    _provenance:
      `Measured by scripts/probe-mop-lines.mjs; re-runnable and diffable with --check. Line ` +
      `ids and coordinates are read from the dataset names in ${GEOMETRY_CATALOG}, which ` +
      `carries each line's position in its filename and is therefore the only cheap source ` +
      `for the geometry. Delivery is the cross-reference against ${ALONGSHORE_CATALOG}: a ` +
      `line delivers when that catalog publishes <id>_forecast.nc for it. Membership is the ` +
      `county prefix CDIP assigns -- ${LINE_ID} -- and not a coordinate box. See ${MOP_DOCS}.`,
    _what_was_measured:
      `${rows.length} San Diego lines, ${delivering.length} of them publishing a forecast, ` +
      `spanning ${Math.min(...latitudes).toFixed(3)}N to ${Math.max(...latitudes).toFixed(3)}N. ` +
      `Neither catalog was sampled: both were read whole, so this is every line CDIP names ` +
      `for this county rather than every line some earlier probe kept. No line file itself ` +
      `was fetched -- what is recorded is that CDIP publishes a forecast for a line, not that ` +
      `today's run of it carries usable rows, which is a per-request fact and belongs to the ` +
      `reader's request rather than to this table.`,
    _schema: {
      lat: "Decimal degrees north, from the refraction dataset's filename. Five decimal places, as published.",
      lon: "Decimal degrees east, negative for west. Same source.",
      delivers:
        "Whether CDIP publishes a forecast for this line, cross-referenced against the alongshore catalog rather than assumed. A line that does not deliver is kept and marked, never deleted.",
      dead_note: "Present only when delivers is false. What was missing.",
    },
    lines: table,
    unresolved: [
      `A MOP estimate is model output, not a measurement. It is driven by real buoy ` +
        `directional spectra and accounts for island sheltering and refraction, which is why ` +
        `it can stand this close to the shore at all -- but no instrument sits on a MOP line, ` +
        `and nothing in this table says otherwise.`,
      `Every line here sits at 10 m depth on the open coast, so the water-class refusal the ` +
        `wave-buoy join makes applies unchanged: a bay, lagoon or sheltered beach binds no ` +
        `line. The 100 m spacing makes a spuriously close line MORE likely at such a beach, ` +
        `not less, which is why the refusal is a rule rather than a distance.`,
      `Adjacent lines can share a coordinate exactly -- the closest pair in this table is 0 m ` +
        `apart -- so a nearest-point join over them must break ties on the id or two runs will ` +
        `disagree about which line a beach binds.`,
      ...(unplaced.length === 0
        ? []
        : [
            `${unplaced.length} lines are forecast by the alongshore catalog and not placed by ` +
              `the refraction catalog: ${unplaced.join(", ")}. They are readable and cannot be ` +
              `bound, because nothing published says where they are.`,
          ]),
    ],
  };
}

async function getXml(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  return response.text();
}

/**
 * The command-line half, kept behind a guard so everything with a rule in it
 * can be imported and asserted without reaching the network or writing a file.
 */
async function main() {
  const checkOnly = process.argv.includes("--check");

  let existing = null;
  try {
    existing = JSON.parse(readFileSync(TABLE_PATH, "utf8"));
  } catch {
    existing = null;
  }

  console.error("Reading the refraction catalog for line positions...");
  const geometry = parseLineGeometry(await getXml(GEOMETRY_CATALOG));
  console.error("Reading the alongshore catalog for published forecasts...");
  const publishing = parseForecastLines(await getXml(ALONGSHORE_CATALOG));

  const built = document(
    buildTable(geometry, publishing),
    unplacedLines(geometry, publishing),
  );

  // `generated` moves on every run by design, so comparing it would make every
  // check fail and mean nothing.
  const comparable = (doc) =>
    JSON.stringify({ ...doc, generated: null }, null, 2);

  if (checkOnly) {
    if (existing === null) {
      console.error(
        "mop-lines.json is missing. Run without --check to write it.",
      );
      process.exit(1);
    }
    if (comparable(existing) === comparable(built)) {
      console.log(
        `mop-lines.json is current: ${Object.keys(built.lines).length} lines, delivery unchanged.`,
      );
      process.exit(0);
    }
    console.error(
      "mop-lines.json has moved. Re-run without --check, read the diff, and say in the commit " +
        "what moved upstream and why.",
    );
    process.exit(1);
  }

  writeFileSync(TABLE_PATH, `${JSON.stringify(built, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${Object.keys(built.lines).length} lines to src/data/mop-lines.json.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
