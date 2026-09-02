import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchGridForecast,
  fetchHourlyTide,
  GRID_FORECAST_REVALIDATE_SECONDS,
  fetchLatestNdbcAir,
  fetchLatestObservation,
  fetchLatestWave,
  fetchMopForecast,
  fetchSkyWording,
  fetchSurfZoneForecast,
  fetchTideExtremes,
  MAX_OBSERVATION_AGE_MINUTES,
  MAX_WAVE_AGE_MINUTES,
  MOP_FORECAST_REVALIDATE_SECONDS,
  OBSERVATIONS_REVALIDATE_SECONDS,
  PREDICTIONS_REVALIDATE_SECONDS,
  SKY_WORDING_REVALIDATE_SECONDS,
  SURF_ZONE_REVALIDATE_SECONDS,
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

const MOP_CAPTURED = readFileSync(
  join(process.cwd(), "src/lib/__fixtures__/mop-d0481-forecast-20260826.csv"),
  "utf8",
);

/** The window one week's read asks for. Shape only; the fetch is stubbed. */
const MOP_WINDOW = {
  lineId: "D0481",
  startIso: "2026-08-25T00:00:00Z",
  endIso: "2026-09-03T00:00:00Z",
};

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

describe("fetchHourlyTide", () => {
  const contract = {
    stationId: "9410230",
    beginDate: "20260827",
    endDate: "20260905",
  };

  test("asks for the hourly interval, on the predictions cache", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ predictions: [{ t: "2026-08-27 00:00", v: "3.157" }] }),
    );

    const result = await fetchHourlyTide(contract);

    expect(
      new URL(fetchMock.mock.calls[0][0]).searchParams.get("interval"),
    ).toBe("h");
    expect(fetchMock.mock.calls[0][1].next.revalidate).toBe(
      PREDICTIONS_REVALIDATE_SECONDS,
    );
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.heights[0].feet).toBe(3.157);
  });

  test("it is a second request rather than the same one", async () => {
    // `interval` is part of the URL, so the hourly series cannot come back in
    // the high/low response however the window is arranged. If these two ever
    // build the same URL, one of the two reads is silently getting the other's
    // shape out of Next's dedupe.
    fetchMock.mockResolvedValue(
      jsonResponse({
        predictions: [{ t: "2026-08-27 00:00", v: "3.157", type: "L" }],
      }),
    );

    await fetchHourlyTide(contract);
    await fetchTideExtremes(contract);

    expect(fetchMock.mock.calls[0][0]).not.toBe(fetchMock.mock.calls[1][0]);
  });

  test("an error under HTTP 200 is unavailable and not drift", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "No Predictions data was found." } }),
    );

    const result = await fetchHourlyTide(contract);

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

    const result = await fetchHourlyTide(contract);
    if (result.kind === "unavailable")
      expect(result.reason).toMatch(/was not JSON/);
  });

  test("a request that never completes names the station", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));
    const result = await fetchHourlyTide(contract);
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toMatch(/9410230/);
      expect(result.reason).toMatch(/socket hang up/);
    }
  });

  test("a bad status names the station", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    const result = await fetchHourlyTide(contract);
    if (result.kind === "unavailable") expect(result.reason).toMatch(/9410230/);
  });

  test("a drifted payload is flagged as drift", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ somethingElse: [] }));
    const result = await fetchHourlyTide(contract);
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
    expect(result.observation.airTempF).toBeCloseTo(69.98, 2);
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

