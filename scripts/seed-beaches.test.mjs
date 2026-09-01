import { describe, expect, it } from "vitest";
import {
  build,
  document,
  dropReplacedBuoy,
  MODELLED_SOURCE_TOLERANCE_M,
  regionOf,
  segmentFault,
  SERVICE_TOLERANCE_M,
  serviceFault,
  servesBeach,
  slugify,
  unlistedCellFault,
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

/**
 * MOP lines near the default row's segment. D0002 sits exactly on its upper
 * endpoint and publishes no forecast, so the join must reach past a line 0 m
 * away to one 500 m away -- delivery decides this, not distance.
 */
const MOP_LINES = {
  D0001: { lat: 32.875, lon: -117.256, delivers: true },
  D0002: { lat: 32.88, lon: -117.25, delivers: false },
  D0003: { lat: 32.877, lon: -117.254, delivers: true },
  // Thirty kilometres south of the rest, for NO_BUOY_ROW. Far enough from the
  // La Jolla cluster that it changes no other beach's binding.
  D0085: { lat: 32.60799, lon: -117.13976, delivers: true },
};

/**
 * Forecast cells for the slugs these rows produce. Both ends land in one cell
 * for every fixture beach except `somewhere-beach`, which straddles two so the
 * elevation criterion is exercised by the seed rather than only by the join's
 * own test.
 */
const GRID_CELLS = {
  cells: {
    "SGX/54,21": { elevation_m: 0, delivers: true },
    "SGX/55,22": { elevation_m: 117.0432, delivers: true },
    "SGX/57,8": { elevation_m: 0.9144, delivers: true },
  },
  resolutions: {
    "somewhere-beach": {
      upper: { cell: "SGX/55,22" },
      lower: { cell: "SGX/54,21" },
    },
    "far-from-any-station": {
      upper: { cell: "SGX/54,21" },
      lower: { cell: "SGX/54,21" },
    },
    "no-buoy-reaches-here": {
      upper: { cell: "SGX/57,8" },
      lower: { cell: "SGX/57,8" },
    },
    "quiet-bay": {
      upper: { cell: "SGX/54,21" },
      lower: { cell: "SGX/54,21" },
    },
    "imperial-beach-pier-area": {
      upper: { cell: "SGX/57,8" },
      lower: { cell: "SGX/57,8" },
    },
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
  // Open coast, thirty kilometres south, and the reason NO_BUOY_ROW can have a
  // tide station in range while its nearest buoy is not.
  9410120: { lat: 32.5783, lon: -117.135, water: "open-coast", delivers: true },
};

/**
 * One table, two joins. `publishes_sky` decides the sky binding and is scarce;
 * `publishes_air_temp`, `publishes_wind` and `shore` decide the air binding and
 * are not. Every station here carries all four, because the seed passes the same
 * table to both joins.
 */
const OBSERVATION_STATIONS = {
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

/**
 * The shape ADR-0019 admits, laid out the way the real south county is: a tide
 * station and a MOP line close by, and the nearest delivering buoy thirty
 * kilometres north. `9410120` and `D0085` above exist for this row alone --
 * every other fixture beach sits in the La Jolla cluster, where the tide
 * station and the buoy are 900 m apart and this case cannot be built.
 */
const NO_BUOY_ROW = row({
  Beach_Name: "No Buoy Reaches Here",
  Beach_UpperLat: "32.612",
  "Beach_ UpperLon": "-117.135",
  Beach_LowerLat: "32.604",
  Beach_LowerLon: "-117.135",
});

/** Enclosed water: the joins decline a buoy AND a line, which is the other
 * reason a served beach carries no measured wave height. */
const BAY_ROW = row({
  Beach_Name: "Quiet Bay",
  WaterBodyType: "Sound, Bay, or Inlet",
  Beach_UpperLat: "32.72",
  "Beach_ UpperLon": "-117.18",
  Beach_LowerLat: "32.71",
  Beach_LowerLon: "-117.18",
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
    const [beach] = build(
      [row()],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(beach.slug).toBe("somewhere-beach");
    expect(beach.tide_station).toBe("9410230");
    expect(beach.tide_station_distance_m).toBeGreaterThan(0);
    expect(["upper", "lower"]).toContain(beach.tide_station_from_end);

    // The wave binding rides along on the same walk, and an open-coast beach
    // gets one.
    expect(beach.wave_buoy).toBe("46254");
    expect(beach.wave_buoy_distance_m).toBeGreaterThan(0);

    // The second wave binding, from its own table. D0002 sits on this beach's
    // upper endpoint and publishes no forecast, so delivery decides this
    // rather than distance.
    expect(beach.mop_line).not.toBe("D0002");
    expect(beach.mop_line).toBe("D0003");
    expect(beach.mop_line_distance_m).toBeGreaterThan(0);
    expect(["upper", "lower"]).toContain(beach.mop_line_from_end);
    // Undefined rather than absent: JSON.stringify drops the key on the way to
    // disk, which is what makes "present exactly when the id is null" true of
    // the committed file.
    expect(beach.mop_line_null_reason).toBeUndefined();

    // So does the observation station, and it is the nearest one that
    // publishes sky rather than the nearest one full stop: D3101 is closer to
    // this row than KNKX and publishes none.
  });

  it("binds a forecast cell, and carries no distance beside it", () => {
    // The one binding on a beach with no *_distance_m, and the absence is the
    // assertion: a cell is an area about 2.5 km square, so there is nothing to
    // be nearer by and a distance here would be an invented precision.
    const [beach] = build(
      [row()],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(beach.grid_cell).toBe("SGX/54,21");
    expect(beach).not.toHaveProperty("grid_cell_distance_m");
    expect(beach.grid_cell_null_reason).toBeUndefined();
  });

  it("chooses the end whose cell averages nearer sea level", () => {
    // somewhere-beach straddles two cells: its upper end falls on a 117 m
    // bluff cell and its lower end at sea level. Every other binding on this
    // row takes the *nearer* end; this one takes the *lower* one, and the two
    // criteria disagree here on purpose.
    const [beach] = build(
      [row()],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(beach.grid_cell_from_end).toBe("lower");
    expect(beach.grid_cell_elevation_m).toBe(0);
  });

  it("says why, when the table does not list the beach", () => {
    // What an excluded beach hits, because the table is measured against the
    // served inventory. A null with no reason would be the silent failure this
    // repo does not ship.
    //
    // **The reason no longer asserts which of the two situations it is.** It
    // used to say "an excluded beach has none recorded", which is false for the
    // other one -- a served beach the table predates -- and the served case is
    // the only one a reader ever sees, since an excluded beach is filtered out
    // before its reason is written anywhere. `unlistedCellFault` below is what
    // stops that case reaching a reader at all.
    const [beach] = build(
      [row({ Beach_Name: "Unprobed Cove" })],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(beach.grid_cell).toBeNull();
    expect(beach.grid_cell_elevation_m).toBeNull();
    expect(beach.grid_cell_null_reason).toMatch(/does not list unprobed-cove/);
  });

  it("binds the air to the shore station, which is what outlived the split", () => {
    // ADR-0010 produced two joins over one table: an airport for sky, and the
    // nearest station standing in the marine layer for temperature and wind.
    // ADR-0020 retired the airport join. This asserts the half that remains --
    // the shore station, at a fraction of the airport's distance, which is the
    // reading the split existed to protect.
    const [beach] = build(
      [row()],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(beach.air_station).toBe("LJAC1");
    // Nearer than the airport it used to be compared against: KNKX is 10.4 km
    // from this row and the pier is under two.
    expect(beach.air_station_distance_m).toBeLessThan(2_000);
    expect(beach).not.toHaveProperty("sky_station");
    expect(["upper", "lower"]).toContain(beach.air_station_from_end);
  });

  it("keeps an open-coast beach off a station above the marine layer", () => {
    // D3101 is nearer this row than LJAC1 and publishes temperature and wind,
    // so distance alone would take it. It is not a shore station.
    const [beach] = build(
      [row()],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(beach.air_station).not.toBe("D3101");
  });

  it("gives a bay beach a tide station and no wave buoy", () => {
    const [beach] = build(
      [row({ WaterBodyType: "Sound, Bay, or Inlet" })],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    // Swell does not reach into a bay, and the tide certainly does.
    expect(beach.tide_station).toBe("9410170");
    expect(beach.wave_buoy).toBeNull();
    expect(beach.wave_buoy_null_reason).toMatch(/does not reach into a bay/);

    // And no forecast either, for the same reason. The two wave bindings are
    // separate joins and must refuse the same water, or the page would carry a
    // forecast for a bay it declines to give a measurement for.
    expect(beach.mop_line).toBeNull();
    expect(beach.mop_line_null_reason).toMatch(/does not reach into a bay/);

    // Air does reach into a bay, so this join is not asymmetric the way the
    // wave join is. Making the two symmetric would silently strip wind and
    // visibility from twenty-six beaches.

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
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
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
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
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
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(beach.tide_station).toBeNull();
    expect(beach.tide_station_null_reason).toMatch(/outside San Diego County/);
    // The fault stops every join, not just the tide one. A coordinate nobody
    // can trust must not produce a confident airport reading either.
    expect(beach.air_station).toBeNull();
    expect(beach.air_station_null_reason).toMatch(/outside San Diego County/);
  });

  it("stops on a duplicate slug rather than disambiguating one", () => {
    // A slug is a primary key. Making one unique automatically would make it
    // unstable, and data accumulates against it.
    expect(() =>
      build(
        [row(), row()],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
    ).toThrow(/is claimed by both/);
  });

  it("stops when a pinned column is missing", () => {
    const missing = row();
    delete missing["Beach_ UpperLon"];
    expect(() =>
      build(
        [missing],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
    ).toThrow(/has drifted/);
  });

  it("stops when a coordinate does not parse", () => {
    expect(() =>
      build(
        [row({ Beach_UpperLat: "north a bit" })],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
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
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
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

  it("says when a model could have stood in for the buoy and could not", () => {
    // The asymmetry ADR-0019 created. Border Field is listed and Tijana River
    // is not, and before this clause both carried the same reason -- a buoy
    // tens of kilometres away -- which told a reader the same thing about two
    // opposite outcomes.
    const why = serviceFault(
      bound({
        wave_buoy: "46232",
        wave_buoy_distance_m: 34_159,
        mop_line: "D0008",
        mop_line_distance_m: 6_395,
      }),
    );

    expect(why).toContain("34.2 km");
    expect(why).toContain("6.4 km");
    expect(why).toContain("1.0 km");
  });

  it("stays quiet about the model where a line was near enough", () => {
    // Ocean Beach: the buoy is too far AND a line is 776 m away, so MOP is not
    // what kept it out -- its tide station is. A clause here would name an
    // innocent binding.
    const why = serviceFault(
      bound({
        tide_station_distance_m: 12_300,
        wave_buoy: "46254",
        wave_buoy_distance_m: 12_500,
        mop_line: "D0333",
        mop_line_distance_m: 776,
      }),
    );

    expect(why).not.toContain("MOP line");
  });

  it("stays quiet about the model where the buoy was not the problem", () => {
    // San Onofre: out on tide alone, with a line 689 m away. Mentioning MOP
    // would imply the waves were ever in question.
    const why = serviceFault(
      bound({
        tide_station_distance_m: 56_557,
        wave_buoy_distance_m: 1_000,
        mop_line: "D1210",
        mop_line_distance_m: 689,
      }),
    );

    expect(why).not.toContain("MOP line");
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

describe("dropReplacedBuoy", () => {
  /** The shape ADR-0019 is about: tide reaches, buoy does not, line does. */
  const replaceable = (overrides = {}) =>
    bound({
      tide_station_distance_m: 2_914,
      wave_buoy: "46232",
      wave_buoy_distance_m: 28_153,
      wave_buoy_from_end: "lower",
      mop_line: "D0001",
      mop_line_distance_m: 466,
      ...overrides,
    });

  it("is a one-kilometre rule by default, and says so in one place", () => {
    // A second judgement, and a different question from SERVICE_TOLERANCE_M --
    // not how far a reading may travel, but whether the beach is on the coast
    // the model describes. Changing it must be a one-line edit like the other.
    expect(MODELLED_SOURCE_TOLERANCE_M).toBe(1_000);
  });

  it("drops a buoy too far to publish when a line can answer instead", () => {
    const beach = dropReplacedBuoy(replaceable());

    expect(beach.wave_buoy).toBeNull();
    expect(beach.wave_buoy_distance_m).toBeNull();
    expect(beach.wave_buoy_from_end).toBeNull();
    expect(beach.mop_line).toBe("D0001");
  });

  it("records the refused distance and the line that replaced it", () => {
    // Either half alone misleads: the distance without the replacement reads as
    // a beach with no waves, and the replacement without the distance hides
    // that a measurement was refused.
    const { wave_buoy_null_reason: why } = dropReplacedBuoy(replaceable());

    expect(why).toContain("46232");
    expect(why).toContain("28.2 km");
    expect(why).toContain("D0001");
    expect(why).toContain("0.5 km");
    expect(why).toContain("model rather than a measurement");
  });

  it("leaves a beach whose buoy is inside the tolerance alone", () => {
    const beach = replaceable({ wave_buoy_distance_m: 1_565 });
    expect(dropReplacedBuoy(beach)).toBe(beach);
  });

  it("leaves a beach whose line is too far to answer alone", () => {
    // Tijana River: published 6-7 km up the river, so its nearest line is
    // 6,395 m. It fails on the rule rather than by name, and stays excluded.
    const beach = replaceable({
      mop_line: "D0008",
      mop_line_distance_m: 6_395,
    });
    expect(dropReplacedBuoy(beach)).toBe(beach);
  });

  it("leaves a beach the tide also fails, so its reason keeps naming both", () => {
    // The guard that makes this four beaches instead of eleven. Ocean Beach is
    // out on tide either way; dropping its buoy would only make `_excluded`
    // tell a reader less than it did.
    const beach = replaceable({
      tide_station_distance_m: 12_300,
      wave_buoy: "46254",
      wave_buoy_distance_m: 12_500,
      mop_line_distance_m: 776,
    });

    expect(dropReplacedBuoy(beach)).toBe(beach);
    expect(serviceFault(dropReplacedBuoy(beach))).toContain("46254");
  });

  it("leaves a beach the join bound no line to", () => {
    // A bay: swell does not reach it, so nothing replaces anything. It has no
    // buoy either, and this must not invent a reason for that.
    const beach = replaceable({
      wave_buoy: null,
      wave_buoy_distance_m: null,
      mop_line: null,
      mop_line_distance_m: null,
    });
    expect(dropReplacedBuoy(beach)).toBe(beach);
  });

  it("turns the fault it clears into no fault at all", () => {
    // The whole point, asserted end to end rather than through the fields: the
    // beach was refused on its buoy, and after the transform it is served.
    const beach = replaceable();

    expect(serviceFault(beach)).toContain("46232");
    expect(serviceFault(dropReplacedBuoy(beach))).toBeNull();
  });
});

describe("document", () => {
  it("lists only the beaches whose stations reach them", () => {
    const doc = document(
      build(
        [row(), FAR_ROW],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
    );

    expect(doc.beaches.map((b) => b.slug)).toEqual(["somewhere-beach"]);
  });

  it("records every beach it does not list, with the distance that cut it", () => {
    const doc = document(
      build(
        [row(), FAR_ROW],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
    );

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
    const built = build(
      [row(), FAR_ROW],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );
    const doc = document(built);

    const listed = [
      ...doc.beaches.map((b) => b.slug),
      ...doc._excluded.map((b) => b.slug),
    ];
    expect(listed.sort()).toEqual(built.map((b) => b.slug).sort());
  });

  it("tells the two reasons for a missing wave height apart, and counts each", () => {
    // Both beaches carry `wave_buoy: null` and they do not mean the same thing:
    // at the bay no buoy was ever bound, and at the other one was bound and
    // refused. A caveat that merged them would tell a reader in Imperial Beach
    // that swell does not reach their beach, which is the opposite of true.
    const doc = document(
      build(
        [row(), NO_BUOY_ROW, BAY_ROW],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
    );
    const caveat = doc.unresolved.find((entry) =>
      entry.includes("no MEASURED wave height"),
    );

    expect(caveat).toContain("2 of these beaches");
    expect(caveat).toContain("At 1 of them the join bound no buoy");
    expect(caveat).toContain("At the other 1 the join DID bind a buoy");
    expect(caveat).toContain("46235");
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
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
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
    expect(() =>
      document(
        build(
          [FAR_ROW],
          STATIONS,
          BUOYS,
          OBSERVATION_STATIONS,
          MOP_LINES,
          GRID_CELLS,
        ),
      ),
    ).toThrow(/excluded all 1/);
  });

  it("tells a reader that a beach out of range is not listed at all", () => {
    const doc = document(
      build(
        [row()],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
    );
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

  it("tells a reader there is no sky reading, and why", () => {
    const built = document(
      build(
        [row()],
        STATIONS,
        BUOYS,
        OBSERVATION_STATIONS,
        MOP_LINES,
        GRID_CELLS,
      ),
    );
    const sky = built.unresolved.find((entry) =>
      entry.includes("no visibility figure"),
    );

    // The caveat that replaced "sky and visibility are read at an airport".
    // The figures went; the reason a beach site has no cloud reading did not,
    // because a reader who wonders is owed the same answer that justified the
    // deletion.
    expect(sky).toBeDefined();
    expect(sky).toMatch(/airport METARs/);
    expect(sky).toMatch(/0020-sky-leaves-the-card/);
  });

  /**
   * A test stood here asserting that the airport caveat named the FARTHEST
   * beach from its sky station rather than whichever row came first -- the
   * reduce and the sort only run with two beaches, so a single-row fixture had
   * left the rule unasserted. Both the caveat and the reduce are gone with the
   * sky binding.
   *
   * The equivalent rule survives for the air station's median, which
   * "reports the median air distance over more than one beach" covers, and for
   * the MOP line's farthest, which its own test covers.
   */

  it("writes its caveats out in full, so two runs agree", () => {
    // Carrying entries forward from the file duplicated them on the second run,
    // and made --check report movement immediately after a seed. A check that
    // cannot say "unchanged" says nothing.
    const built = build(
      [row()],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );
    const first = document(built).unresolved;
    const second = document(built).unresolved;

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it("stamps the date where the beaches are, not where the clock is", () => {
    // 01:59 UTC on the 19th is 18:59 on the 18th in San Diego. Stamping the UTC
    // date made any run after 5pm Pacific claim a day that had not started in
    // the county this file describes, and read a day ahead of the station
    // tables probed beside it. The zone is the one the document itself
    // declares two lines below the stamp.
    const built = build(
      [row()],
      STATIONS,
      BUOYS,
      OBSERVATION_STATIONS,
      MOP_LINES,
      GRID_CELLS,
    );

    expect(document(built, new Date("2026-08-19T01:59:22Z")).generated).toBe(
      "2026-08-18",
    );
  });
});

describe("unlistedCellFault", () => {
  const table = {
    resolutions: { "la-jolla-shores-beach": {}, "ocean-beach": {} },
  };

  it("passes when the table has been asked about every served beach", () => {
    expect(
      unlistedCellFault(
        [{ slug: "la-jolla-shores-beach" }, { slug: "ocean-beach" }],
        table,
      ),
    ).toBeNull();
  });

  it("refuses the seed when the table predates a beach the site serves", () => {
    // THE REGRESSION. `0572e3c` admitted six beaches that `grid-cells.json`
    // predated, and the seed wrote six nulls without a word. Six of 51 beaches
    // shipped with no wind, no air temperature, no cloud band and no wind
    // needle, under a reason that said they had no coordinate recorded.
    const fault = unlistedCellFault(
      [
        { slug: "la-jolla-shores-beach" },
        { slug: "ocean-beach" },
        { slug: "coronado-north-beach" },
      ],
      table,
    );

    expect(fault).toMatch(/coronado-north-beach/);
    expect(fault).toMatch(/1 of the 3 beaches/);
    expect(fault).toMatch(/probe-grid-cells/);
  });

  it("names every unlisted beach, not the first one it meets", () => {
    // A message naming one of six sends someone to re-probe, read a diff with
    // six beaches in it, and wonder which of the five extra ones is a surprise.
    const fault = unlistedCellFault(
      [
        { slug: "ocean-beach" },
        { slug: "dog-beach-o-b" },
        { slug: "sunset-cliffs-park" },
      ],
      table,
    );

    expect(fault).toMatch(/dog-beach-o-b/);
    expect(fault).toMatch(/sunset-cliffs-park/);
  });

  it("does not refuse a served beach the table lists and could not resolve", () => {
    // The distinction the whole guard turns on. `/points` answering for neither
    // end, or a cell that publishes no sky series, are facts about the coast --
    // `bindGridCell` words them and `conditions.ts` has a `no-cell` state for
    // them. Only a beach the table was never asked about is a stale table.
    expect(
      unlistedCellFault([{ slug: "ocean-beach" }], {
        resolutions: {
          "ocean-beach": {
            upper: { cell: null, reason: "the grid does not cover it" },
            lower: { cell: null, reason: "the grid does not cover it" },
          },
        },
      }),
    ).toBeNull();
  });
});
