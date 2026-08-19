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

import {
  airStationFor,
  type Beach,
  beachBySlug,
  tideStationFor,
  waveBuoyFor,
  type WeatherStation,
  weatherStationFor,
} from "./beaches";
import { localDateOf, localTimeOf } from "./pacific-time";
import { lowestLowOn } from "./tide-day";
import {
  fetchLatestNdbcAir,
  fetchLatestObservation,
  fetchLatestWave,
  fetchTideExtremes,
} from "./upstream";

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

/**
 * What the waves view renders. The same three-way split as the tide, and for the
 * same reason: `no-buoy` is a permanent fact about a place, `unavailable` is a
 * transient fact about a feed.
 */
export type WavesState =
  | {
      kind: "reading";
      heightFt: number;
      periodS: number | null;
      directionDegT: number | null;
      waterTempF: number | null;
    }
  | { kind: "no-buoy"; reason: string }
  | { kind: "unavailable"; detail: string; drift: boolean };

export interface WavesView {
  beachName: string;
  /** null exactly when the state is `no-buoy`. */
  buoy: { name: string; distanceM: number | null } | null;
  state: WavesState;
}

/**
 * Read the newest wave observation for one beach.
 *
 * Throws only when the slug is not in the inventory. A beach the join bound no
 * buoy to -- every bay, lagoon and inlet -- arrives as `no-buoy` without a
 * request being made, because there is nothing to ask.
 */
