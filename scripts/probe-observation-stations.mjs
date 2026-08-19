/**
 * Measure the observation stations this county publishes, and write the table.
 *
 *   node scripts/probe-observation-stations.mjs           rewrite src/data/weather-stations.json
 *   node scripts/probe-observation-stations.mjs --check   exit 1 if the committed file has moved
 *
 * WHY THIS SCRIPT EXISTS. Every station table in this repo carried a measured
 * `delivers` and an inherited *membership*: someone ran a probe once, kept the
 * rows that mattered for the question they were asking, and nothing since could
 * re-derive which stations had been left out. `seed-beaches.mjs --check` re-runs
 * the join and is blind to the candidate set, so a station missing from a table
 * is invisible to every gate. That is how both Scripps Pier stations were lost
 * from `wave-buoys.json` -- dropped by a buoy-versus-fixed criterion written in
 * no code -- and it is why La Jolla Shores reads an airport ten kilometres
 * inland. See docs/plans/coastal-air-observations.md.
 *
 * So membership is measured here and re-derivable with `--check`, exactly as
 * delivery already was.
 *
 * WHAT IS IN THE TABLE, and why those and not others:
 *
 *   - Every National Weather Service station listed for a gridpoint this
 *     inventory's beaches resolve to, whose coordinates fall in the county box.
 *   - Every NDBC station in the wave corridor box of type `fixed`.
 *
 * The `fixed` criterion is the one that lost the piers, so it is stated rather
 * than applied silently: NDBC's buoys are `wave-buoys.json`'s subject and are
 * left to it, and the measurement says nothing is given up by doing so. Eleven
 * of the thirteen buoys in that box publish no air temperature or wind at all,
 * 46275 and 46277 publish temperature without wind, and the one buoy that
 * publishes both, 46086, sits twenty-seven nautical miles offshore outside the
 * corridor where no beach can reach it. A station this script excludes is
 * excluded by a rule someone can re-run, which is the whole difference.
 *
 * WHAT IS RECORDED IS A CAPABILITY, NOT A SAMPLE. Six observations are read per
 * station and a field counts as published if it appears on at least one of them.
 * The counts themselves are deliberately NOT written to the file: they move on
 * every probe, and a file whose `--check` fails from noise stops being read. The
 * booleans move only when a station's behaviour does, which is the thing worth
 * failing on.
 *
 * IT REACHES THE NETWORK, so it is not a gate row -- for the same reason
 * `seed-beaches.mjs` is not. Around three hundred requests to two publishers.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const NWS_POINTS = "https://api.weather.gov/points";
const NWS_OBSERVATIONS = "https://api.weather.gov/stations";
const NDBC_STATIONS = "https://www.ndbc.noaa.gov/activestations.xml";
const NDBC_REALTIME2 = "https://www.ndbc.noaa.gov/data/realtime2";

const USER_AGENT =
  "wild-coast-kids/0.1 (+https://github.com/cweber12/wild-coast-kids) station-probe";

const TABLE_PATH = new URL(
  "../src/data/weather-stations.json",
  import.meta.url,
);
const BEACHES_PATH = new URL("../src/data/beaches.json", import.meta.url);

/** How many observations are read per station to decide what it publishes. */
export const OBSERVATIONS_PER_STATION = 6;

/**
 * The county box, as `weather-stations.json` has always used it. Wider than the
 * NDBC box below because the NWS list reaches inland, and the eastern stations
 * are candidates even though no beach will ever bind one.
 */
export const NWS_BOX = {
  minLat: 32.4,
  maxLat: 33.6,
  minLon: -117.7,
  maxLon: -116.8,
};

/** The wave corridor box, reproduced from `wave-buoys.json`'s own provenance. */
export const NDBC_BOX = {
  minLat: 32.4,
  maxLat: 33.5,
  minLon: -118.2,
  maxLon: -117.0,
};

/**
 * Whether a station a network lists is inside the box being probed.
 *
 * @param {{lat: number, lon: number}} point
 * @param {{minLat: number, maxLat: number, minLon: number, maxLon: number}} box
 * @returns {boolean}
 */
