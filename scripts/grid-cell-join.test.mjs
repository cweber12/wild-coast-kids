import { describe, expect, it } from "vitest";
import {
  bindGridCell,
  spansBluff,
  BLUFF_ELEVATION_M,
} from "./grid-cell-join.mjs";

/**
 * Five cells shaped like the ones this coast actually resolves into, measured
 * 2026-08-26: two at sea level, two on the Torrey Pines and Point La Jolla
 * bluffs, and one that answers without publishing sky.
 */
const CELLS = {
  "SGX/54,21": { elevation_m: 0, delivers: true },
  "SGX/55,26": { elevation_m: 21.9456, delivers: true },
  "SGX/55,25": { elevation_m: 102.108, delivers: true },
  "SGX/55,22": { elevation_m: 117.0432, delivers: true },
  "SGX/57,7": { elevation_m: 4.8768, delivers: true },
  "SGX/99,99": { elevation_m: 1, delivers: false },
};

const table = (resolutions) => ({ cells: CELLS, resolutions });

describe("bindGridCell", () => {
  it("binds a beach whose two ends fall in one cell", () => {
    // 27 of 45 beaches do this, so the tie-break is the common path.
    const bound = bindGridCell(
      { slug: "la-jolla-cove" },
      table({
        "la-jolla-cove": {
          upper: { cell: "SGX/55,22" },
          lower: { cell: "SGX/55,22" },
        },
      }),
    );
    expect(bound.cellId).toBe("SGX/55,22");
    expect(bound.elevationM).toBe(117.0432);
  });

  it("takes the end whose cell averages nearer sea level, not the first one", () => {
    // Del Mar City Beach, measured: upper falls in a 22 m cell and lower in a
    // 102 m one. A beach is at sea level, so the low cell is the one describing
    // this shore rather than the terrain behind it.
    const bound = bindGridCell(
      { slug: "del-mar-city-beach" },
      table({
        "del-mar-city-beach": {
          upper: { cell: "SGX/55,26" },
          lower: { cell: "SGX/55,25" },
        },
      }),
    );
    expect(bound.cellId).toBe("SGX/55,26");
    expect(bound.fromEnd).toBe("upper");
  });

  it("picks the low end even when it is the lower one", () => {
    // La Jolla Shores Beach, the mirror case: 117 m upper, 0 m lower. If the
    // criterion were "prefer upper" both tests would still pass, which is why
    // both directions are asserted.
    const bound = bindGridCell(
      { slug: "la-jolla-shores-beach" },
      table({
        "la-jolla-shores-beach": {
          upper: { cell: "SGX/55,22" },
          lower: { cell: "SGX/54,21" },
        },
      }),
    );
    expect(bound.cellId).toBe("SGX/54,21");
    expect(bound.fromEnd).toBe("lower");
  });

  it("binds the resolving end when the other is outside the grid", () => {
    // Border Field State Park: its lower end is south of the border and
    // /points answers InvalidPoint for it.
    const bound = bindGridCell(
      { slug: "border-field-state-park" },
      table({
        "border-field-state-park": {
          upper: { cell: "SGX/57,7" },
          lower: {
            cell: null,
            reason:
              "the National Weather Service grid does not cover 32.534367,-117.124197",
          },
        },
      }),
    );
    expect(bound.cellId).toBe("SGX/57,7");
    expect(bound.fromEnd).toBe("upper");
  });

  it("refuses, with every end's reason, when no end resolved", () => {
    const bound = bindGridCell(
      { slug: "somewhere-else" },
      table({
        "somewhere-else": {
          upper: { cell: null, reason: "the grid does not cover 20,20" },
          lower: { cell: null, reason: "the grid does not cover 20,21" },
        },
      }),
    );
    expect(bound.cellId).toBeNull();
    // Both reasons survive: a binding that failed twice for two reasons must
    // not report one of them.
    expect(bound.reason).toContain("20,20");
    expect(bound.reason).toContain("20,21");
  });

  it("refuses a cell that answers but publishes no sky cover", () => {
    // The trap this feed sets: every payload declares skyCover, visibility and
    // ceilingHeight as keys, and a cell can carry an empty values array. The
    // table records entries, and a cell with none is not a source.
    const bound = bindGridCell(
      { slug: "nowhere" },
      table({ nowhere: { upper: { cell: "SGX/99,99" } } }),
    );
    expect(bound.cellId).toBeNull();
    expect(bound.reason).toMatch(/publishes no sky cover/);
  });

  it("refuses a cell the resolution names and the table does not describe", () => {
    // A broken pair of halves inside one file: the resolution says the end fell
    // in a cell, and the cell block has no entry for it. Reported rather than
    // thrown, so the seed records it against the beach the way every other
    // refusal is recorded, and rather than crashing a build over one row.
    const bound = bindGridCell(
      { slug: "half-written" },
      table({ "half-written": { upper: { cell: "SGX/12,34" } } }),
    );
    expect(bound.cellId).toBeNull();
    expect(bound.reason).toMatch(/missing from the table/);
    expect(bound.reason).toContain("SGX/12,34");
  });

  it("refuses a beach the table does not list, rather than throwing", () => {
    const bound = bindGridCell({ slug: "brand-new-beach" }, table({}));
    expect(bound.cellId).toBeNull();
    expect(bound.reason).toMatch(/does not list brand-new-beach/);
  });

  it("still binds a cell whose elevation is missing", () => {
    // A missing figure is not a high one. Sorting it last keeps it usable when
    // it is the only candidate, which is the difference between a beach with no
    // sky and a beach whose cell did not publish one number.
    const bound = bindGridCell(
      { slug: "unmeasured" },
      table({
        unmeasured: {
          upper: { cell: "SGX/55,22" },
          lower: { cell: "SGX/55,25" },
        },
      }),
    );
    expect(bound.cellId).toBe("SGX/55,25");

    const only = bindGridCell(
      { slug: "only-unmeasured" },
      {
        cells: { "SGX/1,1": { elevation_m: null, delivers: true } },
        resolutions: { "only-unmeasured": { upper: { cell: "SGX/1,1" } } },
      },
    );
    expect(only.cellId).toBe("SGX/1,1");
    expect(only.elevationM).toBeNull();
  });

  it("is stable across runs when two ends tie", () => {
    const resolutions = {
      tied: { upper: { cell: "SGX/54,21" }, lower: { cell: "SGX/54,21" } },
    };
    const first = bindGridCell({ slug: "tied" }, table(resolutions));
    const second = bindGridCell({ slug: "tied" }, table(resolutions));
    expect(first).toEqual(second);
  });
});

describe("spansBluff", () => {
  it("marks the cells measured on the Torrey Pines and La Jolla bluffs", () => {
    expect(spansBluff(117.0432)).toBe(true);
    expect(spansBluff(102.108)).toBe(true);
    expect(spansBluff(106.0704)).toBe(true);
  });

  it("leaves the shoreline cells alone", () => {
    // p50 across all 89 measured segment ends was 2.1 m.
    expect(spansBluff(0)).toBe(false);
    expect(spansBluff(2.1336)).toBe(false);
    expect(spansBluff(21.9456)).toBe(false);
  });

  it("says nothing about a cell with no published elevation", () => {
    expect(spansBluff(null)).toBe(false);
  });

  it("is exclusive at the threshold", () => {
    expect(spansBluff(BLUFF_ELEVATION_M)).toBe(false);
    expect(spansBluff(BLUFF_ELEVATION_M + 0.0001)).toBe(true);
  });
});
