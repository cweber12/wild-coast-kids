import { describe, expect, it } from "vitest";
import {
  buildTable,
  CELL_ID,
  document,
  parseCell,
  parsePoint,
} from "./probe-grid-cells.mjs";

/**
 * Trimmed from a real `/points` response for Del Mar City Beach's lower end,
 * 2026-08-26. Kept in the shape the API serves rather than the shape this
 * script wants, so a field moving is a failure here.
 */
const POINT = {
  properties: {
    gridId: "SGX",
    gridX: 55,
    gridY: 25,
    forecastGridData: "https://api.weather.gov/gridpoints/SGX/55,25",
  },
};

describe("parsePoint", () => {
  it("names the cell from the office and the two indices", () => {
    const parsed = parsePoint(POINT);
    expect(parsed.cellId).toBe("SGX/55,25");
    expect(parsed.cellId).toMatch(CELL_ID);
    expect(parsed).toMatchObject({ office: "SGX", x: 55, y: 25 });
  });

  it("refuses a payload with no properties rather than yielding undefined/NaN", () => {
    expect(() => parsePoint({})).toThrow(/properties/);
    expect(() => parsePoint(null)).toThrow(/properties/);
  });

  it("refuses a non-integer index instead of building SGX/undefined,NaN", () => {
    expect(() =>
      parsePoint({ properties: { gridId: "SGX", gridX: "55", gridY: 25 } }),
    ).toThrow(/integers/);
    expect(() =>
      parsePoint({ properties: { gridId: "SGX", gridX: 55 } }),
    ).toThrow(/integers/);
  });

  it("refuses a missing office", () => {
    expect(() => parsePoint({ properties: { gridX: 55, gridY: 25 } })).toThrow(
      /office/,
    );
  });
});

/**
 * The shape `/gridpoints` actually serves, and the reason this script exists:
 * `visibility` and `ceilingHeight` are present as keys with empty `values`
 * arrays at every cell measured, while `skyCover` carries real entries.
 */
const CELL = {
  properties: {
    elevation: { unitCode: "wmoUnit:m", value: 102.108 },
    skyCover: {
      uom: "wmoUnit:percent",
      values: [
        { validTime: "2026-08-26T12:00:00+00:00/PT3H", value: 59 },
        { validTime: "2026-08-26T15:00:00+00:00/PT3H", value: 23 },
      ],
    },
    visibility: { values: [] },
    ceilingHeight: { values: [] },
    weather: {
      values: [
        {
          validTime: "2026-08-26T12:00:00+00:00/PT3H",
          value: [
            {
              coverage: "patchy",
              weather: "fog",
              visibility: { unitCode: "wmoUnit:km", value: 1.609344 },
            },
          ],
        },
      ],
    },
  },
};

describe("parseCell", () => {
  it("reads the cell's own mean elevation in metres", () => {
    expect(parseCell(CELL).elevationM).toBe(102.108);
  });

  it("counts entries rather than testing for the key", () => {
    // THE POINT OF THIS SCRIPT. Every payload declares visibility and
    // ceilingHeight. A probe asking `"visibility" in properties` would record
    // this cell as publishing a variable it publishes nothing for.
    const parsed = parseCell(CELL);
    expect(parsed.skyCoverEntries).toBe(2);
    expect(parsed.visibilityEntries).toBe(0);
    expect(parsed.ceilingEntries).toBe(0);
    expect(parsed.delivers).toBe(true);
  });

  it("does not deliver when skyCover is declared and empty", () => {
    const empty = {
      properties: { ...CELL.properties, skyCover: { values: [] } },
    };
    expect(parseCell(empty).delivers).toBe(false);
    expect(parseCell(empty).skyCoverEntries).toBe(0);
  });

  it("treats an absent key as zero rather than throwing", () => {
    const properties = { ...CELL.properties };
    delete properties.visibility;
    expect(parseCell({ properties }).visibilityEntries).toBe(0);
  });

  it("refuses an elevation in units this table does not record", () => {
    // A silent foot-to-metre confusion here would put every beach on a bluff.
    expect(() =>
      parseCell({
        properties: {
          ...CELL.properties,
          elevation: { unitCode: "wmoUnit:ft", value: 335 },
        },
      }),
    ).toThrow(/metres/);
  });

  it("records a missing elevation as null rather than as zero", () => {
    const properties = { ...CELL.properties };
    delete properties.elevation;
    expect(parseCell({ properties }).elevationM).toBeNull();
  });

  it("refuses a payload with no properties", () => {
    expect(() => parseCell({})).toThrow(/properties/);
  });
});

describe("the document", () => {
  const TABLE = buildTable(
    {
      "del-mar-city-beach": {
        upper: { cell: "SGX/55,26" },
        lower: { cell: "SGX/55,25" },
      },
      "border-field-state-park": {
        upper: { cell: "SGX/57,7" },
        lower: { cell: null, reason: "the grid does not cover 32.53,-117.12" },
      },
    },
    {
      "SGX/55,25": {
        elevation_m: 102.108,
        sky_cover_entries: 37,
        visibility_entries: 0,
        ceiling_entries: 0,
        delivers: true,
      },
      "SGX/55,26": {
        elevation_m: 21.9456,
        sky_cover_entries: 37,
        visibility_entries: 0,
        ceiling_entries: 0,
        delivers: true,
      },
      "SGX/57,7": {
        elevation_m: 4.8768,
        sky_cover_entries: 37,
        visibility_entries: 0,
        ceiling_entries: 0,
        delivers: true,
      },
    },
  );

  it("sorts both halves, so two runs over the same data produce one file", () => {
    expect(Object.keys(TABLE.cells)).toEqual([
      "SGX/55,25",
      "SGX/55,26",
      "SGX/57,7",
    ]);
    expect(Object.keys(TABLE.resolutions)).toEqual([
      "border-field-state-park",
      "del-mar-city-beach",
    ]);
  });

  it("states what was measured, including the count that is zero", () => {
    const built = document(TABLE, new Date("2026-08-26T12:00:00Z"));
    expect(built._what_was_measured).toContain("3 distinct cells");
    expect(built._what_was_measured).toContain("0 publish a visibility series");
    // The reason the zero is stated rather than omitted: it is the finding.
    expect(built._what_was_measured).toMatch(/empty values array/);
  });

  it("keeps the resolution that failed, with its reason", () => {
    const built = document(TABLE, new Date("2026-08-26T12:00:00Z"));
    expect(built.resolutions["border-field-state-park"].lower).toEqual({
      cell: null,
      reason: "the grid does not cover 32.53,-117.12",
    });
  });
});
