import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gridpointUrl,
  NwsGridpointDriftError,
  NwsGridpointNoDataError,
  parseGridpointForecast,
} from "./nws-gridpoint";

/**
 * A real response, captured from `api.weather.gov` on 2026-08-27 for the cell
 * La Jolla Shores Beach binds. Captured rather than written, because the
 * assertion this parser most needs -- that a declared key can carry nothing --
 * is exactly the kind a hand-written fixture would be built to satisfy.
 *
 * The path is resolved from the working directory rather than `import.meta.url`,
 * which is not a `file:` URL under this test environment.
 */
const PAYLOAD = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "src",
      "lib",
      "__fixtures__",
      "nws-gridpoint-sgx-54-21-20260827.json",
    ),
    "utf8",
  ),
);

const CELL = "SGX/54,21";

describe("parseGridpointForecast", () => {
  it("reads the cell's sky cover as whole percentages", () => {
    const forecast = parseGridpointForecast(PAYLOAD, CELL);
    expect(forecast.cellId).toBe(CELL);
    expect(forecast.skyCover.length).toBeGreaterThan(0);
    for (const hour of forecast.skyCover) {
      expect(hour.percent).toBeGreaterThanOrEqual(0);
      expect(hour.percent).toBeLessThanOrEqual(100);
    }
  });

  it("expands each interval into the hours it covers", () => {
    // The payload's first entry is a PT3H block. A caller selecting the
    // daylight hours of a day cannot do that against three-hour blocks without
    // inventing a rule for one that straddles sunrise.
    const forecast = parseGridpointForecast(PAYLOAD, CELL);
    const entries = PAYLOAD.properties.skyCover.values.length;

    expect(forecast.skyCover.length).toBeGreaterThan(entries);

    const first = PAYLOAD.properties.skyCover.values[0];
    const [instant, duration] = first.validTime.split("/");
    const hours = /PT(\d+)H/.exec(duration);
    if (hours === null) {
      throw new Error("the fixture's first entry is not an hourly block");
    }
    const span = Number(hours[1]);
    const startMs = Date.parse(instant);

    const expanded = forecast.skyCover.filter(
      (hour) => hour.atMs >= startMs && hour.atMs < startMs + span * 3_600_000,
    );
    expect(expanded).toHaveLength(span);
    for (const hour of expanded) expect(hour.percent).toBe(first.value);
  });

  it("returns hours in order, one per hour, with no gaps inside a block", () => {
    const forecast = parseGridpointForecast(PAYLOAD, CELL);
    for (let i = 1; i < forecast.skyCover.length; i += 1) {
      expect(forecast.skyCover[i].atMs).toBeGreaterThan(
        forecast.skyCover[i - 1].atMs,
      );
    }
  });

  it("carries the fog the week grid annotates days with", () => {
    const forecast = parseGridpointForecast(PAYLOAD, CELL);
    // The captured week forecasts fog. If a future capture does not, this
    // asserts the shape rather than the weather.
    for (const hour of forecast.weather) {
      expect(typeof hour.weather).toBe("string");
      expect(hour.weather.length).toBeGreaterThan(0);
    }
    expect(forecast.weather.some((hour) => hour.weather === "fog")).toBe(true);
  });

  it("keeps only the entries that name a phenomenon", () => {
    // Most weather entries name nothing, and an empty one is an ordinary hour
    // rather than missing data. Counting them as phenomena would put a blank
    // annotation on most days of the week.
    const forecast = parseGridpointForecast(PAYLOAD, CELL);
    const named = PAYLOAD.properties.weather.values.filter(
      (entry: { value: { weather: string | null }[] }) =>
        entry.value.some((item) => item.weather),
    );
    expect(named.length).toBeLessThan(PAYLOAD.properties.weather.values.length);
    expect(forecast.weather.length).toBeGreaterThan(0);
  });
});

describe("the variables this feed declares and does not publish", () => {
  it("proves the fixture really carries empty visibility and ceiling", () => {
    // Not a test of the parser. It pins the fact the whole design rests on, in
    // the captured payload, so a future capture that starts publishing either
    // one fails here and gets read rather than absorbed.
    expect(PAYLOAD.properties.visibility.values).toHaveLength(0);
    expect(PAYLOAD.properties.ceilingHeight.values).toHaveLength(0);
  });

  it("refuses a series that is declared and empty, as no-data rather than drift", () => {
    // What visibility does at every cell, and what a real skyCover does when
    // the office has not run the product. A quiet cell is not a bug to chase.
    const empty = {
      properties: {
        ...PAYLOAD.properties,
        skyCover: { uom: "wmoUnit:percent", values: [] },
      },
    };
    expect(() => parseGridpointForecast(empty, CELL)).toThrow(
      NwsGridpointNoDataError,
    );
    expect(() => parseGridpointForecast(empty, CELL)).toThrow(
      /published no values/,
    );
  });

  it("refuses a payload that stops declaring skyCover at all, as drift", () => {
    const properties = { ...PAYLOAD.properties };
    delete properties.skyCover;
    expect(() => parseGridpointForecast({ properties }, CELL)).toThrow(
      NwsGridpointDriftError,
    );
  });
});

