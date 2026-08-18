import { describe, expect, it } from "vitest";
import {
  build,
  document,
  regionOf,
  segmentFault,
  slugify,
} from "./seed-beaches.mjs";

const STATIONS = {
  9410230: {
    lat: 32.8669,
    lon: -117.2571,
    water: "open-coast",
    delivers: true,
  },
  9410170: { lat: 32.7156, lon: -117.1767, water: "bay", delivers: true },
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
    const [beach] = build([row()], STATIONS);

    expect(beach.slug).toBe("somewhere-beach");
    expect(beach.tide_station).toBe("9410230");
    expect(beach.tide_station_distance_m).toBeGreaterThan(0);
    expect(["upper", "lower"]).toContain(beach.tide_station_from_end);
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
    );

    expect(beach.tide_station).toBeNull();
    expect(beach.tide_station_null_reason).toMatch(/outside San Diego County/);
  });

  it("stops on a duplicate slug rather than disambiguating one", () => {
    // A slug is a primary key. Making one unique automatically would make it
    // unstable, and data accumulates against it.
    expect(() => build([row(), row()], STATIONS)).toThrow(/is claimed by both/);
  });

  it("stops when a pinned column is missing", () => {
    const missing = row();
    delete missing["Beach_ UpperLon"];
    expect(() => build([missing], STATIONS)).toThrow(/has drifted/);
  });

  it("stops when a coordinate does not parse", () => {
    expect(() =>
      build([row({ Beach_UpperLat: "north a bit" })], STATIONS),
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
    );
    const doc = document(built);

    expect(doc.unresolved.some((c) => c.includes("Broken coordinates"))).toBe(
      true,
    );
  });

  it("writes its caveats out in full, so two runs agree", () => {
    // Carrying entries forward from the file duplicated them on the second run,
    // and made --check report movement immediately after a seed. A check that
    // cannot say "unchanged" says nothing.
    const built = build([row()], STATIONS);
    const first = document(built).unresolved;
    const second = document(built).unresolved;

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});
