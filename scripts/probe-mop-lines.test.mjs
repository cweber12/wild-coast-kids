import { describe, expect, it } from "vitest";
import {
  buildTable,
  document,
  LINE_ID,
  parseForecastLines,
  parseLineGeometry,
  unplacedLines,
} from "./probe-mop-lines.mjs";

/**
 * A slice of the refraction catalog, in THREDDS's own shape. `DN001` is Del
 * Norte, eight hundred kilometres north, and is here because a looser pattern
 * than `D` plus four digits matches it.
 */
const REFRACTION_CATALOG = `
<catalog>
  <dataset name="D0001_32.53426-117.12917_ref.nc" ID="x" urlPath="y" />
  <dataset name="D0002_32.53524-117.12917_ref.nc" ID="x" urlPath="y" />
  <dataset name="D0003_32.53587-117.12918_ref.nc" ID="x" urlPath="y" />
  <dataset name="DN001_41.99999-124.20000_ref.nc" ID="x" urlPath="y" />
  <dataset name="B0001_34.36880-119.47874_ref.nc" ID="x" urlPath="y" />
</catalog>
`;

const ALONGSHORE_CATALOG = `
<catalog>
  <dataset name="D0001_forecast.nc" ID="x" urlPath="y" />
  <dataset name="D0001_nowcast.nc" ID="x" urlPath="y" />
  <dataset name="D0001_hindcast.nc" ID="x" urlPath="y" />
  <dataset name="D0002_forecast.nc" ID="x" urlPath="y" />
  <dataset name="D0003_nowcast.nc" ID="x" urlPath="y" />
  <dataset name="DN001_forecast.nc" ID="x" urlPath="y" />
</catalog>
`;

describe("LINE_ID", () => {
  it("matches a San Diego line and not its Del Norte lookalike", () => {
    expect(LINE_ID.test("D0498")).toBe(true);
    expect(LINE_ID.test("DN001")).toBe(false);
    expect(LINE_ID.test("B0001")).toBe(false);
  });
});

describe("parseLineGeometry", () => {
  it("reads the coordinates out of the filename", () => {
    const lines = parseLineGeometry(REFRACTION_CATALOG);
    expect(lines.get("D0001")).toEqual({ lat: 32.53426, lon: -117.12917 });
  });

  it("keeps only this county's lines", () => {
    const lines = parseLineGeometry(REFRACTION_CATALOG);
    expect([...lines.keys()]).toEqual(["D0001", "D0002", "D0003"]);
  });

  it("raises on a name it cannot place rather than skipping it", () => {
    // The coordinates are separated by the longitude's own minus sign, so a
    // positive longitude has no separator. A skipped line is a line no beach
    // can bind and nobody can notice.
    expect(() =>
      parseLineGeometry(`<dataset name="D0009_32.53426+117.12917_ref.nc" />`),
    ).toThrow(/does not carry a lat\/lon pair/);
  });

  it("raises rather than writing an empty table", () => {
    expect(() => parseLineGeometry("<catalog></catalog>")).toThrow(
      /broken query, not a county with no coast/,
    );
  });
});

describe("parseForecastLines", () => {
  it("takes the forecast product and no other", () => {
    // The nowcast reaches backwards and the hindcast is 155 MB per line. A
    // line publishing one of those and no forecast is one this site cannot use.
    const lines = parseForecastLines(ALONGSHORE_CATALOG);
    expect([...lines].sort()).toEqual(["D0001", "D0002"]);
  });

  it("raises rather than writing an empty table", () => {
    expect(() => parseForecastLines("<catalog></catalog>")).toThrow(
      /broken query, not a model that stopped running/,
    );
  });
});

describe("buildTable", () => {
  const geometry = parseLineGeometry(REFRACTION_CATALOG);
  const publishing = parseForecastLines(ALONGSHORE_CATALOG);

  it("orders by line number, which is the publisher's own order", () => {
    expect(Object.keys(buildTable(geometry, publishing))).toEqual([
      "D0001",
      "D0002",
      "D0003",
    ]);
  });

  it("marks a line with geometry and no forecast rather than dropping it", () => {
    const table = buildTable(geometry, publishing);
    expect(table.D0003.delivers).toBe(false);
    expect(table.D0003.dead_note).toMatch(/geometry and nothing to read/);
    expect(table.D0001.delivers).toBe(true);
    expect(table.D0001).not.toHaveProperty("dead_note");
  });
});

describe("unplacedLines", () => {
  it("reports a line that is forecast and has no position", () => {
    // Readable and unbindable: this site could ask for its wave heights and
    // could not say which beach they belong to.
    const geometry = new Map([["D0001", { lat: 32.5, lon: -117.1 }]]);
    expect(unplacedLines(geometry, new Set(["D0001", "D0002"]))).toEqual([
      "D0002",
    ]);
  });

  it("is empty when every forecast line is placed", () => {
    const geometry = parseLineGeometry(REFRACTION_CATALOG);
    expect(
      unplacedLines(geometry, parseForecastLines(ALONGSHORE_CATALOG)),
    ).toEqual([]);
  });
});

describe("document", () => {
  const geometry = parseLineGeometry(REFRACTION_CATALOG);
  const publishing = parseForecastLines(ALONGSHORE_CATALOG);
  const table = buildTable(geometry, publishing);

  it("stamps the date where the beaches are, not where the runner is", () => {
    // 5pm Pacific on the 18th is the 19th in UTC, and a file claiming to be
    // generated on a day that has not started in the county it describes is
    // the drift issue #85 records.
    const doc = document(table, [], new Date("2026-08-19T05:00:00Z"));
    expect(doc.generated).toBe("2026-08-18");
  });

  it("counts what was measured rather than asserting it", () => {
    const doc = document(table, [], new Date("2026-08-26T12:00:00Z"));
    expect(doc._what_was_measured).toContain("3 San Diego lines");
    expect(doc._what_was_measured).toContain("2 of them publishing a forecast");
  });

  it("says nothing about unplaced lines when there are none", () => {
    const doc = document(table, [], new Date("2026-08-26T12:00:00Z"));
    expect(doc.unresolved.join(" ")).not.toContain("not placed");
  });

  it("names the unplaced lines when there are some", () => {
    const doc = document(table, ["D0900"], new Date("2026-08-26T12:00:00Z"));
    expect(doc.unresolved.join(" ")).toContain("D0900");
  });

  it("carries the water-class refusal into the table's own caveats", () => {
    // The refusal is a property of what a MOP line is, so it is recorded where
    // the lines are recorded and not only in the join that applies it.
    const doc = document(table, [], new Date("2026-08-26T12:00:00Z"));
    expect(doc.unresolved.join(" ")).toMatch(
      /bay, lagoon or sheltered beach binds no/,
    );
  });
});
