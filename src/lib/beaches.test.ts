import { describe, expect, test } from "vitest";
import {
  allBeaches,
  beachBySlug,
  beachesByRegion,
  DEFAULT_BEACH_SLUG,
  defaultBeach,
  inventoryCaveats,
  inventoryReach,
  mopLineFor,
  tideStationFor,
  waveBuoyFor,
} from "./beaches";

describe("the inventory", () => {
  test("holds only the beaches the station networks reach", () => {
    // The county lists 73. The other 28 are in beaches.json's `_excluded`
    // block, each with the binding distance that removed it; see
    // docs/adr/0011-inventory-bounded-by-station-networks.md.
    expect(allBeaches()).toHaveLength(45);
  });

  test("holds the four beaches no buoy reaches, which a model answers for", () => {
    // 41 before ADR-0019. These four left when 46235 died in May 2026 and the
    // wave join reached 28 km past it; each binds a MOP line under 650 m, and
    // is served on that with no measured wave height at all. Named rather than
    // counted, because the count alone would go green if four different
    // beaches arrived.
    for (const slug of [
      "silver-strand-state-beach",
      "north-imperial-beach",
      "imperial-beach-municipal-beach-other",
      "border-field-state-park",
    ]) {
      const beach = beachBySlug(slug);
      expect(beach).not.toBeNull();
      expect(beach!.wave_buoy).toBeNull();
      expect(beach!.mop_line).not.toBeNull();
    }
  });

  test("does not hold the river reach published six kilometres inland", () => {
    // Tijana River fails on the same rule rather than by name: its nearest line
    // is 6,395 m, against 117-930 m for every beach actually on this coast. The
    // spelling is upstream's own and is not a typo to fix here.
    expect(beachBySlug("tijana-river")).toBeNull();
    expect(
      inventoryReach().excluded.find((b) => b.slug === "tijana-river")?.why,
    ).toContain("wave buoy 46232");
  });

  test("a beach the county lists but no station reaches is not in it", () => {
    // San Onofre reads Scripps 56.6 km away, which is most of the way to Los
    // Angeles. It is absent rather than answered for.
    expect(beachBySlug("san-onofre-state-beach")).toBeNull();
  });

  test("every binding it does have is inside the ten-kilometre tolerance", () => {
    // The predicate, asserted against the file that ships rather than against
    // the fixtures the seeding script was tested with. A buoy the join
    // deliberately withheld is not a binding, and disqualifies nobody.
    for (const beach of allBeaches()) {
      expect(beach.tide_station).not.toBeNull();
      expect(beach.tide_station_distance_m).toBeLessThanOrEqual(10_000);
      if (beach.wave_buoy !== null) {
        expect(beach.wave_buoy_distance_m).toBeLessThanOrEqual(10_000);
      }
    }
  });

  test("is ordered north to south", () => {
    const meanLat = (b: (typeof beaches)[number]) =>
      (b.segment.upper.lat + b.segment.lower.lat) / 2;
    const beaches = allBeaches();
    for (let i = 1; i < beaches.length; i += 1) {
      expect(meanLat(beaches[i - 1])).toBeGreaterThanOrEqual(
        meanLat(beaches[i]),
      );
    }
  });

  test("every slug is unique, since it is the primary key", () => {
    const slugs = allBeaches().map((beach) => beach.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("an unknown slug is null rather than a throw", () => {
    expect(beachBySlug("no-such-beach")).toBeNull();
  });
});

describe("the inventory's reach", () => {
  test("counts what the county lists as what it serves plus what it does not", () => {
    // Derived rather than written down, so the two halves cannot disagree and
    // the figure cannot go stale the next time upstream adds a row.
    const reach = inventoryReach();

    expect(reach.served).toBe(allBeaches().length);
    expect(reach.listed).toBe(reach.served + reach.excluded.length);
    expect(reach.listed).toBe(73);
  });

  test("names each beach it does not serve, and why", () => {
    const onofre = inventoryReach().excluded.find(
      (beach) => beach.slug === "san-onofre-state-beach",
    );

    expect(onofre?.name).toBe("San Onofre State Beach");
    expect(onofre?.why).toContain("56.6 km");
  });

  test("serves none of the beaches it says it does not", () => {
    // The contradiction a reader would catch first: a beach listed as absent
    // that the chooser still offers.
    for (const beach of inventoryReach().excluded) {
      expect(beachBySlug(beach.slug)).toBeNull();
    }
  });
});

describe("a beach", () => {
  test("is a segment, so both endpoints are present", () => {
    for (const beach of allBeaches()) {
      for (const end of [beach.segment.upper, beach.segment.lower]) {
        expect(Number.isFinite(end.lat)).toBe(true);
        expect(Number.isFinite(end.lon)).toBe(true);
        expect(end.lon).toBeLessThan(0);
      }
    }
  });

  test("reproduces upstream's values, including the unknown one", () => {
    const beach = beachBySlug(DEFAULT_BEACH_SLUG)!;
    expect(beach.upstream.usepa_id).toBe("CA876094");
    expect(beach.upstream.water_body_type).toBe("Open Coast");
    expect(beach.upstream.beach_access).toBe("PUBLIC");
    // Upstream publishes UNKNOWN. Kept as published, so a gap in the resource
    // can never be rendered as a claim about the shore.
    expect(beach.upstream.beach_type).toBe("UNKNOWN");
  });
});

describe("the tide station binding", () => {
  test("resolves with its water class and the distance the join measured", () => {
    const beach = beachBySlug(DEFAULT_BEACH_SLUG)!;
    const station = tideStationFor(beach)!;

    expect(station.id).toBe("9410230");
    expect(station.water).toBe("open-coast");
    expect(station.delivers).toBe(true);
    expect(beach.tide_station_distance_m).toBeLessThan(2000);
    expect(["upper", "lower"]).toContain(beach.tide_station_from_end);
  });

  test("never binds an open-coast beach to a bay station, or the reverse", () => {
    // Two beaches are typed as the wrong kind of water upstream and carry a
    // written override in scripts/tide-join.mjs: Fiesta Island is typed open
    // coast inside Mission Bay, Children's Pool is typed a bay on the open
    // ocean. Everywhere else the published type decides. The exceptions are
    // listed here rather than skipped by a rule, so that a third override
    // cannot appear without this test naming it.
    const OVERRIDDEN = new Set(["childrens-pool", "fiesta-island"]);

    for (const beach of allBeaches()) {
      const station = tideStationFor(beach);
      if (station === null || OVERRIDDEN.has(beach.slug)) continue;
      const expected =
        beach.upstream.water_body_type === "Open Coast" ? "open-coast" : "bay";
      expect(station.water).toBe(expected);
    }
  });

  test("applies the water class to the region label and the join alike", () => {
    // The class is resolved in one place and read by three joins and the region
    // label. A beach bound to a bay station but filed under a coastal region
    // would mean an override reached one reader and not the others -- which is
    // the failure mode a slug-keyed override invites.
    for (const beach of allBeaches()) {
      const station = tideStationFor(beach);
      if (station === null) continue;
      expect(station.water === "bay").toBe(beach.region.startsWith("Bays"));
    }
  });

  test("never binds to a station that does not deliver", () => {
    for (const beach of allBeaches()) {
      expect(tideStationFor(beach)?.delivers ?? true).toBe(true);
    }
  });

  test("no beach in the inventory is missing one", () => {
    // Upstream publishes one row whose coordinates are transposed, so the join
    // binds it nothing. It used to ship as a page carrying a stated reason; the
    // service predicate keeps it out of the inventory entirely now, and
    // beaches.json's `_excluded` block carries the reason instead.
    expect(allBeaches().filter((beach) => beach.tide_station === null)).toEqual(
      [],
    );
    expect(beachBySlug("imperial-beach-pier-area")).toBeNull();
  });

  test("resolves to null for a beach with none, which the type still allows", () => {
    // No beach in the inventory has one. The field is still written by a join
    // that can fail, so the reader of the data file validates rather than
    // trusts, and conditions.ts still has a state to render if one ever does.
    const beach = { ...defaultBeach(), tide_station: null };
    expect(tideStationFor(beach)).toBeNull();
  });

  test("a beach naming an undescribed station is a broken data file, and says so", () => {
    const beach = {
      ...beachBySlug(DEFAULT_BEACH_SLUG)!,
      tide_station: "9999999",
    };
    expect(() => tideStationFor(beach)).toThrow(
      /no entry in tide-stations.json/,
    );
  });
});

describe("grouping for a chooser", () => {
  test("covers every beach exactly once", () => {
    const grouped = beachesByRegion().flatMap((group) => group.beaches);
    expect(grouped).toHaveLength(allBeaches().length);
    expect(new Set(grouped.map((b) => b.slug)).size).toBe(allBeaches().length);
  });

  test("names no empty region", () => {
    for (const group of beachesByRegion()) {
      expect(group.region).not.toBe("");
      expect(group.beaches.length).toBeGreaterThan(0);
    }
  });

  test("puts bays and inlets in one group regardless of latitude", () => {
    const bays = beachesByRegion().find((g) => g.region.startsWith("Bays"))!;

    expect(bays.beaches.length).toBeGreaterThan(0);
    for (const beach of bays.beaches) {
      // Read from the binding rather than from `upstream.water_body_type`:
      // that field is what the override in scripts/tide-join.mjs corrects, so
      // asserting it here would assert the bug instead of the behaviour.
      expect(tideStationFor(beach)?.water).toBe("bay");
    }
  });
});

describe("the default beach", () => {
  test("is in the inventory and has a station", () => {
    const beach = defaultBeach();
    expect(beach.slug).toBe(DEFAULT_BEACH_SLUG);
    expect(tideStationFor(beach)).not.toBeNull();
  });
});

describe("caveats", () => {
  test("carry both data files' unresolved entries", () => {
    const caveats = inventoryCaveats();
    expect(caveats.length).toBeGreaterThan(2);
    for (const caveat of caveats) {
      expect(typeof caveat).toBe("string");
      expect(caveat.length).toBeGreaterThan(0);
    }
    // The station file's own caveat about the gap on the open coast must reach a
    // reader, not just the inventory's.
    expect(caveats.some((c) => c.includes("TWC0405"))).toBe(true);
  });
});

describe("the MOP line binding", () => {
  test("every beach with a buoy also has a line, but not the reverse", () => {
    // This used to be an equivalence: two joins over two tables, agreeing about
    // which water ocean swell reaches. ADR-0019 broke the second direction on
    // purpose -- four beaches carry a line and no buoy, because the buoy the
    // join bound is further away than this site will publish. The first
    // direction still holds and is the half that catches the two joins
    // disagreeing about the water, which is what the equivalence was for: a
    // buoy without a line would mean one of them let swell into a bay.
    for (const beach of allBeaches()) {
      if (beach.wave_buoy !== null) expect(beach.mop_line).not.toBeNull();
    }
  });

  test("a beach a model answers for alone has a line inside the modelled bound", () => {
    // The predicate ADR-0019 actually states, asserted over the file that
    // ships. NOT "every bound line is within a kilometre" -- that is true today
    // and the rule does not require it, so pinning it would fail a beach whose
    // buoy is fine and whose line happens to sit further out.
    const modelledOnly = allBeaches().filter(
      (beach) => beach.wave_buoy === null && beach.mop_line !== null,
    );
    expect(modelledOnly).toHaveLength(4);

    for (const beach of modelledOnly) {
      expect(beach.mop_line_distance_m).toBeLessThanOrEqual(1_000);
    }
  });

  test("a dropped buoy says both that it was refused and what replaced it", () => {
    // Either half alone misleads. The distance without the replacement reads as
    // a beach with no waves; the replacement without the distance hides that a
    // measurement was refused. This is the reason the card and the caveats both
    // relay, so it is the reason a reader ends up holding.
    const beach = beachBySlug("border-field-state-park")!;

    expect(beach.wave_buoy_null_reason).toContain("46232");
    expect(beach.wave_buoy_null_reason).toContain("28.2 km");
    expect(beach.wave_buoy_null_reason).toContain("D0001");
    expect(beach.wave_buoy_null_reason).toContain(
      "model rather than a measurement",
    );
  });

  test("bound lines deliver, and the beach is open coast", () => {
    const bound = allBeaches().filter((beach) => beach.mop_line !== null);
    expect(bound.length).toBeGreaterThan(0);

    for (const beach of bound) {
      expect(mopLineFor(beach)!.delivers).toBe(true);
      expect(beach.upstream.water_body_type).toBe("Open Coast");
    }
  });

  test("no bay, lagoon or inlet is bound to a line", () => {
    // The refusal that matters more here than it does for the buoy: lines sit
    // about 100 m apart, so the nearest one to enclosed water is close enough
    // to look right and is still on the open coast outside.
    for (const beach of allBeaches()) {
      if (beach.upstream.water_body_type === "Open Coast") continue;
      expect(beach.mop_line).toBeNull();
      expect(beach.mop_line_null_reason).toBeTruthy();
      expect(mopLineFor(beach)).toBeNull();
    }
  });

  test("every bound line is nearer than the buoy the same beach reads", () => {
    // Not a claim that the forecast is a better reading of now -- it is model
    // output and the buoy is a measurement. It is why a forecast this close to
    // the shore is worth relaying at all.
    //
    // Both bindings, not just the line: since ADR-0019 four beaches have a line
    // and no buoy, and comparing against a null distance would compare against
    // zero and pass by accident on a file where the line had moved anywhere.
    const both = allBeaches().filter(
      (beach) => beach.mop_line !== null && beach.wave_buoy !== null,
    );
    expect(both.length).toBeGreaterThan(0);

    for (const beach of both) {
      expect(beach.mop_line_distance_m!).toBeLessThan(
        beach.wave_buoy_distance_m!,
      );
    }
  });

  test("a beach naming an undescribed line is a broken data file, and says so", () => {
    const beach = { ...defaultBeach(), mop_line: "D9999" };
    expect(() => mopLineFor(beach)).toThrow(/no entry in mop-lines.json/);
  });

  test("the model-not-a-measurement caveat reaches the reader", () => {
    // The page will show a modelled height beside a measured one. The
    // distinction is owed to whoever reads both.
    expect(
      inventoryCaveats().some((c) =>
        c.includes("model output, not a measurement"),
      ),
    ).toBe(true);
  });
});

describe("the wave buoy binding", () => {
  test("open-coast beaches get a delivering buoy that publishes waves", () => {
    const bound = allBeaches().filter((beach) => beach.wave_buoy !== null);
    expect(bound.length).toBeGreaterThan(0);

    for (const beach of bound) {
      const buoy = waveBuoyFor(beach)!;
      expect(buoy.delivers).toBe(true);
      expect(buoy.publishes_waves).toBe(true);
      expect(beach.upstream.water_body_type).toBe("Open Coast");
    }
  });

  test("no bay, lagoon or inlet is bound to a buoy", () => {
    // Swell does not reach them, so the nearest buoy would describe different
    // water. The reason travels with the null.
    for (const beach of allBeaches()) {
      if (beach.upstream.water_body_type === "Open Coast") continue;
      expect(beach.wave_buoy).toBeNull();
      expect(beach.wave_buoy_null_reason).toBeTruthy();
      expect(waveBuoyFor(beach)).toBeNull();
    }
  });

  test("a beach naming an undescribed buoy is a broken data file, and says so", () => {
    const beach = { ...defaultBeach(), wave_buoy: "99999" };
    expect(() => waveBuoyFor(beach)).toThrow(/no entry in wave-buoys.json/);
  });

  test("the dead buoys are kept and marked, not deleted", () => {
    // 46235 is the only buoy south of Point Loma and it 404s; deleting it would
    // erase the reason south-county beaches reach so far for a height.
    const caveats = inventoryCaveats();
    expect(caveats.some((c) => c.includes("46235"))).toBe(true);
  });

  test("the excluded offshore buoy is excluded for its distance, not for waves", () => {
    // 46086 was recorded as publishing no waves. It publishes WVHT on 27 of 48
    // rows -- #70. Nothing renders the station, but this sentence reaches a
    // reader through the caveats gate, and it is the whole reason the station
    // is in the table, so a future slice looking for an offshore wave reference
    // would take the false clause at face value.
    //
    // This holds the sentence still. It cannot hold NDBC still: a gate must not
    // fetch realtime2, so nothing here notices if what 46086 publishes changes.
    // The measurement is evidence in the plan file, not in this assertion.
    const caveat = inventoryCaveats().find((c) => c.includes("46086"));

    expect(caveat, "no caveat mentions 46086 at all").toBeTruthy();
    expect(caveat).not.toMatch(/no waves/i);
    expect(caveat).toMatch(/27 of the 48/);
    expect(caveat).toMatch(/distance/i);
  });

  test("no caveat calls the offshore buoy the only station in the box with wind", () => {
    // It is not. activestations.xml lists nineteen stations in wave-buoys.json's
    // own box and the table holds the thirteen of type `buoy`; three of the
    // omitted `fixed` stations publish WSPD on 99-100% of their rows -- LJAC1
    // and LJPC1 at Scripps Pier and TIXC1 at the Tijuana River. See #73 and #80.
    //
    // The clause is not idle wording. It reaches a reader through the caveats
    // gate, and it is the premise conditions-tool.md's slice 6 addendum used to
    // conclude that this site's wind can only come from the weather service --
    // which is why the air panel binds an airport 10.43 km inland at a beach
    // with a pier station 1.38 km away.
    //
    // Same limit as the assertion above: this holds the sentence still, not the
    // ocean. A gate must not fetch realtime2.
    const caveat = inventoryCaveats().find((c) => c.includes("46086"));

    expect(caveat, "no caveat mentions 46086 at all").toBeTruthy();
    expect(caveat).not.toMatch(/only station in the box/i);
  });
});
