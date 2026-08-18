import { describe, expect, test } from "vitest";
import capturedPayload from "./__fixtures__/coops-9410230-hilo-20260817.json";
import {
  coopsPredictionsUrl,
  CoopsDriftError,
  CoopsUpstreamError,
  parseCoopsHiLo,
  type CoopsRequestContract,
} from "./coops-predictions";
import { localDateOf, localTimeOf } from "./pacific-time";

const CONTRACT: CoopsRequestContract = {
  stationId: "9410230",
  beginDate: "20260817",
  endDate: "20260818",
};

/**
 * The committed payload, exactly as NOAA served it on 2026-08-17. It is excluded
 * from the formatter so the file stays a record of the endpoint rather than of
 * our tooling; reading it back through the parser is what makes it evidence.
 */
function fixture(): unknown {
  return capturedPayload;
}

describe("coopsPredictionsUrl", () => {
  test("pins the three facts the payload cannot state", () => {
    const url = new URL(coopsPredictionsUrl(CONTRACT));
    expect(url.searchParams.get("time_zone")).toBe("gmt");
    expect(url.searchParams.get("units")).toBe("english");
    expect(url.searchParams.get("datum")).toBe("MLLW");
  });

  test("asks for turning points and identifies this site", () => {
    const url = new URL(coopsPredictionsUrl(CONTRACT));
    expect(url.searchParams.get("interval")).toBe("hilo");
    expect(url.searchParams.get("product")).toBe("predictions");
    expect(url.searchParams.get("station")).toBe("9410230");
    expect(url.searchParams.get("application")).toBe("wild-coast-kids");
    expect(url.searchParams.get("begin_date")).toBe("20260817");
    expect(url.searchParams.get("end_date")).toBe("20260818");
  });
});

describe("parseCoopsHiLo, against the captured payload", () => {
  test("reads every row NOAA served", () => {
    const extremes = parseCoopsHiLo(fixture(), CONTRACT);
    expect(extremes).toHaveLength(8);
    expect(extremes.filter((e) => e.kind === "low")).toHaveLength(4);
    expect(extremes.filter((e) => e.kind === "high")).toHaveLength(4);
  });

  test("the timestamps are UTC, which is what makes the Pacific conversion right", () => {
    const extremes = parseCoopsHiLo(fixture(), CONTRACT);

    // The National Weather Service surf zone forecast issued 2026-08-17 quotes La
    // Jolla for 2026-08-18 at 3.4 ft 01:29 AM, 2.0 ft 06:47 AM, 4.9 ft 01:41 PM.
    // These are the same three instants out of NOAA's GMT rows. Two independent
    // products agreeing is the check; a seven-hour offset error would break it.
    const byLocal = extremes.map((e) => ({
      date: localDateOf(e.atMs),
      time: localTimeOf(e.atMs),
      feet: e.feet,
      kind: e.kind,
    }));

    expect(byLocal).toEqual(
      expect.arrayContaining([
        { date: "2026-08-18", time: "1:29 AM", feet: 3.447, kind: "high" },
        { date: "2026-08-18", time: "6:47 AM", feet: 2.006, kind: "low" },
        { date: "2026-08-18", time: "1:41 PM", feet: 4.938, kind: "high" },
      ]),
    );
  });

  test("a GMT row can belong to the previous Pacific day", () => {
    const extremes = parseCoopsHiLo(fixture(), CONTRACT);
    // "2026-08-17 01:41" GMT is 6:41 PM on 2026-08-16 in California. Treating the
    // GMT date as the local date would file this low under the wrong day.
    const first = extremes[0];
    expect(first.kind).toBe("low");
    expect(localDateOf(first.atMs)).toBe("2026-08-16");
    expect(localTimeOf(first.atMs)).toBe("6:41 PM");
  });
});

describe("parseCoopsHiLo refusals", () => {
  test("an error under HTTP 200 is an upstream error, not a payload", () => {
    expect(() =>
      parseCoopsHiLo(
        { error: { message: "No Predictions data was found." } },
        CONTRACT,
      ),
    ).toThrow(CoopsUpstreamError);
  });

  test("an error with no message still names the station", () => {
    expect(() => parseCoopsHiLo({ error: null }, CONTRACT)).toThrow(/9410230/);
  });

  test("a missing predictions array is drift", () => {
    expect(() => parseCoopsHiLo({}, CONTRACT)).toThrow(CoopsDriftError);
  });

  test("an empty range is drift, because predictions are astronomical", () => {
    expect(() => parseCoopsHiLo({ predictions: [] }, CONTRACT)).toThrow(
      /not a flat tide/,
    );
  });

  test("a non-object payload is drift", () => {
    expect(() => parseCoopsHiLo("nope", CONTRACT)).toThrow(CoopsDriftError);
    expect(() => parseCoopsHiLo(null, CONTRACT)).toThrow(CoopsDriftError);
  });

  test("a row that is not an object is drift", () => {
    expect(() => parseCoopsHiLo({ predictions: ["1.4"] }, CONTRACT)).toThrow(
      CoopsDriftError,
    );
  });

  test("an offsetless timestamp in another shape is refused rather than guessed", () => {
    expect(() =>
      parseCoopsHiLo(
        { predictions: [{ t: "2026-08-17T13:24:00Z", v: "1.368", type: "L" }] },
        CONTRACT,
      ),
    ).toThrow(/Refusing to guess what clock it is on/);
  });

  test("a non-string timestamp is drift", () => {
    expect(() =>
      parseCoopsHiLo(
        { predictions: [{ t: 1755400000, v: "1.368", type: "L" }] },
        CONTRACT,
      ),
    ).toThrow(/not a string/);
  });

  test("an unknown type code is drift", () => {
    expect(() =>
      parseCoopsHiLo(
        { predictions: [{ t: "2026-08-17 13:24", v: "1.368", type: "X" }] },
        CONTRACT,
      ),
    ).toThrow(/neither "H" nor "L"/);
  });

  test("a height that is not a number is drift", () => {
    expect(() =>
      parseCoopsHiLo(
        { predictions: [{ t: "2026-08-17 13:24", v: "shallow", type: "L" }] },
        CONTRACT,
      ),
    ).toThrow(/is not a number/);
    expect(() =>
      parseCoopsHiLo(
        { predictions: [{ t: "2026-08-17 13:24", v: 1.368, type: "L" }] },
        CONTRACT,
      ),
    ).toThrow(/not a string/);
  });
});
