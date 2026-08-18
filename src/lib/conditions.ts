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
 * What the view renders. Four states, kept distinct on purpose, because the
 * dangerous direction is any of the last three reading as a calm sea:
 *
 *   reading        a predicted low for today
 *   no-low-today   the window held none, which is a gap in our request
 *   no-station     the join bound no station to this beach at all
 *   unavailable    a station exists and upstream could not answer
 *
 * `no-station` is a permanent fact about the place; `unavailable` is a transient
 * fact about the feed. Collapsing them would tell a reader to try again later
 * about something that will never work, or the reverse.
 */
export type TideTodayState =
  | { kind: "reading"; timeLabel: string; feet: number }
  | { kind: "no-low-today" }
  | { kind: "no-station"; reason: string }
  | {
      kind: "unavailable";
      /** The exact upstream reason, for the disclosure. */
      detail: string;
      /** True when the payload shape drifted, which is a bug here rather than a quiet feed. */
      drift: boolean;
    };

export interface TideTodayView {
  beachName: string;
  /** null exactly when the state is `no-station`. */
  station: { name: string; water: string; distanceM: number | null } | null;
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
 * rather than a quiet feed. Everything an upstream can do wrong, and every beach
 * the join could not bind, arrives as a state instead.
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
  if (station === null) {
    return {
      beachName: beach.name,
      station: null,
      state: {
        kind: "no-station",
        reason:
          beach.tide_station_null_reason ??
          "the join bound no tide station to this beach, and recorded no reason",
      },
    };
  }

  const binding = {
    beachName: beach.name,
    station: {
      name: station.name,
      water: station.water,
      distanceM: beach.tide_station_distance_m,
    },
  };

  const result = await fetchTideExtremes({
    stationId: station.id,
    beginDate: compact(localDateOf(nowMs - ONE_DAY_MS)),
    endDate: compact(localDateOf(nowMs + ONE_DAY_MS)),
  });

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
