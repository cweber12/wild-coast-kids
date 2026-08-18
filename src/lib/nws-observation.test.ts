import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  NwsObservationDriftError,
  NwsObservationNoDataError,
  parseNwsObservation,
} from "./nws-observation";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(process.cwd(), "src/lib/__fixtures__", name), "utf8"),
  );

/** What KNKX served on 2026-08-18, byte for byte. The station la-jolla-shores-beach binds to. */
const KNKX = fixture("nws-knkx-observation-20260818.json");

/**
 * What D3101 served on the same day: the nearest station to that same beach,
 * answering with nulls. This is the shape the join exists to exclude, kept as a
 * fixture because a bound station can fall into it later.
 */
const D3101 = fixture("nws-d3101-observation-20260818.json");

/** A payload built from KNKX's, with one field replaced. */
function withField(field: string, replacement: unknown): unknown {
  const base = KNKX as { properties: Record<string, unknown> };
  return {
    ...base,
    properties: { ...base.properties, [field]: replacement },
  };
}

describe("against the captured payload", () => {
  test("reads the observation's own instant, offset included", () => {
    const observation = parseNwsObservation(KNKX, "KNKX");
    // "2026-08-18T04:55:00+00:00". This payload carries its offset, unlike
    // CO-OPS, which carries none, and NDBC, which carries none and means UTC.
    expect(observation.atMs).toBe(Date.UTC(2026, 7, 18, 4, 55));
  });

  test("converts visibility out of the metres NWS publishes", () => {
    const observation = parseNwsObservation(KNKX, "KNKX");
    // 16090 m
    expect(observation.visibilityMi).toBeCloseTo(10.0, 2);
  });

  test("converts air temperature out of Celsius", () => {
    const observation = parseNwsObservation(KNKX, "KNKX");
    // 21.1 degC
    expect(observation.airTempF).toBeCloseTo(69.98, 2);
  });

  test("converts wind out of the km/h NWS publishes, not knots or mph", () => {
    const observation = parseNwsObservation(KNKX, "KNKX");
    // 9.36 km/h. Read as mph it would be 9.36; read as knots, 10.8. Both are
    // plausible-looking wind speeds, which is exactly why the unit is asserted.
    expect(observation.windMph).toBeCloseTo(5.82, 2);
    expect(observation.windDirDegT).toBe(320);
  });

  test("keeps the station's own plain-words sky", () => {
    expect(parseNwsObservation(KNKX, "KNKX").sky).toBe("Clear");
  });
});

describe("the ten-mile ceiling", () => {
  test("16090 m is flagged as the ceiling, not reported as an exact ten miles", () => {
    // METAR stops at ten statute miles, so the top of the range is a floor.
    expect(parseNwsObservation(KNKX, "KNKX").visibilityAtCeiling).toBe(true);
  });

  test("the other spelling of the ceiling is flagged too", () => {
    // Nine stations publish the cap; some as 16090, some as 16093.44. Testing
    // equality against one would let the other render as a measurement.
    const exact = withField("visibility", {
      unitCode: "wmoUnit:m",
      value: 16093.44,
      qualityControl: "C",
    });
    expect(parseNwsObservation(exact, "KSAN").visibilityAtCeiling).toBe(true);
  });

  test("a reading below the ceiling is a measurement", () => {
    // KOKB published 12874.75 m on the same morning: eight miles, and real.
    const below = withField("visibility", {
      unitCode: "wmoUnit:m",
      value: 12874.75,
      qualityControl: "C",
    });
    const observation = parseNwsObservation(below, "KOKB");
    expect(observation.visibilityAtCeiling).toBe(false);
    expect(observation.visibilityMi).toBeCloseTo(8.0, 2);
  });
});

describe("missing values", () => {
  test("a null value is absent, never a zero", () => {
    // KNKX published no gust that hour. Read as 0 this would say "calm".
    expect(parseNwsObservation(KNKX, "KNKX").gustMph).toBeNull();
  });

  test("a station answering with nulls yields nulls, not a clear calm day", () => {
    // D3101 is nearer la-jolla-shores-beach than KNKX and publishes no
    // visibility at all. The join excludes it; the parser must not invent one.
    const observation = parseNwsObservation(D3101, "D3101");
    expect(observation.visibilityMi).toBeNull();
    expect(observation.visibilityAtCeiling).toBe(false);
    expect(observation.airTempF).toBeCloseTo(69.998, 2);
  });

  test("an empty textDescription is no sky, not a sky", () => {
    // D3101 serves "". Rendered as a sky it would read as an answer.
    expect(parseNwsObservation(D3101, "D3101").sky).toBeNull();
  });

  test("a station with nothing in any field is no data", () => {
    const empty = {
      properties: {
        timestamp: "2026-08-18T04:55:00+00:00",
        textDescription: "",
        visibility: { unitCode: "wmoUnit:m", value: null },
        temperature: { unitCode: "wmoUnit:degC", value: null },
        windSpeed: { unitCode: "wmoUnit:km_h-1", value: null },
        windGust: { unitCode: "wmoUnit:km_h-1", value: null },
        windDirection: { unitCode: "wmoUnit:degree_(angle)", value: null },
      },
    };
    expect(() => parseNwsObservation(empty, "D3101")).toThrow(
      NwsObservationNoDataError,
    );
  });
});

describe("refusals", () => {
  test("a changed unit is drift, not a conversion to attempt", () => {
    const feet = withField("visibility", {
      unitCode: "wmoUnit:ft",
      value: 52789,
      qualityControl: "C",
    });
    expect(() => parseNwsObservation(feet, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });

  test("wind published in knots is refused rather than shown as mph", () => {
    // The failure this prevents does not look like an error. It looks like a
    // breezier day.
    const knots = withField("windSpeed", {
      unitCode: "wmoUnit:kn",
      value: 9.36,
      qualityControl: "V",
    });
    expect(() => parseNwsObservation(knots, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });

  test("a field that disappeared is drift, not a missing reading", () => {
    const base = KNKX as { properties: Record<string, unknown> };
    const gone = { ...base, properties: { ...base.properties } };
    delete (gone.properties as Record<string, unknown>).visibility;
    expect(() => parseNwsObservation(gone, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });

  test("a payload with no properties is refused", () => {
    expect(() => parseNwsObservation({ id: "x" }, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });

  test("an unparseable timestamp is refused rather than dated now", () => {
    const bad = withField("timestamp", "the eighteenth");
    expect(() => parseNwsObservation(bad, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });
});

describe("refusals, continued", () => {
  test("a measurement that is not an object is drift", () => {
    const scalar = withField("temperature", 21.1);
    expect(() => parseNwsObservation(scalar, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });

  test("a non-numeric value is drift, not a missing reading", () => {
    const text = withField("temperature", {
      unitCode: "wmoUnit:degC",
      value: "twenty-one",
    });
    expect(() => parseNwsObservation(text, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });

  test("a missing timestamp is refused rather than dated now", () => {
    const undated = withField("timestamp", null);
    expect(() => parseNwsObservation(undated, "KNKX")).toThrow(
      NwsObservationDriftError,
    );
  });
});
