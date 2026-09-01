import { describe, expect, it } from "vitest";
import {
  anchorsFrom,
  arcBetween,
  coastalArc,
  densifyIndices,
  document as buildDocument,
  mainlandRing,
  metresBetween,
  nearestVertex,
  simplifyIndices,
  thin,
} from "./probe-coastline.mjs";

/**
 * Every rule in the probe that would otherwise draw a wrong coastline quietly.
 *
 * The script reaches the network and writes a file; none of that is exercised
 * here. What is exercised is the arithmetic between the two, which is where a
 * mistake becomes a shoreline nobody can tell is wrong by looking at it.
 */

/** A ring: up the coast at lon -117, back down inland at lon -116. */
function ring() {
  return [
    [-117.0, 32.0],
    [-117.0, 32.1],
    [-117.0, 32.2],
    [-117.0, 32.3],
    [-116.0, 32.3],
    [-116.0, 32.15],
    [-116.0, 32.0],
  ];
}

const ANCHORS = {
  south: { id: "D0001", at: [-117.0, 32.0] },
  north: { id: "D0009", at: [-117.0, 32.3] },
};

describe("metresBetween", () => {
  it("corrects longitude for latitude, as the drawn map does", () => {
    // A degree of latitude is 111.32 km everywhere.
    expect(metresBetween([-117, 32], [-117, 33])).toBeCloseTo(111_320, 0);

    // A degree of longitude is cos(32.5) of that here -- about 84 percent. A
    // probe that skipped this would simplify the north of the county harder
    // than the south.
    expect(metresBetween([-117, 32.5], [-116, 32.5])).toBeCloseTo(
      111_320 * Math.cos((32.5 * Math.PI) / 180),
      0,
    );
  });
});

describe("nearestVertex", () => {
  it("finds the index and reports how far away it landed", () => {
    const hit = nearestVertex(ring(), [-117.0, 32.19]);
    expect(hit.index).toBe(2);
    expect(hit.metres).toBeLessThan(1_200);
  });
});

describe("arcBetween", () => {
  it("walks forward between the anchors when they are in order", () => {
    expect(arcBetween(ring(), 0, 3)).toEqual([
      [-117.0, 32.0],
      [-117.0, 32.1],
      [-117.0, 32.2],
      [-117.0, 32.3],
    ]);
  });

  it("wraps past the ring's own start when it has to", () => {
    // The coastal arc is not always the one that happens to sit between two
    // ascending indices, because a ring's start is arbitrary.
    expect(arcBetween(ring(), 5, 1)).toEqual([
      [-116.0, 32.15],
      [-116.0, 32.0],
      [-117.0, 32.0],
      [-117.0, 32.1],
    ]);
  });

  it("refuses a ring too short to have two arcs", () => {
    expect(() =>
      arcBetween(
        [
          [0, 0],
          [1, 1],
        ],
        0,
        1,
      ),
    ).toThrow(/no arc to cut/);
  });

  it("refuses two anchors that landed on one vertex", () => {
    // Not an empty coast: an anchor pair this repo cannot cut a shoreline from,
    // which has to say so rather than return a single point.
    expect(() => arcBetween(ring(), 2, 2)).toThrow(/same ring vertex/);
  });
});

describe("mainlandRing", () => {
  it("takes the largest ring, which is the mainland", () => {
    const feature = {
      geometry: {
        rings: [
          [
            [0, 0],
            [1, 1],
          ],
          ring(),
          [
            [2, 2],
            [3, 3],
            [4, 4],
          ],
        ],
      },
    };
    expect(mainlandRing(feature)).toHaveLength(7);
  });

  it("refuses a feature with no rings rather than returning nothing", () => {
    expect(() => mainlandRing({ geometry: {} })).toThrow(/carries no rings/);
    expect(() => mainlandRing(undefined)).toThrow(/carries no rings/);
  });
});

describe("anchorsFrom", () => {
  const table = (lines) => ({ lines });

  it("takes the lowest and highest line ids", () => {
    const anchors = anchorsFrom(
      table({
        D0007: { lat: 32.2, lon: -117.2 },
        D0001: { lat: 32.0, lon: -117.0 },
        D0004: { lat: 32.1, lon: -117.1 },
      }),
    );
    expect(anchors.south.id).toBe("D0001");
    expect(anchors.north.id).toBe("D0007");
    expect(anchors.south.at).toEqual([-117.0, 32.0]);
  });

  it("refuses ids of mixed width, which sort wrong as strings", () => {
    // `D999` sorts above `D1000`, so the arc would be cut at the wrong end of
    // the county and the shoreline would come out inside out.
    expect(() =>
      anchorsFrom(
        table({
          D1: { lat: 32.0, lon: -117.0 },
          D1000: { lat: 33.0, lon: -117.5 },
        }),
      ),
    ).toThrow(/not one fixed width/);
  });

  it("refuses a table that has stopped running south to north", () => {
    expect(() =>
      anchorsFrom(
        table({
          D0001: { lat: 33.0, lon: -117.5 },
          D0002: { lat: 32.0, lon: -117.0 },
        }),
      ),
    ).toThrow(/no longer run south to north/);
  });

  it("refuses a table too small to anchor an arc", () => {
    expect(() => anchorsFrom(table({ D0001: { lat: 32, lon: -117 } }))).toThrow(
      /too few to anchor/,
    );
  });
});