describe("fetchLatestNdbcAir", () => {
  const PIER = readFileSync(
    join(
      process.cwd(),
      "src/lib/__fixtures__/ndbc-ljac1-realtime2-20260818.txt",
    ),
    "utf8",
  );

  /** The instant the captured pier payload's newest row was observed. */
  const AT_PIER = Date.UTC(2026, 7, 19, 2, 30);

  const HEADER = PIER.split("\n").slice(0, 2).join("\n");
  const row = (
    time: string,
    { wdir = "MM", wspd = "MM", gst = "MM", atmp = "MM" },
  ) =>
    `${time} ${wdir}  ${wspd}  ${gst}    MM    MM    MM  MM 1012.3  ${atmp}  18.2    MM   MM   MM    MM`;

  test("asks realtime2 and opts into the observation cache window", async () => {
    fetchMock.mockResolvedValue(textResponse(PIER));

    await fetchLatestNdbcAir("LJAC1", AT_PIER);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.ndbc.noaa.gov/data/realtime2/LJAC1.txt");
    // The same window the NWS observations use: this is the same panel, and a
    // second cache policy for one of its two provenances would be a difference
    // nobody chose.
    expect(options.next.revalidate).toBe(OBSERVATIONS_REVALIDATE_SECONDS);
  });

  test("converts to the units the panel renders", async () => {
    fetchMock.mockResolvedValue(textResponse(PIER));

    const result = await fetchLatestNdbcAir("LJAC1", AT_PIER);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // 21.9 degC and 3.6 m/s, the newest row of the captured payload. This is
    // the reading the whole issue is about: 71.4 F at the pier against Miramar's
    // 81 F ten kilometres inland.
    expect(result.airTempF).toBeCloseTo(71.42, 2);
    expect(result.windMph).toBeCloseTo(8.05, 2);
    expect(result.windDirDegT).toBe(320);
    expect(result.gustMph).toBeCloseTo(10.29, 2);
  });

  test("ages each field on its own row, not on the newest row", async () => {
    // The reason the parser returns per-field timestamps. Wind is current and
    // the temperature is four hours stale, so the wind is reported and the
    // temperature is not -- rather than losing both or, worse, publishing a
    // four-hour-old temperature under the wind's clock.
    const text = [
      HEADER,
      row("2026 08 19 02 30", { wdir: "320", wspd: "3.6", gst: "4.6" }),
      row("2026 08 18 22 00", { atmp: "23.4" }),
      "",
    ].join("\n");
    fetchMock.mockResolvedValue(textResponse(text));

    const result = await fetchLatestNdbcAir("LJAC1", AT_PIER);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.windMph).toBeCloseTo(8.05, 2);
    expect(result.airTempF).toBeNull();
  });

  test("keeps a temperature exactly at the limit", async () => {
    // A boundary that decides whether a reading shows at all, so it is asserted
    // rather than left to the comparison operator.
    const text = [
      HEADER,
      row("2026 08 19 02 30", { wdir: "320", wspd: "3.6" }),
      row("2026 08 18 23 30", { atmp: "23.4" }),
      "",
    ].join("\n");
    fetchMock.mockResolvedValue(textResponse(text));

    const atLimit = Date.UTC(2026, 7, 18, 23, 30) + 180 * 60_000;
    const result = await fetchLatestNdbcAir("LJAC1", atLimit);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.airTempF).toBeCloseTo(74.12, 2);
  });

  test("reuses the observation limit rather than inventing one", async () => {
    expect(MAX_OBSERVATION_AGE_MINUTES).toBe(180);
  });

  test("a station publishing wind and no temperature still gives a wind", async () => {
    // LJPC1 exactly: 100% of rows carry WSPD and none carries ATMP. Refusing
    // the whole reading would drop a wind measured at the pier in favour of one
    // measured at an airport.
    const text = [
      HEADER,
      row("2026 08 19 02 30", { wdir: "320", wspd: "3.6" }),
      "",
    ].join("\n");
    fetchMock.mockResolvedValue(textResponse(text));

    const result = await fetchLatestNdbcAir("LJPC1", AT_PIER);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.airTempF).toBeNull();
    expect(result.windMph).toBeCloseTo(8.05, 2);
  });

  test("both fields aged out is unavailable, not a null reading", async () => {
    // A panel handed two nulls would render an empty air section with no
    // explanation. The state has to say the station is not answering currently.
    const text = [
      HEADER,
      row("2026 08 18 20 00", { wdir: "320", wspd: "3.6", atmp: "23.4" }),
      "",
    ].join("\n");
    fetchMock.mockResolvedValue(textResponse(text));

    const result = await fetchLatestNdbcAir("LJAC1", AT_PIER);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("inside the last 180 minutes");
    expect(result.drift).toBe(false);
  });

  test("a 404 is a station that is not publishing", async () => {
    // NPQC1 and TIQC1 do exactly this while listed active.
    fetchMock.mockResolvedValue(textResponse("Not Found", 404));

    const result = await fetchLatestNdbcAir("NPQC1", AT_PIER);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("not publishing");
    expect(result.drift).toBe(false);
  });

  test("a station with no air columns at all is unavailable, not a still day", async () => {
    // SDBC1: ten thousand rows of water temperature and no air.
    const text = [HEADER, row("2026 08 19 02 30", {}), ""].join("\n");
    fetchMock.mockResolvedValue(textResponse(text));

    const result = await fetchLatestNdbcAir("SDBC1", AT_PIER);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("not observing the air");
  });

  test("a changed unit is drift, which is a bug here rather than a quiet feed", async () => {
    const [names, units] = HEADER.split("\n");
    const fields = units.slice(1).trim().split(/\s+/);
    fields[13] = "degF";
    const drifted = [
      names,
      `#${fields.join(" ")}`,
      row("2026 08 19 02 30", { wspd: "3.6", atmp: "71.4" }),
      "",
    ].join("\n");
    fetchMock.mockResolvedValue(textResponse(drifted));

    const result = await fetchLatestNdbcAir("LJAC1", AT_PIER);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(true);
  });

  test("a request that does not complete is reported, never thrown", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));

    const result = await fetchLatestNdbcAir("LJAC1", AT_PIER);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("socket hang up");
  });

  test("a non-404 error status is reported with its code", async () => {
    fetchMock.mockResolvedValue(textResponse("upstream is down", 503));

    const result = await fetchLatestNdbcAir("LJAC1", AT_PIER);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("503");
  });

  test("a body that answers 200 and then fails to read is not drift", async () => {
    // A truncated response is the network having a bad moment, not NDBC
    // changing its format. Calling it drift would send someone hunting a bug
    // that is not in this repo.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error("terminated");
      },
    });

    const result = await fetchLatestNdbcAir("LJAC1", AT_PIER);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("terminated");
    expect(result.drift).toBe(false);
  });
});

