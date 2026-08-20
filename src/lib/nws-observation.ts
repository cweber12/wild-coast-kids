/**
 * NWS `/stations/{id}/observations/latest`: the pinned units, and the newest
 * observation.
 *
 * Pure and offline, like the two parsers beside it. It takes the payload a
 * station served and returns typed values or raises.
 *
 * WHAT IS PINNED, and why each would otherwise produce a confident wrong number:
 *
 *   The unit codes, per field. Unlike NDBC this payload states its units on
 *   every measurement rather than once in a header, so each is asserted where it
 *   is read: `wmoUnit:m` for visibility, `wmoUnit:degC` for temperature,
 *   `wmoUnit:km_h-1` for wind. All three differ from what this site displays --
 *   miles, Fahrenheit, miles per hour -- so an upstream switch that went
 *   unnoticed would not look like an error, it would look like weather.
 *
 *   `null` as the missing marker, per field, inside an object that is still
 *   present. A station that has stopped publishing visibility does not drop the
 *   `visibility` key; it serves `{"value": null, "qualityControl": "Z"}`. So
 *   presence of the key proves nothing and only the value counts. Forty-six of
 *   the fifty-six candidate stations in this county answer exactly that way,
 *   which is why the join filters on measured delivery -- see
 *   `observation-stations.json`.
 *
 * WHAT IS NOT PINNED, deliberately: `qualityControl`. Its values are upstream's
 * own vocabulary and this site does not gate on them, because a reading marked
 * `V` and a reading marked `C` are both what the station published and neither
 * is this site's to second-guess.
 *
 * THE TEN-MILE CEILING IS NOT A MEASUREMENT. METAR stops at ten statute miles,
 * published as either 16093.44 m or 16090 m depending on the station, so the top
 * of the range means "at least ten miles". That distinction is carried out of
 * here as a flag rather than left for the view to rediscover from a magic
 * number.
 */

/** Unit codes this parser knows how to convert from, per field. */
const EXPECTED_UNITS = {
  visibility: "wmoUnit:m",
  temperature: "wmoUnit:degC",
  windSpeed: "wmoUnit:km_h-1",
  windGust: "wmoUnit:km_h-1",
  windDirection: "wmoUnit:degree_(angle)",
} as const;

/**
 * METAR's maximum reportable visibility, ten statute miles, in metres. Stations
 * publish it as 16093.44 (the exact conversion) or 16090 (rounded), so the test
 * is a threshold rather than an equality.
 */
const VISIBILITY_CEILING_M = 16090;

const METRES_PER_MILE = 1609.344;

export class NwsObservationDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsObservationDriftError";
  }
}

export class NwsObservationNoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsObservationNoDataError";
  }
}

export interface StationObservation {
  /** Instant of the observation, epoch milliseconds UTC. */
  atMs: number;
  /** Visibility in statute miles, converted from metres, or null when unpublished. */
  visibilityMi: number | null;
  /** True when visibility sits at METAR's ten-mile ceiling, so the figure is a floor. */
  visibilityAtCeiling: boolean;
  /** Air temperature in Fahrenheit, converted from Celsius, or null. */
  airTempF: number | null;
  /** Wind speed in miles per hour, converted from km/h, or null. */
  windMph: number | null;
  /** Gust in miles per hour, or null. Frequently null while wind speed is not. */
  gustMph: number | null;
  /** Wind direction in degrees true, or null. */
  windDirDegT: number | null;
  /** The station's own plain-words sky, e.g. "Clear". Empty string becomes null. */
  sky: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * One measurement's value, with its declared unit asserted.
 *
 * A missing key is drift -- the shape changed. A present key carrying a null
 * value is not: that is a station which is answering and not measuring.
 */
function measured(
  properties: Record<string, unknown>,
  field: keyof typeof EXPECTED_UNITS,
  stationId: string,
): number | null {
  const raw = properties[field];
  if (raw === undefined || raw === null) {
    throw new NwsObservationDriftError(
      `NWS ${stationId}: the observation carries no ${field} object at all. The payload's ` +
        `shape has drifted; refusing to guess which field replaced it.`,
    );
  }
  if (!isRecord(raw) || !("value" in raw)) {
    throw new NwsObservationDriftError(
      `NWS ${stationId}: ${field} was ${JSON.stringify(raw)}, not a measurement object.`,
    );
  }

  const { value, unitCode } = raw;
  if (value === null || value === undefined) return null;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NwsObservationDriftError(
      `NWS ${stationId}: ${field} was ${JSON.stringify(value)}, not a number.`,
    );
  }

  const expected = EXPECTED_UNITS[field];
  if (unitCode !== expected) {
    throw new NwsObservationDriftError(
      `NWS ${stationId}: ${field} is published in ${JSON.stringify(unitCode)}, not ` +
        `${JSON.stringify(expected)}. The payload states its own units and they have ` +
        `changed; converting on the old assumption would be a wrong number.`,
    );
  }

  return value;
}

/**
 * Parse the newest observation out of a `latest` payload.
 *
 * Raises `NwsObservationNoDataError` when the station answered with nothing
 * usable -- no timestamp, or no value in any field this panel shows, which is a
 * station that is not observing rather than a calm clear day. Raises
 * `NwsObservationDriftError` when the shape or the units are not what is pinned
 * above.
 */
export function parseNwsObservation(
  payload: unknown,
  stationId: string,
): StationObservation {
  if (!isRecord(payload) || !isRecord(payload.properties)) {
    throw new NwsObservationDriftError(
      `NWS ${stationId}: the response carried no properties object.`,
    );
  }
  const properties = payload.properties;

  const timestamp = properties.timestamp;
  if (typeof timestamp !== "string") {
    throw new NwsObservationDriftError(
      `NWS ${stationId}: the observation carries no timestamp string.`,
    );
  }
  // Unlike CO-OPS and NDBC, this one carries its offset. Parsing it as anything
  // other than what it says would be inventing a zone.
  const atMs = Date.parse(timestamp);
  if (!Number.isFinite(atMs)) {
    throw new NwsObservationDriftError(
      `NWS ${stationId}: the timestamp ${JSON.stringify(timestamp)} did not parse.`,
    );
  }

  const visibilityM = measured(properties, "visibility", stationId);
  const airTempC = measured(properties, "temperature", stationId);
  const windKmh = measured(properties, "windSpeed", stationId);
  const gustKmh = measured(properties, "windGust", stationId);
  const windDirDegT = measured(properties, "windDirection", stationId);

  const rawSky = properties.textDescription;
  // Served as "" by stations that publish no sky, which is not a description of
  // the sky. An empty string rendered as a sky would read as an answer.
  const sky =
    typeof rawSky === "string" && rawSky.trim() !== "" ? rawSky : null;

  if (
    visibilityM === null &&
    airTempC === null &&
    windKmh === null &&
    sky === null
  ) {
    throw new NwsObservationNoDataError(
      `NWS ${stationId} answered with no visibility, no temperature, no wind and no sky. ` +
        `That is a station which is not observing, not a clear calm day.`,
    );
  }

  return {
    atMs,
    visibilityMi: visibilityM === null ? null : visibilityM / METRES_PER_MILE,
    visibilityAtCeiling:
      visibilityM !== null && visibilityM >= VISIBILITY_CEILING_M,
    airTempF: airTempC === null ? null : airTempC * 1.8 + 32,
    windMph: windKmh === null ? null : windKmh / 1.609344,
    gustMph: gustKmh === null ? null : gustKmh / 1.609344,
    windDirDegT,
    sky,
  };
}
