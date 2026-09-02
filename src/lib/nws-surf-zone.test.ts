import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NwsSurfZoneDriftError,
  NwsSurfZoneNoDataError,
  parseSurfZoneForecast,
  parseSurfZoneProductList,
  resolvePeriodDates,
  SURF_ZONE_ID,
  surfZoneProductsUrl,
  surfZoneProductUrl,
} from "./nws-surf-zone";

/**
 * Two real bulletins, captured from `api.weather.gov` on 2026-09-02.
 *
 * **Both period-label shapes are here on purpose, and one fixture could not
 * have shown both.** The morning bulletin names its periods `TODAY` and a
 * weekday; the afternoon one names them `THIS AFTERNOON THROUGH WEDNESDAY` —
 * today's remainder merged with tomorrow — and then the day after. A capture
 * taken at a single time of day would have hidden the merge, and the merge is
 * the case the day panel keys into.
 *
 * The afternoon one also carries a headline and the morning one does not,
 * which is the other split worth having a real payload for rather than a
 * hand-written one.
 *
 * The path is resolved from the working directory rather than
 * `import.meta.url`, which is not a `file:` URL under this test environment.
 */
function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "src", "lib", "__fixtures__", name),
    "utf8",
  );
}

/** Issued 1:54 AM PDT Wed Sep 2 2026. Periods: TODAY, THURSDAY. No headline. */
const MORNING = fixture("nws-srf-sgx-20260902-0854z.txt");
const MORNING_ISSUED = Date.parse("2026-09-02T08:54:00+00:00");

/**
 * Issued 12:20 PM PDT Tue Sep 1 2026. Periods: THIS AFTERNOON THROUGH
 * WEDNESDAY, THURSDAY. Headline: MODERATE RIP CURRENT RISK.
 */
const AFTERNOON = fixture("nws-srf-sgx-20260901-1920z.txt");
const AFTERNOON_ISSUED = Date.parse("2026-09-01T19:20:00+00:00");

const LISTING = JSON.parse(fixture("nws-srf-sgx-products-20260902.json"));

describe("the URLs", () => {
  it("names the office's bulletin listing and one bulletin by id", () => {
    expect(surfZoneProductsUrl()).toBe(
      "https://api.weather.gov/products/types/SRF/locations/SGX",
    );
    expect(surfZoneProductUrl("abc-123")).toBe(
      "https://api.weather.gov/products/abc-123",
    );
  });
});

describe("the bulletin listing", () => {
  it("takes the newest bulletin the office is serving", () => {
    const ref = parseSurfZoneProductList(LISTING);

    expect(ref.id).toBe("36f48a5d-9b57-4fe2-9808-5f6a68ec4c64");
    expect(ref.issuedMs).toBe(MORNING_ISSUED);
  });

  /**
   * The listing arrives newest-first today and the parser sorts anyway. This
   * asserts the sort rather than the arrival order, by handing it the same
   * entries reversed: an implementation taking `[0]` passes the test above and
   * fails this one.
   */
  it("takes the newest by stated issuance, not by position", () => {
    const reversed = { "@graph": [...LISTING["@graph"]].reverse() };

    expect(parseSurfZoneProductList(reversed).issuedMs).toBe(MORNING_ISSUED);
  });

  it("refuses an issuance instant with no offset", () => {
    const noOffset = {
      "@graph": [{ id: "x", issuanceTime: "2026-09-02T08:54:00" }],
    };

    expect(() => parseSurfZoneProductList(noOffset)).toThrow(
      NwsSurfZoneDriftError,
    );
  });

  it("reports an office serving nothing as no data rather than as drift", () => {
    expect(() => parseSurfZoneProductList({ "@graph": [] })).toThrow(
      NwsSurfZoneNoDataError,
    );
  });

  it("refuses a listing that is not the JSON-LD shape it was asked for", () => {
    expect(() => parseSurfZoneProductList({ features: [] })).toThrow(
      NwsSurfZoneDriftError,
    );
  });
});

