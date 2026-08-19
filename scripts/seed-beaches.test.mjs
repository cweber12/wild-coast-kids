import { describe, expect, it } from "vitest";
import {
  build,
  document,
  regionOf,
  segmentFault,
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

describe("document", () => {
  it("names an unbound beach in the caveats a reader is owed", () => {
    const built = build(
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
    );
    const doc = document(built);

    expect(doc.unresolved.some((c) => c.includes("Broken coordinates"))).toBe(
      true,
    );
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
    const near = row({
      Beach_Name: "Near The Airport",
      Beach_UpperLat: "32.87",
      "Beach_ UpperLon": "-117.15",
      Beach_LowerLat: "32.86",
      Beach_LowerLon: "-117.16",
    });
    const far = row({
      Beach_Name: "Far From The Airport",
      Beach_UpperLat: "33.05",
      "Beach_ UpperLon": "-117.30",
      Beach_LowerLat: "33.04",
      Beach_LowerLon: "-117.31",
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
