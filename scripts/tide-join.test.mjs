import { describe, expect, it } from "vitest";
import {
  bindTideStation,
  distanceMetres,
  segmentDistance,
  waterClassOf,
} from "./tide-join.mjs";

/** A cut-down station table with the properties the rule turns on. */
const STATIONS = {
  9410230: {
    lat: 32.8669,
    lon: -117.2571,
    water: "open-coast",
    delivers: true,
  },
  9410120: { lat: 32.5783, lon: -117.135, water: "open-coast", delivers: true },
  9410170: { lat: 32.7156, lon: -117.1767, water: "bay", delivers: true },
  TWC0405: {
    lat: 32.6667,
    lon: -117.2333,
    water: "open-coast",
    delivers: false,
  },
};

const near = (lat, lon) => ({ upper: { lat, lon }, lower: { lat, lon } });

describe("distanceMetres", () => {
  it("is zero for a point and itself", () => {
    expect(
      distanceMetres({ lat: 32.8, lon: -117.2 }, { lat: 32.8, lon: -117.2 }),
    ).toBe(0);
  });

  it("matches a known separation", () => {
    // La Jolla to Imperial Beach station, about 34 km down the coast.
    const metres = distanceMetres(
      { lat: 32.8669, lon: -117.2571 },
      { lat: 32.5783, lon: -117.135 },
    );
    expect(metres).toBeGreaterThan(33_000);
    expect(metres).toBeLessThan(35_000);
  });

  it("is symmetric", () => {
    const a = { lat: 32.8669, lon: -117.2571 };
    const b = { lat: 32.5783, lon: -117.135 };
    expect(distanceMetres(a, b)).toBeCloseTo(distanceMetres(b, a), 6);
  });
});

describe("segmentDistance", () => {
  it("measures from whichever end is closer, and says which", () => {
    const segment = {
      upper: { lat: 33.2, lon: -117.4 },
      lower: { lat: 32.87, lon: -117.26 },
    };
    const result = segmentDistance(segment, { lat: 32.8669, lon: -117.2571 });

    expect(result.end).toBe("lower");
    // A long beach must not be pushed onto a distant station by its far end.
    expect(result.metres).toBeLessThan(1000);
  });

  it("prefers the upper end when it is the closer one", () => {
    const segment = {
      upper: { lat: 32.87, lon: -117.26 },
      lower: { lat: 32.2, lon: -117.1 },
    };
    expect(segmentDistance(segment, { lat: 32.8669, lon: -117.2571 }).end).toBe(
      "upper",
    );
  });
});

describe("waterClassOf", () => {
  it("reads the two published values", () => {
    expect(waterClassOf("Open Coast")).toBe("open-coast");
    expect(waterClassOf("Sound, Bay, or Inlet")).toBe("bay");
  });

  it("refuses anything else rather than defaulting to a class", () => {
    // Defaulting would bind a beach by guessing which half of the county it is in.
    expect(waterClassOf("Great Lakes")).toBeNull();
    expect(waterClassOf("")).toBeNull();
    expect(waterClassOf(undefined)).toBeNull();
  });
});

describe("bindTideStation", () => {
  it("binds an open-coast beach to the nearest open-coast station", () => {
    const bound = bindTideStation(
      { segment: near(32.85, -117.27), waterBodyType: "Open Coast" },
      STATIONS,
    );
    expect(bound.stationId).toBe("9410230");
    expect(bound.waterClass).toBe("open-coast");
  });

  it("will not put an ocean beach on a bay station, however close it is", () => {
    // Just outside the bay mouth: the bay station is much nearer than either
    // coastal one, and is still the wrong tide curve for an ocean shore.
    const bound = bindTideStation(
      { segment: near(32.71, -117.18), waterBodyType: "Open Coast" },
      STATIONS,
    );
    expect(bound.stationId).not.toBe("9410170");
    expect(STATIONS[bound.stationId].water).toBe("open-coast");
  });

  it("binds a bay beach to the bay station", () => {
    const bound = bindTideStation(
      { segment: near(32.72, -117.18), waterBodyType: "Sound, Bay, or Inlet" },
      STATIONS,
    );
    expect(bound.stationId).toBe("9410170");
  });

  it("never chooses a station that does not deliver", () => {
    // TWC0405 sits between the two coastal stations and would win on distance
    // alone. It answers HTTP 200 with an error object instead of predictions.
    const bound = bindTideStation(
      { segment: near(32.667, -117.24), waterBodyType: "Open Coast" },
      STATIONS,
    );
    expect(bound.stationId).not.toBe("TWC0405");
  });

  it("returns a reason rather than a station when the water type is unreadable", () => {
    const bound = bindTideStation(
      { segment: near(32.85, -117.27), waterBodyType: "Lagoon" },
      STATIONS,
    );
    expect(bound.stationId).toBeNull();
    expect(bound.reason).toMatch(/not one this join recognises/);
  });

  it("returns a reason when no delivering station of that class exists", () => {
    const bound = bindTideStation(
      { segment: near(32.85, -117.27), waterBodyType: "Open Coast" },
      { TWC0405: STATIONS.TWC0405 },
    );
    expect(bound.stationId).toBeNull();
    expect(bound.reason).toMatch(/no delivering open-coast station/);
  });

  it("is deterministic when two stations tie", () => {
    const tied = {
      bbb: { lat: 32.8, lon: -117.2, water: "bay", delivers: true },
      aaa: { lat: 32.8, lon: -117.2, water: "bay", delivers: true },
    };
    const bound = bindTideStation(
      { segment: near(32.8, -117.2), waterBodyType: "Sound, Bay, or Inlet" },
      tied,
    );
    // Two runs over the same inputs must produce the same file, or the diff the
    // re-join prints stops meaning anything.
    expect(bound.stationId).toBe("aaa");
  });
});