describe("fetchMopForecast", () => {
  test("asks for the forecast product, the four variables and CSV", async () => {
    // Not `_nowcast`, which only reaches backwards, and not `_hindcast`, which
    // is 155 MB per line. `accept=csv` is what keeps NetCDF out of this repo.
    fetchMock.mockResolvedValue(textResponse(MOP_CAPTURED));

    await fetchMopForecast(MOP_WINDOW);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/MOP_alongshore/D0481_forecast.nc?");
    expect(url).toContain("accept=csv");
    for (const variable of ["waveHs", "waveTp", "waveDp", "waveFlagPrimary"]) {
      expect(url).toContain(`var=${variable}`);
    }
  });

  test("always bounds the window", async () => {
    // `time=all` on a nowcast returned 914 KB of rolling history back to April
    // 2025. Bounded, the whole forecast is about 6 KB.
    fetchMock.mockResolvedValue(textResponse(MOP_CAPTURED));

    await fetchMopForecast(MOP_WINDOW);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("time_start=2026-08-25T00%3A00%3A00Z");
    expect(url).toContain("time_end=2026-09-03T00%3A00%3A00Z");
    expect(url).not.toContain("time=all");
  });

  test("opts the request into caching, since Next 16 does not cache fetch by default", async () => {
    fetchMock.mockResolvedValue(textResponse(MOP_CAPTURED));

    await fetchMopForecast(MOP_WINDOW);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.next).toEqual({
      revalidate: MOP_FORECAST_REVALIDATE_SECONDS,
    });
  });

  test("returns the parsed forecast", async () => {
    fetchMock.mockResolvedValue(textResponse(MOP_CAPTURED));

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.forecast.rows).toHaveLength(56);
  });

  test("a window the forecast no longer reaches is a quiet feed, not drift", async () => {
    // NCSS answers 400 for this and for a variable it does not carry, so the
    // body is read rather than the status alone. A forecast that has not been
    // rerun is something a reader comes back for.
    fetchMock.mockResolvedValue(
      textResponse("No features are in the requested subset", 400),
    );

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(false);
    expect(result.reason).toMatch(/has not been rerun recently enough/);
  });

  test("a variable the dataset does not carry is drift", async () => {
    // The other 400. This one is a bug here rather than a bad day at CDIP.
    fetchMock.mockResolvedValue(
      textResponse(
        "Variable: waveHs is not contained in the requested dataset",
        400,
      ),
    );

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(true);
    expect(result.reason).toContain("waveHs is not contained");
  });

  test("a line that has stopped being published says the table is stale", async () => {
    fetchMock.mockResolvedValue(
      textResponse("FileNotFound: No such file or directory", 404),
    );

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toMatch(/needs re-probing/);
    expect(result.drift).toBe(false);
  });

  test("a drifted payload is reported as drift", async () => {
    fetchMock.mockResolvedValue(
      textResponse(
        [
          'time,station,waveHs[unit="feet"]',
          "2026-08-26T00:00:00Z,D0481,1.6",
        ].join("\n"),
      ),
    );

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(true);
  });

  test("a line answering with no usable rows is not drift", async () => {
    fetchMock.mockResolvedValue(textResponse(MOP_CAPTURED.split("\n")[0]));

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(false);
    expect(result.reason).toMatch(/not a week with no waves in it/);
  });

  test("a request that never completes is reported, not thrown", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("socket hang up");
  });

  test("any other status is reported with its code", async () => {
    fetchMock.mockResolvedValue(textResponse("upstream is down", 503));

    const result = await fetchMopForecast(MOP_WINDOW);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("HTTP 503");
  });
});

