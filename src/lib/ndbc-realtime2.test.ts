import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  NdbcDriftError,
  NdbcNoDataError,
  parseNdbcRealtime2,
} from "./ndbc-realtime2";

/**
 * What buoy 46254 served on 2026-08-18, byte for byte. Read from disk rather
 * than imported so the test exercises the text as published; the fixture is
 * excluded from the formatter for the same reason.
 */
const CAPTURED = readFileSync(
  join(process.cwd(), "src/lib/__fixtures__/ndbc-46254-realtime2.txt"),
  "utf8",
);

const HEADER = CAPTURED.split("\n").slice(0, 2).join("\n");

describe("against the captured payload", () => {
  test("reads the newest observation, which is the first row", () => {
    const observation = parseNdbcRealtime2(CAPTURED, "46254");

    // 2026-08-18 03:26 UTC, the top row. The last row is three hours older, and
    // NDBC serves newest-first -- the opposite of CO-OPS.
    expect(observation.atMs).toBe(Date.UTC(2026, 7, 18, 3, 26));
  });

  test("converts wave height out of the metres NDBC publishes", () => {
    const observation = parseNdbcRealtime2(CAPTURED, "46254");
    // 0.8 m
    expect(observation.heightFt).toBeCloseTo(2.62, 2);
  });

  test("converts water temperature out of Celsius", () => {
    const observation = parseNdbcRealtime2(CAPTURED, "46254");
    // 21.1 degC
    expect(observation.waterTempF).toBeCloseTo(69.98, 2);
  });

  test("keeps period and direction as published", () => {
    const observation = parseNdbcRealtime2(CAPTURED, "46254");
    expect(observation.periodS).toBe(5);
    expect(observation.directionDegT).toBe(278);
  });
});

describe("missing values", () => {
  test("MM is absent, never a number", () => {
    // Every nearshore buoy in this corridor leaves wind and visibility MM on
    // every row. Reading MM as a number would report a dead calm coastline.
    const observation = parseNdbcRealtime2(CAPTURED, "46254");
    expect(observation).not.toHaveProperty("windKt");
    expect(Number.isFinite(observation.heightFt)).toBe(true);
  });

  test("a row with no wave height is no data, not a flat sea", () => {
    const text = `${HEADER}\n2026 08 18 03 26  MM   MM   MM    MM     5   4.6 278     MM    MM  21.1    MM   MM   MM    MM\n`;
    expect(() => parseNdbcRealtime2(text, "46254")).toThrow(NdbcNoDataError);
    expect(() => parseNdbcRealtime2(text, "46254")).toThrow(
      /reporting, and not reporting waves/,
    );
  });

  test("a missing water temperature is null rather than an invented one", () => {
    const text = `${HEADER}\n2026 08 18 03 26  MM   MM   MM   0.8     5   4.6 278     MM    MM    MM    MM   MM   MM    MM\n`;
    expect(parseNdbcRealtime2(text, "46254").waterTempF).toBeNull();
  });
});

describe("refusals", () => {
  test("headers and no rows is a quiet buoy, not calm water", () => {
    expect(() => parseNdbcRealtime2(`${HEADER}\n`, "46254")).toThrow(
      NdbcNoDataError,
    );
  });

  test("a shifted column layout is refused rather than read by position", () => {
    const drifted = HEADER.replace("WVHT", "WVHZ");
    expect(() =>
      parseNdbcRealtime2(
        `${drifted}\n2026 08 18 03 26 MM MM MM 0.8 5 4.6 278 MM MM 21.1 MM MM MM MM\n`,
        "46254",
      ),
    ).toThrow(/column layout has drifted/);
  });

  test("a change of published units is refused rather than converted anyway", () => {
    // The payload states its own units on its second header line. If wave height
    // ever arrives in feet, converting from metres would report a third of the
    // real height. Replaced by field position rather than by pattern: the units
    // line also contains "m/s" twice, and a loose match rewrites wind speed
    // instead -- which this test did on its first run, and passed while
    // asserting nothing.
    const [names, units] = HEADER.split("\n");
    const fields = units.slice(1).trim().split(/\s+/);
    fields[8] = "ft";
    const inFeet = [names, `#${fields.join(" ")}`].join("\n");
    const row =
      "2026 08 18 03 26 MM MM MM 0.8 5 4.6 278 MM MM 21.1 MM MM MM MM";

    expect(() =>
      parseNdbcRealtime2([inFeet, row, ""].join("\n"), "46254"),
    ).toThrow(/published in "ft"/);
  });

  test("a payload with no header at all is drift", () => {
    expect(() => parseNdbcRealtime2("2026 08 18 03 26 MM\n", "46254")).toThrow(
      NdbcDriftError,
    );
  });

  test("an unparseable timestamp is refused", () => {
    const text = `${HEADER}\nyear 08 18 03 26  MM   MM   MM   0.8     5   4.6 278     MM    MM  21.1    MM   MM   MM    MM\n`;
    expect(() => parseNdbcRealtime2(text, "46254")).toThrow(
      /timestamp fields did not parse/,
    );
  });
});
