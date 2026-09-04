import { expect, test } from "vitest";
import { areaBySlug } from "@/lib/areas";
import { scopeFor, withheldBy, withheldWords } from "./areaScope";

/** The scope a page builds, from the table rather than from a fixture. */
const scopeOf = (slug: string) => scopeFor(areaBySlug(slug)!);

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
  expect(withheldBy(scopeOf("la-jolla"), "air")).toBeNull();
});

/**
 * The two silences, told apart. `absent` is every beach lacking the source and
 * was already true one beach at a time; `mixed` is new with areas.
 */
test("an absent product carries the area and no counts", () => {
  expect(withheldBy(scopeOf("mission-bay-west"), "swell")).toEqual({
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
  expect(withheldBy(scopeOf("la-jolla"), "waves")).toEqual({
    agreement: "mixed",
    areaName: "La Jolla",
    beaches: 10,
    distinct: 1,
    without: 1,
  });

  // And the plain disagreement, which is 13 of the 16 mixed product-instances.
  expect(withheldBy(scopeOf("la-jolla"), "sky")).toEqual({
    agreement: "mixed",
    areaName: "La Jolla",
    beaches: 10,
    distinct: 4,
    without: 0,
  });
});

/**
 * The sentence, in the three shapes it has. It stands in a card, a note under
 * the week grid and a chart tab, so a reader who meets the same silence twice
 * on one page meets it in the same words.
 */
test("an absent product says nobody has it, and does not blame disagreement", () => {
  const words = withheldWords(
    withheldBy(scopeOf("mission-bay-west"), "swell")!,
    "a swell forecast",
  );

  expect(words).toBe(
    "No beach in Mission Bay – West has a swell forecast. Each says why on its own page.",
  );
  expect(words).not.toContain("different sources");
});

test("a plain disagreement counts the sources", () => {
  expect(
    withheldWords(withheldBy(scopeOf("la-jolla"), "sky")!, "a cloud forecast"),
  ).toBe(
    "The 10 beaches in La Jolla read 4 different sources for a cloud forecast, " +
      "so there is no one figure for the whole area. Choose a beach for it.",
  );
});

/**
 * The shape the count used to be wrong about. Nine of La Jolla's ten read buoy
 * 46254 and one reads none: one source and one gap, which is not "2 different
 * sources".
 */
test("a disagreement with a gap in it counts the beaches that have the product", () => {
  const words = withheldWords(
    withheldBy(scopeOf("la-jolla"), "waves")!,
    "a wave reading",
  );

  expect(words).toBe(
    "Only 9 of the 10 beaches in La Jolla have a wave reading, and they share one source — " +
      "so there is no one figure for the whole area. Choose a beach for it.",
  );
  expect(words).not.toContain("different sources");
});

/** And the same shape where the beaches that have it disagree as well. */
test("a gap and a disagreement are both counted", () => {
  expect(
    withheldWords(
      withheldBy(scopeOf("la-jolla"), "swell")!,
      "a swell forecast",
    ),
  ).toBe(
    "Only 9 of the 10 beaches in La Jolla have a swell forecast, and they read 8 different sources — " +
      "so there is no one figure for the whole area. Choose a beach for it.",
  );
});

/**
 * One beach having the product, which the general form got wrong: "Only 1 of
 * the 2 beaches ... have a swell forecast, and they share one source" is the
 * wrong verb over a clause that says nothing, since one beach trivially reads
 * one source.
 *
 * Tijuana Estuary is the case, and it is the only one in the table today —
 * asserted as a count so that a membership change which removes it shows up as
 * a test that has stopped covering anything.
 */
test("one beach having the product takes the singular, and drops the clause", () => {
  const words = withheldWords(
    withheldBy(scopeOf("tijuana-estuary"), "swell")!,
    "a swell forecast",
  );

  expect(words).toBe(
    "Only 1 of the 2 beaches in Tijuana Estuary has a swell forecast, " +
      "so there is no one figure for the whole area. Choose a beach for it.",
  );
  expect(words).not.toContain("have a swell");
  expect(words).not.toContain("share one source");
});

/** Every sentence the table actually produces, read for a verb that disagrees. */
test("no area's sentence puts a plural verb on a count of one", async () => {
  const { beachesByArea } = await import("@/lib/areas");
  let singular = 0;

  for (const { area } of beachesByArea()) {
    if (area.beaches.length < 2) continue;
    const scope = scopeFor(area);

    for (const product of ["tide", "waves", "swell", "sky", "air"] as const) {
      const slot = withheldBy(scope, product);
      if (slot === null) continue;

      const words = withheldWords(slot, `a ${product} reading`);
      if (/^Only 1 of the/.test(words)) singular += 1;
      expect(words, `${area.slug} ${product}`).not.toMatch(
        /^Only 1 of the .* have /,
      );
    }
  }

  // The probe: Tijuana Estuary's swell is the one instance in the table today,
  // so a run finding none is a run asserting nothing.
  expect(singular).toBe(1);
});