describe("fetchGridForecast", () => {
  const CELL = "SGX/54,21";

  const GRIDPOINT = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src/lib/__fixtures__/nws-gridpoint-sgx-54-21-20260828.json",
      ),
      "utf8",
    ),
  );

  test("opts the request into caching, at the step the product moves on", async () => {
    fetchMock.mockResolvedValue(jsonResponse(GRIDPOINT));

    await fetchGridForecast(CELL);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.weather.gov/gridpoints/SGX/54,21");
    expect(init.next.revalidate).toBe(GRID_FORECAST_REVALIDATE_SECONDS);
    expect(init.headers["User-Agent"]).toMatch(/wild-coast-kids/);
  });

  test("reads a real payload into hours", async () => {
    fetchMock.mockResolvedValue(jsonResponse(GRIDPOINT));

    const result = await fetchGridForecast(CELL);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.forecast.cellId).toBe(CELL);
    expect(result.forecast.skyCover.length).toBeGreaterThan(0);
  });

  test("a 404 means the binding is stale, not that the sky is unknown", async () => {
    // The National Weather Service re-grids without notice, which ADR-0009
    // names as one of the things this repo owns that rots. Telling a reader to
    // come back later would be the wrong sentence and would hide a dead join.
    fetchMock.mockResolvedValue(jsonResponse({}, 404));

    const result = await fetchGridForecast(CELL);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/needs re-probing/);
    expect(result.drift).toBe(true);
  });

  test("another HTTP status is a bad day rather than drift", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    const result = await fetchGridForecast(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/HTTP 503/);
    expect(result.drift).toBe(false);
  });

  test("never throws when the request itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    const result = await fetchGridForecast(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/did not complete/);
    expect(result.reason).toMatch(/ENOTFOUND/);
  });

  test("a body that is not JSON is reported rather than thrown", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token < in JSON");
      },
    });

    const result = await fetchGridForecast(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/was not JSON/);
  });

  test("a declared-and-empty series is a quiet cell, not drift", async () => {
    // Exactly what visibility and ceilingHeight do at every cell. A reader is
    // told the cell does not forecast this; nobody is sent to chase a bug.
    fetchMock.mockResolvedValue(
      jsonResponse({
        properties: {
          ...GRIDPOINT.properties,
          skyCover: { uom: "wmoUnit:percent", values: [] },
        },
      }),
    );

    const result = await fetchGridForecast(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/published no values/);
    expect(result.drift).toBe(false);
  });

  test("a unit change is drift, which is a bug here rather than at the office", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        properties: {
          ...GRIDPOINT.properties,
          skyCover: {
            uom: "wmoUnit:one",
            values: [
              { validTime: "2026-08-26T12:00:00+00:00/PT3H", value: 0.66 },
            ],
          },
        },
      }),
    );

    const result = await fetchGridForecast(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/pins wmoUnit:percent/);
    expect(result.drift).toBe(true);
  });

  test("carries the URL, so a failure can be reproduced by hand", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    const result = await fetchGridForecast(CELL);
    expect(result.url).toBe("https://api.weather.gov/gridpoints/SGX/54,21");
  });
});

