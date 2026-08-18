import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchLatestObservation,
  fetchLatestWave,
  fetchTideExtremes,
  MAX_OBSERVATION_AGE_MINUTES,
  MAX_WAVE_AGE_MINUTES,
  OBSERVATIONS_REVALIDATE_SECONDS,
  PREDICTIONS_REVALIDATE_SECONDS,
  WAVES_REVALIDATE_SECONDS,
} from "./upstream";

/**
 * `fetch` is stubbed rather than reached. What is under test is the policy
 * around the request -- what a 404 means, when a reading is too old to be
 * called current, and which failures are drift -- none of which can be asserted
 * against a live buoy that is having a good day.
 */
const fetchMock = vi.fn();

const CAPTURED = readFileSync(
  join(process.cwd(), "src/lib/__fixtures__/ndbc-46254-realtime2.txt"),
  "utf8",
);

/** The instant the captured payload's newest row was observed. */
const OBSERVED_AT = Date.UTC(2026, 7, 18, 3, 26);

function textResponse(body: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLatestWave", () => {
  test("opts the request into caching, since Next 16 does not cache fetch by default", async () => {
    fetchMock.mockResolvedValue(textResponse(CAPTURED));

    await fetchLatestWave("46254", OBSERVED_AT);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.ndbc.noaa.gov/data/realtime2/46254.txt");
    // Without this the buoy is asked on every render.
    expect(options.next.revalidate).toBe(WAVES_REVALIDATE_SECONDS);
    expect(options.headers["User-Agent"]).toContain("wild-coast-kids");
  });

  test("returns the newest observation when it is fresh", async () => {
    fetchMock.mockResolvedValue(textResponse(CAPTURED));

    const result = await fetchLatestWave("46254", OBSERVED_AT + 10 * 60_000);

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.ageMinutes).toBeCloseTo(10, 5);
      expect(result.observation.heightFt).toBeCloseTo(2.62, 2);
    }
  });

  test("a reading past the age limit is unknown, not a current number", async () => {
    fetchMock.mockResolvedValue(textResponse(CAPTURED));

    const tooOld = OBSERVED_AT + (MAX_WAVE_AGE_MINUTES + 5) * 60_000;
    const result = await fetchLatestWave("46254", tooOld);

    // The buoy is answering and not reporting. Serving its last number as
    // current is the failure this limit exists to prevent.
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toMatch(/past the 180 minute limit/);
      expect(result.drift).toBe(false);
    }
  });

  test("a reading exactly at the limit is still served", async () => {
    fetchMock.mockResolvedValue(textResponse(CAPTURED));
    const atLimit = OBSERVED_AT + MAX_WAVE_AGE_MINUTES * 60_000;
    expect((await fetchLatestWave("46254", atLimit)).kind).toBe("ok");
  });

  test("404 is a buoy that is not publishing, said in those words", async () => {
    fetchMock.mockResolvedValue(textResponse("", 404));

    const result = await fetchLatestWave("46235", OBSERVED_AT);

    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toMatch(/not publishing/);
    }
  });

  test("another bad status is reported with its number", async () => {
    fetchMock.mockResolvedValue(textResponse("", 503));
    const result = await fetchLatestWave("46254", OBSERVED_AT);
    if (result.kind === "unavailable")
      expect(result.reason).toMatch(/HTTP 503/);
  });

  test("a request that never completes is unavailable, not a throw", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));

    const result = await fetchLatestWave("46254", OBSERVED_AT);

    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toMatch(/socket hang up/);
    }
  });

  test("a drifted layout is flagged as drift, separately from a quiet buoy", async () => {
    fetchMock.mockResolvedValue(textResponse(CAPTURED.replace("WVHT", "WVHZ")));

    const result = await fetchLatestWave("46254", OBSERVED_AT);

    // Drift is a bug to chase here; a quiet buoy is not.
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") expect(result.drift).toBe(true);
  });

  test("headers with no rows is a quiet buoy rather than drift", async () => {
    const headerOnly = CAPTURED.split("\n").slice(0, 2).join("\n");
    fetchMock.mockResolvedValue(textResponse(`${headerOnly}\n`));

    const result = await fetchLatestWave("46254", OBSERVED_AT);

    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") expect(result.drift).toBe(false);
  });
});

