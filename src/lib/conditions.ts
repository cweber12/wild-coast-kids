/**
 * Composing one beach's conditions into something a component can render.
 *
 * This is where "now" is read, and that placement is the point. `Date.now()` is
 * impure, and React's purity rule rejects it inside a component for a good
 * reason: a value that changes between renders makes the render unstable. The
 * clock is request data, so resolving it belongs in the data layer beside the
 * fetch, and what reaches the view is a settled value model with no clock in it.
 *
 * `nowMs` is injectable so the day-selection behaviour is testable against fixed
 * instants rather than against whatever the test runner's clock says.
 */

import { beachBySlug, tideStationFor } from "./beaches";
import { localDateOf, localTimeOf } from "./pacific-time";
import { lowestLowOn } from "./tide-day";
import { fetchTideExtremes } from "./upstream";

/**
 * What the view renders. Three states, kept distinct on purpose: a reading, a
 * window that held no low for the day, and nothing available. Collapsing any two
 * of them would let one render as another, and the dangerous direction is an
 * absent reading reading as a calm sea.
 */
export type TideTodayState =
  | { kind: "reading"; timeLabel: string; feet: number }
  | { kind: "no-low-today" }
  | {
      /** Upstream could not answer. The wording shown to a reader belongs to the view. */
      kind: "unavailable";
      /** The exact upstream reason, for the disclosure. */
      detail: string;
      /** True when the payload shape drifted, which is a bug here rather than a quiet feed. */
      drift: boolean;
    };

export interface TideTodayView {
  beachName: string;
  stationName: string;
  stationRole: string;
  state: TideTodayState;
}

const ONE_DAY_MS = 86_400_000;

/** `YYYY-MM-DD` to the `YYYYMMDD` CO-OPS wants. */
function compact(localDate: string): string {
  return localDate.replaceAll("-", "");
}

/**
 * Read today's lowest low tide for one beach.
 *
 * The window asked for is yesterday through tomorrow in GMT dates, because the
 * request is made in GMT while the day is a Pacific day: today in California
 * straddles two GMT dates, so a window of exactly one would clip a late-evening
 * low off the end.
 *
 * Throws only when the slug is not in the inventory, which is a coding error
 * rather than a quiet feed. Everything an upstream can do wrong arrives as the
 * `unavailable` state instead.
 */
export async function readTodaysLowestLow(
  slug: string,
  nowMs: number = Date.now(),
): Promise<TideTodayView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readTodaysLowestLow: no beach in the inventory with slug "${slug}".`,
    );
  }
  const station = tideStationFor(beach);

  const result = await fetchTideExtremes({
    stationId: station.id,
    beginDate: compact(localDateOf(nowMs - ONE_DAY_MS)),
    endDate: compact(localDateOf(nowMs + ONE_DAY_MS)),
  });

  const binding = {
    beachName: beach.name,
    stationName: station.name,
    stationRole: station.role,
  };

  if (result.kind === "unavailable") {
    return {
      ...binding,
      state: {
        kind: "unavailable",
        detail: result.reason,
        drift: result.drift,
      },
    };
  }

  const lowest = lowestLowOn(result.extremes, localDateOf(nowMs));
  return {
    ...binding,
    state:
      lowest === null
        ? { kind: "no-low-today" }
        : {
            kind: "reading",
            timeLabel: localTimeOf(lowest.atMs),
            feet: lowest.feet,
          },
  };
}