export function inBox(point, box) {
  return (
    point.lat >= box.minLat &&
    point.lat <= box.maxLat &&
    point.lon >= box.minLon &&
    point.lon <= box.maxLon
  );
}

/**
 * WHICH STATIONS STAND IN THE MARINE LAYER AT THE SHORELINE.
 *
 * Hand-written, like `tide-stations.json`'s `water` field and for the same
 * reason: no authority publishes the classification, and a join has to be told
 * which stations are candidates for which beaches. It is an input to the join,
 * not a measurement, and `elevation_m` is recorded beside it because that is
 * most of what the judgement is read from.
 *
 * THE JUDGEMENT: a station is `shore` when it stands in the air that reaches the
 * beach -- low-lying, on or beside water open to the ocean, with no landform
 * between it and the sea and none underneath it. Two ways to fail it:
 *
 *   - ON TOP of the landform. Mt. Soledad at 102 m overlooks half the corridor
 *     and the summer marine layer does not always reach the top of it, which is
 *     why MSDSD reads several degrees warmer than the sand below it. Del Mar
 *     Heights, the Torrey Pines mesa and the Encinitas bluff top are the same
 *     case.
 *   - INLAND of the coastal plain. Every station from San Pasqual eastwards.
 *
 * A BAY STATION IS NOT A FAILURE, and this is the part that was measured before
 * it was decided rather than after. The first draft of this rule excluded San
 * Diego Bay, reasoning that enclosed water is what the tide join's `water` class
 * exists for. Measured across all 72 bound beaches, that costs Ocean Beach,
 * Sunset Cliffs and the three Coronado beaches six to eight kilometres each --
 * they reach past Point Loma to Scripps Pier or the Tijuana estuary -- because
 * the ocean side of the peninsula has no low station of its own. What a bay
 * changes is the tide. It does not change the marine layer: the bay is at sea
 * level, open to the ocean at its mouth, and the air over it is coastal air. So
 * KSAN at 4.0 m and E9951 at 3.6 m are shore, and an airport on the bay counts.
 *
 * Applied to these candidates, every station judged shore sits at or below
 * 22.9 m and every station judged not-shore at or above 77.7 m. That gap is a
 * fact about this county's stations and NOT the rule -- it is reported because
 * it means no case here was marginal, and because an elevation cap was measured
 * and rejected in the plan for getting exactly the bay stations wrong.
 *
 * A station absent from this map stops the probe rather than defaulting, so a
 * station that appears in a later listing is classified by a person or the table
 * is not written.
 */
export const SHORE = {
  // In the marine layer at the shoreline.
  F1327: true, // San Clemente Pier, on the pier itself.
  SOBSD: true, // Solana Beach, at the back of the sand.
  E9951: true, // Shelter Island, on the bay's main channel.
  KSAN: true, // San Diego International, on the bay's north shore.
  E3174: true, // Oceanside, at the shoreline.
  KOKB: true, // Oceanside Municipal, on the coastal plain, no ridge seaward.
  E3219: true, // National City, on the bay's east shore.
  CBDSD: true, // Carlsbad, on the coastal terrace.
  KNFG: true, // Camp Pendleton MCAS, on the coastal plain.
  LJAC1: true, // Scripps Pier.
  LJPC1: true, // Scripps Pier.
  TIXC1: true, // Tijuana River estuary, open to the beach behind it.
  SDBC1: true, // San Diego Bay tide station, on the water.
  NPQC1: true, // South Bay, Tijuana River Reserve.
  TIQC1: true, // Oneonta Slough, Tijuana River Reserve.

  // On top of the landform: bluff tops, mesas, and the ridge itself.
  E9978: false, // Encinitas, on the bluff top.
  DMHSD: false, // Del Mar Heights, on the mesa above Del Mar.
  KCRQ: false, // McClellan-Palomar, on the Carlsbad mesa.
  MSDSD: false, // Mt. Soledad, overlooking half the corridor.
  D3101: false, // Torrey Pines Reserve, on the mesa.
  E9873: false, // San Diego University Heights.
  MVNSD: false, // Mission Valley North.

  // Inland of the coastal plain.
  PSQC1: false,
  PAUSD: false,
  E3619: false,
  C8688: false,
  KMYF: false,
  E3055: false,
  E3680: false,
  PZAC1: false,
  KNKX: false,
  E3070: false,
  E3309: false,
  E4858: false,
  SVCSD: false,
  KSDM: false,
  E3241: false,
  E9965: false,
  E3236: false,
  E2652: false,
  D5256: false,
  KL18: false,
  WRBSD: false,
  CAPC1: false,
  MSXC1: false,
  RINSD: false,
  ORTSD: false,
  BVYSD: false,
  SDMEA: false,
  BNASD: false,
  KF70: false,
  KRNM: false,
  SDFRV: false,
  CSTSD: false,
  VLCC1: false,
  AU709: false,
  C2462: false,
  GOSC1: false,
  SRUC1: false,
  E4050: false,
  OTYC1: false,
  PAMC1: false,
};

