/**
 * Binding a beach to the station that publishes its sky.
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
 * WHAT IT FILTERS ON IS `publishes_sky`, NOT PROXIMITY. Of the sixty-two probed
 * candidates only ten carry a sky description, every one of them an airport
 * METAR, and the two nearest La Jolla Shores -- D3101 and MSDSD -- carry none.
 * A nearest-station join would therefore bind this site's sky and visibility to
 * a station that has never published either.
 *
 * THE FIELD WAS RENAMED, NOT THE RULE. It filtered on `publishes_visibility`
 * until the table was generated, and sky and visibility were then measured to be
 * one capability: the same ten stations publish both, with sky the scarcer of
 * the two per observation, so `publishes_sky` is the stricter test and selects
 * the same set. See docs/adr/0010-two-provenances-in-the-air-panel.md.
 *
 * The table this reads now holds every candidate in the county rather than the
 * thirteen a visibility-shaped probe recorded, so the filter is doing far more
 * work than it was: 56 of the 62 rows publish temperature and wind, and this
 * join deliberately ignores all of that. The air join is what reads those.
 */

import { segmentDistance } from "./geo.mjs";

/**
 * Bind one beach to the station that publishes its sky.
 *
 * @param {{segment: object}} beach
 * @param {Record<string, {lat: number, lon: number, delivers: boolean, publishes_sky: boolean}>} stations
 * @returns {{stationId: string, distanceM: number, fromEnd: string}
 *   | {stationId: null, reason: string}}
 */
export function bindSkyStation(beach, stations) {
  const candidates = Object.entries(stations).filter(
    ([, station]) => station.delivers && station.publishes_sky,
  );

  if (candidates.length === 0) {
    return {
      stationId: null,
      reason:
        "no observation station in the table both answers and publishes sky, so there " +
        "is nothing to bind to",
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
