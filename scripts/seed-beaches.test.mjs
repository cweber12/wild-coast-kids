import { describe, expect, it } from "vitest";
import {
  build,
  document,
  regionOf,
  segmentFault,
  SERVICE_TOLERANCE_M,
  serviceFault,
  servesBeach,
  slugify,
} from "./seed-beaches.mjs";

const BUOYS = {
  46254: {
    lat: 32.868,
    lon: -117.267,
    delivers: true,
    publishes_waves: true,
  },
  46235: {
    lat: 32.57,
    lon: -117.169,
    delivers: false,
    publishes_waves: false,
  },
};

const STATIONS = {
  9410230: {
    lat: 32.8669,
    lon: -117.2571,
    water: "open-coast",
    delivers: true,
  },
  9410170: { lat: 32.7156, lon: -117.1767, water: "bay", delivers: true },
};

/**
 * One table, two joins. `publishes_sky` decides the sky binding and is scarce;
 * `publishes_air_temp`, `publishes_wind` and `shore` decide the air binding and
 * are not. Every station here carries all four, because the seed passes the same
 * table to both joins.
 */
const WEATHER = {
  KNKX: {
    lat: 32.86833,
    lon: -117.1425,
    delivers: true,
    publishes_sky: true,
    publishes_air_temp: true,
    publishes_wind: true,
    shore: false,
  },
  KSAN: {
    lat: 32.73361,
    lon: -117.18306,
    delivers: true,
    publishes_sky: true,
    publishes_air_temp: true,
    publishes_wind: true,
    shore: true,
  },
  // Answers, publishes no sky. Nearer most of these beaches than either of the
  // above, and refused by the sky join for exactly that reason -- while the air
  // join takes it, which is the whole point of two joins over one table.
  D3101: {
    lat: 32.92083,
    lon: -117.25283,
    delivers: true,
    publishes_sky: false,
    publishes_air_temp: true,
    publishes_wind: true,
    shore: false,
  },
  // On the water and publishes both, so an open-coast beach may bind it.
  LJAC1: {
    lat: 32.867,
    lon: -117.257,
    delivers: true,
    publishes_sky: false,
    publishes_air_temp: true,
    publishes_wind: true,
    shore: true,
  },
};

const at = (lat, lon, dLat = 0.01) => ({
  upper: { lat: lat + dLat, lon },
  lower: { lat, lon },
});

function row(overrides = {}) {
  return {
    Beach_Name: "Somewhere Beach",
    BeachType: "UNKNOWN",
    WaterBodyType: "Open Coast",
    WaterBodyName: "Pacific Ocean",
    BeachAccess: "PUBLIC",
    Status: "Active",
    CountAsBeach: "1",
    NearestCityName: "San Diego",
    USEPAID: "CA000001",
    Agency_Name: "County of San Diego Department of Environmental Health",
    Beach_UpperLat: "32.88",
    "Beach_ UpperLon": "-117.25",
    Beach_LowerLat: "32.87",
    Beach_LowerLon: "-117.26",
    ...overrides,
  };
}

/** Inside the county, and further from every station in the tables above than
 * the service predicate will publish a reading from. */
const FAR_ROW = row({
  Beach_Name: "Far From Any Station",
  Beach_UpperLat: "33.21",
  "Beach_ UpperLon": "-117.40",
  Beach_LowerLat: "33.20",
  Beach_LowerLon: "-117.40",
});

describe("segmentFault", () => {
  it("passes a real beach", () => {
    expect(segmentFault(at(32.87, -117.25))).toBeNull();
  });

  it("refuses an endpoint outside the county", () => {
    // The values upstream published for "Imperial Beach pier area" on
    // 2026-08-18: latitude and longitude fragments transposed against its
    // neighbours, putting one end deep into Baja California.
    const fault = segmentFault({
      upper: { lat: 32.5804, lon: -117.5866 },
      lower: { lat: 32.1327, lon: -117.1332 },
    });
    expect(fault).toMatch(/outside San Diego County/);
  });

  it("refuses endpoints too far apart to be one beach", () => {
    const fault = segmentFault({
      upper: { lat: 33.4, lon: -117.6 },
      lower: { lat: 32.55, lon: -117.13 },
    });
    expect(fault).toMatch(/is not a beach/);
  });

  it("needs both checks: an endpoint can be in bounds and still wrong", () => {
    // 40 km out to sea at a plausible latitude passes the bounding box, and only
    // the span catches it.
    const offshore = {
      upper: { lat: 32.58, lon: -117.5866 },
      lower: { lat: 32.5783, lon: -117.135 },
    };
    expect(segmentFault(offshore)).toMatch(/is not a beach/);
  });
});