/**
 * WHAT TO CALL EACH STATION ON THE PAGE.
 *
 * Hand-written, on the same precedent as `SHORE` above and `water` in
 * `tide-stations.json`: something no authority publishes, written by a person
 * and recorded where it can be read and argued with.
 *
 * The `name` field beside this stays exactly as each network serves it, because
 * that is the record of what upstream said and the thing a later probe compares
 * against. It is not prose. The mesonet publishes callsigns
 * ("EW9951 San Diego Shelter Island   CA US"), the tide network publishes
 * station numbers ("9410230 - La Jolla, CA"), and the reserve network publishes
 * instrument sites ("Tidal Linkage, Tijuana River Reserve, CA"). Until the air
 * panel bound a second station only airports reached a reader, and airports are
 * named readably; now every panel names two stations.
 *
 * A MECHANICAL RULE WAS TRIED FIRST AND CANNOT REACH. Stripping callsigns,
 * trailing country codes and padding gets both piers right and gets the other
 * two wrong in a way no further rule fixes: nothing turns "Tidal Linkage" into
 * something a parent recognises, and "9410230" is the pier's *tide station
 * number* — the place is Scripps Pier, which no part of the published string
 * says. See #87.
 *
 * THE RULE FOR WRITING ONE: the shortest name a parent looking at a map of this
 * county would recognise, and nothing that repeats what the sentence around it
 * already says. The panel writes "Sky and visibility at Miramar, 10 km away.
 * That is an airport reading", so "Miramar" and not "Miramar MCAS/Mitscher
 * Field Airport". Where upstream's name is already that, it is reused unchanged
 * rather than improved for the sake of it.
 *
 * A station absent from this map stops the probe, exactly as one absent from
 * `SHORE` does, so a station that appears in a later listing is named by a
 * person or the table is not written.
 */