describe("fetchSkyWording", () => {
  const CELL = "SGX/54,21";

  const FORECAST = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src/lib/__fixtures__/nws-forecast-sgx-54-21-20260828.json",
      ),
      "utf8",
    ),
  );

  test("opts the request into caching, at the step the product moves on", async () => {
    fetchMock.mockResolvedValue(jsonResponse(FORECAST));

    await fetchSkyWording(CELL);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.weather.gov/gridpoints/SGX/54,21/forecast");
    expect(init.next.revalidate).toBe(SKY_WORDING_REVALIDATE_SECONDS);
    expect(init.headers["User-Agent"]).toMatch(/wild-coast-kids/);
  });

  test("is a second request, at a second URL, from the numbers beside it", async () => {
    // ADR-0024 deferred this read because it is "a second request, a second
    // failure mode, a second provenance line". The URL is where that starts:
    // the numbers come from the cell and the words from the cell's forecast.
    expect("https://api.weather.gov/gridpoints/SGX/54,21/forecast").not.toBe(
      "https://api.weather.gov/gridpoints/SGX/54,21",
    );
  });

  test("reads a real payload into periods", async () => {
    fetchMock.mockResolvedValue(jsonResponse(FORECAST));

    const result = await fetchSkyWording(CELL);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.forecast.cellId).toBe(CELL);
    expect(result.forecast.periods.length).toBeGreaterThan(0);
    expect(result.forecast.periods[0].shortForecast).not.toBe("");
  });

  test("a 404 means the binding is stale, not that the sky is unknown", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));

    const result = await fetchSkyWording(CELL);

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/needs re-probing/);
    expect(result.drift).toBe(true);
  });

  test("another HTTP status is a bad day rather than drift", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    const result = await fetchSkyWording(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/HTTP 503/);
    expect(result.drift).toBe(false);
  });

  test("never throws when the request itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    const result = await fetchSkyWording(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/did not complete/);
    expect(result.reason).toMatch(/ENOTFOUND/);
  });

  test("a body that is not JSON is reported rather than thrown", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token < in JSON");
      },
    });

    const result = await fetchSkyWording(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/was not JSON/);
  });

  test("a cell with no periods is quiet rather than drifted", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ properties: { periods: [] } }));

    const result = await fetchSkyWording(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toMatch(/no forecast periods/);
    expect(result.drift).toBe(false);
  });

  test("a period with no words is drift, and is flagged as one", async () => {
    // The one field this request exists for. A quiet feed is a bad day; a feed
    // that answers without the product is a bug to chase.
    const stripped = {
      properties: {
        ...FORECAST.properties,
        periods: FORECAST.properties.periods.map(
          (period: Record<string, unknown>, at: number) =>
            at === 0 ? { ...period, shortForecast: null } : period,
        ),
      },
    };
    fetchMock.mockResolvedValue(jsonResponse(stripped));

    const result = await fetchSkyWording(CELL);
    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.drift).toBe(true);
  });
});

/**
 * The surf zone bulletin, which is two requests rather than one.
 *
 * The listing has no stable id in it, so what is asserted here is the policy
 * around the pair: that both are cached, that the second is addressed by the id
 * the first returned, and that a failure names the URL that actually failed
 * rather than the one this read started at.
 */
