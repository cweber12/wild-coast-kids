/**
 * The areas the inventory is grouped into, typed.
 *
 * An **area** is a named stretch of this county's coast holding one or more
 * beaches — Del Mar, La Jolla, Mission Bay – West. It is what a reader chooses
 * on `/conditions`, and it replaced `region`, which was derived from water
 * class and mean latitude and grouped `Childrens Pool` with a wildlife refuge
 * 19 km away because both are bay-class.
 *
 * `src/data/areas.json` is the one table about the beaches that a person writes
 * by hand, and the reason is in its own `_provenance`: nothing upstream
 * publishes an area name, and neither latitude nor the resource's own
 * `nearest_city` can stand in for one. Its counterpart `beaches.json` is
 * rewritten by a script, so the two can drift — which is what the `areas` gate
 * row exists to catch, and why the resolution below throws rather than skips.
 *
 * Nothing here fetches anything. Like `beaches.ts` beside it, reading a group
 * is a file read.
 */

import areaTable from "@/data/areas.json";
import { allBeaches, type Beach } from "./beaches";

/** One area, as `areas.json` carries it. */
export interface Area {
  slug: string;
  name: string;
  /** Member beach slugs, north to south. */
  beaches: readonly string[];
}

const AREAS: readonly Area[] = areaTable.areas;

/** One area's beaches, resolved, for a chooser or a heading. */
export interface AreaGroup {
  area: Area;
  beaches: readonly Beach[];
}

/**
 * Every area with its beaches resolved, north to south and north to south
 * within each.
 *
 * **Throws when an area names a beach the inventory does not have.** That is
 * two data files disagreeing, not a missing reading, and it should stop a build
 * rather than quietly serve a chooser with a beach missing from it — the same
 * argument `tideStationFor` makes about a station it cannot describe. The
 * `areas` gate row catches it earlier and says more; this is the backstop for
 * the case where somebody edits one file and runs the app without the gate.
 */
export function beachesByArea(): readonly AreaGroup[] {
  const bySlug = new Map(allBeaches().map((beach) => [beach.slug, beach]));

  return AREAS.map((area) => ({
    area,
    beaches: area.beaches.map((slug) => {
      const beach = bySlug.get(slug);
      if (!beach) {
        throw new Error(
          `areas.json puts ${slug} in ${area.slug}, but beaches.json has no such beach. ` +
            `Upstream may have renamed it; name its area deliberately.`,
        );
      }
      return beach;
    }),
  }));
}
