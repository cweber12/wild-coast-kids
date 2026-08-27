/**
 * The only module here that touches the conditions upstreams.
 *
 * It was "the only module that touches NOAA" while NOAA was all of them. CDIP
 * is the second publisher, and it belongs here rather than in a module of its
 * own for the reason `sessions.ts` does not: what separates a module here is a
 * different failure vocabulary and a different cache policy, and MOP has
 * neither -- it fails into the same `unavailable` shape and is cached the same
 * way. `sessions.ts` reads Supabase, shares none of that, and follows this
 * module's form without joining it.
 *
 * Fetching, caching and deciding what a failure means live together for these
 * four feeds, and nowhere else: the parsers next door are pure so they can be asserted against committed
 * payloads, and a component that wants a reading calls this rather than reaching
 * for `fetch`.
 *
 * CACHING, verified against this version of Next rather than assumed. `fetch` is
 * **not** cached by default in Next 16 -- a change from earlier versions -- so an
 * un-opted request would reach NOAA on every render. Every request here therefore
 * names its own `next.revalidate`, in seconds:
 *
 *   Predictions  6 hours. Tide predictions are astronomical; they do not change
 *                between requests at all. The only reason to refetch is to roll
 *                the window forward as days pass.
 *
 *   MOP          3 hours, the interval the model's own estimates sit on. Asking
 *                more often cannot return a different value.
 *
 * The route that renders this sets its own, shorter, page-level revalidate so
 * that "today" does not go stale; see `app/conditions/page.tsx`. Page
 * revalidation and fetch revalidation are separate caches, which is what lets the
 * page re-render often while NOAA is asked four times a day.
 *
 * FAILURE POLICY. Nothing here throws. Every failure becomes an `unavailable`
 * result carrying the reason and the URL, because the reason is owed to the
 * reader: a tide panel that cannot answer must say so in words, and must never
 * render a blank or a zero that reads as calm. Format drift is flagged
 * separately from a quiet feed, because drift is a bug to chase rather than a
 * source having a bad day.
 *
 * NOT ENFORCED YET: there is no build-time guard stopping a client component
 * from importing this. The `server-only` package is the intended enforcement and
 * is not installed -- it throws when resolved under jsdom, which would take the
 * test suite with it until vitest is configured with the `react-server` resolve
 * condition. The gap is recorded in `beaches.json`'s unresolved list rather than
 * left for someone to discover.
 */

import {
  coopsPredictionsUrl,
  CoopsDriftError,
  parseCoopsHiLo,
  type CoopsRequestContract,
  type TideExtreme,
} from "./coops-predictions";
import {
  NdbcDriftError,
  NdbcNoDataError,
  type NdbcAirObservation,
  parseNdbcAirObservation,
  parseNdbcRealtime2,
  type WaveObservation,
} from "./ndbc-realtime2";
import {
  MopDriftError,
  type MopForecast,
  MopNoDataError,
  mopForecastUrl,
  type MopRequestContract,
  parseMopForecast,
} from "./mop-forecast";
import {
  type GridpointForecast,
  gridpointUrl,
  NwsGridpointDriftError,
  NwsGridpointNoDataError,
  parseGridpointForecast,
} from "./nws-gridpoint";
import {
  NwsObservationDriftError,
  NwsObservationNoDataError,
  parseNwsObservation,
  type StationObservation,
} from "./nws-observation";

/** Six hours. Astronomical predictions do not change; the window only rolls forward. */
export const PREDICTIONS_REVALIDATE_SECONDS = 21600;

/** Sent on every request so this site is identifiable in NOAA's logs. */
const USER_AGENT =
  "wild-coast-kids/0.1 (+https://github.com/cweber12/wild-coast-kids) conditions";

export type PredictionsResult =
  | { kind: "ok"; extremes: TideExtreme[]; url: string }
  | {
      kind: "unavailable";
      /** Why there is no reading, in a sentence fit to show a reader. */
      reason: string;
      /** True when the payload shape drifted, which is a bug rather than a quiet feed. */
      drift: boolean;
      url: string;
    };

/**
 * Fetch a station's predicted high and low tides for a date range.
 *
 * Never throws.
 */