describe("the morning bulletin", () => {
  it("reads its two periods onto today and tomorrow", () => {
    const forecast = parseSurfZoneForecast(MORNING, MORNING_ISSUED);

    expect(forecast.zoneId).toBe("CAZ043");
    expect(forecast.periods.map((period) => period.name)).toEqual([
      "TODAY",
      "THURSDAY",
    ]);
    expect(forecast.periods.map((period) => period.localDates)).toEqual([
      ["2026-09-02"],
      ["2026-09-03"],
    ]);
  });

  it("relays the published levels", () => {
    const forecast = parseSurfZoneForecast(MORNING, MORNING_ISSUED);

    expect(forecast.periods.map((period) => period.level)).toEqual([
      "Low",
      "Low",
    ]);
  });

  /** 3 of the 14 issuances carried none. A parser requiring one fails on a quiet day. */
  it("carries no headline when the office published none", () => {
    expect(parseSurfZoneForecast(MORNING, MORNING_ISSUED).headline).toBeNull();
  });

  /**
   * The gloss on the page is the publisher's sentence, not one this site wrote.
   * ADR-0009 forbids this site forming the judgement; authoring the words that
   * explain it would be forming it one step removed.
   */
  it("carries the bulletin's own glossary of its three levels", () => {
    const forecast = parseSurfZoneForecast(MORNING, MORNING_ISSUED);

    expect(forecast.meanings).toEqual([
      {
        level: "Low",
        meaning:
          "Life threatening rip currents are unlikely but still could occur.",
      },
      {
        level: "Moderate",
        meaning: "Life threatening rip currents are possible.",
      },
      { level: "High", meaning: "Life threatening rip currents are likely." },
    ]);
  });
});

describe("the afternoon bulletin", () => {
  /**
   * The case a single fixture would have hidden. Issued Tuesday afternoon, its
   * first period is `THIS AFTERNOON THROUGH WEDNESDAY` and covers two calendar
   * days, which pushes the second period to Thursday. So an afternoon bulletin
   * describes three days where a morning one describes two.
   */
  it("merges today's remainder with tomorrow, and dates both", () => {
    const forecast = parseSurfZoneForecast(AFTERNOON, AFTERNOON_ISSUED);

    expect(forecast.periods.map((period) => period.name)).toEqual([
      "THIS AFTERNOON THROUGH WEDNESDAY",
      "THURSDAY",
    ]);
    expect(forecast.periods[0].localDates).toEqual([
      "2026-09-01",
      "2026-09-02",
    ]);
    expect(forecast.periods[1].localDates).toEqual(["2026-09-03"]);
  });

  it("relays the office's own headline without its emphasis markers", () => {
    const forecast = parseSurfZoneForecast(AFTERNOON, AFTERNOON_ISSUED);

    expect(forecast.headline).toBe("MODERATE RIP CURRENT RISK");
  });
});

/**
 * The failure this parser exists to make loud.
 *
 * SGX issues San Diego and Orange County in one bulletin. Measured 2026-09-02,
 * San Diego read 70 to 74 degrees against Orange's 71 to 78, and quoted tides
 * at La Jolla against Newport Beach. A parser that fell through to whichever
 * section it found would render Orange County's forecast under a San Diego
 * heading and look entirely plausible doing it.
 */
describe("the zone section", () => {
  it("refuses to fall through to the other county in the same bulletin", () => {
    // The real bulletin with the San Diego section removed, leaving Orange
    // County's — the exact payload a fallback would have rendered wrongly.
    const orangeOnly = MORNING.slice(0, MORNING.indexOf("CAZ043-"));
    expect(orangeOnly).toContain("CAZ552-");

    expect(() => parseSurfZoneForecast(orangeOnly, MORNING_ISSUED)).toThrow(
      NwsSurfZoneNoDataError,
    );
  });

  it("reads the requested zone rather than the first one in the text", () => {
    // CAZ552 is published first in this bulletin; asking for it must not
    // return the San Diego section, and asking for San Diego must not return
    // Orange's, which the period dates below distinguish.
    const orange = parseSurfZoneForecast(MORNING, MORNING_ISSUED, "CAZ552");

    expect(orange.zoneId).toBe("CAZ552");
    expect(MORNING.indexOf("CAZ552-")).toBeLessThan(MORNING.indexOf("CAZ043-"));
    expect(parseSurfZoneForecast(MORNING, MORNING_ISSUED).zoneId).toBe(
      SURF_ZONE_ID,
    );
  });

  it("reports an empty bulletin as no data", () => {
    expect(() => parseSurfZoneForecast("   ", MORNING_ISSUED)).toThrow(
      NwsSurfZoneNoDataError,
    );
  });
});

