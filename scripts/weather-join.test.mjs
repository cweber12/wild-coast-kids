import { describe, expect, it } from "vitest";
import { bindWeatherStation } from "./weather-join.mjs";

/**
 * A cut-down table with the shapes that matter: two stations that publish
 * visibility, one that answers without it, and one that does not answer.
 *
 * The coordinates are the real ones, because the whole point of the join is
 * which station is nearest.
 */
const STATIONS = {
  KNKX: {
    lat: 32.86833,
    lon: -117.1425,
    delivers: true,
    publishes_visibility: true,
  },
  KSAN: {
    lat: 32.73361,
    lon: -117.18306,
    delivers: true,
    publishes_visibility: true,
  },
  // Nearer La Jolla Shores than either of the above, and publishes no
  // visibility at all. This is the station the join has to refuse.
  D3101: {
    lat: 32.92083,
    lon: -117.25283,
    delivers: true,
    publishes_visibility: false,
  },
  KF70: {
    lat: 33.5742,
    lon: -117.1285,
    delivers: false,
    publishes_visibility: false,
  },
};

/** La Jolla Shores Beach, as the inventory holds it. */
const LA_JOLLA_SHORES = {
  segment: {
    upper: { lat: 32.883647, lon: -117.252681 },
    lower: { lat: 32.854717, lon: -117.259183 },
  },
};

describe("bindWeatherStation", () => {
  it("binds the nearest station that publishes visibility", () => {
    const bound = bindWeatherStation(LA_JOLLA_SHORES, STATIONS);

    expect(bound.stationId).toBe("KNKX");
    expect(bound.fromEnd).toBe("upper");
    expect(Math.round(bound.distanceM)).toBe(10429);
  });

  it("refuses a nearer station that publishes no visibility", () => {
    // D3101 sits about 3.5 km from this beach and KNKX about 10.4 km, so
    // proximity alone would pick D3101 -- which has never published a
    // visibility value. Requiring the field is what makes the binding able to
    // answer the question the site promises.
    const bound = bindWeatherStation(LA_JOLLA_SHORES, STATIONS);
    expect(bound.stationId).not.toBe("D3101");
  });

  it("refuses a station that does not answer at all", () => {
    const onlyDead = {
      KF70: STATIONS.KF70,
      KSAN: STATIONS.KSAN,
    };
    expect(bindWeatherStation(LA_JOLLA_SHORES, onlyDead).stationId).toBe(
      "KSAN",
    );
  });

  it("binds a bay beach too, unlike the wave join", () => {
    // Air reaches a lagoon; ocean swell does not. The asymmetry between this
    // join and the wave join is deliberate, and this is the assertion that
    // would fail if someone made them symmetric.
    const missionBay = {
      segment: {
        upper: { lat: 32.7937, lon: -117.2238 },
        lower: { lat: 32.7837, lon: -117.2238 },
      },
    };
    expect(bindWeatherStation(missionBay, STATIONS).stationId).not.toBeNull();
  });

  it("says why when nothing in the table can be bound", () => {
    const none = { D3101: STATIONS.D3101, KF70: STATIONS.KF70 };
    const bound = bindWeatherStation(LA_JOLLA_SHORES, none);

    expect(bound.stationId).toBeNull();
    expect(bound.reason).toMatch(/publishes visibility/);
  });

  it("breaks a tie on the id, so two runs agree", () => {
    // Two stations equidistant from the segment. Without a deterministic tie
    // break the committed file would flip between runs and --check's diff
    // would stop meaning anything.
    const tied = {
      KZZZ: {
        lat: 32.9,
        lon: -117.3,
        delivers: true,
        publishes_visibility: true,
      },
      KAAA: {
        lat: 32.9,
        lon: -117.3,
        delivers: true,
        publishes_visibility: true,
      },
    };
    expect(bindWeatherStation(LA_JOLLA_SHORES, tied).stationId).toBe("KAAA");
  });
});
