import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  NdbcDriftError,
  NdbcNoDataError,
  parseNdbcAirObservation,
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

/**
 * What LJAC1, the Scripps Pier station, served on 2026-08-18 -- the header and
 * the newest twenty rows, contiguous and unmodified. Six of the twenty carry no
 * `ATMP`, which is the whole reason the air reading exists separately from the
 * wave one.
 */
const PIER = readFileSync(
  join(process.cwd(), "src/lib/__fixtures__/ndbc-ljac1-realtime2-20260818.txt"),
  "utf8",
);

const PIER_HEADER = PIER.split("\n").slice(0, 2).join("\n");

/** A data row on the real 19-column layout, so only the values under test vary. */
const pierRow = (
  time: string,
  { wdir = "MM", wspd = "MM", gst = "MM", atmp = "MM" },
) =>
  `${time} ${wdir}  ${wspd}  ${gst}    MM    MM    MM  MM 1012.3  ${atmp}  18.2    MM   MM   MM    MM`;

describe("the air reading, against the captured pier payload", () => {
  test("reads temperature and wind from the newest row that carries them", () => {
    const observation = parseNdbcAirObservation(PIER, "LJAC1");

    // Row 0: 2026-08-19 02:30 UTC, 21.9 degC, 3.6 m/s from 320 degrees.
    expect(observation.airTemp).toEqual({
      celsius: 21.9,
      atMs: Date.UTC(2026, 7, 19, 2, 30),
    });
    expect(observation.wind?.speedMps).toBe(3.6);
    expect(observation.wind?.dirDegT).toBe(320);
    expect(observation.wind?.gustMps).toBe(4.6);
    expect(observation.wind?.atMs).toBe(Date.UTC(2026, 7, 19, 2, 30));
  });

  test("leaves the values in the units NDBC published them in", () => {
    // Conversion is the caller's, so the drift assertion above and the
    // conversion stay in one place each. m/s here, mph at the panel.
    const observation = parseNdbcAirObservation(PIER, "LJAC1");
    expect(observation.wind?.speedMps).toBeLessThan(10);
    expect(observation.airTemp?.celsius).toBeLessThan(50);
  });
});

describe("the air reading, per field", () => {
  test("takes the temperature from an older row when the newest has none", () => {
    // The case the whole interface exists for. Row 0 carries wind and no
    // temperature, which happens on about a third of this station's rows.
    const text = [
      PIER_HEADER,
      pierRow("2026 08 19 02 30", { wdir: "320", wspd: "3.6", gst: "4.6" }),
      pierRow("2026 08 19 02 24", { wdir: "320", wspd: "3.1", gst: "4.1" }),
      pierRow("2026 08 19 01 00", {
        wdir: "310",
        wspd: "3.6",
        gst: "4.1",
        atmp: "23.4",
      }),
      "",
    ].join("\n");

    const observation = parseNdbcAirObservation(text, "LJAC1");

    expect(observation.wind?.atMs).toBe(Date.UTC(2026, 7, 19, 2, 30));
    expect(observation.airTemp).toEqual({
      celsius: 23.4,
      atMs: Date.UTC(2026, 7, 19, 1, 0),
    });
  });

  test("keeps a gust with the speed it gusted from, not with the newest row", () => {
    // A gust pulled off a different row than its speed is a number about
    // nothing. Wind is one reading of one row.
    const text = [
      PIER_HEADER,
      pierRow("2026 08 19 02 30", { atmp: "21.9" }),
      pierRow("2026 08 19 02 00", { wdir: "310", wspd: "4.1", gst: "4.6" }),
      "",
    ].join("\n");

    const observation = parseNdbcAirObservation(text, "LJAC1");

    expect(observation.wind).toEqual({
      speedMps: 4.1,
      gustMps: 4.6,
      dirDegT: 310,
      atMs: Date.UTC(2026, 7, 19, 2, 0),
    });
  });

  test("a wind with no direction is still a wind", () => {
    // LJAC1 leaves WDIR missing on about 6% of rows while WSPD is present.
    // Waiting for a row with both would age the speed for no reason.
    const text = [
      PIER_HEADER,
      pierRow("2026 08 19 00 48", { wspd: "0.0", gst: "0.5" }),
      "",
    ].join("\n");

    const observation = parseNdbcAirObservation(text, "LJAC1");

    expect(observation.wind?.speedMps).toBe(0);
    expect(observation.wind?.dirDegT).toBeNull();
  });

  test("no temperature anywhere is null, not an exception", () => {
    // LJPC1 publishes wind on every row and ATMP on none of them. It is a
    // usable wind station and an unusable temperature one, and the reading has
    // to be able to say so.
    const text = [
      PIER_HEADER,
      pierRow("2026 08 19 02 30", { wdir: "320", wspd: "3.6" }),
      "",
    ].join("\n");

    const observation = parseNdbcAirObservation(text, "LJPC1");

    expect(observation.airTemp).toBeNull();
    expect(observation.wind?.speedMps).toBe(3.6);
  });

  test("neither temperature nor wind anywhere is no data, not a still day", () => {
    // SDBC1 answers with ten thousand rows of water temperature and no air at
    // all. Returning two nulls would render as a calm, temperatureless beach.
    const text = [
      PIER_HEADER,
      pierRow("2026 08 19 02 30", {}),
      pierRow("2026 08 19 02 24", {}),
      "",
    ].join("\n");

    expect(() => parseNdbcAirObservation(text, "SDBC1")).toThrow(
      NdbcNoDataError,
    );
    expect(() => parseNdbcAirObservation(text, "SDBC1")).toThrow(
      /not observing the air/,
    );
  });

  test("headers and no rows is no data", () => {
    expect(() => parseNdbcAirObservation(`${PIER_HEADER}\n`, "LJAC1")).toThrow(
      NdbcNoDataError,
    );
  });
});

