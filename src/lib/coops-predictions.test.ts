import { describe, expect, test } from "vitest";
import capturedPayload from "./__fixtures__/coops-9410230-hilo-20260817.json";
import capturedHourlyPayload from "./__fixtures__/coops-9410230-hourly-20260828.json";
import {
  coopsHourlyUrl,
  coopsPredictionsUrl,
  CoopsDriftError,
  CoopsUpstreamError,
  parseCoopsHiLo,
  parseCoopsHourly,
  type CoopsRequestContract,
} from "./coops-predictions";
import { localDateOf, localTimeOf } from "./pacific-time";

const CONTRACT: CoopsRequestContract = {
  stationId: "9410230",
  beginDate: "20260817",
  endDate: "20260818",
};

/** The window `predictionsWindow` asks for, which is what the hourly capture covers. */
const HOURLY_CONTRACT: CoopsRequestContract = {
  stationId: "9410230",
  beginDate: "20260827",
  endDate: "20260905",
};

/**
 * The committed payload, exactly as NOAA served it on 2026-08-17. It is excluded
 * from the formatter so the file stays a record of the endpoint rather than of
 * our tooling; reading it back through the parser is what makes it evidence.
 */
function fixture(): unknown {
  return capturedPayload;
}

/** The hourly capture, on the same terms. Served 2026-08-28. */
function hourlyFixture(): unknown {
  return capturedHourlyPayload;
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

describe("coopsHourlyUrl", () => {
  test("pins the same three facts the payload cannot state", () => {
    const url = new URL(coopsHourlyUrl(HOURLY_CONTRACT));
    expect(url.searchParams.get("time_zone")).toBe("gmt");
    expect(url.searchParams.get("units")).toBe("english");
    expect(url.searchParams.get("datum")).toBe("MLLW");
  });

  test("asks for hourly heights and identifies this site", () => {
    const url = new URL(coopsHourlyUrl(HOURLY_CONTRACT));
    expect(url.searchParams.get("interval")).toBe("h");
    expect(url.searchParams.get("product")).toBe("predictions");
    expect(url.searchParams.get("station")).toBe("9410230");
    expect(url.searchParams.get("application")).toBe("wild-coast-kids");
    expect(url.searchParams.get("begin_date")).toBe("20260827");
    expect(url.searchParams.get("end_date")).toBe("20260905");
  });

  test("differs from the high/low request in the interval and nothing else", () => {
    // The two requests are one product at two resolutions. If they ever differ
    // in a datum, a zone or a unit, one of the two series is being read against
    // a fact the other does not share -- which is a wrong number rather than an
    // error, and is what this comparison exists to catch.
    const hourly = new URL(coopsHourlyUrl(CONTRACT)).searchParams;
    const hilo = new URL(coopsPredictionsUrl(CONTRACT)).searchParams;

    const differing = [...hourly.keys()].filter(
      (key) => hourly.get(key) !== hilo.get(key),
    );
    expect(differing).toEqual(["interval"]);
    expect([...hourly.keys()].sort()).toEqual([...hilo.keys()].sort());
  });
});

describe("parseCoopsHourly, against the captured payload", () => {
  test("reads every hour NOAA served, as feet above MLLW", () => {
    const heights = parseCoopsHourly(hourlyFixture(), HOURLY_CONTRACT);

    // Ten days on the hour, which is the window this page asks for.
    expect(heights).toHaveLength(240);
    expect(heights.every((h) => Number.isFinite(h.feet))).toBe(true);

    // The first row, read straight off the committed bytes: "2026-08-27 00:00"
    // GMT at 3.157 ft, which is 5:00 PM on 2026-08-26 in California. A row that
    // came back in feet rather than metres is the units pin holding -- 3.157
    // metres of tide does not happen on this coast.
    expect(heights[0].feet).toBe(3.157);
    expect(localDateOf(heights[0].atMs)).toBe("2026-08-26");
    expect(localTimeOf(heights[0].atMs)).toBe("5:00 PM");
  });

  test("the heights fall on the hour, an hour apart, with no gaps", () => {
    const heights = parseCoopsHourly(hourlyFixture(), HOURLY_CONTRACT);
    const steps = new Set(
      heights.slice(1).map((h, i) => h.atMs - heights[i].atMs),
    );
    expect([...steps]).toEqual([3_600_000]);
  });

  test("a negative height survives, because MLLW is what makes it mean something", () => {
    const heights = parseCoopsHourly(hourlyFixture(), HOURLY_CONTRACT);
    // "2026-08-27 11:00" GMT is -0.147 ft in the committed bytes. A parser that
    // coerced or clamped would turn the lowest hour of the week into zero.
    expect(heights.some((h) => h.feet < 0)).toBe(true);
    expect(Math.min(...heights.map((h) => h.feet))).toBeCloseTo(-0.147, 3);
  });

  test("it reads no kind, because an hourly row is not a turning point", () => {
    const heights = parseCoopsHourly(hourlyFixture(), HOURLY_CONTRACT);
    expect(Object.keys(heights[0]).sort()).toEqual(["atMs", "feet"]);
  });
});

describe("parseCoopsHourly refusals", () => {
  test("an error under HTTP 200 is an upstream error, not a payload", () => {
    expect(() =>
      parseCoopsHourly(
        { error: { message: "No Predictions data was found." } },
        HOURLY_CONTRACT,
      ),
    ).toThrow(CoopsUpstreamError);
  });

  test("a missing predictions array is drift", () => {
    expect(() => parseCoopsHourly({}, HOURLY_CONTRACT)).toThrow(
      CoopsDriftError,
    );
  });

  test("an empty range is drift, because predictions are astronomical", () => {
    expect(() =>
      parseCoopsHourly({ predictions: [] }, HOURLY_CONTRACT),
    ).toThrow(/not a flat tide/);
  });

  test("a malformed row raises rather than being skipped", () => {
    // Skipping would leave a hole in the series, and a curve drawn across a
    // hole is a claim about hours nobody published. One bad row out of three
    // takes the whole read, which is what sends the reader a stated outage
    // instead of a confident wrong shape.
    const withOneBadRow = {
      predictions: [
        { t: "2026-08-27 00:00", v: "3.157" },
        { t: "2026-08-27 01:00", v: "shallow" },
        { t: "2026-08-27 02:00", v: "5.148" },
      ],
    };
    expect(() => parseCoopsHourly(withOneBadRow, HOURLY_CONTRACT)).toThrow(
      /is not a number/,
    );
  });

  test("an offsetless timestamp in another shape is refused rather than guessed", () => {
    expect(() =>
      parseCoopsHourly(
        { predictions: [{ t: "2026-08-27T00:00:00Z", v: "3.157" }] },
        HOURLY_CONTRACT,
      ),
    ).toThrow(/Refusing to guess what clock it is on/);
  });

  test("a row that is not an object is drift", () => {
    expect(() =>
      parseCoopsHourly({ predictions: ["3.157"] }, HOURLY_CONTRACT),
    ).toThrow(CoopsDriftError);
  });

  test("a non-object payload is drift", () => {
    expect(() => parseCoopsHourly("nope", HOURLY_CONTRACT)).toThrow(
      CoopsDriftError,
    );
    expect(() => parseCoopsHourly(null, HOURLY_CONTRACT)).toThrow(
      CoopsDriftError,
    );
  });
});
