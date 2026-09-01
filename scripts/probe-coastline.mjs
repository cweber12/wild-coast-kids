/**
 * Trace this county's shoreline from CDFW's ecoregion boundary, and write it.
 *
 *   node scripts/probe-coastline.mjs           rewrite src/data/shoreline.json
 *   node scripts/probe-coastline.mjs --check   exit 1 if the committed file has moved
 *
 * THE SOURCE IS NOT A MARINE DATASET AND NOT A TIDAL ONE. It is the terrestrial
 * ECOMAP/Goudey 2007 ecological sections for California, dissolved by CDFW for
 * their Areas of Conservation Emphasis work. It has a usable coastal edge only
 * because of what CDFW did to it, which the service description states itself:
 *
 *   conformed to Cnty19_1 counties layer linework, the Great Valley section
 *   split in two, had all bays "erased", and offshore rocks/stacks detail
 *   removed.
 *
 * So the edge is county boundary linework. California's seaward county boundary
 * nominally follows the mean high tide line, so it lands near MHW by
 * construction -- BUT THE SERVICE NEVER DECLARES A DATUM AND NEITHER DOES THIS
 * FILE. Anything that wants to draw a water level against this line needs a
 * source that states one; see docs/plans/traced-shoreline.md.
 *
 * "Bays erased" is why the bays are traced at all: the bay water was cut out of
 * the polygon, so its boundary follows the bay shore. That is what gives the 23
 * Mission Bay and San Diego Bay beaches a coastline for the first time.
 *
 * WHY THE ARC HAS TO BE CUT OUT OF A RING. The feature is a closed polygon
 * around a whole ecoregion, so its boundary holds an inland arc as well as a
 * coastal one -- measured, the inland arc reaches longitude -116.72, forty
 * kilometres from the sea. Walking the whole ring would draw the ecoregion's
 * mountain boundary as shoreline.
 *
 * THE CUT IS ANCHORED ON COMMITTED COORDINATES. The two ends are the vertices
 * nearest `mop-lines.json`'s southernmost and northernmost lines. That reuses
 * the county scope this repo already defines rather than inventing a box, and
 * both anchors are values already in the tree -- which is the same rule that
 * keeps `beaches.json`'s distances a join result rather than a guess.
 *
 * WHAT IS PINNED, and asserted on read rather than assumed:
 *   - that the query returns exactly one feature. The `where` names one
 *     OBJECTID; two features would mean the layer was renumbered upstream and
 *     the arc would be cut out of the wrong polygon.
 *   - that its largest ring holds both anchors. A ring that holds neither is
 *     not the mainland, and the arc between two anchors that are not on it is
 *     arbitrary.
 *   - that the arc walks south to north. `coastline()` and every function over
 *     it assume walk order; a reversed arc would draw the same shape and break
 *     every left-or-right test against it.
 *
 * IT REACHES THE NETWORK, so it is not a gate row -- for the same reason
 * `probe-mop-lines.mjs` and `probe-observation-stations.mjs` are not. What the
 * gate checks is the committed file, and it checks it through the `test` row
 * rather than a row of its own: `coastline.test.ts` asserts the properties this
 * script is here to produce -- every beach within 40 m of the line, the walk
 * running south to north, and no step crossing open water.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generatedDate } from "./generated-date.mjs";

const SERVICE =
  "https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/ACE_Ecoregion_Sections_wm/FeatureServer/0";

/**
 * The one polygon this county's coast is the edge of.
 *
 * "Southern California Coast" -- the ecoregion section that runs from the
 * Mexican border to Point Conception. Named by OBJECTID rather than by its
 * `ECOREGION_SECTION` string because the string is prose and the id is a key,
 * and the read below asserts the name it got back matches.
 */
const SECTION_OBJECTID = 2;
const SECTION_NAME = "Southern California Coast";

const TABLE_PATH = new URL("../src/data/shoreline.json", import.meta.url);
const MOP_PATH = new URL("../src/data/mop-lines.json", import.meta.url);

const USER_AGENT =
  "wild-coast-kids/probe-coastline (+https://github.com/cweber12/wild-coast-kids)";

