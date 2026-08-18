/**
 * Binding a beach to a National Weather Service observation station.
 *
 * Pure, like the two joins beside it, and the same shape: nearest **delivering**
 * candidate, measured from whichever end of the beach's segment is closer, ties
 * broken on the id so two runs over the same inputs produce the same file.
 *
 * WHAT DIFFERS FROM THE WAVE JOIN IS THE CLASS RULE, AND IT IS THE OTHER WAY
 * ROUND. The wave join binds nothing to a bay or lagoon, because ocean swell
 * does not propagate into enclosed water. Air does. Fog, wind and temperature
 * reach a lagoon exactly as they reach the open coast, so every beach binds here
 * regardless of its water body type, and the asymmetry is deliberate rather than
 * an oversight in one of the two.
 *
 * WHAT IT FILTERS ON IS `publishes_visibility`, NOT PROXIMITY. Forty-six of the
 * fifty-six candidate stations in the county box answer perfectly and carry no
 * visibility at all, and the two nearest La Jolla Shores -- D3101 and MSDSD --
 * are both of that kind. A nearest-station join would therefore bind this site's
 * visibility promise to a station that has never published one. Requiring the
 * field means the binding is further away and can actually answer, and it means
 * one station supplies all four of the panel's values rather than two stations
 * being blended behind one heading.
 */

import { segmentDistance } from "./geo.mjs";

/**
 * Bind one beach to an observation station.
 *
 * @param {{segment: object}} beach
 * @param {Record<string, {lat: number, lon: number, delivers: boolean, publishes_visibility: boolean}>} stations
 * @returns {{stationId: string, distanceM: number, fromEnd: string}
 *   | {stationId: null, reason: string}}
 */
export function bindWeatherStation(beach, stations) {
  const candidates = Object.entries(stations).filter(
    ([, station]) => station.delivers && station.publishes_visibility,
  );

  if (candidates.length === 0) {
    return {
      stationId: null,
      reason:
        "no observation station in the table both answers and publishes visibility, so " +
        "there is nothing to bind to",
    };
  }

  let best = null;
  for (const [stationId, station] of candidates) {
    const { metres, end } = segmentDistance(beach.segment, station);
    if (
      best === null ||
      metres < best.distanceM ||
      (metres === best.distanceM && stationId < best.stationId)
    ) {
      best = { stationId, distanceM: metres, fromEnd: end };
    }
  }

  return best;
}
