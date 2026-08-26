import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  MopDriftError,
  MopNoDataError,
  parseMopForecast,
} from "./mop-forecast";

/**
 * A real response, saved on 2026-08-26: D0481, the line La Jolla Cove binds,
 * over the week the grid covers. 56 three-hourly rows, every one flagged good.
 *
 * The path is resolved from the working directory rather than `import.meta.url`,
 * which is not a `file:` URL under this test environment.
 */
const FIXTURE = readFileSync(
  join(
    process.cwd(),
    "src",
    "lib",
    "__fixtures__",
    "mop-d0481-forecast-20260826.csv",
  ),
  "utf8",
);

const HEADER =
  'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],' +
  'waveHs[unit="meter"],waveTp[unit="second"],waveDp[unit="degreeT"],waveFlagPrimary';

const row = (overrides: Partial<Record<string, string>> = {}) => {
  const fields = {
    time: "2026-08-26T00:00:00Z",
    station: "D0481",
    latitude: "32.851",
    longitude: "-117.273",
    waveHs: "0.48994595",
    waveTp: "16.666668",
    waveDp: "339.82608",
    waveFlagPrimary: "1",
    ...overrides,
  };
  return Object.values(fields).join(",");
};

const payload = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parseMopForecast", () => {
  test("reads every good row of a real response", () => {
    const forecast = parseMopForecast(FIXTURE, "D0481");
    expect(forecast.lineId).toBe("D0481");
    expect(forecast.rows).toHaveLength(56);
    expect(forecast.flaggedOut).toBe(0);
  });

  test("converts the metres CDIP publishes into the feet the page renders", () => {
    // 0.48994595 m. Read as feet it would be a fifth of what it is, which is
    // the whole reason the unit is asserted rather than assumed.
    const [first] = parseMopForecast(FIXTURE, "D0481").rows;
    expect(first.heightFt).toBeCloseTo(1.607, 3);
  });

  test("keeps the rows in the order the service serves them, oldest first", () => {
    const { rows } = parseMopForecast(FIXTURE, "D0481");
    expect(rows[0].atMs).toBe(Date.parse("2026-08-26T00:00:00Z"));
    expect(rows.at(-1)!.atMs).toBe(Date.parse("2026-09-01T21:00:00Z"));
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].atMs).toBeGreaterThan(rows[i - 1].atMs);
    }
  });

  test("carries period and direction through unconverted", () => {
    const [first] = parseMopForecast(FIXTURE, "D0481").rows;
    expect(first.periodS).toBeCloseTo(16.666668, 6);
    expect(first.directionDegT).toBeCloseTo(339.82608, 5);
  });

  test("keeps flag 1 and drops the other four, counting what it dropped", () => {
    // The issue body asked for the opposite. `flag_meanings` on the variable
    // reads `good not_evaluated questionable bad missing` against
    // `flag_values: 1 2 3 4 9`, so rejecting 1 would have emptied the row at
    // every beach and looked like a dead feed.
    const forecast = parseMopForecast(
      payload(
        row({ waveFlagPrimary: "1" }),
        row({ time: "2026-08-26T03:00:00Z", waveFlagPrimary: "2" }),
        row({ time: "2026-08-26T06:00:00Z", waveFlagPrimary: "3" }),
        row({ time: "2026-08-26T09:00:00Z", waveFlagPrimary: "4" }),
        row({ time: "2026-08-26T12:00:00Z", waveFlagPrimary: "9" }),
      ),
      "D0481",
    );
    expect(forecast.rows).toHaveLength(1);
    expect(forecast.flaggedOut).toBe(4);
  });

  test("a run that is entirely flagged is a model failing, not a flat week", () => {
    // The dangerous direction: an empty row reads as an outage rather than as
    // the buoys driving the model being down.
    expect(() =>
      parseMopForecast(payload(row({ waveFlagPrimary: "4" })), "D0481"),
    ).toThrow(MopNoDataError);
    expect(() =>
      parseMopForecast(payload(row({ waveFlagPrimary: "4" })), "D0481"),
    ).toThrow(/flagged all 1 of its forecast rows/);
  });

  test("a header with no rows is a line that is not forecast", () => {
    expect(() => parseMopForecast(HEADER, "D0481")).toThrow(MopNoDataError);
    expect(() => parseMopForecast(HEADER, "D0481")).toThrow(
      /not a week with no waves in it/,
    );
  });

  test("refuses a payload with no header at all", () => {
    expect(() => parseMopForecast("", "D0481")).toThrow(MopDriftError);
  });

  test("refuses a reordered column layout rather than reading by position", () => {
    const swapped = HEADER.replace(
      'waveHs[unit="meter"],waveTp[unit="second"]',
      'waveTp[unit="second"],waveHs[unit="meter"]',
    );
    expect(() =>
      parseMopForecast([swapped, row()].join("\n"), "D0481"),
    ).toThrow(/column 4 is "waveTp" and should be "waveHs"/);
  });

  test("refuses a column header it cannot read as a name at all", () => {
    // NCSS declares a column as a name, optionally with its unit. Anything else
    // means the header format itself has changed, and every value after it
    // would be read by position against a layout nobody has checked.
    const mangled = HEADER.replace("waveFlagPrimary", "wave flag primary");
    expect(() =>
      parseMopForecast([mangled, row()].join("\n"), "D0481"),
    ).toThrow(/column 7 is declared as "wave flag primary"/);
  });

  test("refuses a column count that has changed", () => {
    expect(() =>
      parseMopForecast([`${HEADER},waveTa`, row()].join("\n"), "D0481"),
    ).toThrow(/expected 8 columns and the header declares 9/);
  });

  test("refuses a height published in another unit", () => {
    // Feet read as metres would be a swell three times its real size.
    const feet = HEADER.replace('waveHs[unit="meter"]', 'waveHs[unit="feet"]');
    expect(() => parseMopForecast([feet, row()].join("\n"), "D0481")).toThrow(
      /waveHs is published in "feet", not "meter"/,
    );
  });

  test("ignores a unit change on a column it does not convert", () => {
    // Latitude arrives with every point response and nothing reads it. Failing
    // the whole forecast for it would refuse a reading over a change that
    // cannot affect one.
    const moved = HEADER.replace("degrees_north", "degree_north");
    expect(() =>
      parseMopForecast([moved, row()].join("\n"), "D0481"),
    ).not.toThrow();
  });

  test("refuses a response about another line", () => {
    // The service answers per file, so this is a reading about another beach.
    expect(() =>
      parseMopForecast(payload(row({ station: "D0482" })), "D0481"),
    ).toThrow(/a row is for station "D0482"/);
  });

  test("refuses a timestamp that stopped saying which zone it is in", () => {
    // Reading an offset-less time as UTC would age the row by seven or eight
    // hours, which is the hazard ADR-0009 records for the feeds that do it.
    expect(() =>
      parseMopForecast(payload(row({ time: "2026-08-26T00:00:00" })), "D0481"),
    ).toThrow(/is not a UTC instant ending in Z/);
  });

  test("refuses a good row whose height is not a number", () => {
    // This feed has a flag for missing. A row that says good and serves a
    // non-number is contradicting itself, and guessing which half to believe
    // is how a wrong number gets published.
    expect(() =>
      parseMopForecast(payload(row({ waveHs: "NaN" })), "D0481"),
    ).toThrow(/waveHs was "NaN" on a row this feed flagged good/);
    expect(() =>
      parseMopForecast(payload(row({ waveTp: "" })), "D0481"),
    ).toThrow(MopDriftError);
  });

  test("does not look at a flagged row's values at all", () => {
    // A row the flag rejects is dropped before its fields are read, so a bad
    // run cannot fail the read for a beach whose other rows are fine.
    const forecast = parseMopForecast(
      payload(
        row({ waveHs: "not-a-number", waveFlagPrimary: "9" }),
        row({ time: "2026-08-26T03:00:00Z" }),
      ),
      "D0481",
    );
    expect(forecast.rows).toHaveLength(1);
    expect(forecast.flaggedOut).toBe(1);
  });

  test("refuses a row with the wrong number of values", () => {
    expect(() =>
      parseMopForecast([HEADER, `${row()},99`].join("\n"), "D0481"),
    ).toThrow(/a row carries 9 values against 8 columns/);
  });
});