describe("resolving a period's label onto the calendar", () => {
  it("reads TODAY as the day the bulletin was issued", () => {
    expect(resolvePeriodDates("TODAY", "2026-09-02")).toEqual(["2026-09-02"]);
  });

  it("walks a bare weekday forward from where it was told to start", () => {
    // 2026-09-02 is a Wednesday, so Thursday is the next day...
    expect(resolvePeriodDates("THURSDAY", "2026-09-02")).toEqual([
      "2026-09-03",
    ]);
    // ...and a Wednesday asked for from that same Wednesday is that day, not
    // one a week away.
    expect(resolvePeriodDates("WEDNESDAY", "2026-09-02")).toEqual([
      "2026-09-02",
    ]);
  });

  it("spans every day a THROUGH label covers, inclusive", () => {
    expect(
      resolvePeriodDates("THIS AFTERNOON THROUGH FRIDAY", "2026-09-02"),
    ).toEqual(["2026-09-02", "2026-09-03", "2026-09-04"]);
  });

  /**
   * The measured vocabulary is one week of one summer, which is not the whole
   * of what NWS period naming can produce. A label this cannot place is a
   * failed read rather than a dropped period: a dropped period is a day
   * missing from the panel with nothing said about why, which is the failure
   * this feature exists to correct.
   */
  it("throws on a label it cannot place rather than dropping the period", () => {
    expect(() => resolvePeriodDates("REST OF TONIGHT", "2026-09-02")).toThrow(
      NwsSurfZoneDriftError,
    );
    expect(() =>
      resolvePeriodDates("THIS AFTERNOON THROUGH BLURSDAY", "2026-09-02"),
    ).toThrow(NwsSurfZoneDriftError);
  });
});

/**
 * Edit only the San Diego half of a bulletin.
 *
 * Necessary rather than tidy, and the first draft of these tests got it wrong:
 * `CAZ552` is published *before* `CAZ043`, so a plain `replace` lands in Orange
 * County and leaves the section under test untouched. Both drift tests below
 * passed against an unmodified San Diego section and reported the parser as
 * broken. That is the same first-match trap `sectionFor` exists to stop, met
 * from the other side.
 */
function inSanDiego(text: string, from: string | RegExp, to: string): string {
  const at = text.indexOf(`${SURF_ZONE_ID}-`);
  return text.slice(0, at) + text.slice(at).replace(from, to);
}

describe("drift in the fields", () => {
  it("refuses a risk level outside the three the bulletin defines", () => {
    const invented = inSanDiego(
      MORNING,
      "Rip Current Risk*.............Low.",
      "Rip Current Risk*.............Extreme.",
    );

    expect(() => parseSurfZoneForecast(invented, MORNING_ISSUED)).toThrow(
      NwsSurfZoneDriftError,
    );
  });

  it("refuses a period that stopped publishing the risk at all", () => {
    const dropped = inSanDiego(
      MORNING,
      /^Rip Current Risk\*\.+.*$/m,
      "Surf Height...................1 to 3 feet.",
    );

    expect(() => parseSurfZoneForecast(dropped, MORNING_ISSUED)).toThrow(
      NwsSurfZoneDriftError,
    );
  });
});

/**
 * The three failure paths a real bulletin will not show me.
 *
 * One week of one summer is what was available to capture, so the payloads
 * above exercise the shapes SGX happened to issue. These are the shapes it did
 * not, reached by editing a real bulletin rather than by writing a synthetic
 * one -- an invented payload would assert what I expect the office to send,
 * which is the thing under test.
 */
describe("shapes the captured week did not contain", () => {
  it("refuses a listing entry with no usable id", () => {
    const nameless = {
      "@graph": [{ issuanceTime: "2026-09-02T08:54:00+00:00" }],
    };

    expect(() => parseSurfZoneProductList(nameless)).toThrow(
      NwsSurfZoneDriftError,
    );
  });

  /**
   * A zone issued twice in one bulletin. Choosing between them would be this
   * parser guessing which forecast is current, and taking the first would make
   * the guess silently.
   */
  it("refuses a bulletin carrying the same zone twice", () => {
    const at = MORNING.indexOf(`${SURF_ZONE_ID}-`);
    const doubled = MORNING + MORNING.slice(at);

    expect(() => parseSurfZoneForecast(doubled, MORNING_ISSUED)).toThrow(
      NwsSurfZoneDriftError,
    );
  });

  it("reports a zone section with no periods as no data", () => {
    // The header and the glossary, with every `.PERIOD...` block gone.
    const headerOnly = MORNING.slice(
      0,
      MORNING.indexOf("\n.", MORNING.indexOf(`${SURF_ZONE_ID}-`)),
    );

    expect(() => parseSurfZoneForecast(headerOnly, MORNING_ISSUED)).toThrow(
      NwsSurfZoneNoDataError,
    );
  });
});