export async function fetchTideExtremes(
  contract: CoopsRequestContract,
): Promise<PredictionsResult> {
  const url = coopsPredictionsUrl(contract);

  const unavailable = (reason: string, drift = false): PredictionsResult => ({
    kind: "unavailable",
    reason,
    drift,
    url,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: PREDICTIONS_REVALIDATE_SECONDS },
    });
  } catch (cause) {
    return unavailable(
      `The request to NOAA for station ${contract.stationId} did not complete: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!response.ok) {
    return unavailable(
      `NOAA returned HTTP ${response.status} for station ${contract.stationId}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    return unavailable(
      `NOAA's response for station ${contract.stationId} was not JSON: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  try {
    // This can throw on a 200: CO-OPS serves {"error":{...}} with HTTP 200, and
    // the parser treats that as the dead response it is.
    return { kind: "ok", extremes: parseCoopsHiLo(payload, contract), url };
  } catch (cause) {
    if (cause instanceof CoopsDriftError) {
      return unavailable(cause.message, true);
    }
    return unavailable(cause instanceof Error ? cause.message : String(cause));
  }
}

/* ===========================================================================
 * NDBC waves and water temperature
 * ========================================================================= */

/**
 * Fifteen minutes. These buoys publish about every thirty, so a quarter-hour
 * never serves a reading more than one cycle stale, and asking more often would
 * cost NDBC requests that cannot return anything new.
 */
export const WAVES_REVALIDATE_SECONDS = 900;

/**
 * Beyond this, a "current" reading is not current. These buoys publish about
 * every thirty minutes, so three hours means at least five missed cycles: the
 * buoy is answering and not reporting. Reported as unknown rather than as a
 * stale number wearing no warning.
 */
export const MAX_WAVE_AGE_MINUTES = 180;

const NDBC_BASE = "https://www.ndbc.noaa.gov/data/realtime2";

export type WaveResult =
  | {
      kind: "ok";
      observation: WaveObservation;
      ageMinutes: number;
      url: string;
    }
  | { kind: "unavailable"; reason: string; drift: boolean; url: string };

/**
 * Fetch one buoy's newest wave observation.
 *
 * Never throws. `nowMs` is passed in rather than read here, so the freshness
 * limit is testable against a fixed instant and no clock is read during a
 * render.
 */
export async function fetchLatestWave(
  buoyId: string,
  nowMs: number,
): Promise<WaveResult> {
  const url = `${NDBC_BASE}/${buoyId}.txt`;

  const unavailable = (reason: string, drift = false): WaveResult => ({
    kind: "unavailable",
    reason,
    drift,
    url,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: WAVES_REVALIDATE_SECONDS },
    });
  } catch (cause) {
    return unavailable(
      `The request to NDBC for buoy ${buoyId} did not complete: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (response.status === 404) {
    // What a decommissioned buoy does. Its entry in NDBC's active station list
    // can outlive it, which is why the inventory records measured delivery.
    return unavailable(
      `NDBC ${buoyId} returns 404 for its observations. The buoy is not publishing.`,
    );
  }
  if (!response.ok) {
    return unavailable(
      `NDBC returned HTTP ${response.status} for buoy ${buoyId}.`,
    );
  }

  let observation: WaveObservation;
  try {
    observation = parseNdbcRealtime2(await response.text(), buoyId);
  } catch (cause) {
    if (cause instanceof NdbcDriftError)
      return unavailable(cause.message, true);
    if (cause instanceof NdbcNoDataError) return unavailable(cause.message);
    return unavailable(cause instanceof Error ? cause.message : String(cause));
  }

  const ageMinutes = (nowMs - observation.atMs) / 60_000;
  if (ageMinutes > MAX_WAVE_AGE_MINUTES) {
    return unavailable(
      `NDBC ${buoyId}'s newest observation is ${Math.round(ageMinutes)} minutes old, past the ` +
        `${MAX_WAVE_AGE_MINUTES} minute limit. Reported as unknown rather than as a current reading.`,
    );
  }

  return { kind: "ok", observation, ageMinutes, url };
}

/* ===========================================================================
 * NWS station observations: visibility, wind, air temperature and sky
 * ========================================================================= */

/**
 * Fifteen minutes, matching the page's own revalidate. These stations publish
 * hourly, with unscheduled specials when conditions change sharply — and a
 * special is exactly the moment worth catching, since it is what a bank of fog
 * rolling in looks like from here.
 */
export const OBSERVATIONS_REVALIDATE_SECONDS = 900;

/**
 * Beyond this, a "current" observation is not current. These stations publish
 * hourly, so three hours means at least three missed cycles: the station is
 * answering and not observing. Reported as unknown rather than as a stale
 * number wearing no warning.
 */
export const MAX_OBSERVATION_AGE_MINUTES = 180;

const NWS_BASE = "https://api.weather.gov";

export type ObservationResult =
  | {
      kind: "ok";
      observation: StationObservation;
      ageMinutes: number;
      url: string;
    }
  | { kind: "unavailable"; reason: string; drift: boolean; url: string };

/**
 * Fetch one station's newest observation.
 *
 * Never throws. `nowMs` is passed in rather than read here, so the freshness
 * limit is testable against a fixed instant and no clock is read during a
 * render.
 */
export async function fetchLatestObservation(
  stationId: string,
  nowMs: number,
): Promise<ObservationResult> {
  const url = `${NWS_BASE}/stations/${stationId}/observations/latest`;

  const unavailable = (reason: string, drift = false): ObservationResult => ({
    kind: "unavailable",
    reason,
    drift,
    url,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: OBSERVATIONS_REVALIDATE_SECONDS },
    });
  } catch (cause) {
    return unavailable(
      `The request to the National Weather Service for station ${stationId} did not ` +
        `complete: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (response.status === 404) {
    // What a retired station does while still listed as serving a grid. KF70
    // does exactly this, which is why the inventory records measured delivery.
    return unavailable(
      `NWS ${stationId} returns 404 for its latest observation. The station is not publishing.`,
    );
  }
  if (!response.ok) {
    return unavailable(
      `The National Weather Service returned HTTP ${response.status} for station ${stationId}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    return unavailable(
      `The National Weather Service's response for station ${stationId} was not JSON: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  let observation: StationObservation;
  try {
    observation = parseNwsObservation(payload, stationId);
  } catch (cause) {
    if (cause instanceof NwsObservationDriftError)
      return unavailable(cause.message, true);
    if (cause instanceof NwsObservationNoDataError)
      return unavailable(cause.message);
    return unavailable(cause instanceof Error ? cause.message : String(cause));
  }

  const ageMinutes = (nowMs - observation.atMs) / 60_000;
  if (ageMinutes > MAX_OBSERVATION_AGE_MINUTES) {
    return unavailable(
      `NWS ${stationId}'s newest observation is ${Math.round(ageMinutes)} minutes old, past ` +
        `the ${MAX_OBSERVATION_AGE_MINUTES} minute limit. Reported as unknown rather than as ` +
        `a current reading.`,
    );
  }

  return { kind: "ok", observation, ageMinutes, url };
}

/* =========================================================================
 * NDBC station air: temperature and wind, from the second network
 * ========================================================================= */

/**
 * What a coastal NDBC station's air reading comes back as.
 *
 * The same three fields the NWS reading offers for air, converted the same way,
 * so `conditions.ts` can hold one shape whichever network answered. What it does
 * NOT carry is sky or visibility: `realtime2` has no column for either, which is
 * the whole reason the sky binding is a second station. See ADR 0010.
 *
 * Each field is aged independently, so a station reporting wind every six
 * minutes and temperature every hour yields a current wind rather than nothing.
 */
export type AirReadingResult =
  | {
      kind: "ok";
      airTempF: number | null;
      windMph: number | null;
      gustMph: number | null;
      windDirDegT: number | null;
      url: string;
    }
  | { kind: "unavailable"; reason: string; drift: boolean; url: string };

/**
 * Fetch one NDBC station's newest air temperature and wind.
 *
 * Never throws. Reuses `MAX_OBSERVATION_AGE_MINUTES` rather than introducing a
 * limit of its own: what counts as a current air reading is a property of air,
 * not of who published it. Applied per field, because that is what the parser
 * hands back and it is the point of the parser.
 */
export async function fetchLatestNdbcAir(
  stationId: string,
  nowMs: number,
): Promise<AirReadingResult> {
  const url = `${NDBC_BASE}/${stationId}.txt`;

  const unavailable = (reason: string, drift = false): AirReadingResult => ({
    kind: "unavailable",
    reason,
    drift,
    url,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: OBSERVATIONS_REVALIDATE_SECONDS },
    });
  } catch (cause) {
    return unavailable(
      `The request to NDBC for station ${stationId} did not complete: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (response.status === 404) {
    // What a listed-but-retired station does. NPQC1 and TIQC1 do exactly this,
    // which is why the station table records measured delivery.
    return unavailable(
      `NDBC ${stationId} returns 404 for realtime2. The station is not publishing.`,
    );
  }
  if (!response.ok) {
    return unavailable(
      `NDBC returned HTTP ${response.status} for station ${stationId}.`,
    );
  }

  let observation: NdbcAirObservation;
  try {
    observation = parseNdbcAirObservation(await response.text(), stationId);
  } catch (cause) {
    if (cause instanceof NdbcDriftError)
      return unavailable(cause.message, true);
    if (cause instanceof NdbcNoDataError) return unavailable(cause.message);
    return unavailable(cause instanceof Error ? cause.message : String(cause));
  }

  /** Null once a field's own row is older than the limit. */
  const fresh = <T>(reading: { atMs: number } | null, value: T): T | null =>
    reading !== null &&
    (nowMs - reading.atMs) / 60_000 <= MAX_OBSERVATION_AGE_MINUTES
      ? value
      : null;

  const airTempF = fresh(
    observation.airTemp,
    observation.airTemp === null
      ? null
      : observation.airTemp.celsius * 1.8 + 32,
  );
  const windMph = fresh(
    observation.wind,
    observation.wind === null ? null : observation.wind.speedMps * 2.236936,
  );

  if (airTempF === null && windMph === null) {
    // Both fields aged out, so the station is answering with nothing current.
    // Distinct from a station that publishes no temperature: that one still
    // gives a wind, and this one gives nothing.
    return unavailable(
      `NDBC ${stationId} has published no air temperature or wind inside the last ` +
        `${MAX_OBSERVATION_AGE_MINUTES} minutes. Reported as unknown rather than as a ` +
        `current reading.`,
    );
  }

  return {
    kind: "ok",
    airTempF,
    windMph,
    // Gust and direction ride on the wind's own freshness: they came off that
    // row, and without a current speed they describe nothing.
    gustMph: fresh(
      observation.wind,
      observation.wind?.gustMps == null
        ? null
        : observation.wind.gustMps * 2.236936,
    ),
    windDirDegT: fresh(observation.wind, observation.wind?.dirDegT ?? null),
    url,
  };
}

/* =========================================================================
 * CDIP MOP: the wave forecast the week grid reads
 * ========================================================================= */

/**
 * Three hours, which is the interval the estimates themselves sit on.
 *
 * Asking more often cannot return a different value: the model publishes on a
 * three-hour grid, so a cached response is at most one grid step behind the
 * newest one there could be. The run observed on 2026-08-26 rewrote all 1,210
 * San Diego lines inside the 07:00 UTC hour, so the rerun cadence is at most
 * daily and this is generous rather than tight. Longer than the readings above
 * for the same reason it can be: this fills a row about the week, where a few
 * hours of staleness changes nothing a reader would act on differently.
 */
export const MOP_FORECAST_REVALIDATE_SECONDS = 10800;

/**
 * How much of an NCSS error body is quoted back. These are one short sentence
 * -- 39 bytes for the one that matters -- and a cap stops an HTML error page
 * from arriving in a reader's disclosure.
 */
const NCSS_ERROR_LIMIT = 200;

/** What NCSS says when the window it was given holds none of the file's times. */
const NO_FEATURES = "No features are in the requested subset";

export type MopForecastResult =
  | { kind: "ok"; forecast: MopForecast; url: string }
  | { kind: "unavailable"; reason: string; drift: boolean; url: string };

/**
 * Fetch one MOP line's forecast for a window.
 *
 * Never throws.
 *
 * NCSS ANSWERS 400 FOR TWO DIFFERENT THINGS and they are not the same kind of
 * problem, so the body is read rather than the status alone. A window holding
 * none of the file's times means the forecast has not been rerun and is now
 * behind us -- a quiet feed, and the reader is told to come back. A variable
 * this site asks for and the dataset does not carry is drift, and a bug to
 * chase here.
 */
export async function fetchMopForecast(
  contract: MopRequestContract,
): Promise<MopForecastResult> {
  const url = mopForecastUrl(contract);
  const { lineId } = contract;

  const unavailable = (reason: string, drift = false): MopForecastResult => ({
    kind: "unavailable",
    reason,
    drift,
    url,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: MOP_FORECAST_REVALIDATE_SECONDS },
    });
  } catch (cause) {
    return unavailable(
      `The request to CDIP for MOP line ${lineId} did not complete: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (response.status === 404) {
    // What a line CDIP has stopped publishing does. The line table records
    // which lines carry a forecast, so this means that table has gone stale.
    return unavailable(
      `CDIP publishes no forecast file for MOP line ${lineId}. The line table needs re-probing.`,
    );
  }

  if (response.status === 400) {
    const detail = (await response.text()).trim().slice(0, NCSS_ERROR_LIMIT);
    if (detail.startsWith(NO_FEATURES)) {
      return unavailable(
        `CDIP's forecast for MOP line ${lineId} does not reach the week this page is showing. ` +
          `The model has not been rerun recently enough to cover it.`,
      );
    }
    return unavailable(
      `CDIP refused this site's request for MOP line ${lineId}: ${detail}`,
      true,
    );
  }

  if (!response.ok) {
    return unavailable(
      `CDIP returned HTTP ${response.status} for MOP line ${lineId}.`,
    );
  }

  try {
    return {
      kind: "ok",
      forecast: parseMopForecast(await response.text(), lineId),
      url,
    };
  } catch (cause) {
    if (cause instanceof MopDriftError) return unavailable(cause.message, true);
    if (cause instanceof MopNoDataError) return unavailable(cause.message);
    return unavailable(cause instanceof Error ? cause.message : String(cause));
  }
}

/* =========================================================================
 * NWS gridpoints: the cloud cover the week grid reads
 * ========================================================================= */

/**
 * One hour, which is the finest step this product moves on.
 *
 * The forecast itself sits on three- and six-hour blocks and the office reruns
 * it a few times a day, so an hour never serves a block that has been
 * superseded for long, and asking more often cannot return a different value.
 * Shorter than MOP's three hours because this feed's blocks are shorter and its
 * near end is the day a reader is standing in; longer than the observations
 * above because a forecast for a three-hour block does not change on the
 * quarter hour the way a special observation does.
 */
export const GRID_FORECAST_REVALIDATE_SECONDS = 3600;

export type GridForecastResult =
  | { kind: "ok"; forecast: GridpointForecast; url: string }
  | { kind: "unavailable"; reason: string; drift: boolean; url: string };

/**
 * Fetch one forecast cell's sky cover and present weather.
 *
 * Never throws.
 *
 * THE 404 HERE MEANS THE BINDING HAS GONE STALE, not that the sky is unknown.
 * `/gridpoints` answers for a cell that exists, and the National Weather
 * Service re-grids without notice -- ADR-0009 names a re-gridded forecast point
 * as one of the things this repo owns that rots. So the reason says to re-probe
 * rather than telling a reader to come back later.
 */
export async function fetchGridForecast(
  cellId: string,
): Promise<GridForecastResult> {
  const url = gridpointUrl(cellId);

  const unavailable = (reason: string, drift = false): GridForecastResult => ({
    kind: "unavailable",
    reason,
    drift,
    url,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: GRID_FORECAST_REVALIDATE_SECONDS },
    });
  } catch (cause) {
    return unavailable(
      `The request to the National Weather Service for forecast cell ${cellId} did not ` +
        `complete: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (response.status === 404) {
    return unavailable(
      `The National Weather Service publishes no forecast for cell ${cellId}. The grid has ` +
        `moved and the cell binding needs re-probing.`,
      true,
    );
  }
  if (!response.ok) {
    return unavailable(
      `The National Weather Service returned HTTP ${response.status} for forecast cell ${cellId}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    return unavailable(
      `The National Weather Service's response for forecast cell ${cellId} was not JSON: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  try {
    return {
      kind: "ok",
      forecast: parseGridpointForecast(payload, cellId),
      url,
    };
  } catch (cause) {
    if (cause instanceof NwsGridpointDriftError)
      return unavailable(cause.message, true);
    if (cause instanceof NwsGridpointNoDataError)
      return unavailable(cause.message);
    return unavailable(cause instanceof Error ? cause.message : String(cause));
  }
}
