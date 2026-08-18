import { describe, expect, it } from "vitest";
import { distanceMetres, segmentDistance } from "./geo.mjs";

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