describe("the air reading pins its own columns", () => {
  test("a temperature published in Fahrenheit is drift, not a hot day", () => {
    // ATMP is column 14 of 19. Replaced by position for the same reason the
    // wave test does it: "degC" appears twice on the units line, and a loose
    // match rewrites water temperature instead.
    const [names, units] = PIER_HEADER.split("\n");
    const fields = units.slice(1).trim().split(/\s+/);
    fields[13] = "degF";
    const inFahrenheit = [names, `#${fields.join(" ")}`].join("\n");

    expect(() =>
      parseNdbcAirObservation(
        [
          inFahrenheit,
          pierRow("2026 08 19 02 30", { wspd: "3.6", atmp: "71.4" }),
          "",
        ].join("\n"),
        "LJAC1",
      ),
    ).toThrow(/published in "degF"/);
  });

  test("a wind speed published in knots is drift", () => {
    const [names, units] = PIER_HEADER.split("\n");
    const fields = units.slice(1).trim().split(/\s+/);
    fields[6] = "kt";
    const inKnots = [names, `#${fields.join(" ")}`].join("\n");

    expect(() =>
      parseNdbcAirObservation(
        [inKnots, pierRow("2026 08 19 02 30", { wspd: "7.0" }), ""].join("\n"),
        "LJAC1",
      ),
    ).toThrow(NdbcDriftError);
  });

  test("a shifted column layout is refused rather than read by position", () => {
    expect(() =>
      parseNdbcAirObservation("2026 08 19 02 30 320 3.6\n", "LJAC1"),
    ).toThrow(NdbcDriftError);
  });

  test("an unparseable timestamp on the row a value came from is refused", () => {
    // The air reading times each field from its own row, so a row that carries
    // a good temperature and an unreadable clock cannot be half-used: there
    // would be no instant to age it against.
    const text = [
      PIER_HEADER,
      pierRow("year 08 19 02 30", { wspd: "3.6", atmp: "21.9" }),
      "",
    ].join("\n");

    expect(() => parseNdbcAirObservation(text, "LJAC1")).toThrow(
      /timestamp fields did not parse/,
    );
  });

  test("a non-numeric temperature is drift, not a missing value", () => {
    // `MM` is the missing marker and everything else in the column is supposed
    // to be a number. Treating an unexpected token as absent would hide a
    // format change behind a panel that simply says nothing.
    const text = [
      PIER_HEADER,
      pierRow("2026 08 19 02 30", { wspd: "3.6", atmp: "warm" }),
      "",
    ].join("\n");

    expect(() => parseNdbcAirObservation(text, "LJAC1")).toThrow(
      /ATMP was "warm", not a number/,
    );
  });

  test("the wave reading still asserts only its own units", () => {
    // The two readings share the header check, so an air unit changing must not
    // start failing the wave reading -- which does not convert ATMP at all.
    const [names, units] = PIER_HEADER.split("\n");
    const fields = units.slice(1).trim().split(/\s+/);
    fields[13] = "degF";
    const airDrift = [names, `#${fields.join(" ")}`].join("\n");
    const row =
      "2026 08 19 02 30 320  3.6  4.6   0.8     5   4.6 278 1012.3  71.4  18.2    MM   MM   MM    MM";

    expect(() =>
      parseNdbcRealtime2([airDrift, row, ""].join("\n"), "LJAC1"),
    ).not.toThrow();
  });
});
