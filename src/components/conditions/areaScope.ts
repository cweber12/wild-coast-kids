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
 * **The sentence is here and not in `lib/areas.ts`.** ADR-0048 has the resolver
 * return facts and counts and leaves the copy to the page, and this is the
 * page: `mopLine.ts` and `gridCell.ts` beside it own wording for the same
 * reason. What the resolver could not do is borrow a beach's own reason -- the
 * members' reasons differ, and lifting any one of them would print a figure
 * about one beach as though it were the area's. Coronado's three name 20.9,
 * 21.6 and 21.2 km for the buoy that does not reach them.
 *
 * **One sentence for three positions**, because they are three positions and
 * not three facts. It stands in a card in the measured block, in a note under
 * the week grid and in a chart tab in the day region, and a reader moving down
 * the page meets the same silence three times. Only the product's noun
 * changes.
 *
 * Nothing here fetches anything, and nothing here is a component.
 */

import {
  type Area,
  type AreaProduct,
  type AreaSources,
  areaSources,
  surfZoneBeachOf,
} from "@/lib/areas";

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
  /**
   * The area's member beaches, north to south.
   *
   * **The slugs and not just how many**, because two things need them and one
   * of them needs which: the withheld sentences count them, and the area map
   * draws the coast of every one and a mark at each. It was a count until the
   * map arrived, and keeping both a count and a list would be two fields for
   * one fact.
   */
  beaches: readonly string[];
  sources: AreaSources;
  /**
   * The member the surf zone bulletin is read through, which is not the member
   * everything else is read through.
   *
   * **The one product outside `sources` entirely**, because it is outside the
   * rule `sources` resolves: the National Weather Service issues one bulletin
   * for "San Diego County Coastal Areas", a unit larger than any area here, so
   * intersecting it across members asks a question it has no answer to. What it
   * needs instead is a member the forecast is *issued* for, which
   * `surfZoneBeachOf` picks. See ADR-0050.
   */
  bulletinBeach: string;
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
 * The scope a page hands its panels, built from the area.
 *
 * One place composes it, so the three regions of an area page cannot come to
 * different conclusions about what the area may report -- and so a new field
 * reaches all of them at once. `bulletinBeach` arrived that way.
 */
export function scopeFor(area: Area): AreaScope {
  return {
    name: area.name,
    beaches: area.beaches,
    sources: areaSources(area),
    bulletinBeach: surfZoneBeachOf(area),
  };
}

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
    beaches: scope.beaches.length,
    distinct: source.kind === "mixed" ? source.distinct : 0,
    without: source.kind === "mixed" ? source.without : 0,
  };
}

/**
 * What a panel says instead of a figure, in one sentence.
 *
 * `product` is what the reader came for, in their words: "a wave reading", "a
 * swell forecast". It is the only thing that varies between the three
 * positions this sentence stands in.
 *
 * **Three sentences and not two, because `mixed` has two shapes.** The plain
 * one is beaches reading different sources. The other is some reading a source
 * and some reading none, and saying "read 2 different sources" of nine beaches
 * sharing a buoy and one lacking it is false — which is what the measured block
 * printed on `/conditions/la-jolla`, the default area, until the count learned
 * to tell a gap from a source.
 *
 * **It counts the beaches that have the product rather than the ones that do
 * not**, which is what keeps the gap sentence covering both counts without a
 * second plural to agree: "Only 9 of the 10 beaches" needs no branch where
 * "and 1 has none" would need one, and a reader learns the same thing from it.
 *
 * **One beach having the product is still its own sentence.** Tijuana Estuary
 * is that case today -- Border Field State Park binds a model line and the
 * slough binds none -- and the general form said "Only 1 of the 2 beaches ...
 * have a swell forecast, and they share one source", which is the wrong verb
 * over a clause that says nothing. One beach trivially reads one source, so the
 * clause goes and the verb agrees. Found on the rendered page rather than in a
 * fixture, which is why the area pages are worth looking at rather than only
 * asserting.
 */
export function withheldWords(slot: NotShared, product: string): string {
  if (slot.agreement === "absent") {
    return `No beach in ${slot.areaName} has ${product}. Each says why on its own page.`;
  }

  const tail = `so there is no one figure for the whole area. Choose a beach for it.`;

  if (slot.without === 0) {
    return `The ${slot.beaches} beaches in ${slot.areaName} read ${slot.distinct} different sources for ${product}, ${tail}`;
  }

  const having = slot.beaches - slot.without;
  if (having === 1) {
    return `Only 1 of the ${slot.beaches} beaches in ${slot.areaName} has ${product}, ${tail}`;
  }

  const sources =
    slot.distinct === 1
      ? "they share one source"
      : `they read ${slot.distinct} different sources`;
  return `Only ${having} of the ${slot.beaches} beaches in ${slot.areaName} have ${product}, and ${sources} — ${tail}`;
}

/**
 * One product's answer: what was read, or why the area cannot report it.
 *
 * **Exclusive by construction, and typed rather than checked.** A withheld
 * product is never read -- that is ADR-0048, and it is why an area page makes
 * no request for a figure it has already decided not to print -- so exactly one
 * of these two is present. Stating it in the type is what lets a component
 * compose a chart tab out of it with a branch instead of an assertion that the
 * read and the withholding line up.
 *
 * `WeekPanel` needs none of this and takes plain nulls, because its reads feed
 * `if` guards that narrow a null on their own. The day chart's feed object
 * literals, which do not.
 */
export type Answered<V> =
  { view: V; withheld: null } | { view: null; withheld: NotShared };

/** The read, or the withholding, as one awaitable. */
export function answer<V>(
  withheld: NotShared | null,
  read: () => Promise<V>,
): Promise<Answered<V>> {
  return withheld === null
    ? read().then((view) => ({ view, withheld: null }))
    : Promise.resolve({ view: null, withheld });
}
