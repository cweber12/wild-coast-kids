import { describe, expect, it } from "vitest";
import { bindMopLine } from "./mop-join.mjs";

/**
 * Four lines about 100 m apart, as CDIP spaces them, plus one that publishes no
 * forecast. D0480 and D0481 share a coordinate exactly, which real adjacent
 * lines do and which is what the tie-break exists for.
 */
const LINES = {
  D0479: { lat: 32.8489, lon: -117.2762, delivers: true },
  D0480: { lat: 32.8498, lon: -117.2751, delivers: true },
  D0481: { lat: 32.8498, lon: -117.2751, delivers: true },
  D0482: { lat: 32.8507, lon: -117.274, delivers: true },
  D0483: { lat: 32.8516, lon: -117.2729, delivers: false },
};

const at = (lat, lon) => ({ upper: { lat, lon }, lower: { lat, lon } });

describe("bindMopLine", () => {
  it("binds an open-coast beach to the nearest delivering line", () => {
    const bound = bindMopLine(
      { segment: at(32.8507, -117.274), waterBodyType: "Open Coast" },
      LINES,
    );
    expect(bound.lineId).toBe("D0482");
    expect(bound.distanceM).toBeLessThan(100);
    expect(["upper", "lower"]).toContain(bound.fromEnd);
  });

  it("measures from whichever end of the segment is closer", () => {
    // A beach is a shoreline segment, and some are miles long. Measuring from
    // one fixed end would push the far end onto a line that is not its
    // nearest, and averaging the two would invent a point not on the shore.
    // Here the lower end is two kilometres inland of every line in the table.
    const bound = bindMopLine(
      {
        segment: {
          upper: { lat: 32.8507, lon: -117.274 },
          lower: { lat: 32.8507, lon: -117.2527 },
        },
        waterBodyType: "Open Coast",
      },
      LINES,
    );
    expect(bound.fromEnd).toBe("upper");
    expect(bound.lineId).toBe("D0482");
    expect(bound.distanceM).toBeLessThan(10);
  });

  it("gives a bay beach no line at all, and says why", () => {
    // The nearest line is metres away and still describes the open coast.
    const bound = bindMopLine(
      {
        segment: at(32.8498, -117.2751),
        waterBodyType: "Sound, Bay, or Inlet",
      },
      LINES,
    );
    expect(bound.lineId).toBeNull();
    expect(bound.reason).toMatch(/does not reach into a bay/);
  });

  it("gives a sheltered open-coast beach no line, and says why", () => {
    // Children's Pool is open coast for its tide -- the water level inside is
    // the ocean's -- and closed to swell by the breakwater that makes it a
    // pool. Its nearest line is 330 m away outside that breakwater.
    const bound = bindMopLine(
      {
        slug: "childrens-pool",
        segment: at(32.8476, -117.2784),
        waterBodyType: "Sound, Bay, or Inlet",
      },
      LINES,
    );
    expect(bound.lineId).toBeNull();
    expect(bound.reason).toMatch(/breakwater/);
    expect(bound.reason).toMatch(/MOP line/);
  });

  it("binds the neighbouring cove, which has no structure", () => {
    // The shelter rule must not spread along a coast made largely of coves:
    // Shell Beach is 396 m from Children's Pool and open to the same swell.
    const bound = bindMopLine(
      {
        slug: "shell-beach",
        segment: at(32.8498, -117.2751),
        waterBodyType: "Open Coast",
      },
      LINES,
    );
    expect(bound.lineId).not.toBeNull();
  });

  it("never chooses a line CDIP publishes no forecast for", () => {
    const bound = bindMopLine(
      { segment: at(32.8516, -117.2729), waterBodyType: "Open Coast" },
      LINES,
    );
    expect(bound.lineId).not.toBe("D0483");
    expect(bound.lineId).toBe("D0482");
  });

  it("refuses an unreadable water body type rather than guessing", () => {
    const bound = bindMopLine(
      { segment: at(32.8498, -117.2751), waterBodyType: "Estuarine" },
      LINES,
    );
    expect(bound.lineId).toBeNull();
    expect(bound.reason).toMatch(/not one this join recognises/);
  });

  it("says so when no delivering line exists at all", () => {
    const bound = bindMopLine(
      { segment: at(32.8498, -117.2751), waterBodyType: "Open Coast" },
      { D0483: LINES.D0483 },
    );
    expect(bound.lineId).toBeNull();
    expect(bound.reason).toMatch(/no delivering MOP line/);
  });

  it("is deterministic when two lines share a coordinate", () => {
    // Not a contrived tie. The closest pair in the committed table is 0 m
    // apart, so without the id tie-break two runs would disagree about which
    // line a beach binds and the re-join's diff would stop meaning anything.
    const bound = bindMopLine(
      { segment: at(32.8498, -117.2751), waterBodyType: "Open Coast" },
      LINES,
    );
    expect(bound.distanceM).toBe(0);
    expect(bound.lineId).toBe("D0480");
  });
});
