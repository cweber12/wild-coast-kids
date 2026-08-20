/**
 * Binding a beach to a tide station.
 *
 * Pure, so the rule can be asserted without a network and the seeding script
 * next door is left with nothing but fetching and writing.
 *
 * THE RULE: the nearest **delivering** station whose water class matches the
 * beach's, measured from whichever end of the beach's segment is closer to it.
 *
 * Each clause is load-bearing.
 *
 * *Delivering*, because NOAA's tide-prediction station list includes at least
 * one station that answers HTTP 200 with an error object instead of predictions.
 * Choosing from the published list alone would bind beaches to it.
 *
 * *Matching water class*, because an ocean-facing beach near a bay mouth is
 * geometrically closer to a bay station than to any coastal one, and a bay tide
 * curve at an ocean beach is a wrong number that looks right.
 *
 * *From the closer end*, because the state publishes a beach as a shoreline
 * segment rather than a point. Some are miles long. Measuring from one fixed end
 * would push the far end of a long beach onto a station that is not its nearest,
 * and averaging the two would invent a location that is not on the shore at all.
 *
 * Nothing here reads a file or a clock. The result is committed by the seeding
 * script and never recomputed while serving a reader.
 */

import { segmentDistance } from "./geo.mjs";

/**
 * The water class a beach belongs to, from the value the state publishes.
 *
 * Returns null for anything unrecognised rather than defaulting to one class.
 * A beach whose type cannot be read has no business being bound to a station by
 * guessing which half of the county it belongs to.
 *
 * @param {string} waterBodyType
 * @returns {"open-coast" | "bay" | null}
 */
export function waterClassOf(waterBodyType) {
  if (waterBodyType === "Open Coast") return "open-coast";
  if (waterBodyType === "Sound, Bay, or Inlet") return "bay";
  return null;
}

/**
 * Beaches the state types as the wrong kind of water, and what they are.
 *
 * Hand-written, like `tide-stations.json`'s `water` and
 * `observation-stations.json`'s `shore`, and for the same reason: the join has
 * to be told, and no authority publishes a correction. Each entry carries what
 * was measured rather than what it looks like, so the next person can check it
 * instead of trusting it.
 *
 * Keyed by slug, which `seed-beaches.mjs` guarantees is a stable primary key.
 */
const WATER_CLASS_OVERRIDES = {
  "fiesta-island": {
    waterClass: "bay",
    why:
      "typed Open Coast upstream; 32.7694, -117.2111 is inside Mission Bay. As open " +
      "coast it bound a tide station 11.66 km away and a wave buoy at 12.14 km, " +
      "publishing a surf height for water that has none. As bay: 2.10 km and no buoy.",
  },
  "childrens-pool": {
    waterClass: "open-coast",
    why:
      "typed Sound, Bay, or Inlet upstream; it is an ocean cove in La Jolla and its " +
      "water level is the ocean's. As bay it bound Mission Bay Campland at 7.84 km; " +
      "as open coast it binds Scripps at 2.93 km. It is also `sheltered` in " +
      "wave-join.mjs, which is the half of its old classification that was right.",
  },
};

/**
 * The water class this join should use for a beach.
 *
 * Takes the whole beach rather than the published type, so that a call site
 * cannot apply the classification and forget the override. Every join reads
 * this; nothing reads `waterClassOf` directly except its own test.
 *
 * @param {{slug?: string, waterBodyType: string}} beach
 * @returns {"open-coast" | "bay" | null}
 */
export function waterClassFor(beach) {
  const override = WATER_CLASS_OVERRIDES[beach.slug];
  if (override) return override.waterClass;
  return waterClassOf(beach.waterBodyType);
}

/**
 * Bind one beach to a station.
 *
 * @param {{slug?: string, segment: object, waterBodyType: string}} beach
 * @param {Record<string, {lat: number, lon: number, water: string, delivers: boolean}>} stations
 * @returns {{stationId: string, distanceM: number, fromEnd: string, waterClass: string}
 *   | {stationId: null, reason: string}}
 */
export function bindTideStation(beach, stations) {
  const waterClass = waterClassFor(beach);
  if (waterClass === null) {
    return {
      stationId: null,
      reason: `water body type ${JSON.stringify(beach.waterBodyType)} is not one this join recognises`,
    };
  }

  const candidates = Object.entries(stations).filter(
    ([, station]) => station.delivers && station.water === waterClass,
  );

  if (candidates.length === 0) {
    return {
      stationId: null,
      reason: `no delivering ${waterClass} station exists to bind to`,
    };
  }

  let best = null;
  for (const [stationId, station] of candidates) {
    const { metres, end } = segmentDistance(beach.segment, station);
    // Ties break on the station id so the join is deterministic: two runs over
    // the same inputs must produce the same file, or the diff stops meaning
    // anything.
    if (
      best === null ||
      metres < best.distanceM ||
      (metres === best.distanceM && stationId < best.stationId)
    ) {
      best = { stationId, distanceM: metres, fromEnd: end, waterClass };
    }
  }

  return best;
}
