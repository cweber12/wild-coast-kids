/**
 * Binding a beach to a wave buoy.
 *
 * Pure, like the tide join beside it, and the same shape: nearest **delivering**
 * candidate, measured from whichever end of the beach's segment is closer.
 *
 * WHAT DIFFERS IS THE CLASS RULE, AND IT IS NOT SYMMETRIC. The tide join has two
 * classes and binds a beach to the matching one. Here there is one class of
 * candidate, because every wave buoy sits on the open coast, and a bay or inlet
 * beach is therefore bound to **nothing**. Ocean swell does not propagate into a
 * bay or a lagoon, so the nearest buoy's height would describe different water:
 * a parent reading three feet before a paddle with children would be told
 * something false about the place they are going. A missing number they can see
 * is better than a confident wrong one.
 *
 * `publishes_waves` is checked separately from `delivers` because one station in
 * the table answers perfectly, publishes waves, and still must not be bound:
 * 46086 sits twenty-seven nautical miles offshore, outside the corridor these
 * beaches share. The field is this join's verdict on a station rather than a
 * claim about what its rows carry.
 */

import { segmentDistance } from "./geo.mjs";
import { shelteredReason } from "./sheltered.mjs";
import { waterClassFor } from "./tide-join.mjs";

/** Which of a sheltered beach's clauses this join asks for. */
const SOURCE = "buoy";

/**
 * Bind one beach to a wave buoy.
 *
 * @param {{slug?: string, segment: object, waterBodyType: string}} beach
 * @param {Record<string, {lat: number, lon: number, delivers: boolean, publishes_waves: boolean}>} buoys
 * @returns {{buoyId: string, distanceM: number, fromEnd: string}
 *   | {buoyId: null, reason: string}}
 */
export function bindWaveBuoy(beach, buoys) {
  const waterClass = waterClassFor(beach);

  if (waterClass === null) {
    return {
      buoyId: null,
      reason: `water body type ${JSON.stringify(beach.waterBodyType)} is not one this join recognises`,
    };
  }

  // Before the water-class test, not after: a sheltered beach may be classed
  // open-coast for its tide and still be closed to swell, which is the whole
  // of Children's Pool. See sheltered.mjs for the criterion.
  const sheltered = shelteredReason(beach.slug, SOURCE);
  if (sheltered !== null) {
    return {
      buoyId: null,
      reason: `no buoy describes the water here: ${sheltered}`,
    };
  }

  if (waterClass !== "open-coast") {
    return {
      buoyId: null,
      reason:
        "every wave buoy sits on the open coast, and ocean swell does not reach into a bay " +
        "or lagoon, so no buoy describes the water here",
    };
  }

  const candidates = Object.entries(buoys).filter(
    ([, buoy]) => buoy.delivers && buoy.publishes_waves,
  );

  if (candidates.length === 0) {
    return {
      buoyId: null,
      reason: "no delivering wave buoy exists to bind to",
    };
  }

  let best = null;
  for (const [buoyId, buoy] of candidates) {
    const { metres, end } = segmentDistance(beach.segment, buoy);
    // Ties break on the id, so two runs over the same inputs produce the same
    // file and the re-join's diff keeps meaning something.
    if (
      best === null ||
      metres < best.distanceM ||
      (metres === best.distanceM && buoyId < best.buoyId)
    ) {
      best = { buoyId, distanceM: metres, fromEnd: end };
    }
  }

  return best;
}