export const DISPLAY_NAMES = {
  // On the shore, and the reason this map exists: every one of these renders as
  // the source of a temperature a reader is being asked to trust.
  LJAC1: "Scripps Pier",
  LJPC1: "Scripps Pier",
  F1327: "San Clemente Pier",
  E9951: "Shelter Island",
  TIXC1: "Tijuana River Estuary",
  TIQC1: "Oneonta Slough",
  NPQC1: "South San Diego Bay",
  SDBC1: "San Diego Bay",
  SOBSD: "Solana Beach",
  E3174: "Oceanside",
  CBDSD: "Carlsbad",
  E3219: "National City",

  // Airports. The panel's own sentence says "that is an airport reading", so
  // these do not repeat it.
  KSAN: "San Diego Airport",
  KNKX: "Miramar",
  KNFG: "Camp Pendleton",
  KOKB: "Oceanside Airport",
  KCRQ: "Palomar Airport",
  KMYF: "Montgomery Field",
  KSDM: "Brown Field",
  KRNM: "Ramona Airport",
  KL18: "Fallbrook",
  KF70: "French Valley Airport",

  // Everywhere else. None of these is bound by any beach today, and each is one
  // measurement away from being bound, so each is named rather than left to a
  // future probe to guess at.
  MSDSD: "Mt. Soledad",
  DMHSD: "Del Mar Heights",
  D3101: "Torrey Pines Reserve",
  E9978: "Encinitas",
  E9873: "University Heights",
  MVNSD: "Mission Valley North",
  PSQC1: "San Pasqual",
  PAUSD: "Pauma Valley",
  PZAC1: "Pala",
  E3055: "Vista",
  E3236: "Escondido",
  AU709: "Escondido East",
  WRBSD: "West Rancho Bernardo",
  C8688: "Mira Mesa",
  E3241: "Poway",
  MSXC1: "Miramar East",
  SVCSD: "San Vicente",
  E3619: "Santee",
  E3309: "Santee East",
  E9965: "Lakeside",
  E4858: "El Cajon",
  E3070: "Rancho San Diego",
  E3680: "Lemon Grove",
  D5256: "La Mesa",
  E2652: "San Diego East",
  BNASD: "Barona",
  BVYSD: "Blossom Valley",
  CSTSD: "Crest",
  C2462: "Alpine",
  RINSD: "Rincon",
  ORTSD: "Ortega",
  CAPC1: "Bell Canyon",
  GOSC1: "Bud Hill",
  VLCC1: "Valley Center",
  SDMEA: "Murrieta",
  SDFRV: "French Valley",
  SRUC1: "Santa Rosa Plateau",
  E4050: "Mountain Center",
  OTYC1: "Otay Mountain",
  PAMC1: "Palomar Mountain",
};

/**
 * What a run of NWS observations shows the station publishing.
 *
 * `textDescription` is the sky field the site already reads, and a station that
 * publishes no sky serves it as an empty string rather than omitting it. An
 * empty string is not a description of the sky, so it is not counted.
 *
 * Visibility is measured alongside and deliberately not stored: across these
 * candidates the two select exactly the same stations, and sky is the scarcer of
 * the two per observation, so `publishes_sky` is the stricter test and the
 * panel's visibility rides on it. See ADR 0010.
 *
 * @param {Array<Record<string, unknown>>} observations
 * @returns {{delivers: boolean, publishes_air_temp: boolean, publishes_wind: boolean, publishes_sky: boolean, publishes_visibility: boolean}}
 */
export function nwsCapabilities(observations) {
  const measured = (key) =>
    observations.some((observation) => {
      const field = observation?.[key];
      return (
        typeof field === "object" &&
        field !== null &&
        field.value !== null &&
        field.value !== undefined
      );
    });

  return {
    delivers: observations.length > 0,
    publishes_air_temp: measured("temperature"),
    publishes_wind: measured("windSpeed"),
    publishes_sky: observations.some(
      (observation) =>
        typeof observation?.textDescription === "string" &&
        observation.textDescription.trim() !== "",
    ),
    publishes_visibility: measured("visibility"),
  };
}

/**
 * What a `realtime2` payload shows the station publishing.
 *
 * The header names the columns and `MM` is the missing marker. Reading the
 * header rather than counting from a fixed offset is the same pinning
 * `parseNdbcRealtime2` does, for the same reason: a column added upstream would
 * otherwise shift every reading one place to the left.
 *
 * @param {string} text
 * @returns {{delivers: boolean, publishes_air_temp: boolean, publishes_wind: boolean, publishes_sky: boolean, publishes_visibility: boolean}}
 */
export function ndbcCapabilities(text) {
  const absent = {
    delivers: false,
    publishes_air_temp: false,
    publishes_wind: false,
    publishes_sky: false,
    publishes_visibility: false,
  };

  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 3) return absent;

  const header = lines[0].replace(/^#/, "").trim().split(/\s+/);
  const rows = lines.slice(2).map((line) => line.trim().split(/\s+/));

  const measured = (column) => {
    const index = header.indexOf(column);
    if (index === -1) return false;
    return rows.some((row) => row[index] !== undefined && row[index] !== "MM");
  };

  return {
    delivers: rows.length > 0,
    publishes_air_temp: measured("ATMP"),
    publishes_wind: measured("WSPD"),
    // realtime2 carries no sky column at all. That is the product lacking the
    // field, not these stations declining to fill it.
    publishes_sky: false,
    publishes_visibility: measured("VIS"),
  };
}

