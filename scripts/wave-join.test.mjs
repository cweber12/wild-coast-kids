import { describe, expect, it } from "vitest";
import { bindWaveBuoy } from "./wave-join.mjs";

const BUOYS = {
  46254: { lat: 32.868, lon: -117.267, delivers: true, publishes_waves: true },
  46232: { lat: 32.517, lon: -117.425, delivers: true, publishes_waves: true },
  46235: { lat: 32.57, lon: -117.169, delivers: false, publishes_waves: false },
  46086: { lat: 32.504, lon: -118.029, delivers: true, publishes_waves: false },
};

const at = (lat, lon) => ({ upper: { lat, lon }, lower: { lat, lon } });

describe("bindWaveBuoy", () => {
  it("binds an open-coast beach to the nearest delivering buoy", () => {
    const bound = bindWaveBuoy(
      { segment: at(32.87, -117.26), waterBodyType: "Open Coast" },
      BUOYS,
    );
    expect(bound.buoyId).toBe("46254");
    expect(bound.distanceM).toBeGreaterThan(0);
    expect(["upper", "lower"]).toContain(bound.fromEnd);
  });

  it("gives a bay beach no buoy at all, and says why", () => {
    // The nearest buoy is a few hundred metres away and still describes water
    // the swell never reaches.
    const bound = bindWaveBuoy(
      { segment: at(32.868, -117.266), waterBodyType: "Sound, Bay, or Inlet" },
      BUOYS,
    );
    expect(bound.buoyId).toBeNull();
    expect(bound.reason).toMatch(/does not reach into a bay/);
  });

  it("never chooses a buoy that does not deliver", () => {
    // 46235 is the closest thing to the south county and answers 404.
    const bound = bindWaveBuoy(
      { segment: at(32.575, -117.17), waterBodyType: "Open Coast" },
      BUOYS,
    );
    expect(bound.buoyId).not.toBe("46235");
    expect(bound.buoyId).toBe("46232");
  });

  it("never chooses a delivering station that carries no wave height", () => {
    // 46086 answers with rows, and none of them has WVHT in it.
    const bound = bindWaveBuoy(
      { segment: at(32.5, -117.9), waterBodyType: "Open Coast" },
      BUOYS,
    );
    expect(bound.buoyId).not.toBe("46086");
  });

  it("refuses an unreadable water body type rather than guessing", () => {
    const bound = bindWaveBuoy(
      { segment: at(32.87, -117.26), waterBodyType: "Estuarine" },
      BUOYS,
    );
    expect(bound.buoyId).toBeNull();
    expect(bound.reason).toMatch(/not one this join recognises/);
  });

  it("says so when no delivering buoy exists at all", () => {
    const bound = bindWaveBuoy(
      { segment: at(32.87, -117.26), waterBodyType: "Open Coast" },
      { 46235: BUOYS["46235"] },
    );
    expect(bound.buoyId).toBeNull();
    expect(bound.reason).toMatch(/no delivering wave buoy/);
  });

  it("is deterministic when two buoys tie", () => {
    const tied = {
      bbb: { lat: 32.8, lon: -117.2, delivers: true, publishes_waves: true },
      aaa: { lat: 32.8, lon: -117.2, delivers: true, publishes_waves: true },
    };
    const bound = bindWaveBuoy(
      { segment: at(32.8, -117.2), waterBodyType: "Open Coast" },
      tied,
    );
    expect(bound.buoyId).toBe("aaa");
  });
});
