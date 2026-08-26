/**
 * Beaches a fixed structure closes to ocean swell.
 *
 * This is a fact about a beach, not about who publishes a number for it, and it
 * lived inside `wave-join.mjs` while that was the only join that needed it. It
 * is here because a second one does: MOP lines sit at 10 m depth on the open
 * coast, ~100 m apart, so a nearest-point join over them is *more* likely to
 * find a spuriously close candidate for a closed cove than a join over buoys
 * kilometres apart. A criterion copied into the second join would be a
 * criterion that could diverge from the first.
 *
 * THE WATER CLASS ANSWERS TWO QUESTIONS AND THEY CAN DIVERGE. `tide-join.mjs`
 * reads it as which water body's level applies here; the wave joins read it as
 * whether ocean swell reaches this water. Those agree at 71 of 73 beaches,
 * which is why one field carried both until Children's Pool, where a breakwater
 * stands between the two answers: the water level inside the pool is the
 * ocean's, and the swell outside it is not.
 *
 * THE CRITERION, so this stays checkable rather than becoming a taste: a fixed
 * constructed structure -- breakwater, seawall, jetty -- stands between the
 * beach and the open ocean. NOT "the waves feel smaller here", which is
 * unfalsifiable and would spread along a coast made largely of coves. Applied
 * to all sixteen open-coast beaches that survive the inventory bound; one
 * qualifies. See docs/plans/inventory-bounded-by-stations.md.
 *
 * Hand-written for the same reason as `water` and `shore`: no authority
 * publishes it, and a join has to be told.
 *
 * WHAT IS SPLIT AND WHY. The structure and the stakes belong to the beach and
 * are shared. The middle clause -- what the nearest candidate would have
 * described -- belongs to the join, because "the nearest buoy is 2.50 km away"
 * and "the nearest MOP line is 330 m away" are different sentences about
 * different networks. Keyed per source rather than passed in, so that a second
 * sheltered beach cannot inherit the first one's word for its structure.
 */

/**
 * @typedef {object} ShelteredBeach
 * @property {string} structure  What stands there, and what it does. Ends in a full stop.
 * @property {string} stakes     Why a wrong number here would matter. Ends in a full stop.
 * @property {Record<string, string>} sources  Per join, what its nearest candidate describes.
 */

/** @type {Record<string, ShelteredBeach>} */
export const SHELTERED = {
  "childrens-pool": {
    structure:
      "a curved breakwater encloses the cove, which is what it was built for.",
    stakes:
      "at the beach in this inventory most likely to be read by someone " +
      "deciding whether to put children in the water.",
    sources: {
      buoy:
        "The nearest buoy is 2.50 km away on the open coast and describes " +
        "swell the breakwater stops,",
    },
  },
};

/**
 * Why a join refuses this beach, or null when the beach is not a sheltered one.
 *
 * Throws when a sheltered beach has no clause for the asking join. A join that
 * refuses a beach owes the reader what it refused and why; composing the
 * sentence with a hole in it would ship half of that, and silently binding the
 * beach instead would ship the wrong number this table exists to prevent.
 *
 * @param {string | undefined} slug
 * @param {string} source  Which join is asking; a key of the beach's `sources`.
 * @returns {string | null}
 */
export function shelteredReason(slug, source) {
  const beach = SHELTERED[slug];
  if (beach === undefined) return null;

  const clause = beach.sources[source];
  if (clause === undefined) {
    throw new Error(
      `sheltered: ${slug} is sheltered and has no clause for the ${JSON.stringify(source)} ` +
        `join. Add one rather than letting the join bind a structure it cannot describe.`,
    );
  }

  return `${beach.structure} ${clause} ${beach.stakes}`;
}
