import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CoopsDriftError,
  CoopsUpstreamError,
  COOPS_APPLICATION as SITE_APPLICATION,
  COOPS_DATUM as SITE_DATUM,
  COOPS_TIME_ZONE as SITE_TIME_ZONE,
  COOPS_UNITS as SITE_UNITS,
  coopsPredictionsUrl as siteUrl,
  parseCoopsHiLo,
} from "../src/lib/coops-predictions.ts";
import FIXTURE from "../src/lib/__fixtures__/coops-9410230-hilo-20260817.json" with { type: "json" };
import {
  classifyPayload,
  coopsPredictionsUrl,
  COOPS_APPLICATION,
  COOPS_DATUM,
  COOPS_TIME_ZONE,
  COOPS_UNITS,
  DELIVERING,
  DRIFT,
  formatRows,
  measureAll,
  measureStation,
  NOT_DELIVERING,
  predictionsWindow,
  UNREACHABLE,
  verdict,
} from "./probe-tide-stations.mjs";

const CONTRACT = {
  stationId: "9410230",
  beginDate: "20260817",
  endDate: "20260818",
};

/**
 * THE REASON THIS FILE EXISTS TWICE OVER.
 *
 * The probe cannot import `coops-predictions.ts` -- it runs under node unbuilt
 * -- so the request contract is spelled in both places. A probe measuring a
 * contract the site does not read measures nothing, and nothing about the two
 * copies makes them agree except this.
 */
describe("the request contract, against the one the site reads", () => {
  it("builds the same URL for the same station and range", () => {
    expect(coopsPredictionsUrl(CONTRACT)).toBe(siteUrl(CONTRACT));
  });

  it("builds the same URL for a different station and range", () => {
    const other = {
      stationId: "TWC0405",
      beginDate: "20261215",
      endDate: "20261216",
    };
    expect(coopsPredictionsUrl(other)).toBe(siteUrl(other));
  });

  it("spells each pinned constant the way the site spells it", () => {
    // Named individually rather than compared as a bag, so a failure says which
    // one moved. Getting any of them wrong produces a confident wrong number
    // rather than an error, which is why the site pins them at all.
    expect(COOPS_DATUM).toBe(SITE_DATUM);
    expect(COOPS_UNITS).toBe(SITE_UNITS);
    expect(COOPS_TIME_ZONE).toBe(SITE_TIME_ZONE);
    expect(COOPS_APPLICATION).toBe(SITE_APPLICATION);
  });

  it("asks for the turning points, not the six-minute series", () => {
    expect(coopsPredictionsUrl(CONTRACT)).toContain("interval=hilo");
  });
});

/**
 * The payloads a station can answer with, and what each one means.
 *
 * `TWC0405`'s entry is the body `tide-stations.json` records it answering on
 * 2026-08-18, quoted from the file's own `dead_note`.
 */
const PAYLOADS = [
  ["the committed fixture", FIXTURE, DELIVERING],
  [
    "a CO-OPS error object under HTTP 200",
    {
      error: {
        message:
          "No Predictions data was found. Please make sure the Datum input is valid.",
      },
    },
    NOT_DELIVERING,
  ],
  ["an empty predictions array", { predictions: [] }, DRIFT],
  ["predictions that are not an array", { predictions: "none" }, DRIFT],
  ["a body with neither key", {}, DRIFT],
  ["a payload that is not an object", "predictions", DRIFT],
  [
    "a row whose timestamp carries an offset",
    { predictions: [{ t: "2026-08-17T01:41+00:00", v: "1.366", type: "L" }] },
    DRIFT,
  ],
  [
    "a row whose type is neither H nor L",
    { predictions: [{ t: "2026-08-17 01:41", v: "1.366", type: "X" }] },
    DRIFT,
  ],
  [
    "a row whose height is not a number",
    { predictions: [{ t: "2026-08-17 01:41", v: "high", type: "L" }] },
    DRIFT,
  ],
];

/** What the site's own parser makes of a payload, as one of this probe's outcomes. */
function asSiteOutcome(payload) {
  try {
    parseCoopsHiLo(payload, CONTRACT);
    return DELIVERING;
  } catch (error) {
    if (error instanceof CoopsUpstreamError) return NOT_DELIVERING;
    if (error instanceof CoopsDriftError) return DRIFT;
    throw error;
  }
}