export async function readLatestWaves(
  slug: string,
  nowMs: number = Date.now(),
): Promise<WavesView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readLatestWaves: no beach in the inventory with slug "${slug}".`,
    );
  }

  const buoy = waveBuoyFor(beach);
  if (buoy === null) {
    return {
      beachName: beach.name,
      buoy: null,
      state: {
        kind: "no-buoy",
        reason:
          beach.wave_buoy_null_reason ??
          "the join bound no wave buoy to this beach, and recorded no reason",
      },
    };
  }

  const binding = {
    beachName: beach.name,
    buoy: { name: buoy.name, distanceM: beach.wave_buoy_distance_m },
  };

  const result = await fetchLatestWave(buoy.id, nowMs);
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

  return {
    ...binding,
    state: {
      kind: "reading",
      heightFt: result.observation.heightFt,
      periodS: result.observation.periodS,
      directionDegT: result.observation.directionDegT,
      waterTempF: result.observation.waterTempF,
    },
  };
}

/**
 * The temperature-and-wind half of the panel. The same three-way split as the
 * tide and the waves, and for the same reason: `no-station` is a permanent fact
 * about a place, `unavailable` is a transient fact about a feed.
 *
 * Unlike the wave view, `no-station` is rare here rather than routine — every
 * beach binds a station because air reaches a lagoon, and the only beach without
 * one is the beach whose coordinates upstream publishes transposed.
 */
export type AirState =
  | {
      kind: "reading";
      airTempF: number | null;
      windMph: number | null;
      gustMph: number | null;
      windDirDegT: number | null;
    }
  | { kind: "no-station"; reason: string }
  | { kind: "unavailable"; detail: string; drift: boolean };

/**
 * The sky-and-visibility half, read at a different station and failing on its
 * own. Both fields come from one METAR, which is why they are one state: a
 * station publishes both or neither.
 */
export type SkyState =
  | {
      kind: "reading";
      /** Statute miles, or null when the bound station published none this hour. */
      visibilityMi: number | null;
      /** True when visibility is at METAR's ten-mile ceiling, so it is a floor. */
      visibilityAtCeiling: boolean;
      sky: string | null;
    }
  | { kind: "no-station"; reason: string }
  | { kind: "unavailable"; detail: string; drift: boolean };

export interface StationBinding {
  name: string;
  distanceM: number | null;
}

export interface AirView {
  beachName: string;
  /** Where temperature and wind were measured. null exactly when `air` is `no-station`. */
  airStation: StationBinding | null;
  /** Where sky and visibility were measured. null exactly when `sky` is `no-station`. */
  skyStation: StationBinding | null;
  air: AirState;
  sky: SkyState;
}

/**
 * Read the air at one beach, from the two stations that measure it.
 *
 * TWO PROVENANCES, FETCHED AND FAILED SEPARATELY. Temperature and wind come from
 * the nearest station standing in the marine layer at the shoreline, which is
 * often on the NDBC network; sky and visibility come from the nearest station
 * publishing them, which in this county is always an airport. Requiring one
 * station for all four is what bound La Jolla Shores to Miramar, ten kilometres
 * inland, where the air read 81 °F against the pier's 72 °F. See
 * docs/adr/0010-two-provenances-in-the-air-panel.md.
 *
 * The two halves fail independently on purpose. Withholding a measured shore
 * temperature because an airport ten kilometres away missed a minute would trade
 * the good reading for the irrelevant one. They are fetched concurrently for the
 * same reason they are separate: neither waits on the other.
 *
 * Throws only when the slug is not in the inventory, which is a coding error
 * rather than a quiet feed.
 */
export async function readLatestAir(
  slug: string,
  nowMs: number = Date.now(),
): Promise<AirView> {
  const beach = beachBySlug(slug);
  if (!beach) {
    throw new Error(
      `readLatestAir: no beach in the inventory with slug "${slug}".`,
    );
  }

  const airStation = airStationFor(beach);
  const skyStation = weatherStationFor(beach);

  const [air, sky] = await Promise.all([
    readAirHalf(beach, airStation, nowMs),
    readSkyHalf(beach, skyStation, nowMs),
  ]);

  return {
    beachName: beach.name,
    airStation:
      airStation === null
        ? null
        : {
            name: airStation.name,
            distanceM: beach.air_station_distance_m,
          },
    skyStation:
      skyStation === null
        ? null
        : {
            name: skyStation.name,
            distanceM: beach.weather_station_distance_m,
          },
    air,
    sky,
  };
}

/**
 * Temperature and wind, from whichever network the bound station is on.
 *
 * The dispatch is the station table's `network` field rather than a guess at the
 * id's shape: NDBC ids and NWS ids are both five characters and both uppercase,
 * so there is nothing in an id to read this from.
 */
async function readAirHalf(
  beach: Beach,
  station: (WeatherStation & { id: string }) | null,
  nowMs: number,
): Promise<AirState> {
  if (station === null) {
    return {
      kind: "no-station",
      reason:
        beach.air_station_null_reason ??
        "the join bound no air station to this beach, and recorded no reason",
    };
  }

  if (station.network === "ndbc") {
    const result = await fetchLatestNdbcAir(station.id, nowMs);
    if (result.kind === "unavailable") {
      return {
        kind: "unavailable",
        detail: result.reason,
        drift: result.drift,
      };
    }
    return {
      kind: "reading",
      airTempF: result.airTempF,
      windMph: result.windMph,
      gustMph: result.gustMph,
      windDirDegT: result.windDirDegT,
    };
  }

  const result = await fetchLatestObservation(station.id, nowMs);
  if (result.kind === "unavailable") {
    return { kind: "unavailable", detail: result.reason, drift: result.drift };
  }
  const { observation } = result;
  return {
    kind: "reading",
    airTempF: observation.airTempF,
    windMph: observation.windMph,
    gustMph: observation.gustMph,
    windDirDegT: observation.windDirDegT,
  };
}

/** Sky and visibility, always from an NWS airport: no other station has them. */
async function readSkyHalf(
  beach: Beach,
  station: (WeatherStation & { id: string }) | null,
  nowMs: number,
): Promise<SkyState> {
  if (station === null) {
    return {
      kind: "no-station",
      reason:
        beach.weather_station_null_reason ??
        "the join bound no observation station to this beach, and recorded no reason",
    };
  }

  const result = await fetchLatestObservation(station.id, nowMs);
  if (result.kind === "unavailable") {
    return { kind: "unavailable", detail: result.reason, drift: result.drift };
  }

  const { observation } = result;
  return {
    kind: "reading",
    visibilityMi: observation.visibilityMi,
    visibilityAtCeiling: observation.visibilityAtCeiling,
    sky: observation.sky,
  };
}
