/**
 * The only module here that touches NOAA.
 *
 * Not the only one that touches the network any more: `sessions.ts` reads the
 * schedule from Supabase and follows this module's shape deliberately. The two
 * stay apart because they share no upstream, no failure vocabulary and no
 * cache policy -- only a form.
 *
 * Fetching, caching and deciding what a failure means live together for these
 * three feeds, and nowhere else: the parsers next door are pure so they can be asserted against committed
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
  parseNdbcRealtime2,
  type WaveObservation,
} from "./ndbc-realtime2";
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