/**
 * One table row, from a probed station.
 *
 * `publishes_visibility` is measured but not carried: it selects the same
 * stations as `publishes_sky`, and two flags for one capability are two things
 * that can drift apart while naming one.
 *
 * @param {Record<string, unknown>} station
 */
export function tableRow(station) {
  const shore = SHORE[station.id];
  if (shore === undefined) {
    throw new Error(
      `${station.id} (${station.name}) is not classified in SHORE. A station listed ` +
        `upstream but never judged is a join input nobody decided, so the table is not ` +
        `written. Classify it and re-run.`,
    );
  }

  const displayName = DISPLAY_NAMES[station.id];
  if (displayName === undefined) {
    throw new Error(
      `${station.id} (${station.name}) has no entry in DISPLAY_NAMES. Falling back to the ` +
        `published name would render a callsign at a reader, so the table is not written. ` +
        `Name it and re-run.`,
    );
  }

  return {
    name: station.name,
    display_name: displayName,
    network: station.network,
    lat: station.lat,
    lon: station.lon,
    elevation_m: station.elevation_m,
    shore,
    delivers: station.delivers,
    publishes_air_temp: station.publishes_air_temp,
    publishes_wind: station.publishes_wind,
    publishes_sky: station.publishes_sky,
    ...(station.delivers ? {} : { dead_note: station.dead_note }),
  };
}

/**
 * The table, ordered north to south then by id, so two runs over the same
 * stations produce the same file.
 *
 * @param {Array<Record<string, unknown>>} stations
 */
export function buildTable(stations) {
  const ordered = stations
    .slice()
    .sort((a, b) => b.lat - a.lat || a.id.localeCompare(b.id));

  const table = {};
  for (const station of ordered) table[station.id] = tableRow(station);
  return table;
}

/**
 * Today's date where the beaches are, not where the clock is.
 *
 * `new Date().toISOString().slice(0, 10)` -- which is what `seed-beaches.mjs`
 * uses -- stamps the UTC date, so any run after 5pm Pacific records tomorrow.
 * The file would claim to have been generated on a day that had not started in
 * the county it describes, and would read a day newer than the sibling tables
 * probed beside it. The zone is the one `beaches.json` already declares.
 */
