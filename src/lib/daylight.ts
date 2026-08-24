/**
 * When the sun comes up and goes down at one point on this coast.
 *
 * **Computed here, with no upstream and no dependency.** That is a decision
 * already recorded rather than one taken now: `docs/plans/conditions-tool.md`
 * lists daylight as "computed in-repo. There is no sun API here and there
 * should not be." Sunrise is astronomy, the inputs are a date and a pair of
 * coordinates the inventory already carries, and adding a fourth agency to the
 * page for a value that cannot vary would buy an outage mode and nothing else.
 * It is the only row on this page that cannot fail.
 *
 * **The algorithm is NOAA's, which is Meeus reduced to the terms that matter at
 * this precision.** Solar noon comes from the equation of time and the
 * longitude; the half-day comes from the hour angle at which the sun's upper
 * limb sits on a refracting horizon, the 90.833° below. Both are evaluated
 * twice — once for the date, then again at the instant the first pass
 * estimated — because the sun's declination moves measurably between midnight
 * and dawn near the equinoxes.
 *
 * **It is checked against the Naval Observatory, not against itself.** Five
 * dates spread across a year and both ends of the county, in `daylight.test.ts`,
 * with the service and the query recorded there. This file's output agreeing
 * with this file's expectations would prove nothing.
 *
 * **What comes back is the computed instant, not a rounded one.** Rounding to
 * the minute is a display decision and it is made where the label is built, in
 * `conditions.ts`. Keeping it out of here is what lets the tests state the
 * accuracy honestly: measured against the instant, this agrees with USNO to
 * within 32 seconds at every reference point, where a rounded value could only
 * ever be shown to be within a minute — a claim that says nothing about whether
 * the astronomy is right or the rounding is lucky.
 *
 * **A place, not a segment.** Everything else on this page treats a beach as a
 * shoreline segment, because that is how the state publishes it and because a
 * station's distance depends on which end you measure from. Daylight does not:
 * across the whole county, from Oceanside to Imperial Beach, sunset differs by
 * a single minute. The caller passes one point and this file does not pretend
 * to more resolution than that.
 */

/** Where the sun's upper limb sits at rise and set, allowing for refraction. */
const HORIZON_ZENITH_DEG = 90.833;

const RAD = Math.PI / 180;
const MS_PER_MINUTE = 60_000;

/** A point on the coast, WGS84 decimal degrees. Longitude is east-positive, so this coast is negative. */
export interface Coordinates {
  lat: number;
  lon: number;
}

/** Sunrise and sunset for one place on one day, as instants. */
export interface Daylight {
  /** Instant of sunrise, epoch milliseconds UTC. Not rounded; see the header. */
  sunriseMs: number;
  /** Instant of sunset, epoch milliseconds UTC. Not rounded; see the header. */
  sunsetMs: number;
}

/** The sun neither rises nor sets on this date at this latitude. Not reachable from this inventory. */
export class NoSunriseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoSunriseError";
  }
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function julianCentury(julianDay: number): number {
  return (julianDay - 2451545.0) / 36525;
}

function geomMeanLongSunDeg(t: number): number {
  const longitude = 280.46646 + t * (36000.76983 + t * 0.0003032);
  return ((longitude % 360) + 360) % 360;
}

