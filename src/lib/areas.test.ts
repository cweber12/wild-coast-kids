import { describe, expect, test, vi } from "vitest";
import {
  areaBySlug,
  areaSources,
  areaOfBeach,
  DEFAULT_AREA_SLUG,
  beachesByArea,
  defaultArea,
} from "./areas";
import { allBeaches } from "./beaches";

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
   */
  test("disagreeing is not the same as lacking", () => {
    expect(of("la-jolla").sky).toEqual({ kind: "mixed", distinct: 4 });
    expect(of("mission-bay-west").swell).toEqual({ kind: "absent" });
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