export function probeDate(now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function document(table, now = new Date()) {
  const rows = Object.values(table);
  const count = (predicate) => rows.filter(predicate).length;
  const nws = rows.filter((row) => row.network === "nws");
  const ndbc = rows.filter((row) => row.network === "ndbc");
  const airPool = count(
    (row) => row.delivers && row.publishes_air_temp && row.publishes_wind,
  );

  return {
    version: "0.2.0",
    generated: probeDate(now),
    _provenance:
      `Measured by scripts/probe-observation-stations.mjs; re-runnable and diffable with ` +
      `--check. National Weather Service candidates are the union of ` +
      `https://api.weather.gov/gridpoints/<grid>/stations over every distinct gridpoint the ` +
      `beaches in beaches.json resolve to, filtered to ${NWS_BOX.minLat}-${NWS_BOX.maxLat}N ` +
      `and ${NWS_BOX.minLon} to ${NWS_BOX.maxLon}E: ${nws.length} stations. The state-wide ` +
      `listing at /stations?state=CA is NOT the source; it is capped at 500 results and ` +
      `truncates before reaching either KSAN or KNKX. NDBC candidates are ${NDBC_STATIONS} ` +
      `filtered to the wave corridor box ${NDBC_BOX.minLat}-${NDBC_BOX.maxLat}N and ` +
      `${NDBC_BOX.minLon} to ${NDBC_BOX.maxLon}E AND to type "fixed": ${ndbc.length} stations. ` +
      `That type filter is the criterion that lost both Scripps Pier stations from ` +
      `wave-buoys.json, so it is stated here rather than applied silently -- NDBC's buoys are ` +
      `that table's subject, eleven of the thirteen in the box publish no air temperature or ` +
      `wind at all, and the one that publishes both, 46086, is twenty-seven nautical miles ` +
      `offshore and out of every beach's reach. Capability was then measured one station at a ` +
      `time against the endpoints this site reads -- /stations/<id>/observations for NWS, ` +
      `${NDBC_REALTIME2}/<id>.txt for NDBC -- rather than inferred from either listing.`,
    _what_was_measured:
      `${OBSERVATIONS_PER_STATION} observations per station; a field counts as published if ` +
      `it appears on at least one of them. Of ${rows.length} candidates, ` +
      `${count((row) => row.delivers)} deliver, ${airPool} publish air temperature and wind ` +
      `together, and ${count((row) => row.publishes_sky)} publish sky. So the pool an air join ` +
      `ranks over is ${airPool} stations and not the thirteen a visibility-shaped probe ` +
      `recorded. Sky and visibility are one capability: both were measured, and they select ` +
      `exactly the same stations -- every one an airport METAR -- with sky the scarcer of the ` +
      `two per observation. Only publishes_sky is stored, because two flags for one capability ` +
      `are two things that can drift apart while naming one. Counts of how many of the six ` +
      `observations carried a field are deliberately absent from this file: they move on every ` +
      `probe, and a --check that fails from noise stops being read.`,
    _schema: {
      name: "The station name, reproduced as its network serves it, run of spaces and trailing 'CA US' included. A record of what upstream said, and what a later probe compares against. NOT what is shown to a reader -- see display_name.",
      display_name:
        "What the page calls this station. Hand-written, like `shore` and like tide-stations.json's `water`, because the published name is an identifier rather than prose for most of these: the mesonet publishes callsigns, the tide network publishes station numbers, and the reserve network publishes instrument sites. The rule is the shortest name someone looking at a map of this county would recognise, saying nothing the sentence around it already says. See #87.",
      network:
        "Which publisher serves this station, and therefore which fetcher reads it: 'nws' for api.weather.gov, 'ndbc' for the realtime2 text product.",
      lat: "Decimal degrees north, from the network's own listing.",
      lon: "Decimal degrees east, negative for west.",
      elevation_m:
        "Metres above sea level, as the network publishes it; null where it publishes none. Measured metadata, recorded because it is most of what `shore` is read from. NOT a join input on its own -- an elevation cap was measured and rejected, see docs/adr/0010-two-provenances-in-the-air-panel.md.",
      shore:
        "Whether the station stands in the marine layer at the shoreline: low-lying, on or beside water open to the ocean, with no landform between it and the sea and none underneath it. Hand-written, like tide-stations.json's `water` field, because no authority publishes the classification and a join has to be told which stations are candidates for which beaches. A bay station qualifies -- what a bay changes is the tide, not the marine layer.",
      delivers:
        "Whether the station's observation endpoint answers with anything at all, measured rather than assumed. A station that does not deliver is kept and marked, never deleted. Answering is not publishing: SDFRV answers with six observations carrying no values at all.",
      publishes_air_temp:
        "Whether any of the observations read carried an air temperature.",
      publishes_wind: "Whether any of them carried a wind speed.",
      publishes_sky:
        "Whether any of them carried a non-empty sky description. An empty string is what a station with no sky serves, and it is not a description of the sky. This is the sky-and-visibility join's filter.",
      dead_note:
        "Present only when delivers is false. What the station did when asked.",
    },
    stations: table,
    unresolved: [
      `Every station in this county that publishes sky is an airport METAR, and airports sit ` +
        `inland of the beaches they are bound to. Sky and visibility therefore describe the ` +
        `airport and not the shoreline, and the distance is recorded per beach and shown to ` +
        `the reader rather than hidden.`,
      `METAR stops at ten statute miles. The stations publish that ceiling as either ` +
        `16093.44 m or 16090 m depending on the station, so a reading at the top of the range ` +
        `means "at least ten miles" and never "exactly ten miles". It is rendered as "10 miles ` +
        `or more" for that reason.`,
      `A capability here means "published at least once in ${OBSERVATIONS_PER_STATION} ` +
        `observations", so a station that publishes a field rarely sits close to flipping. ` +
        `KF70 carried sky on one observation of six and is the row most likely to move a ` +
        `future --check; no beach binds it, so nothing a reader sees turns on it. The ` +
        `threshold is not raised to keep the check quiet, because a station that publishes sky ` +
        `once in six genuinely does publish sky.`,
      `The shore classification is an author judgement, written by hand because no upstream ` +
        `authority publishes one. It has not been checked against a marine-layer study, and ` +
        `the case it most affects is San Diego Bay, where a station at sea level sits behind a ` +
        `130 m peninsula from the ocean beaches it serves.`,
      `This file is still named for the weather station the panel binds, while the table now ` +
        `holds observation stations from two networks and is read by two joins. The name is ` +
        `narrower than its contents until the field it is named for is renamed too.`,
    ],
  };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  return response.json();
}

/**
 * Run `fn` over `items` with at most `limit` in flight, preserving order. Both
 * publishers are asked for hundreds of things; asking all at once is rude and
 * gets throttled.
 */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index]);
      }
    }),
  );
  return out;
}

