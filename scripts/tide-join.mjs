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

const EARTH_RADIUS_M = 6371008.8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than a projected approximation: the corridor is small enough
 * that either would do, and this one has no zone to get wrong.
 *
 * @param {{lat: number, lon: number}} a
 * @param {{lat: number, lon: number}} b
 * @returns {number}
 */
export function distanceMetres(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * The distance from a beach segment to a point, and which end supplied it.
 *
 * @param {{upper: {lat: number, lon: number}, lower: {lat: number, lon: number}}} segment
 * @param {{lat: number, lon: number}} point
 * @returns {{metres: number, end: "upper" | "lower"}}
 */
export function segmentDistance(segment, point) {
  const upper = distanceMetres(segment.upper, point);
  const lower = distanceMetres(segment.lower, point);
  return upper <= lower
    ? { metres: upper, end: "upper" }
    : { metres: lower, end: "lower" };
}

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
 * Bind one beach to a station.
 *
 * @param {{segment: object, waterBodyType: string}} beach
 * @param {Record<string, {lat: number, lon: number, water: string, delivers: boolean}>} stations
 * @returns {{stationId: string, distanceM: number, fromEnd: string, waterClass: string}
 *   | {stationId: null, reason: string}}
 */
export function bindTideStation(beach, stations) {
  const waterClass = waterClassOf(beach.waterBodyType);
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