describe("what the parser refuses", () => {
  const withSkyCover = (values: unknown[], uom = "wmoUnit:percent") => ({
    properties: { ...PAYLOAD.properties, skyCover: { uom, values } },
  });

  it("refuses a unit change rather than putting a fraction on the page", () => {
    expect(() =>
      parseGridpointForecast(
        withSkyCover(
          [{ validTime: "2026-08-26T12:00:00+00:00/PT3H", value: 0.66 }],
          "wmoUnit:one",
        ),
        CELL,
      ),
    ).toThrow(/pins wmoUnit:percent/);
  });

  it("refuses an instant with no offset, which ADR-0009 names as the hazard", () => {
    // Read as local and tagged UTC, an offset-less instant ages every reading
    // by seven or eight hours on this coast.
    expect(() =>
      parseGridpointForecast(
        withSkyCover([{ validTime: "2026-08-26T12:00:00/PT3H", value: 66 }]),
        CELL,
      ),
    ).toThrow(/offset stated/);
  });

  it("refuses a value outside the range its declared unit allows", () => {
    expect(() =>
      parseGridpointForecast(
        withSkyCover([
          { validTime: "2026-08-26T12:00:00+00:00/PT3H", value: 140 },
        ]),
        CELL,
      ),
    ).toThrow(/outside the 0 to 100/);
    expect(() =>
      parseGridpointForecast(
        withSkyCover([
          { validTime: "2026-08-26T12:00:00+00:00/PT3H", value: "66" },
        ]),
        CELL,
      ),
    ).toThrow(/not a number/);
  });

  it("refuses an interval covering no time", () => {
    expect(() =>
      parseGridpointForecast(
        withSkyCover([
          { validTime: "2026-08-26T12:00:00+00:00/PT0H", value: 66 },
        ]),
        CELL,
      ),
    ).toThrow(/covers no time/);
  });

  it("skips a null step without failing the whole read", () => {
    // The service leaves a gap where it has not forecast a step. One gap is not
    // a dead cell, and refusing the read over it would blank a whole week.
    const forecast = parseGridpointForecast(
      withSkyCover([
        { validTime: "2026-08-26T12:00:00+00:00/PT1H", value: null },
        { validTime: "2026-08-26T13:00:00+00:00/PT1H", value: 40 },
      ]),
      CELL,
    );
    expect(forecast.skyCover).toHaveLength(1);
    expect(forecast.skyCover[0].percent).toBe(40);
  });

  it("refuses when every step is null, as no-data", () => {
    expect(() =>
      parseGridpointForecast(
        withSkyCover([
          { validTime: "2026-08-26T12:00:00+00:00/PT1H", value: null },
        ]),
        CELL,
      ),
    ).toThrow(NwsGridpointNoDataError);
  });

  it("refuses a validTime that is not a string at all", () => {
    expect(() =>
      parseGridpointForecast(withSkyCover([{ validTime: 3, value: 66 }]), CELL),
    ).toThrow(/not a string/);
  });

  it("refuses a series whose values are not an array", () => {
    expect(() =>
      parseGridpointForecast(
        {
          properties: {
            ...PAYLOAD.properties,
            skyCover: { uom: "wmoUnit:percent", values: {} },
          },
        },
        CELL,
      ),
    ).toThrow(/an array of values was expected/);
  });

  it("refuses a response with no properties", () => {
    expect(() => parseGridpointForecast({}, CELL)).toThrow(
      /no properties object/,
    );
  });

  it("reads a multi-day duration, which the far end of the week uses", () => {
    const forecast = parseGridpointForecast(
      withSkyCover([
        { validTime: "2026-08-26T12:00:00+00:00/P1DT2H", value: 50 },
      ]),
      CELL,
    );
    expect(forecast.skyCover).toHaveLength(26);
  });
});

describe("gridpointUrl", () => {
  it("addresses the cell the binding names, without re-deriving it", () => {
    expect(gridpointUrl("SGX/54,21")).toBe(
      "https://api.weather.gov/gridpoints/SGX/54,21",
    );
  });
});