/**
 * How far a simplified vertex may sit from the line it replaces, in metres.
 *
 * **Below the source's own vertex spacing, which is the point.** Measured over
 * the county arc, the published vertices sit a median 6.7 m apart (p25 3.4,
 * p75 14.7). A tolerance under that means the simplification is not the thing
 * deciding the coast's shape -- it removes vertices the source placed closer
 * together than its own typical step, and leaves the shape to the publisher.
 *
 * Measured: 26,999 raw vertices become 4,628 at 5 m and 2,850 at 10 m, and the
 * beach whose distance to the line moved most at 5 m moved 2.4 m.
 */
const SIMPLIFY_M = 5;

/**
 * The longest step the committed line may take, in metres.
 *
 * **Simplification alone produces a polyline whose step length means nothing,
 * and `shore.ts` reads step length as meaning.** Douglas-Peucker removes every
 * vertex on a straight coast, so a 5 m tolerance left 62 steps over 500 m and
 * one of 1,834 m -- and every one of them is ordinary open beach, straight
 * enough to need no vertices. `COAST_GAP_M` reads a step over 500 m as a gap in
 * the shore not to be crossed, which was true of MOP's 98 m grid and is the
 * exact opposite of true here: the longest steps are the straightest coast.
 *
 * So density is restored after the shape is chosen, and restored *from the
 * publisher's own vertices* rather than by interpolating new ones. Nothing here
 * invents a coordinate; it only declines to drop one.
 *
 * 200 m is chosen below `COAST_GAP_M`'s 500 by enough that the two cannot be
 * confused, and above the source's 6.7 m median spacing by enough that the file
 * stays small. Measured: it costs 740 points, 4,628 to 5,368.
 *
 * **Nine steps still exceed 500 m afterwards and every one is wanted.** They
 * are places where two *adjacent published vertices* are that far apart, so
 * there is nothing to restore between them, and all nine sit at the mouths of
 * San Diego Bay and Mission Bay — chords the "bays erased" operation drew
 * straight across open water. That is precisely what `COAST_GAP_M` exists to
 * refuse to cross, so the rule survives the change of source with its meaning
 * intact: after the cap, a long step is a chord over water rather than a
 * straight piece of beach.
 */
const MAX_STEP_M = 200;

/** One degree of latitude in metres, the same constant `coastline.ts` uses. */
const METRES_PER_DEGREE = 111_320;

/** Ground metres between two [lon, lat] pairs, cosine-corrected for longitude. */
export function metresBetween(a, b) {
  const lonScale = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * lonScale, a[1] - b[1]) * METRES_PER_DEGREE;
}

/** The index of the ring vertex nearest a position, and how far away it is. */
export function nearestVertex(ring, at) {
  let index = -1;
  let metres = Infinity;
  ring.forEach((vertex, candidate) => {
    const distance = metresBetween(vertex, at);
    if (distance < metres) {
      metres = distance;
      index = candidate;
    }
  });
  return { index, metres };
}

/**
 * The arc of a closed ring between two anchors, walked in ring order.
 *
 * A ring has two arcs between any two points and this returns the one that
 * walks forward from `south`, wrapping past the ring's own start if it has to.
 * Which of the two is the coast is not decided here by shape: it is decided by
 * the anchors, and the caller asserts the result walks south to north.
 *
 * Throws on a ring too short to have two distinct arcs, which is a ring that is
 * not a boundary rather than a coast with no length.
 */
export function arcBetween(ring, southIndex, northIndex) {
  if (ring.length < 3) {
    throw new Error(
      `probe-coastline: a ring of ${ring.length} vertices has no arc to cut.`,
    );
  }
  if (southIndex === northIndex) {
    throw new Error(
      "probe-coastline: both anchors landed on the same ring vertex, so there is no arc between them.",
    );
  }
  return southIndex < northIndex
    ? ring.slice(southIndex, northIndex + 1)
    : [...ring.slice(southIndex), ...ring.slice(0, northIndex + 1)];
}

/**
 * Douglas-Peucker, in ground metres rather than in degrees.
 *
 * Degrees would simplify the north of the county harder than the south, because
 * a degree of longitude shortens with latitude -- the same correction
 * `projectionFor` makes for the same reason. The cosine is taken once at the
 * arc's middle rather than per segment: over this county's 0.85 degrees of
 * latitude that varies by under half a percent, which is far inside a 5 m
 * tolerance.
 *
 * Iterative rather than recursive: 27,000 vertices is deep enough to matter.
 */
