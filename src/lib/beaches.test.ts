import { describe, expect, test } from "vitest";
import {
  allBeaches,
  beachBySlug,
  beachesByRegion,
  DEFAULT_BEACH_SLUG,
  defaultBeach,
  inventoryCaveats,
  tideStationFor,
  waveBuoyFor,
} from "./beaches";

describe("the inventory", () => {
  test("holds every public, active San Diego beach the state publishes", () => {
    expect(allBeaches()).toHaveLength(73);
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
    for (const beach of allBeaches()) {
      const station = tideStationFor(beach);
      if (station === null) continue;
      const expected =
        beach.upstream.water_body_type === "Open Coast" ? "open-coast" : "bay";
      expect(station.water).toBe(expected);
    }
  });

  test("never binds to a station that does not deliver", () => {
    for (const beach of allBeaches()) {
      expect(tideStationFor(beach)?.delivers ?? true).toBe(true);
    }
  });

  test("a beach the join could not bind is null with a stated reason", () => {
    const unbound = allBeaches().filter((beach) => beach.tide_station === null);

    // Upstream publishes one row whose coordinates are transposed; it is refused
    // rather than corrected here, because correcting it would be inventing a
    // location. If this count changes, upstream changed.
    expect(unbound).toHaveLength(1);
    for (const beach of unbound) {
      expect(beach.tide_station_null_reason).toBeTruthy();
      expect(tideStationFor(beach)).toBeNull();
      expect(beach.tide_station_distance_m).toBeNull();
    }
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
    for (const beach of bays.beaches) {
      expect(beach.upstream.water_body_type).toBe("Sound, Bay, or Inlet");
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
