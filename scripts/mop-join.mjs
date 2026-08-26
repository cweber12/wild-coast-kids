/**
 * Binding a beach to a MOP line.
 *
 * Pure, like the three joins beside it, and the same shape: nearest
 * **delivering** candidate, measured from whichever end of the beach's segment
 * is closer.
 *
 * A SECOND WAVE BINDING RATHER THAN A WIDER FIRST ONE. `wave-join.mjs` binds
 * the buoy the page reads for a measurement of now; this binds the model line
 * it reads for the week ahead. They pick from different tables, fail on
 * different days, and one of them will outlive the other -- Imperial Beach
 * Nearshore died in May 2026 and its beaches lost a buoy without losing a
 * coastline. Overloading one join to return two ids would have made the two
 * bindings move together, which is the thing they must not do.
 *
 * WHAT IT SHARES WITH THE BUOY JOIN IS THE REFUSAL, and that is not a
 * coincidence to be tidied away. Every MOP line sits at 10 m depth on the open
 * coast, so ocean swell reaching this water is the same question, answered from
 * `sheltered.mjs` so the two joins cannot drift apart on it.
 *
 * THE SPACING MAKES THE REFUSAL MATTER MORE, NOT LESS. Buoys sit kilometres
 * apart, so a bay beach bound by proximity alone would get a number from
 * visibly the wrong place. MOP lines are about 100 m apart and some share a
 * coordinate exactly: Children's Pool's nearest line is 330 m away against
 * 2.50 km for its nearest buoy. A join that leaned on distance to keep itself
 * honest would stop being honest here.
 */

import { segmentDistance } from "./geo.mjs";
import { shelteredReason } from "./sheltered.mjs";
import { waterClassFor } from "./tide-join.mjs";

/** Which of a sheltered beach's clauses this join asks for. */
const SOURCE = "mopLine";

/**
 * Bind one beach to a MOP line.
 *
 * @param {{slug?: string, segment: object, waterBodyType: string}} beach
 * @param {Record<string, {lat: number, lon: number, delivers: boolean}>} lines
 * @returns {{lineId: string, distanceM: number, fromEnd: string}
 *   | {lineId: null, reason: string}}
 */
export function bindMopLine(beach, lines) {
  const waterClass = waterClassFor(beach);

  if (waterClass === null) {
    return {
      lineId: null,
      reason: `water body type ${JSON.stringify(beach.waterBodyType)} is not one this join recognises`,
    };
  }

  // Before the water-class test, not after: a sheltered beach may be classed
  // open-coast for its tide and still be closed to swell.
  const sheltered = shelteredReason(beach.slug, SOURCE);
  if (sheltered !== null) {
    return {
      lineId: null,
      reason: `no MOP line describes the water here: ${sheltered}`,
    };
  }

  if (waterClass !== "open-coast") {
    return {
      lineId: null,
      reason:
        "every MOP line sits at 10 m depth on the open coast, and ocean swell does not reach " +
        "into a bay or lagoon, so no line describes the water here",
    };
  }

  const candidates = Object.entries(lines).filter(([, line]) => line.delivers);

  if (candidates.length === 0) {
    return {
      lineId: null,
      reason: "no delivering MOP line exists to bind to",
    };
  }

  let best = null;
  for (const [lineId, line] of candidates) {
    const { metres, end } = segmentDistance(beach.segment, line);
    // Ties break on the id, and here that is load-bearing rather than tidy:
    // adjacent lines can share a coordinate exactly, so without it two runs
    // over the same inputs would disagree and the re-join's diff would stop
    // meaning anything.
    if (
      best === null ||
      metres < best.distanceM ||
      (metres === best.distanceM && lineId < best.lineId)
    ) {
      best = { lineId, distanceM: metres, fromEnd: end };
    }
  }

  return best;
}
