import { describe, expect, it } from "vitest";
import { bindAirStation } from "./air-join.mjs";

/**
 * A cut-down table with the shapes that decide this join, at the real
 * coordinates: the whole point is which station is nearest and whether nearest
 * is allowed to win.
 */
const STATIONS = {
  // Scripps Pier. On the water, publishes both, and 1.4 km from the default
  // beach -- the binding this whole issue exists to make possible.
  LJAC1: {
    lat: 32.867,
    lon: -117.257,
    delivers: true,
    publishes_air_temp: true,
    publishes_wind: true,
    shore: true,
  },
  // Mt. Soledad. Nearer many of these beaches than anything at sea level, and
  // 102 m up, where the marine layer does not always reach.
  MSDSD: {
    lat: 32.81418,
    lon: -117.24088,
    delivers: true,
    publishes_air_temp: true,
    publishes_wind: true,
    shore: false,
  },
  // Miramar, 146 m and ten kilometres inland: what the panel binds today.
  KNKX: {
    lat: 32.86833,
    lon: -117.1425,
    delivers: true,
    publishes_air_temp: true,
    publishes_wind: true,
    shore: false,
  },
  // On the water and publishes neither. SDBC1 exactly: ten thousand rows of
  // water temperature and no air at all.
  SDBC1: {
    lat: 32.714,
    lon: -117.174,
    delivers: true,
    publishes_air_temp: false,
    publishes_wind: false,
    shore: true,
  },
  // Publishes temperature, no wind. The two are required together.
  E3219: {
    lat: 32.6705,
    lon: -117.1008,
    delivers: true,
    publishes_air_temp: true,
    publishes_wind: false,
    shore: true,
  },
  // Listed and dead.
  NPQC1: {
    lat: 32.601,
    lon: -117.116,
    delivers: false,
    publishes_air_temp: false,
    publishes_wind: false,
    shore: true,
  },
};

/** La Jolla Shores Beach, as the inventory holds it. */
const LA_JOLLA_SHORES = {
  segment: {
    upper: { lat: 32.883647, lon: -117.252681 },
    lower: { lat: 32.854717, lon: -117.259183 },
  },
  waterBodyType: "Open Coast",
};

describe("bindAirStation", () => {
  it("binds the pier at La Jolla Shores instead of the airport", () => {
    // The reading this issue was opened for. On 2026-08-18 the pier read 72 F
    // and Miramar 81 F, nine minutes apart.
    const bound = bindAirStation(LA_JOLLA_SHORES, STATIONS);

    expect(bound.stationId).toBe("LJAC1");
    expect(Math.round(bound.distanceM)).toBe(1381);
  });

  it("refuses a nearer station that stands above the marine layer", () => {
    // MSDSD is 3.8 km from WindanSea and LJAC1 is 4.1 km, so distance alone
    // picks the hilltop. That is the binding the shore rule exists to refuse,
    // and it costs 0.2 km to refuse it.
    const windansea = {
      segment: {
        upper: { lat: 32.8331, lon: -117.2807 },
        lower: { lat: 32.8281, lon: -117.2787 },
      },
      waterBodyType: "Open Coast",
    };

    const bound = bindAirStation(windansea, STATIONS);

    expect(bound.stationId).toBe("LJAC1");
  });

  it("lets a bay beach take the nearest station of any kind", () => {
    // The asymmetry, and the assertion that would fail if someone made the two
    // classes symmetric out of tidiness. A marine layer is not what a station
    // overlooking Mission Bay gets wrong, and forcing a shore station here
    // pushes the binding kilometres away for nothing.
    const missionBay = {
      segment: {
        upper: { lat: 32.7937, lon: -117.2238 },
        lower: { lat: 32.7837, lon: -117.2238 },
      },
      waterBodyType: "Sound, Bay, or Inlet",
    };

    const bound = bindAirStation(missionBay, STATIONS);

    expect(bound.stationId).toBe("MSDSD");
  });

  it("requires temperature and wind from one station, not one each", () => {
    // E3219 is nearer this beach than anything else that qualifies and
    // publishes temperature without wind. Taking its temperature and someone
    // else's wind would put two provenances behind one sentence.
    const nearE3219 = {
      segment: {
        upper: { lat: 32.671, lon: -117.101 },
        lower: { lat: 32.67, lon: -117.1 },
      },
      waterBodyType: "Sound, Bay, or Inlet",
    };

    const bound = bindAirStation(nearE3219, STATIONS);

    expect(bound.stationId).not.toBe("E3219");
  });

  it("refuses a station that does not answer at all", () => {
    const onlyDead = { NPQC1: STATIONS.NPQC1, LJAC1: STATIONS.LJAC1 };

    expect(bindAirStation(LA_JOLLA_SHORES, onlyDead).stationId).toBe("LJAC1");
  });

  it("refuses a shore station that publishes no air", () => {
    const onlyWater = { SDBC1: STATIONS.SDBC1, LJAC1: STATIONS.LJAC1 };

    expect(bindAirStation(LA_JOLLA_SHORES, onlyWater).stationId).toBe("LJAC1");
  });

  it("measures from whichever end of the segment is closer", () => {
    // Beaches are published as segments and some are miles long. Measuring from
    // one fixed end would push the far end onto a station that is not its
    // nearest.
    const bound = bindAirStation(LA_JOLLA_SHORES, STATIONS);

    expect(bound.fromEnd).toBe("lower");
  });

  it("says why when an open-coast beach has no shore station to bind to", () => {
    const inlandOnly = { MSDSD: STATIONS.MSDSD, KNKX: STATIONS.KNKX };
    const bound = bindAirStation(LA_JOLLA_SHORES, inlandOnly);

    expect(bound.stationId).toBeNull();
    expect(bound.reason).toMatch(/from the shore/);
  });

  it("says why when nothing in the table publishes air at all", () => {
    const bound = bindAirStation(
      { ...LA_JOLLA_SHORES, waterBodyType: "Sound, Bay, or Inlet" },
      { SDBC1: STATIONS.SDBC1 },
    );

    expect(bound.stationId).toBeNull();
    expect(bound.reason).toMatch(/nothing to bind to/);
  });

  it("refuses an unreadable water body type rather than guessing", () => {
    // Guessing a class picks which half of the rule applies, which is the whole
    // binding. The tide join refuses the same value for the same reason.
    const bound = bindAirStation(
      { ...LA_JOLLA_SHORES, waterBodyType: "Lake" },
      STATIONS,
    );

    expect(bound.stationId).toBeNull();
    expect(bound.reason).toMatch(/not one this join recognises/);
  });

  it("breaks a tie on the id, so two runs agree", () => {
    // Both pier stations sit at 32.867, -117.257. Without a deterministic tie
    // break the committed file would flip between runs and --check's diff would
    // stop meaning anything.
    const tied = {
      LJPC1: { ...STATIONS.LJAC1 },
      LJAC1: { ...STATIONS.LJAC1 },
    };

    expect(bindAirStation(LA_JOLLA_SHORES, tied).stationId).toBe("LJAC1");
  });
});
