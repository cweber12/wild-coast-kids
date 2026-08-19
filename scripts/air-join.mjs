/**
 * Binding a beach to the station that measures its air.
 *
 * Pure, like the three joins beside it, and the same shape: nearest qualifying
 * candidate, measured from whichever end of the beach's segment is closer, ties
 * broken on the id so two runs over the same inputs produce the same file.
 *
 * THIS IS THE SECOND JOIN OVER ONE TABLE. `weather-join.mjs` binds the station
 * that supplies sky and visibility, filtering on `publishes_sky` -- ten stations
 * county-wide, every one an airport. This one binds the station that supplies
 * temperature and wind, filtering on what those two actually need. The same
 * table answers both because the table records a capability per field rather
 * than one question's answer. See docs/adr/0010-two-provenances-in-the-air-panel.md.
 *
 * WHAT IT FILTERS ON:
 *
 * *Delivering*, for the reason every table here records measured delivery: a
 * station listed by its network can be retired and still listed.
 *
 * *Temperature AND wind from the same station*, not each from its nearest. They
 * are the panel's two headline figures and are read as one statement about the
 * air at the beach; splitting them would put two provenances behind one
 * sentence, which is worse than the two behind one panel that ADR 0010 already
 * spends this panel's credibility on.
 *
 * *A shore station for an open-coast beach*, and any station for a bay or
 * lagoon. This is the tide join's water class doing the same job for a different
 * reason. Pure distance binds 24 of these beaches to a station above 50 m,
 * because Mt. Soledad at 102 m overlooks half the corridor and reads several
 * degrees warmer than the sand below it. The asymmetry is deliberate: a marine
 * layer is not what a station overlooking Mission Bay gets wrong, so a bay beach
 * ranks over everything and takes the nearest.
 *
 * `shore` is a hand-written input to this join, not a measurement, exactly as
 * `water` is for the tide join. `elevation_m` sits beside it in the table as the
 * measured thing the judgement is read from, and is deliberately NOT a filter
 * here: an elevation cap was measured and rejected, because it gets the bay
 * stations wrong in both directions.
 */

import { segmentDistance } from "./geo.mjs";
import { waterClassOf } from "./tide-join.mjs";

/**
 * Bind one beach to the station that measures its air.
 *
 * @param {{segment: object, waterBodyType: string}} beach
 * @param {Record<string, {lat: number, lon: number, delivers: boolean, publishes_air_temp: boolean, publishes_wind: boolean, shore: boolean}>} stations
 * @returns {{stationId: string, distanceM: number, fromEnd: string, waterClass: string}
 *   | {stationId: null, reason: string}}
 */
export function bindAirStation(beach, stations) {
  const waterClass = waterClassOf(beach.waterBodyType);
  if (waterClass === null) {
    return {
      stationId: null,
      reason: `water body type ${JSON.stringify(beach.waterBodyType)} is not one this join recognises`,
    };
  }

  const candidates = Object.entries(stations).filter(
    ([, station]) =>
      station.delivers &&
      station.publishes_air_temp &&
      station.publishes_wind &&
      (waterClass === "bay" || station.shore),
  );

  if (candidates.length === 0) {
    return {
      stationId: null,
      reason:
        waterClass === "open-coast"
          ? "no station in the table both answers and publishes air temperature and wind " +
            "from the shore, so there is nothing an open-coast beach may bind to"
          : "no station in the table both answers and publishes air temperature and wind, " +
            "so there is nothing to bind to",
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
      best = { stationId, distanceM: metres, fromEnd: end, waterClass };
    }
  }

  return best;
}