describe("fetchTideExtremes", () => {
  const contract = {
    stationId: "9410230",
    beginDate: "20260817",
    endDate: "20260818",
  };

  test("opts into caching for six hours, predictions being astronomical", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        predictions: [{ t: "2026-08-17 13:24", v: "1.368", type: "L" }],
      }),
    );

    await fetchTideExtremes(contract);

    expect(fetchMock.mock.calls[0][1].next.revalidate).toBe(
      PREDICTIONS_REVALIDATE_SECONDS,
    );
  });

  test("an error under HTTP 200 is unavailable and not drift", async () => {
    // CO-OPS serves this with a success status. A caller trusting the status
    // code would treat it as a payload.
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "No Predictions data was found." } }),
    );

    const result = await fetchTideExtremes(contract);

    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toMatch(/No Predictions data was found/);
      expect(result.drift).toBe(false);
    }
  });

  test("a body that is not JSON is reported as such", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token <");
      },
    });

    const result = await fetchTideExtremes(contract);
    if (result.kind === "unavailable")
      expect(result.reason).toMatch(/was not JSON/);
  });

  test("a bad status names the station", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    const result = await fetchTideExtremes(contract);
    if (result.kind === "unavailable") expect(result.reason).toMatch(/9410230/);
  });

  test("a drifted payload is flagged as drift", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ somethingElse: [] }));
    const result = await fetchTideExtremes(contract);
    if (result.kind === "unavailable") expect(result.drift).toBe(true);
  });
});

describe("fetchLatestObservation", () => {
  const OBSERVED = Date.UTC(2026, 7, 18, 4, 55);
  const CAPTURED_OBS = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src/lib/__fixtures__/nws-knkx-observation-20260818.json",
      ),
      "utf8",
    ),
  );

  test("opts the request into caching and identifies this site", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CAPTURED_OBS));

    await fetchLatestObservation("KNKX", OBSERVED);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.weather.gov/stations/KNKX/observations/latest",
    );
    expect(options.next.revalidate).toBe(OBSERVATIONS_REVALIDATE_SECONDS);
    // The National Weather Service requires a self-identifying User-Agent.
    expect(options.headers["User-Agent"]).toContain("wild-coast-kids");
  });

  test("returns the newest observation when it is fresh", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CAPTURED_OBS));

    const result = await fetchLatestObservation("KNKX", OBSERVED);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.observation.visibilityMi).toBeCloseTo(10.0, 2);
    expect(result.ageMinutes).toBe(0);
  });

  test("a reading past the age limit is unknown, not a current number", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CAPTURED_OBS));

    const stale = OBSERVED + (MAX_OBSERVATION_AGE_MINUTES + 1) * 60_000;
    const result = await fetchLatestObservation("KNKX", stale);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("minutes old");
    // An hours-old visibility rendered as current is exactly the number a
    // reader would act on.
    expect(result.drift).toBe(false);
  });

  test("a reading exactly at the limit is still served", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CAPTURED_OBS));

    const edge = OBSERVED + MAX_OBSERVATION_AGE_MINUTES * 60_000;
    expect((await fetchLatestObservation("KNKX", edge)).kind).toBe("ok");
  });

  test("404 is a station that is not publishing, said in those words", async () => {
    // KF70 does exactly this while still listed as serving these grids.
    fetchMock.mockResolvedValue(jsonResponse({}, 404));

    const result = await fetchLatestObservation("KF70", OBSERVED);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("not publishing");
    expect(result.drift).toBe(false);
  });

  test("another bad status is reported with its number", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    const result = await fetchLatestObservation("KNKX", OBSERVED);
    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("503");
  });

  test("a request that never completes is unavailable, not a throw", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));

    const result = await fetchLatestObservation("KNKX", OBSERVED);
    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("socket hang up");
  });

  test("a changed unit is flagged as drift, separately from a quiet station", async () => {
    const knots = {
      properties: {
        ...CAPTURED_OBS.properties,
        windSpeed: { unitCode: "wmoUnit:kn", value: 9.36 },
      },
    };
    fetchMock.mockResolvedValue(jsonResponse(knots));

    const result = await fetchLatestObservation("KNKX", OBSERVED);
    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    // Drift is a bug to chase here; a quiet station is a bad day upstream.
    expect(result.drift).toBe(true);
  });

  test("a station answering with nothing is quiet rather than drifted", async () => {
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
    fetchMock.mockResolvedValue(jsonResponse(empty));

    const result = await fetchLatestObservation("D3101", OBSERVED);
    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(false);
  });

  test("a body that is not JSON is reported as such", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token <");
      },
    });

    const result = await fetchLatestObservation("KNKX", OBSERVED);
    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("not JSON");
  });
});
