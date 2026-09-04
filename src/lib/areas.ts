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

/**
 * The area `/conditions` opens on.
 *
 * Named rather than derived, for the reason `DEFAULT_BEACH_SLUG` next door is:
 * "first in the table" would move the moment somebody adds an area north of
 * Del Mar. This is the one the National Weather Service means when its surf
 * zone forecast says "La Jolla", it holds ten beaches, and it is the area the
 * whole design was worked against.
 */
export const DEFAULT_AREA_SLUG = "la-jolla";

/** One area by slug, or null. Null means the slug names no area. */
export function areaBySlug(slug: string): Area | null {
  return AREAS.find((area) => area.slug === slug) ?? null;
}

/**
 * The area a beach belongs to, or null when the slug names no beach.
 *
 * Never null for a beach that is in the inventory: the partition is total, and
 * the `areas` gate row is what keeps it that way. The nullable return is for
 * the slug that is not a beach at all, which is what an old or invented URL
 * looks like from here.
 */
export function areaOfBeach(beachSlug: string): Area | null {
  return AREAS.find((area) => area.beaches.includes(beachSlug)) ?? null;
}

/**
 * The default area, or a loud failure.
 *
 * `areas.json` is written by hand, so the default can be renamed out from under
 * this by an ordinary edit. That must stop a build rather than render a page
 * about nothing -- the argument `defaultBeach()` makes about an upstream
 * rename, applied to the file a person maintains.
 */
export function defaultArea(): Area {
  const area = areaBySlug(DEFAULT_AREA_SLUG);
  if (!area) {
    throw new Error(
      `areas.json no longer contains ${DEFAULT_AREA_SLUG}, which /conditions opens on. ` +
        `Pick a new default deliberately.`,
    );
  }
  return area;
}

/**
 * The one beach an area holds, or null when it holds several.
 *
 * Six of the eighteen hold one, and for those the area *is* the beach —
 * ADR-0046 already says so, in the words it permits a single-member area with:
 * "a lone member shares everything with itself and its area is the beach page".
 * This is that sentence made callable.
 */
export function soleBeachOf(area: Area): string | null {
  return area.beaches.length === 1 ? area.beaches[0] : null;
}

/**
 * The one URL a beach is served at, or null when the slug names no beach.
 *
 * **Two shapes, and the rule lives here so nothing redirects twice.** A beach in
 * an area of several is at `/conditions/<area>/<beach>`; the sole beach of its
 * area is at `/conditions/<area>`, because a page offering a choice of one is
 * not a choice. Both routes ask this rather than deciding for themselves, which
 * is what stops an old `/conditions/<beach>` link from bouncing through the
 * nested URL on its way to the area.
 */
export function canonicalConditionsPath(beachSlug: string): string | null {
  const area = areaOfBeach(beachSlug);
  if (!area) return null;

  return soleBeachOf(area) === null
    ? `/conditions/${area.slug}/${beachSlug}`
    : `/conditions/${area.slug}`;
}

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

/**
 * The five products `/conditions` draws, named by what a reader calls them
 * rather than by the table each comes from.
 *
 * One product to one binding, which is why this list is five and not four or
 * six: `tide` is the tide station's, `waves` the wave buoy's measurement,
 * `swell` the MOP line's forecast, `sky` everything the forecast cell supplies
 * (cloud, wind and temperature together, because they come from one cell and
 * fail together), and `air` the shore station's.
 */
export type AreaProduct = "tide" | "waves" | "swell" | "sky" | "air";

/**
 * What an area can say about one product.
 *
 * **Three states, and the middle one is the reason there are three.** An area
 * reports only what all its beaches share, so the obvious model is shared or
 * not — but "not" runs together two different facts, and the page owes a
 * different sentence for each. `absent` is every beach lacking the source, which
 * is the bay's missing buoy and was already true one beach at a time. `mixed` is
 * the beaches not all reading one source, which is new with areas and is the
 * only state a reader has never seen before.
 *
 * **`mixed` covers two shapes and counts them apart.** The plain one is beaches
 * reading different sources; the other is some reading a source and some
 * reading none, which is neither `absent` nor agreement. Both mean no single
 * figure answers for the area, so both are one state -- but the page prints the
 * numbers, and "two sources" said of nine beaches sharing a buoy and one
 * lacking it is false. So `distinct` counts sources and `without` counts the
 * beaches that have none.
 *
 * That is the same distinction `beaches.json` draws about `wave_buoy` null,
 * whose schema note says it "carries TWO meanings and wave_buoy_null_reason
 * always distinguishes them".
 */