export function simplifyIndices(points, toleranceMetres) {
  if (points.length < 3) return points.map((_, at) => at);

  const midLat = (points[0][1] + points[points.length - 1][1]) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  const flat = points.map(([lon, lat]) => [
    lon * lonScale * METRES_PER_DEGREE,
    lat * METRES_PER_DEGREE,
  ]);

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [from, to] = stack.pop();
    const [ax, ay] = flat[from];
    const [bx, by] = flat[to];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    let worst = -1;
    let worstAt = -1;
    for (let at = from + 1; at < to; at += 1) {
      const [px, py] = flat[at];
      let distance;
      if (lengthSquared === 0) {
        distance = Math.hypot(px - ax, py - ay);
      } else {
        const along = Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
        );
        distance = Math.hypot(px - (ax + along * dx), py - (ay + along * dy));
      }
      if (distance > worst) {
        worst = distance;
        worstAt = at;
      }
    }

    if (worst > toleranceMetres && worstAt > 0) {
      keep[worstAt] = true;
      stack.push([from, worstAt], [worstAt, to]);
    }
  }

  return keep.flatMap((kept, at) => (kept ? [at] : []));
}

/**
 * Put vertices back until no step is longer than the cap.
 *
 * Only vertices the source published are restored — the search is over the
 * original arc's own indices, and the midpoint chosen is the original vertex
 * nearest the middle of the long step rather than a coordinate computed from
 * its ends. Halving repeatedly means a step needs at most log2(length / cap)
 * insertions and the result is evenly spread rather than bunched at one end.
 *
 * A step that cannot be shortened — two adjacent original vertices further
 * apart than the cap — is left alone, because there is nothing between them to
 * restore. That is a real discontinuity in the published ring and is exactly
 * what `COAST_GAP_M` downstream is for.
 */
export function densifyIndices(points, indices, capMetres) {
  const out = [indices[0]];

  for (let at = 1; at < indices.length; at += 1) {
    const from = indices[at - 1];
    const to = indices[at];
    const pending = [[from, to]];

    while (pending.length > 0) {
      const [a, b] = pending.pop();
      if (b - a <= 1) {
        out.push(b);
        continue;
      }
      if (metresBetween(points[a], points[b]) <= capMetres) {
        out.push(b);
        continue;
      }
      const middle = a + Math.floor((b - a) / 2);
      pending.push([middle, b], [a, middle]);
    }
  }

  return out;
}

/** The shape chosen by tolerance, then the density restored by the cap. */
export function thin(points, toleranceMetres, capMetres) {
  const kept = densifyIndices(
    points,
    simplifyIndices(points, toleranceMetres),
    capMetres,
  );
  return kept.map((at) => points[at]);
}

/**
 * The two anchors, read from the committed MOP table rather than written here.
 *
 * The lowest and highest line ids, which CDIP numbers south to north from the
 * Mexican border. Sorted as strings, which is safe because the ids are
 * zero-padded to a fixed width -- asserted, because an unpadded id would sort
 * `D999` above `D1000` and cut the arc at the wrong end of the county.
 */
export function anchorsFrom(mopTable) {
  const ids = Object.keys(mopTable.lines).sort();
  if (ids.length < 2) {
    throw new Error(
      `probe-coastline: mop-lines.json holds ${ids.length} lines, too few to anchor an arc.`,
    );
  }
  const widths = new Set(ids.map((id) => id.length));
  if (widths.size !== 1) {
    throw new Error(
      `probe-coastline: MOP line ids are not one fixed width (${[...widths].join(", ")}), ` +
        "so sorting them as strings would cut the arc at the wrong end.",
    );
  }

  const south = mopTable.lines[ids[0]];
  const north = mopTable.lines[ids[ids.length - 1]];
  if (south.lat >= north.lat) {
    throw new Error(
      `probe-coastline: ${ids[0]} is not south of ${ids[ids.length - 1]}, so the ids no longer ` +
        "run south to north and the arc's direction cannot be taken from them.",
    );
  }
  return {
    south: { id: ids[0], at: [south.lon, south.lat] },
    north: { id: ids[ids.length - 1], at: [north.lon, north.lat] },
  };
}

/** The largest ring of a returned polygon, which is the mainland. */
export function mainlandRing(feature) {
  const rings = feature?.geometry?.rings;
  if (!Array.isArray(rings) || rings.length === 0) {
    throw new Error("probe-coastline: the feature carries no rings.");
  }
  return rings.reduce((largest, ring) =>
    ring.length > largest.length ? ring : largest,
  );
}