/** Every distinct gridpoint station list the inventory's beaches resolve to. */
export async function nwsStationListUrls(beaches) {
  const points = beaches.flatMap((beach) => [
    beach.segment.upper,
    beach.segment.lower,
  ]);
  const urls = new Set();
  const skipped = [];

  await mapLimit(points, 4, async (point) => {
    try {
      const payload = await getJson(`${NWS_POINTS}/${point.lat},${point.lon}`);
      const url = payload.properties?.observationStations;
      if (typeof url !== "string") {
        skipped.push(`${point.lat},${point.lon}: no observationStations`);
        return;
      }
      urls.add(url);
    } catch (error) {
      skipped.push(`${point.lat},${point.lon}: ${error.message}`);
    }
  });

  // Reported rather than swallowed. A gridpoint that silently failed would
  // shrink the candidate set invisibly, which is the exact failure this script
  // exists to end. The known cases are beach endpoints upstream publishes
  // outside the county -- the transposed pair the seed already refuses, and one
  // border coordinate the API has no grid for.
  for (const note of skipped) console.error(`  no gridpoint for ${note}`);

  if (urls.size === 0) {
    throw new Error(
      "no gridpoint resolved to a station list. An empty candidate set is a broken " +
        "discovery, not a county with no stations.",
    );
  }
  return [...urls];
}

export async function probeNws(beaches) {
  const urls = await nwsStationListUrls(beaches);
  console.error(`  ${urls.length} distinct gridpoints`);

  const listed = new Map();
  await mapLimit(urls, 4, async (url) => {
    const payload = await getJson(url);
    for (const feature of payload.features ?? []) {
      const [lon, lat] = feature.geometry.coordinates;
      if (!inBox({ lat, lon }, NWS_BOX)) continue;
      listed.set(feature.properties.stationIdentifier, {
        id: feature.properties.stationIdentifier,
        name: feature.properties.name,
        network: "nws",
        lat,
        lon,
        elevation_m: feature.properties.elevation?.value ?? null,
      });
    }
  });
  console.error(`  ${listed.size} NWS candidates in the county box`);

  return mapLimit([...listed.values()], 4, async (station) => {
    try {
      const payload = await getJson(
        `${NWS_OBSERVATIONS}/${station.id}/observations?limit=${OBSERVATIONS_PER_STATION}`,
      );
      const observations = (payload.features ?? []).map(
        (feature) => feature.properties,
      );
      const capabilities = nwsCapabilities(observations);
      return {
        ...station,
        ...capabilities,
        dead_note: capabilities.delivers
          ? undefined
          : "Listed for a gridpoint and answers with no observations at all.",
      };
    } catch (error) {
      return {
        ...station,
        delivers: false,
        publishes_air_temp: false,
        publishes_wind: false,
        publishes_sky: false,
        dead_note:
          `${error.message} Kept and marked rather than deleted, so the next probe ` +
          `compares against a station that was measured rather than one that quietly vanished.`,
      };
    }
  });
}

