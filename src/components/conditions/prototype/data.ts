/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * The data prep every variant needs, lifted verbatim out of
 * `ConditionsSection` so the variants disagree about layout and about nothing
 * else. Sharing this much is deliberate: sharing a *layout* would defeat the
 * prototype, sharing the reads makes the comparison honest.
 */

import { areaBySlug, beachesByArea } from "@/lib/areas";
import { type AreaScope, scopeFor } from "../areaScope";

export type PrototypeData = {
  areas: { slug: string; name: string }[];
  group: ReturnType<typeof beachesByArea>[number];
  /** The beach a read is keyed on. */
  reading: string;
  /** Undefined on a beach page, which is what withholds nothing. */
  scope: AreaScope | undefined;
  /** The member the surf zone bulletin is read through — see ADR-0050. */
  bulletin: string;
};

export function prototypeData(
  areaSlug: string,
  beachSlug: string | null,
): PrototypeData {
  const groups = beachesByArea();
  const areas = groups.map((group) => ({
    slug: group.area.slug,
    name: group.area.name,
  }));

  const group = groups.find((entry) => entry.area.slug === areaSlug);
  if (!group || !areaBySlug(areaSlug)) {
    throw new Error(
      `The conditions prototype was given ${areaSlug}, which names no area in areas.json.`,
    );
  }

  const reading = beachSlug ?? group.beaches[0].slug;
  const scope = beachSlug === null ? scopeFor(group.area) : undefined;
  const bulletin = scope === undefined ? reading : scope.bulletinBeach;

  return { areas, group, reading, scope, bulletin };
}

/** The standing notice ADR-0009 turns on. Same words in every variant. */
export const STANDING_NOTICE =
  "Instrument readings, not a safety assessment — lifeguards and the signs posted at the beach are the authority on the day.";

export const BAND_FALLBACK = "Reading the buoy and the air station…";
export const RIP_FALLBACK = "Reading the rip current risk…";
export const WEEK_FALLBACK = "Reading the week from NOAA…";
export const DAY_FALLBACK = "Reading the sky in words…";