/**
 * The county's coastal arc, cut from the fetched feature.
 *
 * Returned unsimplified, so the caller can report what it simplified *from*.
 * The count that belongs in the file is the arc's, not the whole ring's: the
 * ring runs to Point Conception and only the arc was ever a candidate for
 * removal, so "simplified from the ring" would overstate the reduction by four
 * times.
 *
 * Pure over what the network returned, so the whole rule is testable without
 * reaching it. Every assertion here is one that would otherwise draw a wrong
 * coastline quietly.
 */
export function coastalArc(feature, anchors) {
  const name = feature?.attributes?.CA_Ecoregion_Name;
  if (name !== SECTION_NAME) {
    throw new Error(
      `probe-coastline: OBJECTID ${SECTION_OBJECTID} is now ${JSON.stringify(name)}, not ` +
        `${JSON.stringify(SECTION_NAME)}. The layer was renumbered upstream; re-read it before trusting the arc.`,
    );
  }

  const ring = mainlandRing(feature);
  const south = nearestVertex(ring, anchors.south.at);
  const north = nearestVertex(ring, anchors.north.at);

  /*
    A kilometre is generous against the 493 m and 693 m these anchors actually
    land at, and it is not a tolerance on the coast's accuracy -- it is the
    distance from a MOP line, which sits offshore, to the shore beside it. What
    it catches is an anchor landing on a different landmass entirely.
  */
  const ANCHOR_REACH_M = 1_500;
  for (const [label, hit] of [
    [anchors.south.id, south],
    [anchors.north.id, north],
  ]) {
    if (hit.metres > ANCHOR_REACH_M) {
      throw new Error(
        `probe-coastline: the vertex nearest ${label} is ${Math.round(hit.metres)} m away, past ` +
          `the ${ANCHOR_REACH_M} m an anchor may sit from the ring. The ring is not this county's mainland.`,
      );
    }
  }

  const arc = arcBetween(ring, south.index, north.index);

  /*
    The ring has two arcs between the anchors and only one of them is the coast.
    Which one this gets is decided by the ring's winding direction, which is the
    publisher's and could change without anything else changing -- and if it
    did, walking forward from the south anchor would traverse the *inland*
    boundary instead. That comes back as a smooth line between the same two
    endpoints and draws as a plausible shoreline forty kilometres inland.

    Checking the walk runs south to north does not catch it: both arcs start and
    end at the anchors, so both do. What separates them is where they go in
    between, and the seaward one is the one that stays west.
  */
  const other = arcBetween(ring, north.index, south.index);
  const eastOf = (run) => Math.max(...run.map(([lon]) => lon));
  if (eastOf(arc) >= eastOf(other)) {
    throw new Error(
      `probe-coastline: the arc walked from ${anchors.south.id} reaches ` +
        `${eastOf(arc).toFixed(3)}E and the other way round reaches ${eastOf(other).toFixed(3)}E, ` +
        "so this is the inland ecoregion boundary rather than the coast. The ring's winding " +
        "changed upstream; the anchors no longer pick the seaward arc.",
    );
  }

  return arc;
}