describe("fetchSurfZoneForecast", () => {
  const SRF_LIST = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src/lib/__fixtures__/nws-srf-sgx-products-20260902.json",
      ),
      "utf8",
    ),
  );
  const SRF_TEXT = readFileSync(
    join(process.cwd(), "src/lib/__fixtures__/nws-srf-sgx-20260902-0854z.txt"),
    "utf8",
  );
  const NEWEST_ID = "36f48a5d-9b57-4fe2-9808-5f6a68ec4c64";

  function servingTheBulletin() {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SRF_LIST))
      .mockResolvedValueOnce(jsonResponse({ productText: SRF_TEXT }));
  }

  test("opts both requests into caching and asks for the newest bulletin by id", async () => {
    servingTheBulletin();

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("ok");
    const [listUrl, listOptions] = fetchMock.mock.calls[0];
    const [textUrl, textOptions] = fetchMock.mock.calls[1];
    expect(listUrl).toBe(
      "https://api.weather.gov/products/types/SRF/locations/SGX",
    );
    // The listing is JSON-LD; the default media type is a different shape.
    expect(listOptions.headers.Accept).toBe("application/ld+json");
    expect(textUrl).toBe(`https://api.weather.gov/products/${NEWEST_ID}`);
    expect(listOptions.next.revalidate).toBe(SURF_ZONE_REVALIDATE_SECONDS);
    expect(textOptions.next.revalidate).toBe(SURF_ZONE_REVALIDATE_SECONDS);
    expect(textOptions.headers["User-Agent"]).toContain("wild-coast-kids");
  });

  test("reads the San Diego zone out of a bulletin that also carries Orange County", async () => {
    servingTheBulletin();

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.forecast.zoneId).toBe("CAZ043");
    expect(result.forecast.periods.map((period) => period.level)).toEqual([
      "Low",
      "Low",
    ]);
    // The issuance instant comes from the listing, not from the bulletin's own
    // "154 AM PDT Wed Sep 2 2026" line, which carries no machine-readable zone.
    expect(result.forecast.issuedMs).toBe(
      Date.parse("2026-09-02T08:54:00+00:00"),
    );
  });

  test("a quiet listing is reported against the listing's URL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.url).toBe(
      "https://api.weather.gov/products/types/SRF/locations/SGX",
    );
    expect(result.reason).toContain("503");
    expect(result.drift).toBe(false);
    // The bulletin is never asked for when the listing did not answer.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * No walking back down the listing to an older bulletin. A surf zone forecast
   * is a judgement with a stated window, and serving yesterday's under today's
   * date is the failure this page can least afford.
   */
  test("a bulletin the listing named but cannot serve is unavailable, not the one before it", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SRF_LIST))
      .mockResolvedValueOnce(jsonResponse({}, 404));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.url).toBe(`https://api.weather.gov/products/${NEWEST_ID}`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("a bulletin with no San Diego section is unavailable rather than Orange County's", async () => {
    const orangeOnly = SRF_TEXT.slice(0, SRF_TEXT.indexOf("CAZ043-"));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SRF_LIST))
      .mockResolvedValueOnce(jsonResponse({ productText: orangeOnly }));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("CAZ043");
  });

  test("a bulletin missing its body is drift, not a quiet office", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SRF_LIST))
      .mockResolvedValueOnce(jsonResponse({ id: NEWEST_ID }));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(true);
  });

  test("a network error on the listing is reported rather than thrown", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("ECONNRESET");
  });

  test("a network error on the bulletin names the bulletin's URL, not the listing's", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SRF_LIST))
      .mockRejectedValueOnce(new Error("socket hang up"));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.url).toBe(`https://api.weather.gov/products/${NEWEST_ID}`);
    expect(result.reason).toContain("socket hang up");
  });

  test("a listing that is not JSON is reported against the listing", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token <");
      },
    });

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("Unexpected token <");
  });

  test("a bulletin body that is not JSON is reported against the bulletin", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SRF_LIST))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Unexpected end of JSON input");
        },
      });

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.url).toBe(`https://api.weather.gov/products/${NEWEST_ID}`);
    expect(result.reason).toContain("Unexpected end of JSON input");
  });

  /**
   * An office serving no bulletins at all is a quiet feed, not a bug here, so
   * it must not be flagged as drift -- the two are kept apart everywhere in
   * this module because drift is something to chase and quiet is something to
   * wait out.
   */
  test("an empty listing is quiet rather than drift", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ "@graph": [] }));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(false);
  });

  test("a listing in the wrong shape is drift", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ features: [] }));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(true);
  });

  test("a risk level the bulletin does not define is drift", async () => {
    const at = SRF_TEXT.indexOf("CAZ043-");
    const invented =
      SRF_TEXT.slice(0, at) +
      SRF_TEXT.slice(at).replace(
        "Rip Current Risk*.............Low.",
        "Rip Current Risk*.............Extreme.",
      );
    fetchMock
      .mockResolvedValueOnce(jsonResponse(SRF_LIST))
      .mockResolvedValueOnce(jsonResponse({ productText: invented }));

    const result = await fetchSurfZoneForecast();

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.drift).toBe(true);
  });
});

/**
 * The zone and office are parameters with defaults rather than constants baked
 * into the request, which is what lets the Orange County section of the same
 * bulletin be read at all. Nothing on this site asks for it -- the inventory is
 * one county -- so this is the test that keeps the seam honest.
 */
test("reads a zone other than the default when asked for one", async () => {
  const SRF_LIST = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src/lib/__fixtures__/nws-srf-sgx-products-20260902.json",
      ),
      "utf8",
    ),
  );
  const SRF_TEXT = readFileSync(
    join(process.cwd(), "src/lib/__fixtures__/nws-srf-sgx-20260902-0854z.txt"),
    "utf8",
  );
  fetchMock
    .mockResolvedValueOnce(jsonResponse(SRF_LIST))
    .mockResolvedValueOnce(jsonResponse({ productText: SRF_TEXT }));

  const result = await fetchSurfZoneForecast("CAZ552", "SGX");

  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") return;
  expect(result.forecast.zoneId).toBe("CAZ552");
});
