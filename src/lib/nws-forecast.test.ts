import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NwsForecastDriftError,
  NwsForecastNoDataError,
  parseSkyWording,
  skyWordingUrl,
} from "./nws-forecast";

/**
 * A real response, captured from `api.weather.gov` on 2026-08-28 at 2:25 PM
 * Pacific, for the cell La Jolla Shores Beach binds.
 *
 * The capture time matters and is why it was not taken at a round hour: the
 * first period of this payload is "This Afternoon" rather than "Today",
 * because the morning half had already ended when it was served. That is the
 * fact the selection tests below rest on, and a fixture written by hand would
 * almost certainly have opened on "Today" and hidden it.
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
      "nws-forecast-sgx-54-21-20260828.json",
    ),
    "utf8",
  ),
);

const CELL = "SGX/54,21";

/** The fixture's periods, with one field replaced on the period at `index`. */
function withPeriod(index: number, changes: Record<string, unknown>) {
  return {
    properties: {
      ...PAYLOAD.properties,
      periods: PAYLOAD.properties.periods.map(
        (period: Record<string, unknown>, at: number) =>
          at === index ? { ...period, ...changes } : period,
      ),
    },
  };
}

describe("parseSkyWording", () => {
  it("reads every period the publisher issued", () => {
    const forecast = parseSkyWording(PAYLOAD, CELL);

    expect(forecast.cellId).toBe(CELL);
    expect(forecast.periods).toHaveLength(
      PAYLOAD.properties.periods.length as number,
    );
  });

  it("relays the words verbatim, character for character", () => {
    // THE ASSERTION ADR-0009 TURNS ON. This site may not form a forecaster's
    // judgement, and ADR-0024 measured what happens when it tries: banding the
    // cloud mean on the service's own scale disagreed with the service's own
    // wording on three days of six. So the string that arrives is the string
    // that leaves -- not title-cased, not trimmed to the first clause, not
    // mapped onto a vocabulary of ours.
    const forecast = parseSkyWording(PAYLOAD, CELL);

    const published = PAYLOAD.properties.periods.map(
      (period: { shortForecast: string }) => period.shortForecast,
    );
    expect(forecast.periods.map((period) => period.shortForecast)).toEqual(
      published,
    );

    // The transition wording specifically, because it is the part a computed
    // band word cannot express and the reason ADR-0024 deferred this read.
    expect(published).toContain("Patchy Fog then Mostly Sunny");
  });

  it("carries the publisher's own name for each period", () => {
    // Rather than deriving one from the instants, which would mean this site
    // deciding when an afternoon starts.
    const forecast = parseSkyWording(PAYLOAD, CELL);

    expect(forecast.periods[0].name).toBe("This Afternoon");
    expect(forecast.periods[1].name).toBe("Tonight");
    expect(forecast.periods.map((period) => period.name)).toEqual(
      PAYLOAD.properties.periods.map((period: { name: string }) => period.name),
    );
  });

  it("does not assume the first period is a daytime one", () => {
    // The captured payload opens on an afternoon because it was taken at 2:25
    // PM; the same request at 9 PM opens on "Tonight". A caller taking
    // periods[0] would print tonight's fog against tomorrow's date twice a day,
    // so the flag is carried and selection is left to whoever knows the date.
    const forecast = parseSkyWording(PAYLOAD, CELL);

    expect(forecast.periods[0].isDaytime).toBe(true);
    expect(forecast.periods[1].isDaytime).toBe(false);
    // Day and night alternate, which is what makes selecting by flag safe.
    for (let i = 1; i < forecast.periods.length; i += 1) {
      expect(forecast.periods[i].isDaytime).toBe(
        !forecast.periods[i - 1].isDaytime,
      );
    }
  });

  it("places every period in time, with its offset honoured", () => {
    const forecast = parseSkyWording(PAYLOAD, CELL);

    for (const period of forecast.periods) {
      expect(period.endMs).toBeGreaterThan(period.startMs);
    }
    for (let i = 1; i < forecast.periods.length; i += 1) {
      expect(forecast.periods[i].startMs).toBeGreaterThanOrEqual(
        forecast.periods[i - 1].startMs,
      );
    }
    // 2026-08-28T14:00:00-07:00 is 21:00 UTC. Read as if it were local and
    // tagged UTC -- ADR-0009's hazard -- it would land seven hours earlier.
    expect(forecast.periods[0].startMs).toBe(
      Date.parse("2026-08-28T21:00:00Z"),
    );
  });

  it("covers the seven days the week grid names, one daytime period each", () => {
    // Not a parser assertion. It pins that the product's reach matches the
    // grid's, in the captured payload, so a future capture that stops covering
    // the week fails here and gets read rather than absorbed.
    const daytime = PAYLOAD.properties.periods.filter(
      (period: { isDaytime: boolean }) => period.isDaytime,
    );
    const dates = new Set(
      daytime.map((period: { startTime: string }) =>
        period.startTime.slice(0, 10),
      ),
    );
    expect(dates.size).toBe(7);
  });
});

