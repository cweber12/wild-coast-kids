/**
 * Distances along a coastline, for the joins next door.
 *
 * Pure geometry and nothing else. It lives on its own because two joins need it
 * now -- a beach to a tide station, and a beach to a wave buoy -- and geometry
 * filed under either of them would be found by whoever was not looking for it.
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