export type AreaSource =
  | { kind: "shared"; source: string }
  | { kind: "absent" }
  | {
      kind: "mixed";
      /**
       * How many distinct sources the area's beaches read between them.
       *
       * **Sources, so a beach binding nothing is not counted as one.** The
       * first version of this read the size of a set built over the raw
       * bindings, `null` included, and La Jolla's ten beaches came back as two
       * wave buoys: nine read 46254 and `childrens-pool` reads none. The page
       * prints this figure, so it said the default area's beaches read two
       * buoys when they read one. At least 1, because a `mixed` product has at
       * least one beach that has it -- with none it would be `absent`.
       */
      distinct: number;
      /**
       * How many of the area's beaches bind no source at all.
       *
       * **Beside `distinct` rather than folded into it**, because they are two
       * facts and the sentence needs both: nine beaches reading one buoy and
       * one reading none is not the same page as ten beaches reading two
       * buoys, and only the second is what "2 different sources" describes.
       * Zero for the ordinary disagreement, which is 13 of the 16 mixed
       * product-instances.
       */
      without: number;
    };

export type AreaSources = Readonly<Record<AreaProduct, AreaSource>>;

const BINDING: Readonly<Record<AreaProduct, keyof Beach>> = {
  tide: "tide_station",
  waves: "wave_buoy",
  swell: "mop_line",
  sky: "grid_cell",
  air: "air_station",
};

/**
 * What every beach in an area agrees on, product by product.
 *
 * **Identifier equality, which is the strict form and deliberately so.** Two
 * beaches share a product here only when they bind the very same station, line
 * or cell. That refuses some agreement it should allow — CDIP's model lines sit
 * about 100 m apart and come from one run, so La Jolla's nine almost certainly
 * publish the same forecast to the decimal the page prints — and the measured
 * form of the rule is its own slice. Until that probe exists this is the version
 * that cannot overclaim: everything it calls shared *is* one source.
 *
 * **A beach binding nothing is a gap and never a source.** Counting `null` in
 * with the identifiers is how the default area came to say its ten beaches read
 * two wave buoys when nine read 46254 and `childrens-pool` reads none. It did
 * not change any area's state -- nine agreeing and one lacking still means no
 * single figure -- which is why nothing failed.
 *
 * **No reason strings.** The wording belongs to the page, which is this repo's
 * rule about who owns the copy; and for `absent` there is no beach sentence to
 * lift, because they differ. Coronado's three beaches name 20.9, 21.6 and
 * 21.2 km for the buoy that does not reach them, and Tijuana Estuary's two give
 * different kinds of reason entirely — one is sheltered water, the other is
 * simply too far from a buoy. So an area states the fact and sends the reader to
 * the beach for its own reason.
 *
 * Throws for an area naming a beach the inventory does not have, like
 * `beachesByArea` and for the same reason.
 */
export function areaSources(area: Area): AreaSources {
  const bySlug = new Map(allBeaches().map((beach) => [beach.slug, beach]));
  const members = area.beaches.map((slug) => {
    const beach = bySlug.get(slug);
    if (!beach) {
      throw new Error(
        `areas.json puts ${slug} in ${area.slug}, but beaches.json has no such beach.`,
      );
    }
    return beach;
  });

  const resolve = (product: AreaProduct): AreaSource => {
    const bound = members.map((beach) => beach[BINDING[product]]);

    /*
      Sources and gaps counted apart, because they are different facts and the
      page states both. A set built over the raw bindings counts `null` as a
      source, which made La Jolla's ten beaches read "2 different sources" for
      a buoy nine of them share and one lacks.
    */
    const has = (id: (typeof bound)[number]) => id !== null && id !== undefined;
    const sources = new Set(bound.filter(has));
    const without = bound.length - bound.filter(has).length;

    if (sources.size === 0) return { kind: "absent" };
    if (sources.size === 1 && without === 0) {
      return { kind: "shared", source: String([...sources][0]) };
    }
    return { kind: "mixed", distinct: sources.size, without };
  };

  return {
    tide: resolve("tide"),
    waves: resolve("waves"),
    swell: resolve("swell"),
    sky: resolve("sky"),
    air: resolve("air"),
  };
}