/** The committed document. `points` is the coast, walked south to north. */
export function document(arc, anchors, raw, now = new Date()) {
  const lats = arc.map(([, lat]) => lat);
  const lons = arc.map(([lon]) => lon);
  const steps = arc
    .slice(1)
    .map((point, at) => metresBetween(arc[at], point))
    .sort((a, b) => a - b);

  return {
    version: "0.1.0",
    generated: generatedDate(now),
    _provenance:
      `Measured by scripts/probe-coastline.mjs; re-runnable and diffable with --check. The ` +
      `geometry is the boundary of OBJECTID ${SECTION_OBJECTID} (${SECTION_NAME}) of ` +
      `${SERVICE}, CDFW's ACE Ecoregion Sections. That is a TERRESTRIAL ecoregion layer ` +
      `(ECOMAP/Goudey 2007); it carries a coastal edge only because CDFW conformed it to the ` +
      `Cnty19_1 county linework and erased the bays, which its own service description states. ` +
      `NO TIDAL DATUM IS PUBLISHED FOR THIS LINE and none is claimed here -- a California ` +
      `seaward county boundary nominally follows mean high tide, but the service does not say ` +
      `so, so nothing may draw a water level against it without a source that does.`,
    _what_was_measured:
      `${arc.length} points, thinned from ${raw}: the shape chosen by a ${SIMPLIFY_M} m ` +
      `Douglas-Peucker tolerance, then density restored by putting published vertices back ` +
      `until no step longer than ${MAX_STEP_M} m had one to restore. Spanning ` +
      `${Math.min(...lats).toFixed(4)}N to ${Math.max(...lats).toFixed(4)}N and ` +
      `${Math.min(...lons).toFixed(4)}E to ${Math.max(...lons).toFixed(4)}E. The arc is cut ` +
      `from the closed ecoregion ring between the vertices nearest MOP lines ` +
      `${anchors.south.id} and ${anchors.north.id}, so the county scope is mop-lines.json's ` +
      `rather than a box invented here. Steps along it run ` +
      `${steps[0].toFixed(1)} m to ${steps[steps.length - 1].toFixed(0)} m, median ` +
      `${steps[Math.floor(steps.length / 2)].toFixed(1)} m.`,
    _schema: {
      points:
        "The shoreline, walked south to north, as [lon, lat] pairs in decimal degrees east and north. A pair rather than an object because there are thousands of them and the file is read whole.",
      lon: "Decimal degrees east, negative for west.",
      lat: "Decimal degrees north.",
    },
    points: arc,
    unresolved: [
      `This line is the LANDWARD edge of a terrestrial polygon, not a surveyed shoreline and ` +
        `not a tidal datum. It is close to the sand -- measured, 50 of 51 beaches in ` +
        `beaches.json sit within 37 m of it -- and that closeness is a property of county ` +
        `linework rather than a promise the publisher makes.`,
      `Only the mainland ring is kept. The islands and lagoons inside the county are separate ` +
        `rings of the same feature and are not in this file, so a beach on one of them has no ` +
        `coastline here. mission-bay-vacation-isle is the only one in the inventory, at 416 m; ` +
        `its committed segment is a single point, so it renders an absence either way.`,
      `Offshore rocks and stacks were removed from the source by CDFW before publication, so ` +
        `this line does not carry them. Anything drawing reefs needs a source that does.`,
    ],
  };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  const body = await response.json();
  if (body.error) {
    throw new Error(
      `${url} answered with an error: ${JSON.stringify(body.error)}`,
    );
  }
  return body;
}

function queryUrl() {
  const query = new URLSearchParams({
    where: `OBJECTID=${SECTION_OBJECTID}`,
    outFields: "OBJECTID,CA_Ecoregion_Name",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "6",
    f: "json",
  });
  return `${SERVICE}/query?${query}`;
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

  const anchors = anchorsFrom(JSON.parse(readFileSync(MOP_PATH, "utf8")));
  console.error(
    `Reading the ecoregion boundary, anchored on ${anchors.south.id} and ${anchors.north.id}...`,
  );
  const body = await getJson(queryUrl());

  if (!Array.isArray(body.features) || body.features.length !== 1) {
    throw new Error(
      `probe-coastline: the query for OBJECTID ${SECTION_OBJECTID} returned ` +
        `${body.features?.length ?? 0} features, not 1.`,
    );
  }

  const feature = body.features[0];
  const arc = coastalArc(feature, anchors);
  const built = document(
    thin(arc, SIMPLIFY_M, MAX_STEP_M),
    anchors,
    arc.length,
  );

  // `generated` moves on every run by design, so comparing it would make every
  // check fail and mean nothing.
  const comparable = (doc) =>
    JSON.stringify({ ...doc, generated: null }, null, 2);

  if (checkOnly) {
    if (existing === null) {
      console.error(
        "shoreline.json is missing. Run without --check to write it.",
      );
      process.exit(1);
    }
    if (comparable(existing) === comparable(built)) {
      console.log(
        `shoreline.json is current: ${built.points.length} points, unchanged.`,
      );
      process.exit(0);
    }
    console.error(
      "shoreline.json has moved. Re-run without --check, read the diff, and say in the commit " +
        "what moved upstream and why.",
    );
    process.exit(1);
  }

  writeFileSync(TABLE_PATH, `${JSON.stringify(built, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${built.points.length} points to src/data/shoreline.json.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