describe("slugify", () => {
  it("makes a stable key from a published name", () => {
    expect(slugify("La Jolla Shores Beach")).toBe("la-jolla-shores-beach");
    expect(slugify("Coronado Cays (NR)")).toBe("coronado-cays-nr");
    expect(slugify("north Imperial Beach")).toBe("north-imperial-beach");
  });

  it("refuses a name that slugifies to nothing", () => {
    expect(() => slugify("!!!")).toThrow(/slugified to nothing/);
  });
});

describe("regionOf", () => {
  it("groups bays together wherever they are", () => {
    expect(regionOf("bay", 33.2)).toBe("Bays, lagoons and inlets");
    expect(regionOf("bay", 32.6)).toBe("Bays, lagoons and inlets");
  });

  it("bands the open coast by latitude", () => {
    expect(regionOf("open-coast", 33.2)).toBe("North County coast");
    expect(regionOf("open-coast", 32.85)).toBe("La Jolla and Pacific Beach");
    expect(regionOf("open-coast", 32.7)).toBe("Point Loma and Ocean Beach");
    expect(regionOf("open-coast", 32.58)).toBe("South County coast");
  });
});

describe("build", () => {
  it("binds a beach and records how the join measured it", () => {
    const [beach] = build([row()], STATIONS, BUOYS, WEATHER);

    expect(beach.slug).toBe("somewhere-beach");
    expect(beach.tide_station).toBe("9410230");
    expect(beach.tide_station_distance_m).toBeGreaterThan(0);
    expect(["upper", "lower"]).toContain(beach.tide_station_from_end);

    // The wave binding rides along on the same walk, and an open-coast beach
    // gets one.
    expect(beach.wave_buoy).toBe("46254");
    expect(beach.wave_buoy_distance_m).toBeGreaterThan(0);

    // So does the observation station, and it is the nearest one that
    // publishes sky rather than the nearest one full stop: D3101 is closer to
    // this row than KNKX and publishes none.
    expect(beach.weather_station).toBe("KNKX");
    expect(beach.weather_station_distance_m).toBeGreaterThan(0);
    expect(["upper", "lower"]).toContain(beach.weather_station_from_end);
  });

  it("binds the air separately from the sky, and nearer", () => {
    // The two provenances, produced by two joins over one table. The sky
    // station is the nearest airport; the air station is the nearest station
    // standing in the marine layer, and it is a different station and a much
    // shorter distance. See docs/adr/0010-two-provenances-in-the-air-panel.md.
    const [beach] = build([row()], STATIONS, BUOYS, WEATHER);

    expect(beach.air_station).toBe("LJAC1");
    expect(beach.weather_station).toBe("KNKX");
    expect(beach.air_station_distance_m).toBeLessThan(
      beach.weather_station_distance_m,
    );
    expect(["upper", "lower"]).toContain(beach.air_station_from_end);
  });

  it("keeps an open-coast beach off a station above the marine layer", () => {
    // D3101 is nearer this row than LJAC1 and publishes temperature and wind,
    // so distance alone would take it. It is not a shore station.
    const [beach] = build([row()], STATIONS, BUOYS, WEATHER);

    expect(beach.air_station).not.toBe("D3101");
  });

  it("gives a bay beach a tide station and no wave buoy", () => {
    const [beach] = build(
      [row({ WaterBodyType: "Sound, Bay, or Inlet" })],
      STATIONS,
      BUOYS,
      WEATHER,
    );

    // Swell does not reach into a bay, and the tide certainly does.
    expect(beach.tide_station).toBe("9410170");
    expect(beach.wave_buoy).toBeNull();
    expect(beach.wave_buoy_null_reason).toMatch(/does not reach into a bay/);

    // Air does reach into a bay, so this join is not asymmetric the way the
    // wave join is. Making the two symmetric would silently strip wind and
    // visibility from twenty-six beaches.
    expect(beach.weather_station).not.toBeNull();

    expect(beach.air_station).not.toBeNull();
  });

  it("lets a bay beach bind a station above the marine layer", () => {
    // The air join has a water-class rule where the sky join has none, and a
    // bay beach is the permissive side of it: nearest of any kind, because a
    // marine layer is not what a station overlooking a bay gets wrong. These
    // coordinates put D3101, which is not a shore station, nearest by far.
    const [beach] = build(
      [
        row({
          WaterBodyType: "Sound, Bay, or Inlet",
          Beach_UpperLat: "32.925",
          "Beach_ UpperLon": "-117.253",
          Beach_LowerLat: "32.918",
          Beach_LowerLon: "-117.253",
        }),
      ],
      STATIONS,
      BUOYS,
      WEATHER,
    );

    expect(beach.air_station).toBe("D3101");
  });

  it("refuses that same station for an open-coast beach in the same place", () => {
    // The two halves of the rule, on one set of coordinates, so the difference
    // is the water class and nothing else.
    const [beach] = build(
      [
        row({
          WaterBodyType: "Open Coast",
          Beach_UpperLat: "32.925",
          "Beach_ UpperLon": "-117.253",
          Beach_LowerLat: "32.918",
          Beach_LowerLon: "-117.253",
        }),
      ],
      STATIONS,
      BUOYS,
      WEATHER,
    );

    expect(beach.air_station).toBe("LJAC1");
  });

  it("refuses a beach whose coordinates cannot be used, and says why", () => {
    const [beach] = build(
      [
        row({
          Beach_Name: "Imperial Beach pier area",
          Beach_UpperLat: "32.5804",
          "Beach_ UpperLon": "-117.5866",
          Beach_LowerLat: "32.1327",
          Beach_LowerLon: "-117.1332",
        }),
      ],
      STATIONS,
      BUOYS,
      WEATHER,
    );

    expect(beach.tide_station).toBeNull();
    expect(beach.tide_station_null_reason).toMatch(/outside San Diego County/);
    // The fault stops every join, not just the tide one. A coordinate nobody
    // can trust must not produce a confident airport reading either.
    expect(beach.weather_station).toBeNull();
    expect(beach.weather_station_null_reason).toMatch(
      /outside San Diego County/,
    );
    expect(beach.air_station).toBeNull();
    expect(beach.air_station_null_reason).toMatch(/outside San Diego County/);
  });

  it("stops on a duplicate slug rather than disambiguating one", () => {
    // A slug is a primary key. Making one unique automatically would make it
    // unstable, and data accumulates against it.
    expect(() => build([row(), row()], STATIONS, BUOYS, WEATHER)).toThrow(
      /is claimed by both/,
    );
  });

  it("stops when a pinned column is missing", () => {
    const missing = row();
    delete missing["Beach_ UpperLon"];
    expect(() => build([missing], STATIONS, BUOYS, WEATHER)).toThrow(
      /has drifted/,
    );
  });

  it("stops when a coordinate does not parse", () => {
    expect(() =>
      build([row({ Beach_UpperLat: "north a bit" })], STATIONS, BUOYS, WEATHER),
    ).toThrow(/did not parse as numbers/);
  });

  it("orders the inventory north to south", () => {
    const built = build(
      [
        row({
          Beach_Name: "South one",
          Beach_UpperLat: "32.61",
          Beach_LowerLat: "32.6",
        }),
        row({
          Beach_Name: "North one",
          Beach_UpperLat: "33.21",
          Beach_LowerLat: "33.2",
        }),
      ],
      STATIONS,
      BUOYS,
      WEATHER,
    );
    expect(built.map((b) => b.slug)).toEqual(["north-one", "south-one"]);
  });
});

