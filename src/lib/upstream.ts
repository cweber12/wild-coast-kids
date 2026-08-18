/**
 * The only module here that touches the network.
 *
 * Fetching, caching and deciding what a failure means live together, and nowhere
 * else: the parsers next door are pure so they can be asserted against committed
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
