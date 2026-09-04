/**
 * What an area may report, asked once for every panel that draws a product.
 *
 * Three panels on `/conditions` render at two scopes -- one beach, or an area
 * holding several -- and each of them has to ask the same question of every
 * product it draws: may this area report it, and if not, which silence is it?
 * `lib/areas.ts` resolves the bindings; this is the shape a component takes
 * that answer in.
 *
 * It exists for the reason `mopLine.ts`, `gridCell.ts` and `tideStation.ts`
 * beside it do: two call sites answering one question is how `ProvenanceLine`
 * came to print the same station two ways on one card. Here the question is
 * asked by the measured block, the week and the day chart, and the answer has
 * to be the same in all three or an area reports a tide in one region and
 * withholds it in the next.
 *
 * **Facts and counts, never a sentence.** The copy on this page belongs to the
 * page, and each of the three panels words a withheld product in the slot it
 * already uses for an absence -- a card, a note under the grid, a chart tab. It
 * also could not carry a sentence: the beaches' own reasons differ, and lifting
 * any one of them would print a figure about one beach as though it were the
 * area's. See ADR-0048.
 *
 * Nothing here fetches anything, and nothing here is a component.
 */

import { type AreaProduct, type AreaSources } from "@/lib/areas";

/**
 * What a panel is about, when it is about an area rather than one beach.
 *
 * Absent on a beach page, present on an area's. The panels still read through
 * a beach slug, because every read in `lib/conditions.ts` is keyed on one --
 * but which beach is immaterial for a product the area shares, and that is what
 * "shared" means: `areas.test.ts` asserts that where `areaSources` says shared,
 * every beach in the area binds that same source. A product it does not share
 * is not read at all, so no member's figure can leak into an area's answer.
 */
export type AreaScope = {
  name: string;
  beaches: number;
  sources: AreaSources;
};

/**
 * Why an area cannot report a product, when its beaches do not share one.
 *
 * **Two agreements, because they owe a reader different sentences.** `absent`
 * is every beach in the area lacking the source, which is the bay's missing
 * buoy and was already true one beach at a time. `mixed` is the beaches not all
 * reading one source, which is new with areas and is the only state a reader
 * has never seen before.
 *
 * **`mixed` has two shapes and the counts tell them apart.** Either the beaches
 * read different sources, or some read one and some read none — three of the
 * sixteen mixed product-instances are the second, La Jolla's own wave buoy
 * among them. Both mean no single figure answers for the area; only the first
 * is what "different sources" describes.
 */
export type NotShared = {
  agreement: "absent" | "mixed";
  /** The area's name, for the sentence. */
  areaName: string;
  /** How many beaches it holds. */
  beaches: number;
  /** How many distinct sources they bind. Only meaningful when `mixed`. */
  distinct: number;
  /**
   * How many of them bind no source at all. Only meaningful when `mixed`.
   *
   * **Beside `distinct` because the sentence needs both.** Nine beaches reading
   * one buoy and a tenth reading none is not ten beaches reading two buoys, and
   * only the second is what "2 different sources" describes. It was the first
   * that `/conditions/la-jolla` printed the second sentence over.
   */
  without: number;
};

/**
 * A product the area cannot report, or null when it can.
 *
 * Null on a beach page too, and that is the whole of what makes a panel's
 * beach-scoped path unchanged: with no scope there is nothing to withhold, so
 * every product is read and drawn exactly as it was before areas existed.
 */
export function withheldBy(
  scope: AreaScope | undefined,
  product: AreaProduct,
): NotShared | null {
  if (!scope) return null;

  const source = scope.sources[product];
  if (source.kind === "shared") return null;

  return {
    agreement: source.kind,
    areaName: scope.name,
    beaches: scope.beaches,
    distinct: source.kind === "mixed" ? source.distinct : 0,
    without: source.kind === "mixed" ? source.without : 0,
  };
}
