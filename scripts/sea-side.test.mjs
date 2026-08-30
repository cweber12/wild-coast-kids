import { describe, expect, it } from "vitest";
import { checkSeaSide, coastFrom, sideOf } from "./sea-side.mjs";
import {
  coastline,
  sideOf as sideOfTs,
  boundsAround,
  windowAround,
} from "../src/lib/coastline.ts";
import MOP_LINES from "../src/data/mop-lines.json" with { type: "json" };
import BEACHES from "../src/data/beaches.json" with { type: "json" };
import BUOYS from "../src/data/wave-buoys.json" with { type: "json" };
import TIDE_STATIONS from "../src/data/tide-stations.json" with { type: "json" };
import OBSERVATION_STATIONS from "../src/data/observation-stations.json" with { type: "json" };

/**
 * A coast running due north at longitude -117, and one beach on it. West of
 * that line is the sea; east is the land.
 */
function fabricated(buoyLon) {
  return {
    mopLines: {
      D0001: { lat: 32.0, lon: -117.0 },
      D0002: { lat: 32.01, lon: -117.0 },
      D0003: { lat: 32.02, lon: -117.0 },
      D0004: { lat: 32.03, lon: -117.0 },
      D0005: { lat: 32.04, lon: -117.0 },
    },
    beaches: [
      {
        slug: "test-beach",
        segment: {
          upper: { lat: 32.03, lon: -117.0 },
          lower: { lat: 32.01, lon: -117.0 },
        },
        mop_line: "D0003",
        wave_buoy: "TEST1",
        tide_station: null,
        air_station: null,
      },
    ],
    buoys: { TEST1: { lat: 32.02, lon: buoyLon } },
    tideStations: {},
    observationStations: {},
  };
}

describe("checkSeaSide", () => {
  it("passes when the buoy is out to sea, west of a coast walked northward", () => {
    const { ok, lines } = checkSeaSide(fabricated(-117.01));

    expect(ok).toBe(true);
    // A beach that holds the rule earns no line of its own; the summary counts it.
    expect(lines.join("\n")).toMatch(/1 of 1 beaches/);
  });

  it("fails when a buoy is moved to the landward side", () => {
    // The assertion this checker exists for. Not "errors" -- the arithmetic is
    // perfectly happy with a buoy in a car park, which is why nothing catches
    // this without a rule stated somewhere.
    const { ok, lines } = checkSeaSide(fabricated(-116.99));

    expect(ok).toBe(false);
    expect(lines.join("\n")).toMatch(/test-beach.*right/);
  });

  it("reports a beach the traced coast does not reach without failing", () => {
    // 23 of the 51 committed beaches are in Mission Bay or San Diego Bay, 2.6
    // to 5.4 km from the nearest MOP line, so their window holds no coast at
    // all. That is a fact about which water this file traces, not a broken
    // rule, and a checker that failed on it would cry wolf on half the county.
    const inland = fabricated(-117.01);
    // No bound line either, or the box would stretch back to the coast and the
    // window would not be empty after all.
    inland.beaches[0].mop_line = null;
    inland.beaches[0].segment = {
      upper: { lat: 33.5, lon: -116.0 },
      lower: { lat: 33.49, lon: -116.0 },
    };
    inland.buoys.TEST1 = { lat: 33.5, lon: -116.01 };

    const { ok, lines } = checkSeaSide(inland);

    expect(ok).toBe(true);
    expect(lines.join("\n")).toMatch(/no coast/i);
  });

  it("holds for every beach in the committed data", () => {
    const { ok } = checkSeaSide({
      mopLines: MOP_LINES.lines,
      beaches: BEACHES.beaches,
      buoys: BUOYS.buoys,
      tideStations: TIDE_STATIONS.stations,
      observationStations: OBSERVATION_STATIONS.stations,
    });

    expect(ok).toBe(true);
  });
});

describe("the two spellings of the geometry", () => {
  it("dedupe to the same coast", () => {
    // The checker runs under plain node for the gate row and cannot import
    // TypeScript, so the geometry is spelled twice -- the trade ADR-0021 made
    // for generated-date.mjs. What keeps it safe is this: not a sampled
    // agreement but the whole committed file, both ways.
    const fromScript = coastFrom(MOP_LINES.lines);
    const fromSrc = coastline();

    expect(fromScript.length).toBe(fromSrc.length);
    expect(fromScript).toEqual(fromSrc.map((point) => ({ ...point })));
  });

  it("put every committed beach on the same side of its own window", () => {
    const coast = coastline();
    let compared = 0;

    for (const beach of BEACHES.beaches) {
      const buoy = beach.wave_buoy ? BUOYS.buoys[beach.wave_buoy] : null;
      if (!buoy) continue;

      const positions = [beach.segment.upper, beach.segment.lower, buoy];
      const bounds = boundsAround(positions, 0.1);
      if (!bounds) continue;

      const window = windowAround(coast, bounds);
      expect(sideOf(window, buoy)).toBe(sideOfTs(window, buoy));
      compared += 1;
    }

    // A pin that compared nothing would pass forever, so the count is pinned
    // too: 15 of the 51 committed beaches bind a wave buoy, and only those can
    // be asked the question at all.
    expect(compared).toBe(15);
  });
});

describe("what the gate row prints", () => {
  it("groups the beaches it could not check by reason, not one line each", () => {
    // 36 of the 51 bind no wave buoy, and 36 identical lines is not a report --
    // it buries the one line a reader needs. The reason is named once with its
    // count, and only an unusual reason names beaches.
    const many = fabricated(-117.01);
    for (let index = 0; index < 3; index += 1) {
      many.beaches.push({
        slug: `no-buoy-${index}`,
        segment: many.beaches[0].segment,
        mop_line: "D0003",
        wave_buoy: null,
        tide_station: null,
        air_station: null,
      });
    }

    const { ok, lines } = checkSeaSide(many);
    const printed = lines.join("\n");

    expect(ok).toBe(true);
    expect(printed).toMatch(/3 bind no wave buoy/);
    expect(printed).not.toMatch(/no-buoy-0/);
  });
});