function geomMeanAnomalySunDeg(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

function earthOrbitEccentricity(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function sunEqOfCentreDeg(t: number): number {
  const m = geomMeanAnomalySunDeg(t) * RAD;
  return (
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289
  );
}

/** The longitude of the sun corrected for nutation and aberration. */
function sunApparentLongDeg(t: number): number {
  const trueLong = geomMeanLongSunDeg(t) + sunEqOfCentreDeg(t);
  const omega = 125.04 - 1934.136 * t;
  return trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
}

function obliquityCorrectionDeg(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const mean = 23 + (26 + seconds / 60) / 60;
  const omega = 125.04 - 1934.136 * t;
  return mean + 0.00256 * Math.cos(omega * RAD);
}

function solarDeclinationDeg(t: number): number {
  const obliquity = obliquityCorrectionDeg(t) * RAD;
  const apparentLong = sunApparentLongDeg(t) * RAD;
  return Math.asin(Math.sin(obliquity) * Math.sin(apparentLong)) / RAD;
}

/** How far apparent solar time runs ahead of mean solar time, in minutes. */
function equationOfTimeMinutes(t: number): number {
  const epsilon = obliquityCorrectionDeg(t) * RAD;
  const meanLong = geomMeanLongSunDeg(t) * RAD;
  const eccentricity = earthOrbitEccentricity(t);
  const meanAnomaly = geomMeanAnomalySunDeg(t) * RAD;
  const y = Math.tan(epsilon / 2) ** 2;

  const radians =
    y * Math.sin(2 * meanLong) -
    2 * eccentricity * Math.sin(meanAnomaly) +
    4 * eccentricity * y * Math.sin(meanAnomaly) * Math.cos(2 * meanLong) -
    0.5 * y * y * Math.sin(4 * meanLong) -
    1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly);

  return (radians / RAD) * 4;
}

/**
 * Half the length of the day, as an angle.
 *
 * Throws where the sun stays up or stays down, which is a latitude no beach in
 * this inventory has. `Math.acos` would otherwise return `NaN` and carry it all
 * the way to an empty cell, which is the silent failure this page is built to
 * refuse.
 */
function hourAngleDeg(
  latDeg: number,
  declinationDeg: number,
  localDate: string,
): number {
  const lat = latDeg * RAD;
  const declination = declinationDeg * RAD;

  const cosHourAngle =
    Math.cos(HORIZON_ZENITH_DEG * RAD) /
      (Math.cos(lat) * Math.cos(declination)) -
    Math.tan(lat) * Math.tan(declination);

  if (cosHourAngle > 1 || cosHourAngle < -1) {
    throw new NoSunriseError(
      `daylightOn: at latitude ${latDeg} the sun neither rises nor sets on ${localDate}. ` +
        `No beach in this inventory is within thirty degrees of that.`,
    );
  }

  return Math.acos(cosHourAngle) / RAD;
}

/** Minutes after 00:00 UTC on `jdMidnight`'s date, refined once at the estimate. */
function eventMinutesUtc(
  jdMidnight: number,
  at: Coordinates,
  localDate: string,
  fromNoon: -1 | 1,
): number {
  const estimate = (t: number) =>
    720 -
    equationOfTimeMinutes(t) -
    4 * at.lon +
    fromNoon * 4 * hourAngleDeg(at.lat, solarDeclinationDeg(t), localDate);

  const firstPass = estimate(julianCentury(jdMidnight));
  // The declination moves enough between midnight and dawn near an equinox to
  // matter at this precision, so the terms are evaluated again at the instant
  // the first pass found.
  return estimate(julianCentury(jdMidnight + firstPass / 1440));
}

/**
 * Sunrise and sunset at `at` on the local date `localDate`.
 *
 * The date is a **local** calendar date and carries no zone, which is what the
 * whole site means by a date. Both events are anchored to 00:00 UTC on the same
 * calendar date, and on this coast that is correct rather than lucky: local
 * midnight is 07:00 or 08:00 UTC, so a Pacific day's sunrise and its sunset both
 * fall after the UTC day begins — the sunset lands after midnight in Greenwich,
 * which is the trap, and it is still the same Pacific evening. `daylight.test.ts`
 * asserts exactly that.
 *
 * Throws on a malformed date or a latitude with no sunrise. Both are coding
 * errors rather than conditions a reader can act on.
 */
export function daylightOn(localDate: string, at: Coordinates): Daylight {
  const match = LOCAL_DATE.exec(localDate);
  if (match === null) {
    throw new Error(
      `daylightOn: "${localDate}" is not a YYYY-MM-DD local date.`,
    );
  }

  const midnightUtcMs = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const jdMidnight = midnightUtcMs / 86_400_000 + 2440587.5;

  const toInstant = (minutes: number) =>
    midnightUtcMs + minutes * MS_PER_MINUTE;

  return {
    sunriseMs: toInstant(eventMinutesUtc(jdMidnight, at, localDate, -1)),
    sunsetMs: toInstant(eventMinutesUtc(jdMidnight, at, localDate, 1)),
  };
}

/**
 * The midpoint of a shoreline segment, which is the point daylight is computed
 * for.
 *
 * A plain mean of the two endpoints. Over a few kilometres of coastline the
 * great-circle midpoint and the arithmetic one differ by metres, and sunset
 * differs by a minute across the entire county — so the simple form is not an
 * approximation anyone has to defend, and the alternative would be precision
 * this file has already said it does not have.
 */
export function midpointOf(ends: {
  upper: Coordinates;
  lower: Coordinates;
}): Coordinates {
  return {
    lat: (ends.upper.lat + ends.lower.lat) / 2,
    lon: (ends.upper.lon + ends.lower.lon) / 2,
  };
}