/**
 * A built beach reduced to what the service predicate reads. Written out rather
 * than produced by `build` so the boundary cases are stated in metres instead
 * of hidden inside a pair of coordinates.
 */
function bound(overrides = {}) {
  return {
    slug: "somewhere-beach",
    name: "Somewhere Beach",
    tide_station: "9410230",
    tide_station_distance_m: 1_000,
    wave_buoy: "46254",
    wave_buoy_distance_m: 1_000,
    ...overrides,
  };
}

describe("servesBeach", () => {
  it("is a ten-kilometre rule by default, and says so in one place", () => {
    // The figure is a judgement rather than a citation, so changing it has to
    // be a one-line edit to a named constant and not a hunt through the file.
    expect(SERVICE_TOLERANCE_M).toBe(10_000);
    expect(servesBeach(bound({ tide_station_distance_m: 10_001 }))).toBe(false);
  });

  it("keeps a beach whose bindings sit exactly on the tolerance", () => {
    expect(
      servesBeach(
        bound({
          tide_station_distance_m: 10_000,
          wave_buoy_distance_m: 10_000,
        }),
      ),
    ).toBe(true);
  });

  it("cuts a beach one metre past it", () => {
    expect(servesBeach(bound({ tide_station_distance_m: 10_001 }))).toBe(false);
  });

  it("reads the tolerance it is given, not the constant", () => {
    const beach = bound({ tide_station_distance_m: 5_000 });
    expect(servesBeach(beach, 4_000)).toBe(false);
    expect(servesBeach(beach, 6_000)).toBe(true);
  });

  it("cuts a beach whose buoy is too far even when its tide station is near", () => {
    // Ocean Beach: Scripps at 12.3 km and Scripps Nearshore at 12.5 km. Either
    // clause alone is enough to refuse it.
    expect(
      servesBeach(
        bound({ tide_station_distance_m: 4_000, wave_buoy_distance_m: 12_476 }),
      ),
    ).toBe(false);
  });

  it("keeps a beach that binds no buoy at all, whatever declined it", () => {
    // The clause is "if a buoy is bound, it is within range", not "a buoy is
    // within range". A bay binds none because swell does not reach it, and
    // Children's Pool binds none because a breakwater stops the swell. Both are
    // the join answering correctly, and neither is a reason to drop a beach.
    expect(
      servesBeach(bound({ wave_buoy: null, wave_buoy_distance_m: null })),
    ).toBe(true);
  });

  it("cuts a beach the join could not bind a tide station to", () => {
    expect(
      servesBeach(
        bound({
          tide_station: null,
          tide_station_distance_m: null,
          wave_buoy: null,
          wave_buoy_distance_m: null,
          tide_station_null_reason: "the upper endpoint is outside the county",
        }),
      ),
    ).toBe(false);
  });
});