describe("classifying a payload", () => {
  it.each(PAYLOADS)(
    "reads %s as its own outcome",
    (_name, payload, expected) => {
      expect(classifyPayload(payload).outcome).toBe(expected);
    },
  );

  it.each(PAYLOADS)(
    "agrees with the site's parser about %s",
    (_name, payload) => {
      // The classification the probe reports has to be the classification a
      // reader's request would hit. This is the only thing holding the two
      // implementations together.
      expect(classifyPayload(payload).outcome).toBe(asSiteOutcome(payload));
    },
  );

  it("carries CO-OPS's own message, and says the status code did not say so", () => {
    const { detail } = classifyPayload({
      error: { message: "No Predictions data was found." },
    });
    expect(detail).toContain("No Predictions data was found.");
    expect(detail).toContain("HTTP 200");
  });

  it("says an empty range is a broken request rather than a flat tide", () => {
    expect(classifyPayload({ predictions: [] }).detail).toMatch(/astronomical/);
  });
});

describe("the verdict", () => {
  const TABLE = {
    9410230: { delivers: true },
    TWC0405: { delivers: false },
  };
  const measurement = (outcome) => ({ outcome, detail: "measured" });

  it("exits 0 when every flag agrees with what was measured", () => {
    const { exitCode, rows } = verdict(TABLE, {
      9410230: measurement(DELIVERING),
      TWC0405: measurement(NOT_DELIVERING),
    });

    expect(exitCode).toBe(0);
    expect(rows.every((row) => row.label === "agrees")).toBe(true);
  });

  it("exits non-zero and names a station that stopped delivering", () => {
    const { exitCode, rows } = verdict(TABLE, {
      9410230: measurement(NOT_DELIVERING),
      TWC0405: measurement(NOT_DELIVERING),
    });

    expect(exitCode).toBe(1);
    expect(rows.find((row) => row.id === "9410230").label).toBe("DISAGREES");
  });

  it("exits non-zero and names a station that started delivering", () => {
    // The direction that is easy to forget. A station coming back is as much a
    // change as one going quiet, and it is the one that actually happened.
    const { exitCode, rows } = verdict(TABLE, {
      9410230: measurement(DELIVERING),
      TWC0405: measurement(DELIVERING),
    });

    expect(exitCode).toBe(1);
    expect(rows.find((row) => row.id === "TWC0405").label).toBe("DISAGREES");
  });

  it("reports every station, agreeing or not", () => {
    const { rows } = verdict(TABLE, {
      9410230: measurement(DELIVERING),
      TWC0405: measurement(DELIVERING),
    });

    expect(rows.map((row) => row.id)).toEqual(["9410230", "TWC0405"]);
  });

  it("reports drift as drift, not as a station that stopped delivering", () => {
    const { exitCode, rows } = verdict(TABLE, {
      9410230: measurement(DRIFT),
      TWC0405: measurement(NOT_DELIVERING),
    });

    const drifted = rows.find((row) => row.id === "9410230");
    expect(drifted.outcome).toBe(DRIFT);
    expect(drifted.label).toBe("NOT MEASURED");
    expect(exitCode).toBe(1);
  });

  it("reports unreachable as unreachable, never as stopped delivering", () => {
    // The false alarm this probe exists to prevent. A refused connection to a
    // station committed as delivering must not read as that station going
    // quiet, which is what comparing it against the flag would say.
    const { rows } = verdict(TABLE, {
      9410230: measurement(UNREACHABLE),
      TWC0405: measurement(NOT_DELIVERING),
    });

    const unreached = rows.find((row) => row.id === "9410230");
    expect(unreached.outcome).toBe(UNREACHABLE);
    expect(unreached.label).toBe("NOT MEASURED");
    expect(unreached.label).not.toBe("DISAGREES");
  });

  it("does not let an unmeasured station pass as agreeing", () => {
    const { exitCode, rows } = verdict(TABLE, {
      TWC0405: measurement(NOT_DELIVERING),
    });

    expect(exitCode).toBe(1);
    expect(rows.find((row) => row.id === "9410230").outcome).toBe(UNREACHABLE);
  });
});

describe("measuring a station", () => {
  const WINDOW = { beginDate: "20260817", endDate: "20260818" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the URL the contract builds", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => FIXTURE,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await measureStation("9410230", WINDOW);

    expect(fetchMock.mock.calls[0][0]).toBe(
      siteUrl({ stationId: "9410230", ...WINDOW }),
    );
  });

  it("reads a served payload as delivering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => FIXTURE })),
    );

    expect((await measureStation("9410230", WINDOW)).outcome).toBe(DELIVERING);
  });

  it("reads a CO-OPS error under HTTP 200 as not delivering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ error: { message: "No Predictions data" } }),
      })),
    );

    expect((await measureStation("TWC0405", WINDOW)).outcome).toBe(
      NOT_DELIVERING,
    );
  });

  it("reads a refused connection as unreachable, not as not delivering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const measured = await measureStation("9410230", WINDOW);
    expect(measured.outcome).toBe(UNREACHABLE);
    expect(measured.detail).toContain("fetch failed");
  });

  it("reads a non-200 as unreachable, since no payload was measured", async () => {
    // CO-OPS retired `product=datums` and answers HTTP 400 with a plain-text
    // body. A status code is not a station telling us anything about delivery.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400 })),
    );

    const measured = await measureStation("9410230", WINDOW);
    expect(measured.outcome).toBe(UNREACHABLE);
    expect(measured.detail).toContain("400");
  });

  it("reads a non-JSON body under HTTP 200 as drift", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON at position 0");
        },
      })),
    );

    expect((await measureStation("9410230", WINDOW)).outcome).toBe(DRIFT);
  });
});