describe("simplifyIndices", () => {
  it("drops a vertex that sits on the line between its neighbours", () => {
    const straight = [
      [-117.0, 32.0],
      [-117.0, 32.05],
      [-117.0, 32.1],
    ];
    expect(simplifyIndices(straight, 5)).toEqual([0, 2]);
  });

  it("keeps a vertex that departs from it by more than the tolerance", () => {
    const bent = [
      [-117.0, 32.0],
      [-116.99, 32.05],
      [-117.0, 32.1],
    ];
    expect(simplifyIndices(bent, 5)).toEqual([0, 1, 2]);
  });

  it("keeps everything it is given when there is nothing to drop", () => {
    expect(
      simplifyIndices(
        [
          [0, 0],
          [1, 1],
        ],
        5,
      ),
    ).toEqual([0, 1]);
  });
});

describe("densifyIndices", () => {
  /** A straight run of eleven vertices about 1.1 km apart end to end. */
  const dense = Array.from({ length: 11 }, (_, at) => [
    -117.0,
    32.0 + at * 0.001,
  ]);

  it("puts published vertices back until no step exceeds the cap", () => {
    // Douglas-Peucker on a straight line keeps only the ends, and a step that
    // long reads downstream as water rather than as shore.
    const simplified = simplifyIndices(dense, 5);
    expect(simplified).toEqual([0, 10]);

    const restored = densifyIndices(dense, simplified, 300);
    const steps = restored
      .slice(1)
      .map((at, before) => metresBetween(dense[restored[before]], dense[at]));
    expect(Math.max(...steps)).toBeLessThanOrEqual(300);
  });

  it("restores only vertices the publisher issued, never a computed midpoint", () => {
    // The rule this repo does not break: positions are read, not manufactured.
    const restored = densifyIndices(dense, [0, 10], 300);
    for (const at of restored) {
      expect(dense[at]).toBeDefined();
    }
    expect(restored[0]).toBe(0);
    expect(restored[restored.length - 1]).toBe(10);
  });

  it("leaves a step it cannot shorten, which is a real gap", () => {
    // Two adjacent published vertices further apart than the cap. There is
    // nothing between them to restore, and downstream `COAST_GAP_M` is what
    // decides such a step is water.
    const gapped = [
      [-117.0, 32.0],
      [-117.0, 32.05],
    ];
    expect(densifyIndices(gapped, [0, 1], 200)).toEqual([0, 1]);
  });
});

describe("thin", () => {
  it("chooses the shape by tolerance and the density by the cap", () => {
    const points = Array.from({ length: 21 }, (_, at) => [
      -117.0,
      32.0 + at * 0.001,
    ]);
    const thinned = thin(points, 5, 300);

    expect(thinned.length).toBeGreaterThan(2);
    expect(thinned.length).toBeLessThan(points.length);
    expect(thinned[0]).toEqual(points[0]);
    expect(thinned[thinned.length - 1]).toEqual(points[points.length - 1]);
  });
});

describe("coastalArc", () => {
  const feature = (overrides = {}) => ({
    attributes: { CA_Ecoregion_Name: "Southern California Coast" },
    geometry: { rings: [ring()] },
    ...overrides,
  });

  it("cuts the arc between the anchors and returns it unsimplified", () => {
    const arc = coastalArc(feature(), ANCHORS);
    expect(arc[0]).toEqual([-117.0, 32.0]);
    expect(arc[arc.length - 1]).toEqual([-117.0, 32.3]);
  });

  it("refuses a feature whose section has been renumbered upstream", () => {
    // The `where` names an OBJECTID. If the layer is renumbered, the arc would
    // be cut out of some other ecoregion and would still draw a plausible line.
    expect(() =>
      coastalArc(
        feature({ attributes: { CA_Ecoregion_Name: "Sierra Nevada" } }),
        ANCHORS,
      ),
    ).toThrow(/was renumbered upstream/);
  });

  it("refuses a ring the anchors are nowhere near", () => {
    const elsewhere = {
      attributes: { CA_Ecoregion_Name: "Southern California Coast" },
      geometry: {
        rings: [
          [
            [-120.0, 38.0],
            [-120.0, 38.1],
            [-119.9, 38.1],
            [-119.9, 38.0],
          ],
        ],
      },
    };
    expect(() => coastalArc(elsewhere, ANCHORS)).toThrow(
      /not this county's mainland/,
    );
  });

  it("refuses the inland arc when the ring's winding flips upstream", () => {
    // The failure this is really guarding, and it is not the one that was
    // guarded first. Reversing the ring makes "forward from the south anchor"
    // traverse the ecoregion's *mountain* boundary, which comes back as a
    // smooth line between the same two endpoints and draws as a plausible
    // shoreline forty kilometres inland.
    //
    // A south-to-north check cannot see it: both arcs start and end at the
    // anchors, so both walk south to north. Only where they go in between
    // separates them.
    const reversed = {
      attributes: { CA_Ecoregion_Name: "Southern California Coast" },
      geometry: { rings: [[...ring()].reverse()] },
    };
    expect(() => coastalArc(reversed, ANCHORS)).toThrow(
      /inland ecoregion boundary rather than the coast/,
    );
  });
});

describe("document", () => {
  it("states its own provenance, what was measured, and the datum it lacks", () => {
    const arc = [
      [-117.0, 32.0],
      [-117.0, 32.1],
      [-117.0, 32.2],
    ];
    const built = buildDocument(
      arc,
      ANCHORS,
      99,
      new Date("2026-08-31T12:00:00Z"),
    );

    expect(built.points).toEqual(arc);
    expect(built._what_was_measured).toContain("thinned from 99");
    expect(built._what_was_measured).toContain("D0001");

    // The claim this file must never stop making. A reader drawing a water
    // level against this line needs to know no datum is published for it.
    expect(built._provenance).toContain("NO TIDAL DATUM IS PUBLISHED");
    expect(built.unresolved.length).toBeGreaterThan(0);
  });
});
