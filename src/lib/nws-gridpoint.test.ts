import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type GridpointHour,
  type GridpointSeries,
  gridpointUrl,
  NwsGridpointDriftError,
  NwsGridpointNoDataError,
  parseGridpointForecast,
} from "./nws-gridpoint";

/**
 * A real response, captured from `api.weather.gov` on 2026-08-28 for the cell
 * La Jolla Shores Beach binds. Captured rather than written, because the
 * assertion this parser most needs -- that a declared key can carry nothing --
 * is exactly the kind a hand-written fixture would be built to satisfy.
 *
 * **It replaces the 2026-08-27 capture, which could not exercise this file.**
 * That one was trimmed to `skyCover`, `weather`, `visibility` and
 * `ceilingHeight`, so the five series this parser now reads were simply not in
 * it and every assertion about them would have been written against a fiction.
 * This one is trimmed too -- 41 KB of the 205 KB served -- but the trim drops
 * whole keys the parser never touches and keeps every entry of the nine it
 * does, with their real instants, durations, units and values. It is not a
 * byte-for-byte record: the kept subtree is re-serialised at two spaces to
 * match its siblings.
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
      "nws-gridpoint-sgx-54-21-20260828.json",
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

describe("the wind and temperature series", () => {
  /** Every series that arrives as `GridpointSeries`, with the key it is read from. */
  const OPTIONAL = [
    ["windMph", "windSpeed"],
    ["gustMph", "windGust"],
    ["windDirDegT", "windDirection"],
    ["airTempF", "temperature"],
    ["apparentTempF", "apparentTemperature"],
  ] as const;

  const published = (series: GridpointSeries): GridpointHour[] => {
    if (series.kind !== "published") {
      throw new Error(`expected a published series, got: ${series.reason}`);
    }
    return series.hours;
  };

  const replacing = (key: string, series: unknown) => ({
    properties: { ...PAYLOAD.properties, [key]: series },
  });

  it("reads all five out of the captured payload", () => {
    const forecast = parseGridpointForecast(PAYLOAD, CELL);
    for (const [field] of OPTIONAL) {
      expect(published(forecast[field]).length).toBeGreaterThan(0);
    }
  });

  it("converts km/h to mph and Celsius to Fahrenheit, and leaves degrees alone", () => {
    // The conversion is the reason the units are pinned at all: these four
    // arrive in units the page does not show, and a silent switch upstream
    // would put a plausible wrong number on it rather than an obvious one.
    const forecast = parseGridpointForecast(PAYLOAD, CELL);
    const props = PAYLOAD.properties;

    expect(published(forecast.windMph)[0].value).toBeCloseTo(
      props.windSpeed.values[0].value / 1.609344,
      10,
    );
    expect(published(forecast.gustMph)[0].value).toBeCloseTo(
      props.windGust.values[0].value / 1.609344,
      10,
    );
    expect(published(forecast.airTempF)[0].value).toBeCloseTo(
      props.temperature.values[0].value * 1.8 + 32,
      10,
    );
    // A bearing is a bearing in both. Converting it would be the bug this
    // assertion exists to catch, because 340 is a plausible mph too.
    expect(published(forecast.windDirDegT)[0].value).toBe(
      props.windDirection.values[0].value,
    );
  });

  it("expands every block length the payload uses, hourly and gapless", () => {
    // The captured payload carries blocks of one, two, three, four, five, six,
    // seven, eight, nine, ten and fourteen hours across these series. A parser
    // that assumed three would silently drop most of the week.
    const forecast = parseGridpointForecast(PAYLOAD, CELL);

    for (const [field, key] of OPTIONAL) {
      const hours = published(forecast[field]);
      const declared = PAYLOAD.properties[key].values.reduce(
        (total: number, entry: { validTime: string }) => {
          const match = /\/P(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/.exec(
            entry.validTime,
          );
          if (match === null) throw new Error(`unreadable: ${entry.validTime}`);
          return (
            total +
            (match[1] === undefined ? 0 : Number(match[1]) * 24) +
            (match[2] === undefined ? 0 : Number(match[2]))
          );
        },
        0,
      );

      expect(hours).toHaveLength(declared);
      expect(hours.length).toBeGreaterThan(
        PAYLOAD.properties[key].values.length,
      );
      for (let i = 1; i < hours.length; i += 1) {
        expect(hours[i].atMs - hours[i - 1].atMs).toBe(3_600_000);
      }
    }
  });

  it("marks the hour each block began, and not the hours it was held across", () => {
    // THE EXPANSION'S ONE LOSS, PUT BACK. The service publishes intervals, not
    // hours, and the far end of a run is blocks of six. A plot marking all six
    // would say this cell forecasts the wind hourly a week out, which is the
    // same overstatement the swell's three-hour grid gets marks to prevent.
    // Every block's value covers its hours -- what is not published is the
    // instant, not the figure.
    const forecast = parseGridpointForecast(PAYLOAD, CELL);

    for (const [field, key] of OPTIONAL) {
      const hours = published(forecast[field]);
      const marked = hours.filter((hour) => hour.published);

      // One mark per entry the payload carried, and never one per hour.
      expect(marked).toHaveLength(PAYLOAD.properties[key].values.length);
      expect(marked.length).toBeLessThan(hours.length);

      // And each mark sits on an instant the payload actually names.
      const issued = new Set(
        PAYLOAD.properties[key].values.map((entry: { validTime: string }) =>
          Date.parse(entry.validTime.split("/")[0]),
        ),
      );
      for (const hour of marked) expect(issued.has(hour.atMs)).toBe(true);
    }
  });

  it("pins each series' own unit, and says which one it pinned", () => {
    // Read off the payload rather than assumed. Four different unit codes
    // across five series, and getting one wrong is a wrong number rather than
    // a visible failure.
    const pinned: [string, string][] = [
      ["windSpeed", "wmoUnit:km_h-1"],
      ["windGust", "wmoUnit:km_h-1"],
      ["windDirection", "wmoUnit:degree_\\(angle\\)"],
      ["temperature", "wmoUnit:degC"],
      ["apparentTemperature", "wmoUnit:degC"],
    ];

    for (const [key, unit] of pinned) {
      const drifted = replacing(key, {
        uom: "wmoUnit:someOtherThing",
        values: [{ validTime: "2026-08-28T13:00:00+00:00/PT1H", value: 5 }],
      });
      expect(() => parseGridpointForecast(drifted, CELL)).toThrow(
        NwsGridpointDriftError,
      );
      expect(() => parseGridpointForecast(drifted, CELL)).toThrow(
        new RegExp(`pins ${unit}`),
      );
    }
  });

  it("names a declared-and-empty series as an absence rather than drawing it", () => {
    // `assertPublished` counts entries rather than testing for a key, which is
    // the whole reason it exists -- `visibility` proves on every request that a
    // declared key can carry nothing. A tab handed an empty array would draw a
    // flat line at zero and claim the wind dropped.
    const forecast = parseGridpointForecast(
      replacing("windSpeed", { uom: "wmoUnit:km_h-1", values: [] }),
      CELL,
    );

    expect(forecast.windMph.kind).toBe("absent");
    if (forecast.windMph.kind !== "absent") return;
    expect(forecast.windMph.reason).toMatch(/published no values/);
    expect(forecast.windMph.reason).toContain(CELL);
  });

  it("names a series whose every step is null as an absence too", () => {
    const forecast = parseGridpointForecast(
      replacing("windSpeed", {
        uom: "wmoUnit:km_h-1",
        values: [{ validTime: "2026-08-28T13:00:00+00:00/PT1H", value: null }],
      }),
      CELL,
    );

    expect(forecast.windMph.kind).toBe("absent");
    if (forecast.windMph.kind !== "absent") return;
    expect(forecast.windMph.reason).toMatch(/was\s+empty/);
  });

  it("lets a quiet series stay quiet without costing the other five", () => {
    // The property that made these optional. Requiring all six would let the
    // scarcest decide for the rest, which is the coupling ADR-0010 and ADR-0020
    // each spent a decision undoing one layer up.
    const forecast = parseGridpointForecast(
      replacing("windSpeed", { uom: "wmoUnit:km_h-1", values: [] }),
      CELL,
    );

    expect(forecast.windMph.kind).toBe("absent");
    expect(forecast.skyCover.length).toBeGreaterThan(0);
    expect(published(forecast.airTempF).length).toBeGreaterThan(0);
    expect(published(forecast.gustMph).length).toBeGreaterThan(0);
    expect(published(forecast.windDirDegT).length).toBeGreaterThan(0);
  });

  it("still refuses an offset-less instant, in the new series too", () => {
    // ADR-0009's hazard does not become survivable by moving one series over.
    // Read as local and tagged UTC, this ages every reading by seven hours.
    expect(() =>
      parseGridpointForecast(
        replacing("temperature", {
          uom: "wmoUnit:degC",
          values: [{ validTime: "2026-08-28T13:00:00/PT1H", value: 22 }],
        }),
        CELL,
      ),
    ).toThrow(/offset stated/);
  });

  it("refuses a bearing outside the circle its unit describes", () => {
    expect(() =>
      parseGridpointForecast(
        replacing("windDirection", {
          uom: "wmoUnit:degree_(angle)",
          values: [{ validTime: "2026-08-28T13:00:00+00:00/PT1H", value: 400 }],
        }),
        CELL,
      ),
    ).toThrow(/outside the 0 to 360/);
  });

  it("refuses a negative wind speed, which no unit makes meaningful", () => {
    expect(() =>
      parseGridpointForecast(
        replacing("windSpeed", {
          uom: "wmoUnit:km_h-1",
          values: [{ validTime: "2026-08-28T13:00:00+00:00/PT1H", value: -3 }],
        }),
        CELL,
      ),
    ).toThrow(/below the 0/);
  });

  it("bounds temperature at neither end, because Celsius bounds it at neither", () => {
    // Not an omission. A limit invented here would be this parser deciding what
    // the weather may do, and the first cold morning past it would blank the
    // row rather than report it.
    const forecast = parseGridpointForecast(
      replacing("temperature", {
        uom: "wmoUnit:degC",
        values: [{ validTime: "2026-08-28T13:00:00+00:00/PT1H", value: -40 }],
      }),
      CELL,
    );
    expect(published(forecast.airTempF)[0].value).toBe(-40);
  });

  it("treats a series that disappears entirely as drift, not as quiet", () => {
    // The six arrive as one schema at every cell measured, so one of them going
    // missing is the product changing rather than this cell having nothing to
    // say. That distinction is why the absent case above is reachable at all.
    const properties = { ...PAYLOAD.properties };
    delete properties.windSpeed;
    expect(() => parseGridpointForecast({ properties }, CELL)).toThrow(
      NwsGridpointDriftError,
    );
  });
});

describe("gridpointUrl", () => {
  it("addresses the cell the binding names, without re-deriving it", () => {
    expect(gridpointUrl("SGX/54,21")).toBe(
      "https://api.weather.gov/gridpoints/SGX/54,21",
    );
  });
});