describe("the window asked for", () => {
  it("asks for two consecutive calendar days, compacted", () => {
    expect(predictionsWindow(new Date("2026-08-27T18:00:00Z"))).toEqual({
      beginDate: "20260827",
      endDate: "20260828",
    });
  });

  it("steps across a month end rather than producing day 32", () => {
    expect(predictionsWindow(new Date("2026-08-31T18:00:00Z"))).toEqual({
      beginDate: "20260831",
      endDate: "20260901",
    });
  });

  it("uses the Pacific date, not the UTC one", () => {
    // 2026-08-28T02:00Z is still the 27th where the beaches are. A UTC date
    // here would ask for a window that has not started in the county.
    expect(predictionsWindow(new Date("2026-08-28T02:00:00Z")).beginDate).toBe(
      "20260827",
    );
  });
});

describe("what the run prints", () => {
  const { rows } = verdict(
    {
      9410230: { delivers: true },
      TWC0413: { delivers: true },
      TWC0405: { delivers: false },
    },
    {
      9410230: { outcome: DELIVERING, detail: "8 turning points" },
      TWC0413: { outcome: UNREACHABLE, detail: "NOAA answered HTTP 503" },
      TWC0405: { outcome: DELIVERING, detail: "8 turning points" },
    },
  );
  const printed = formatRows(rows);

  it("prints a line for every station, agreeing or not", () => {
    // A probe that printed only its complaints would leave a reader unable to
    // tell a clean run from one that never reached half the table.
    for (const id of ["9410230", "TWC0413", "TWC0405"]) {
      expect(printed).toContain(id);
    }
  });

  it("marks the station that disagrees, and only that one", () => {
    const disagreeing = printed
      .split("\n")
      .filter((line) => line.includes("DISAGREES"));
    expect(disagreeing).toHaveLength(1);
    expect(disagreeing[0]).toContain("TWC0405");
  });

  it("carries each measurement's detail, so a reader sees why", () => {
    expect(printed).toContain("8 turning points");
    expect(printed).toContain("NOAA answered HTTP 503");
  });

  it("shows what was committed beside what was measured", () => {
    expect(printed).toMatch(
      /TWC0405\s+committed=false\s+delivering\s+DISAGREES/,
    );
  });
});

describe("measuring the whole table", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for every station and keys the answers by id", async () => {
    const bodies = {
      9410230: {
        predictions: [{ t: "2026-08-17 01:41", v: "1.4", type: "L" }],
      },
      TWC0405: { error: { message: "No Predictions data was found." } },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const id = new URL(url).searchParams.get("station");
        return { ok: true, status: 200, json: async () => bodies[id] };
      }),
    );

    const measured = await measureAll(
      { 9410230: { delivers: true }, TWC0405: { delivers: false } },
      { beginDate: "20260817", endDate: "20260818" },
    );

    expect(measured["9410230"].outcome).toBe(DELIVERING);
    expect(measured.TWC0405.outcome).toBe(NOT_DELIVERING);
  });

  it("measures the rest of the table when one station is unreachable", async () => {
    // One station refusing a connection must not cost the other eight their
    // measurement, or a single blip reports the whole table as unknown.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (new URL(url).searchParams.get("station") === "TWC0413") {
          throw new TypeError("fetch failed");
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            predictions: [{ t: "2026-08-17 01:41", v: "1.4", type: "L" }],
          }),
        };
      }),
    );

    const measured = await measureAll(
      {
        9410230: { delivers: true },
        TWC0413: { delivers: true },
        TWC0405: { delivers: false },
      },
      { beginDate: "20260817", endDate: "20260818" },
    );

    expect(measured.TWC0413.outcome).toBe(UNREACHABLE);
    expect(measured["9410230"].outcome).toBe(DELIVERING);
    expect(measured.TWC0405.outcome).toBe(DELIVERING);
  });
});