describe("serviceFault", () => {
  it("is silent about a beach the stations reach", () => {
    expect(serviceFault(bound())).toBeNull();
  });

  it("names the distance that disqualified the beach", () => {
    const why = serviceFault(bound({ tide_station_distance_m: 56_557 }));
    expect(why).toContain("9410230");
    expect(why).toContain("56.6 km");
    expect(why).toContain("10.0 km");
  });

  it("names every binding that is too far, not merely the first", () => {
    // Sunset Cliffs is past the tolerance on both, and a reason that mentioned
    // only the tide would read as though moving one station would rescue it.
    const why = serviceFault(
      bound({ tide_station_distance_m: 14_646, wave_buoy_distance_m: 14_805 }),
    );
    expect(why).toContain("14.6 km");
    expect(why).toContain("14.8 km");
  });

  it("repeats the join's own reason when nothing was bound", () => {
    const why = serviceFault(
      bound({
        tide_station: null,
        tide_station_distance_m: null,
        wave_buoy: null,
        wave_buoy_distance_m: null,
        tide_station_null_reason:
          "the lower endpoint published upstream is outside San Diego County",
      }),
    );
    expect(why).toContain("outside San Diego County");
  });
});

describe("document", () => {
  it("lists only the beaches whose stations reach them", () => {
    const doc = document(build([row(), FAR_ROW], STATIONS, BUOYS, WEATHER));

    expect(doc.beaches.map((b) => b.slug)).toEqual(["somewhere-beach"]);
  });

  it("records every beach it does not list, with the distance that cut it", () => {
    const doc = document(build([row(), FAR_ROW], STATIONS, BUOYS, WEATHER));

    expect(doc._excluded).toEqual([
      {
        slug: "far-from-any-station",
        name: "Far From Any Station",
        why: expect.stringContaining("km away"),
      },
    ]);
  });

  it("accounts for every beach the county lists, in one block or the other", () => {
    // The failure mode this exists to stop: a beach leaving the inventory with
    // nothing anywhere saying it did.
    const built = build([row(), FAR_ROW], STATIONS, BUOYS, WEATHER);
    const doc = document(built);

    const listed = [
      ...doc.beaches.map((b) => b.slug),
      ...doc._excluded.map((b) => b.slug),
    ];
    expect(listed.sort()).toEqual(built.map((b) => b.slug).sort());
  });

  it("records a beach nothing could be bound to, and repeats the join's reason", () => {
    const doc = document(
      build(
        [
          row(),
          row({
            Beach_Name: "Broken coordinates",
            Beach_LowerLat: "32.1327",
          }),
        ],
        STATIONS,
        BUOYS,
        WEATHER,
      ),
    );

    const broken = doc._excluded.find((b) => b.name === "Broken coordinates");
    expect(broken).toBeDefined();
    expect(broken.why).toMatch(/outside San Diego County/);
  });

  it("refuses to write an inventory with nothing in it", () => {
    // Every beach failing the predicate is a broken join or a moved station
    // table, not a county with no reachable coastline. Writing the empty file
    // would replace the whole inventory with a silence.
    expect(() => document(build([FAR_ROW], STATIONS, BUOYS, WEATHER))).toThrow(
      /excluded all 1/,
    );
  });

  it("tells a reader that a beach out of range is not listed at all", () => {
    const doc = document(build([row()], STATIONS, BUOYS, WEATHER));
    const bound = doc.unresolved.find((entry) =>
      entry.includes("nearest station of matching water class"),
    );

    // The old wording said the distances were large where NOAA publishes no
    // nearby station. They are not large any more -- the beaches that had them
    // are gone -- and a caveat that describes the previous inventory is worse
    // than none.
    expect(bound).toContain("10.0 km");
    expect(bound).not.toMatch(/distances are large/);
  });

  it("tells a reader the weather figures are read at an airport", () => {
    const built = document(build([row()], STATIONS, BUOYS, WEATHER));
    const airport = built.unresolved.find((entry) =>
      entry.includes("read at an airport"),
    );

    // The four values in that panel come from a station some kilometres
    // inland, and coastal fog is precisely what changes over that distance.
    // A reader who is not told that will read it as a beach measurement.
    expect(airport).toBeDefined();
    expect(airport).toMatch(/km away/);
  });

  it("names the farthest beach from its station, not merely the first", () => {
    // Two beaches, so the reduce and the sort actually run. With one, the
    // callbacks never fire and "farthest" is whatever happened to be there --
    // which is how a single-row fixture can leave a real rule unasserted.
    // Both are inside the service tolerance of the tide station and the buoy,
    // and differ only in how far the airport is: a fixture the predicate cuts
    // never reaches the reduce this test is about.
    const near = row({
      Beach_Name: "Near The Airport",
      Beach_UpperLat: "32.88",
      "Beach_ UpperLon": "-117.20",
      Beach_LowerLat: "32.87",
      Beach_LowerLon: "-117.20",
    });
    const far = row({
      Beach_Name: "Far From The Airport",
      Beach_UpperLat: "32.88",
      "Beach_ UpperLon": "-117.34",
      Beach_LowerLat: "32.87",
      Beach_LowerLon: "-117.34",
    });

    const built = document(build([near, far], STATIONS, BUOYS, WEATHER));
    const airport = built.unresolved.find((entry) =>
      entry.includes("read at an airport"),
    );

    expect(airport).toContain("Far From The Airport");
    expect(airport).not.toContain("at Near The Airport");
  });

  it("writes its caveats out in full, so two runs agree", () => {
    // Carrying entries forward from the file duplicated them on the second run,
    // and made --check report movement immediately after a seed. A check that
    // cannot say "unchanged" says nothing.
    const built = build([row()], STATIONS, BUOYS, WEATHER);
    const first = document(built).unresolved;
    const second = document(built).unresolved;

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});
