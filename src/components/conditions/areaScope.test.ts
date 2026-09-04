import { expect, test } from "vitest";
import { areaBySlug, areaSources } from "@/lib/areas";
import { type AreaScope, withheldBy } from "./areaScope";

/** The scope a page builds, from the table rather than from a fixture. */
function scopeFor(slug: string): AreaScope {
  const area = areaBySlug(slug)!;
  return {
    name: area.name,
    beaches: area.beaches.length,
    sources: areaSources(area),
  };
}

/**
 * The beach page's path, and the reason every panel's beach-scoped behaviour is
 * unchanged: with no scope there is nothing to withhold, so every product is
 * read and drawn exactly as it was before areas existed.
 */
test("no scope withholds nothing", () => {
  for (const product of ["tide", "waves", "swell", "sky", "air"] as const) {
    expect(withheldBy(undefined, product), product).toBeNull();
  }
});

test("a shared product is not withheld", () => {
  // Air is shared by all eighteen areas, which is why every area page has
  // something measured on it at all.
  expect(withheldBy(scopeFor("la-jolla"), "air")).toBeNull();
});

/**
 * The two silences, told apart. `absent` is every beach lacking the source and
 * was already true one beach at a time; `mixed` is new with areas.
 */
test("an absent product carries the area and no counts", () => {
  expect(withheldBy(scopeFor("mission-bay-west"), "swell")).toEqual({
    agreement: "absent",
    areaName: "Mission Bay – West",
    beaches: 8,
    distinct: 0,
    without: 0,
  });
});

test("a mixed product carries its sources and its gaps apart", () => {
  // Nine of La Jolla's ten read buoy 46254 and `childrens-pool` reads none:
  // one source, one gap. Counting the gap as a source is what made the default
  // area's page say "2 different sources" over it.
  expect(withheldBy(scopeFor("la-jolla"), "waves")).toEqual({
    agreement: "mixed",
    areaName: "La Jolla",
    beaches: 10,
    distinct: 1,
    without: 1,
  });

  // And the plain disagreement, which is 13 of the 16 mixed product-instances.
  expect(withheldBy(scopeFor("la-jolla"), "sky")).toEqual({
    agreement: "mixed",
    areaName: "La Jolla",
    beaches: 10,
    distinct: 4,
    without: 0,
  });
});