/**
 * Attribute values out of each `<station .../>` element.
 *
 * A tolerant reader over one known-shape document rather than an XML parser: the
 * alternative is a dependency for four attributes, which is an architecture
 * decision this task has no business making.
 *
 * @param {string} xml
 */
export function parseActiveStations(xml) {
  const attribute = (element, key) => {
    const match = new RegExp(`${key}="([^"]*)"`).exec(element);
    return match ? match[1] : null;
  };

  const stations = [];
  for (const match of xml.matchAll(/<station\b([^>]*)\/>/g)) {
    const element = match[1];
    const id = attribute(element, "id");
    const lat = Number(attribute(element, "lat"));
    const lon = Number(attribute(element, "lon"));
    if (id === null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const elevation = attribute(element, "elev");
    stations.push({
      // realtime2 serves uppercase ids while this listing serves the fixed
      // stations in lower case. A case-sensitive match here finds none of them.
      id: id.toUpperCase(),
      name: attribute(element, "name"),
      type: attribute(element, "type"),
      lat,
      lon,
      elevation_m:
        elevation === null || elevation === "" ? null : Number(elevation),
    });
  }

  if (stations.length === 0) {
    throw new Error(
      "activestations.xml parsed to no stations. An empty listing is a changed document, " +
        "not an empty ocean.",
    );
  }
  return stations;
}

export async function probeNdbc() {
  const response = await fetch(NDBC_STATIONS, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`${NDBC_STATIONS} returned HTTP ${response.status}.`);
  }

  const listed = parseActiveStations(await response.text()).filter(
    (station) => inBox(station, NDBC_BOX) && station.type === "fixed",
  );
  console.error(`  ${listed.length} NDBC fixed stations in the corridor box`);

  return mapLimit(listed, 3, async (station) => {
    const result = await fetch(`${NDBC_REALTIME2}/${station.id}.txt`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!result.ok) {
      return {
        ...station,
        network: "ndbc",
        delivers: false,
        publishes_air_temp: false,
        publishes_wind: false,
        publishes_sky: false,
        dead_note:
          `Returns HTTP ${result.status} for realtime2 while listed active. Kept and marked ` +
          `rather than deleted, so the next probe compares against a station that was ` +
          `measured rather than one that quietly vanished.`,
      };
    }
    return {
      ...station,
      network: "ndbc",
      ...ndbcCapabilities(await result.text()),
    };
  });
}

/**
 * The command-line half, kept behind a guard so everything with a rule in it can
 * be imported and asserted without reaching the network or writing a file.
 */
async function main() {
  const checkOnly = process.argv.includes("--check");

  const beaches = JSON.parse(readFileSync(BEACHES_PATH, "utf8")).beaches;
  let existing = null;
  try {
    existing = JSON.parse(readFileSync(TABLE_PATH, "utf8"));
  } catch {
    existing = null;
  }

  console.error("Probing the National Weather Service...");
  const nws = await probeNws(beaches);
  console.error("Probing NDBC...");
  const ndbc = await probeNdbc();

  const built = document(buildTable([...nws, ...ndbc]));

  // `generated` moves on every run by design, so comparing it would make every
  // check fail and mean nothing.
  const comparable = (doc) =>
    JSON.stringify({ ...doc, generated: null }, null, 2);

  if (checkOnly) {
    if (existing === null) {
      console.error(
        "weather-stations.json is missing. Run without --check to write it.",
      );
      process.exit(1);
    }
    if (comparable(existing) === comparable(built)) {
      console.log(
        `weather-stations.json is current: ${Object.keys(built.stations).length} stations, ` +
          `capabilities unchanged.`,
      );
      process.exit(0);
    }
    console.error(
      "weather-stations.json has moved. Re-run without --check, read the diff, and say in " +
        "the commit what moved upstream and why.",
    );
    process.exit(1);
  }

  writeFileSync(TABLE_PATH, `${JSON.stringify(built, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${Object.keys(built.stations).length} stations to src/data/weather-stations.json.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