describe("what the parser refuses", () => {
  it("refuses a period with no words, which is the whole product missing", () => {
    // Not a quiet period. There is no second wording to fall back to, and a
    // panel that skipped it would show one day fewer with nothing said.
    expect(() =>
      parseSkyWording(withPeriod(2, { shortForecast: "" }), CELL),
    ).toThrow(NwsForecastDriftError);
    expect(() =>
      parseSkyWording(withPeriod(2, { shortForecast: null }), CELL),
    ).toThrow(/entire product this request is made for/);
  });

  it("refuses an instant with no offset, which ADR-0009 names as the hazard", () => {
    expect(() =>
      parseSkyWording(
        withPeriod(0, { startTime: "2026-08-28T14:00:00" }),
        CELL,
      ),
    ).toThrow(/offset stated/);
  });

  it("refuses a period that ends at or before it starts", () => {
    expect(() =>
      parseSkyWording(
        withPeriod(0, {
          startTime: "2026-08-28T14:00:00-07:00",
          endTime: "2026-08-28T14:00:00-07:00",
        }),
        CELL,
      ),
    ).toThrow(/ends at or before it starts/);
  });

  it("refuses a period that will not say which half of the day it is", () => {
    // Guessing from the clock would be this site deciding where the
    // publisher's day ends, which is the judgement ADR-0009 forbids.
    expect(() =>
      parseSkyWording(withPeriod(3, { isDaytime: "no" }), CELL),
    ).toThrow(/not a boolean/);
  });

  it("refuses a period with no name", () => {
    expect(() => parseSkyWording(withPeriod(1, { name: "" }), CELL)).toThrow(
      /the publisher's to give/,
    );
  });

  it("reports an empty period list as no-data rather than as drift", () => {
    // A cell that answers and has not been forecast is a quiet office. The
    // panel says so; it does not compute a word to fill the gap.
    const empty = { properties: { ...PAYLOAD.properties, periods: [] } };
    expect(() => parseSkyWording(empty, CELL)).toThrow(NwsForecastNoDataError);
    expect(() => parseSkyWording(empty, CELL)).toThrow(/no forecast periods/);
  });

  it("refuses periods that are not a list at all", () => {
    expect(() =>
      parseSkyWording({ properties: { periods: {} } }, CELL),
    ).toThrow(/an array was expected/);
  });

  it("refuses a response with no properties", () => {
    expect(() => parseSkyWording({}, CELL)).toThrow(/no properties object/);
  });
});

describe("skyWordingUrl", () => {
  it("addresses the forecast under the cell the binding names", () => {
    expect(skyWordingUrl("SGX/54,21")).toBe(
      "https://api.weather.gov/gridpoints/SGX/54,21/forecast",
    );
  });
});
