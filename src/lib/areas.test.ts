import { describe, expect, test, vi } from "vitest";
import {
  areaBySlug,
  areaSources,
  areaOfBeach,
  DEFAULT_AREA_SLUG,
  beachesByArea,
  defaultArea,
  surfZoneBeachOf,
} from "./areas";
import { allBeaches, surfZoneWithheldReason } from "./beaches";

describe("beachesByArea", () => {
  test("covers the whole inventory exactly once", () => {
    const grouped = beachesByArea().flatMap((group) => group.beaches);

    expect(grouped.map((beach) => beach.slug).sort()).toEqual(
      allBeaches()
        .map((beach) => beach.slug)
        .sort(),
    );
  });

  test("every area has a name and at least one beach", () => {
    for (const { area, beaches } of beachesByArea()) {
      expect(area.name).not.toBe("");
      expect(beaches.length).toBeGreaterThan(0);
    }
  });

  /**
   * The inventory is sorted north to south, so preserving its order is what
   * makes the chooser read down the coast. Two separate properties, because
   * they are all that can be true at once: members are in inventory order
   * *within* an area, and areas are ordered by their northernmost member.
   */
  test("members run north to south within an area", () => {
    const order = new Map(allBeaches().map((beach, i) => [beach.slug, i]));

    for (const { area, beaches } of beachesByArea()) {
      const indices = beaches.map((beach) => order.get(beach.slug)!);
      expect(indices, area.slug).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  test("areas are ordered by their northernmost beach", () => {
    const order = new Map(allBeaches().map((beach, i) => [beach.slug, i]));
    const firsts = beachesByArea().map((group) =>
      Math.min(...group.beaches.map((beach) => order.get(beach.slug)!)),
    );

    expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
  });

  /**
   * And the two properties above are all that hold, because **areas interleave
   * north to south** — flattening them does not give the inventory's order
   * back. Mission Bay's arms are why: `mission-bay-north` spans inventory
   * positions 15–22 and `mission-bay-west` spans 21–32, with `Mission Beach`
   * at 26 sitting inside both, which is the same interleave that stopped
   * latitude from deriving these groups in the first place.
   *
   * Asserted rather than left as a surprise: without this a later reader finds
   * the flattened order unsorted, reads it as a defect and "fixes" the table
   * by moving a beach out of the area it belongs to.
   */
  test("areas interleave, so the flattened order is not the inventory's", () => {
    const order = new Map(allBeaches().map((beach, i) => [beach.slug, i]));
    const flattened = beachesByArea().flatMap((group) =>
      group.beaches.map((beach) => order.get(beach.slug)!),
    );

    expect(flattened).not.toEqual([...flattened].sort((a, b) => a - b));
  });

  /**
   * The two bays are the reason there are eighteen areas rather than thirteen.
   * Named here because the split is a decision — see the 2026-09-02 addendum in
   * `docs/plans/areas-over-locations.md` — and a later edit that quietly folds
   * them back together should fail rather than merely change a dropdown.
   */
  test("Mission Bay is four areas and San Diego Bay is three", () => {
    const slugs = beachesByArea().map((group) => group.area.slug);

    expect(slugs.filter((slug) => slug.startsWith("mission-bay-"))).toEqual([
      "mission-bay-north",
      "mission-bay-west",
      "mission-bay-east",
      "mission-bay-south",
    ]);
    expect(slugs.filter((slug) => slug.startsWith("san-diego-bay-"))).toEqual([
      "san-diego-bay-north",
      "san-diego-bay-central",
    ]);
    expect(slugs).toContain("coronado-cays");
  });

  /**
   * An area slug may equal a beach slug — three do — because the two sit at
   * different positions of the route. Asserted rather than left implicit, so
   * the collision is a recorded property rather than something a later reader
   * treats as a bug.
   *
   * Five beach slugs were candidates before the bays were split; `mission-bay`
   * and `san-diego-bay` stopped colliding when those areas became
   * `mission-bay-north` and the rest, so the split removed two of them.
   */
  test("an area slug may equal a beach slug", () => {
    const beachSlugs = new Set(allBeaches().map((beach) => beach.slug));
    const shared = beachesByArea()
      .map((group) => group.area.slug)
      .filter((slug) => beachSlugs.has(slug));

    expect(shared).toEqual(["pacific-beach", "mission-beach", "ocean-beach"]);
  });

  test("throws when an area names a beach the inventory does not have", async () => {
    vi.resetModules();
    vi.doMock("@/data/areas.json", () => ({
      default: {
        areas: [{ slug: "nowhere", name: "Nowhere", beaches: ["not-a-beach"] }],
      },
    }));

    const { beachesByArea: withBrokenTable } = await import("./areas");

    expect(() => withBrokenTable()).toThrow(/beaches\.json has no such beach/);

    vi.doUnmock("@/data/areas.json");
    vi.resetModules();
  });
});

describe("looking one area up", () => {
  test("finds it by slug, and answers null for a slug that names none", () => {
    expect(areaBySlug("la-jolla")?.name).toBe("La Jolla");
    expect(areaBySlug("atlantis")).toBeNull();
  });

  /**
   * Never null for a beach in the inventory, because the partition is total and
   * the `areas` gate row keeps it that way. The nullable return is for a slug
   * that is not a beach at all, which is what a stale or invented URL looks
   * like from here.
   */
  test("finds the area holding a beach, for every beach there is", () => {
    expect(areaOfBeach("windansea-beach")?.slug).toBe("la-jolla");
    expect(areaOfBeach("mission-bay-sail-bay")?.slug).toBe("mission-bay-west");
    expect(areaOfBeach("no-such-beach")).toBeNull();

    for (const { beaches } of beachesByArea()) {
      for (const beach of beaches) {
        expect(areaOfBeach(beach.slug), beach.slug).not.toBeNull();
      }
    }
  });

  test("the default area is in the table", () => {
    expect(defaultArea().slug).toBe(DEFAULT_AREA_SLUG);
  });

  /**
   * `areas.json` is written by hand, so an ordinary edit can rename the default
   * out from under `/conditions`. That must stop a build rather than render a
   * page about nothing.
   */
  test("throws when the default has been renamed away", async () => {
    vi.resetModules();
    vi.doMock("@/data/areas.json", () => ({
      default: {
        areas: [
          { slug: "somewhere-else", name: "Somewhere Else", beaches: [] },
        ],
      },
    }));

    const { defaultArea: withRenamedTable } = await import("./areas");
    expect(() => withRenamedTable()).toThrow(/no longer contains la-jolla/);

    vi.doUnmock("@/data/areas.json");
    vi.resetModules();
  });
});

describe("what an area's beaches agree on", () => {
  const of = (slug: string) => areaSources(areaBySlug(slug)!);

  /**
   * An area of one agrees with itself about everything it has. That is
   * ADR-0046's whole argument for permitting a single-member area, and it is
   * what makes the degenerate case need no branch in the code.
   */
  test("an area of one shares every source it binds", () => {
    const sources = of("mission-beach");

    for (const product of ["tide", "waves", "swell", "sky", "air"] as const) {
      expect(sources[product].kind, product).toBe("shared");
    }
  });

  /**
   * The distinction the three states exist for. La Jolla's ten beaches all have
   * a forecast cell and bind four different ones — that is `mixed`, and it is
   * new with areas. Mission Bay – West's eight have no MOP line at all — that is
   * `absent`, and it was already true one beach at a time.
   *
   * And the case between them, which is `mixed` too: nine of La Jolla's ten
   * read buoy 46254 and `childrens-pool` reads none. No single figure answers
   * for the area either way, so the state is the same — but it is one source
   * and one gap, and `without` is what keeps the page from calling that two
   * sources.
   */
  test("disagreeing is not the same as lacking", () => {
    expect(of("la-jolla").sky).toEqual({
      kind: "mixed",
      distinct: 4,
      without: 0,
    });
    expect(of("mission-bay-west").swell).toEqual({ kind: "absent" });
    expect(of("la-jolla").waves).toEqual({
      kind: "mixed",
      distinct: 1,
      without: 1,
    });
  });

  test("a shared product names the one source behind it", () => {
    expect(of("la-jolla").air).toEqual({
      kind: "shared",
      source: "LJAC1",
    });
  });

  /**
   * Measured across the whole table rather than sampled, because these counts
   * are what decide how much of an area page renders at all. If a later edit to
   * `areas.json` moves one, that is a real change to what readers see and it
   * should be a decision rather than a surprise.
   */
  test("the eighteen areas agree exactly this often", () => {
    const tally = { tide: 0, waves: 0, swell: 0, sky: 0, air: 0 };
    const absent = { ...tally };

    for (const { area } of beachesByArea()) {
      const sources = areaSources(area);
      for (const product of Object.keys(tally) as (keyof typeof tally)[]) {
        if (sources[product].kind === "shared") tally[product] += 1;
        if (sources[product].kind === "absent") absent[product] += 1;
      }
    }

    expect(tally).toEqual({ tide: 16, waves: 3, swell: 6, sky: 11, air: 18 });
    expect(absent).toEqual({ tide: 0, waves: 13, swell: 7, sky: 0, air: 0 });
  });

  /**
   * The claim that makes "shared" usable: where an area shares a product, any
   * of its beaches resolves to the same source, so the page may read the
   * product through any member without choosing a representative. Asserted
   * over every area and every product rather than argued.
   */
  test("a shared source is the one every beach in the area binds", () => {
    const bySlug = new Map(allBeaches().map((beach) => [beach.slug, beach]));
    const field = {
      tide: "tide_station",
      waves: "wave_buoy",
      swell: "mop_line",
      sky: "grid_cell",
      air: "air_station",
    } as const;

    for (const { area, beaches } of beachesByArea()) {
      const sources = areaSources(area);
      for (const product of Object.keys(field) as (keyof typeof field)[]) {
        const resolved = sources[product];
        if (resolved.kind !== "shared") continue;
        for (const beach of beaches) {
          expect(bySlug.get(beach.slug)![field[product]], beach.slug).toBe(
            resolved.source,
          );
        }
      }
    }
  });
});

/**
 * `mixed` counts sources, and a beach binding nothing is not one of them.
 *
 * `areaSources` builds its set out of the raw bindings, `null` included, so a
 * product nine beaches share and a tenth lacks reads as two sources. It is not:
 * it is one source and one gap, and the page prints the number. La Jolla is the
 * default area, and `/conditions/la-jolla` says "The 10 beaches in La Jolla read
 * 2 different sources for a wave reading" over nine beaches reading buoy 46254
 * and `childrens-pool` reading none.
 *
 * The state is right either way -- nine agreeing and one lacking still means no
 * one figure answers for the area -- so nothing failed. Only the count is wrong.
 *
 * Derived over the whole table rather than asserted against three copied
 * numbers, because the three are a property of `beaches.json` today and the
 * invariant is a property of the resolver. `MeasuredToday.test.tsx` has the
 * other kind: a hand-written `distinct: 2` for La Jolla, which is why the card
 * that prints the wrong figure has a passing test over it.
 */
describe("a mixed product's count", () => {
  const FIELD = {
    tide: "tide_station",
    waves: "wave_buoy",
    swell: "mop_line",
    sky: "grid_cell",
    air: "air_station",
  } as const;

  test("never counts a missing binding among the sources", () => {
    const bySlug = new Map(allBeaches().map((beach) => [beach.slug, beach]));
    let withAGap = 0;

    for (const { area, beaches } of beachesByArea()) {
      const sources = areaSources(area);
      for (const product of Object.keys(FIELD) as (keyof typeof FIELD)[]) {
        const resolved = sources[product];
        if (resolved.kind !== "mixed") continue;

        const bound = beaches.map(
          (beach) => bySlug.get(beach.slug)![FIELD[product]],
        );
        const real = bound.filter((id) => id !== null);
        if (real.length < bound.length) withAGap += 1;

        expect(resolved.distinct, `${area.slug} ${product}`).toBe(
          new Set(real).size,
        );
      }
    }

    // The probe. Without it this loop passes on a table where no mixed product
    // has a gap in it, which is a table this assertion says nothing about.
    expect(withAGap).toBeGreaterThan(0);
  });
});

/**
 * The one product an area reports without its beaches agreeing about a source,
 * because it has no source to agree about: the National Weather Service issues
 * one bulletin for "San Diego County Coastal Areas". ADR-0050.
 */
describe("the beach an area reads the surf zone bulletin through", () => {
  const bySlug = () =>
    new Map(allBeaches().map((beach) => [beach.slug, beach]));

  /**
   * The claim the page's own wording rests on, asserted rather than argued.
   *
   * On an area page the withheld sentence says the forecast is not issued for
   * *any* beach in the area, having read it through one. That is only true
   * because the fallback is reached exactly when no member is open coast — so
   * where this returns a withheld member, every member is withheld.
   */
  test("falls back only where the forecast reaches no member at all", () => {
    const beaches = bySlug();
    let withheldAreas = 0;

    for (const { area } of beachesByArea()) {
      const chosen = beaches.get(surfZoneBeachOf(area))!;
      if (surfZoneWithheldReason(chosen) === null) continue;

      withheldAreas += 1;
      for (const slug of area.beaches) {
        expect(surfZoneWithheldReason(beaches.get(slug)!), slug).not.toBeNull();
      }
    }

    // The probe, and a count rather than a floor: seven of the eighteen areas
    // are wholly sheltered today. A table where none was would make the loop
    // above assert nothing, and a table where that number moved is a real
    // change to which area pages carry a rip current level.
    expect(withheldAreas).toBe(7);
  });

  /** And where it does reach one, that member is one it is issued for. */
  test("prefers a member the forecast is issued for", () => {
    const beaches = bySlug();

    for (const { area } of beachesByArea()) {
      const issued = area.beaches.some(
        (slug) => surfZoneWithheldReason(beaches.get(slug)!) === null,
      );
      if (!issued) continue;

      expect(
        surfZoneWithheldReason(beaches.get(surfZoneBeachOf(area))!),
        area.slug,
      ).toBeNull();
    }
  });

  /**
   * The area the exception is actually worth something to today, named so that
   * a membership change which quietly removes the case is visible.
   *
   * Tijuana Estuary holds the slough, which is sheltered water, and Border
   * Field State Park, which is not. Read through its first member the area
   * would withhold a bulletin that is issued for half of it.
   */
  test("Tijuana Estuary reads it through the member that is open coast", () => {
    const area = areaBySlug("tijuana-estuary")!;

    expect(area.beaches[0]).toBe("tijuana-slough-national-wildlife-refuge");
    expect(surfZoneBeachOf(area)).toBe("border-field-state-park");
  });
});
