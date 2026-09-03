import { expect, test } from "vitest";
import { daylightOn, midpointOf } from "./daylight";
import { localDateOf } from "./pacific-time";

/**
 * Every reference time here is published by the United States Naval
 * Observatory, fetched 2026-08-24 from its one-day rise/set/transit service.
 * They are not this repo's own output checked against itself, which would prove
 * only that the code agrees with itself.
 *
 *   https://aa.usno.navy.mil/api/rstt/oneday?date=<date>&coords=<lat>,<lon>&tz=<offset>
 *
 * The service takes a fixed offset rather than a zone name, so the summer dates
 * were requested at `tz=-7` and the winter ones at `tz=-8`. Those offsets are
 * reproduced below only to turn a published wall-clock time back into an
 * instant; what the code under test does with zones is asserted separately.
 *
 * **The assertion is a tolerance, and the tolerance is the point.** USNO
 * publishes whole minutes, and rounding to a whole minute makes a comparison
 * turn on which side of :30 a value falls rather than on whether the astronomy
 * is right. Measured against the instant, this implementation is within 32
 * seconds of USNO at every reference below — its worst case is the June
 * solstice sunset, 20:00:32 against a published 20:00, which as a rendered
 * label reads 8:01 PM where USNO reads 8:00 PM. That is the documented accuracy
 * of the low-order NOAA series, and buying the last half-minute would mean
 * shipping an ephemeris this page has no use for. Asserting the string would
 * have hidden that behind a coincidence at nine of the ten reference points.
 */
const LA_JOLLA = { lat: 32.857, lon: -117.257 };

/** The northern and southern ends of the corridor this site covers. */
const OCEANSIDE = { lat: 33.195, lon: -117.386 };
const IMPERIAL_BEACH = { lat: 32.575, lon: -117.133 };

/** A published wall-clock time at a fixed offset, as an instant. */
function published(
  localDate: string,
  hhmm: string,
  utcOffsetHours: number,
): number {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour - utcOffsetHours, minute);
}

/** No event may differ from the Naval Observatory's published minute by as much as one. */
const TOLERANCE_MS = 60_000;

const REFERENCES = [
  // The June solstice: the longest day here, and where a low-order series is
  // least accurate because the declination is at an extremum.
  { date: "2026-06-21", at: LA_JOLLA, tz: -7, rise: "05:41", set: "20:00" },
  // Late August, beside the dates this repo's tide fixtures were captured on.
  { date: "2026-08-24", at: LA_JOLLA, tz: -7, rise: "06:19", set: "19:24" },
  // The September equinox, where an error in the obliquity term would show.
  { date: "2026-09-22", at: LA_JOLLA, tz: -7, rise: "06:37", set: "18:45" },
  // The day the clocks go back. Both events are standard time by the time they
  // happen, which the code must get from the zone rather than from a constant.
  { date: "2026-11-01", at: LA_JOLLA, tz: -8, rise: "06:07", set: "16:58" },
  // The December solstice, the far end of the range.
  { date: "2026-12-21", at: LA_JOLLA, tz: -8, rise: "06:48", set: "16:47" },
  // Both ends of the county on one date, so latitude and longitude are shown to
  // be inputs rather than decoration.
  { date: "2026-08-24", at: OCEANSIDE, tz: -7, rise: "06:19", set: "19:24" },
  {
    date: "2026-08-24",
    at: IMPERIAL_BEACH,
    tz: -7,
    rise: "06:18",
    set: "19:23",
  },
] as const;

for (const { date, at, tz, rise, set } of REFERENCES) {
  test(`agrees with the Naval Observatory on ${date} at ${at.lat}, ${at.lon}`, () => {
    const daylight = daylightOn(date, at);

    expect(
      Math.abs(daylight.sunriseMs - published(date, rise, tz)),
    ).toBeLessThan(TOLERANCE_MS);
    expect(Math.abs(daylight.sunsetMs - published(date, set, tz))).toBeLessThan(
      TOLERANCE_MS,
    );
  });
}

test("the beach's own coordinates are used, not one figure for the county", () => {
  const north = daylightOn("2026-08-24", OCEANSIDE);
  const south = daylightOn("2026-08-24", IMPERIAL_BEACH);

  // The sun sets later at the northern end, and the whole county spans well
  // under two minutes. Small, and not nothing: the figure is computed for the
  // place rather than quoted once and reprinted at 41 beaches.
  expect(north.sunsetMs).toBeGreaterThan(south.sunsetMs);
  expect(north.sunsetMs - south.sunsetMs).toBeLessThan(2 * 60_000);
});

test("both instants fall on the local date asked for, not on the UTC one", () => {
  const { sunriseMs, sunsetMs } = daylightOn("2026-08-24", LA_JOLLA);

  expect(localDateOf(sunriseMs)).toBe("2026-08-24");
  expect(localDateOf(sunsetMs)).toBe("2026-08-24");
  // The trap this exists for: sunset on this coast is after midnight in
  // Greenwich, so an implementation anchored on the UTC date would put the
  // evening of the 24th onto the 25th and nothing would look wrong.
  expect(new Date(sunsetMs).toISOString()).toMatch(/^2026-08-25T/);
});

test("the sun rises before it sets, which a sign error would reverse", () => {
  const { sunriseMs, sunsetMs } = daylightOn("2026-12-21", LA_JOLLA);

  expect(sunsetMs).toBeGreaterThan(sunriseMs);
  // Just under ten hours at the solstice here.
  expect((sunsetMs - sunriseMs) / 3_600_000).toBeCloseTo(9.98, 1);
});

/**
 * The instants are whole seconds, and the tolerance above is why.
 *
 * This series agrees with USNO to within 32 seconds, so a value carrying
 * fractional milliseconds -- `1788441902729.5322` was one -- is stating four
 * more digits than the astronomy has, on top of the four the tolerance already
 * covers. That is not only untidy: the beach page serializes 28 of these into
 * its flight payload, where the fractions cost a measured 136 bytes.
 *
 * Seconds are lossless for every reader in this repo. The labels are rounded to
 * the minute where they are built, and the day chart's night band turns these
 * into a pixel boundary. Half a second is also two orders of magnitude below
 * the accuracy the tests above assert, so rounding here cannot flatter the
 * comparison with the Naval Observatory -- which is the objection the header
 * used to raise against rounding at all, and it was an objection to rounding to
 * the *minute*.
 */
test("both instants are whole seconds, not raw float milliseconds", () => {
  for (const { date, at } of REFERENCES) {
    const { sunriseMs, sunsetMs } = daylightOn(date, at);

    expect(sunriseMs % 1000).toBe(0);
    expect(sunsetMs % 1000).toBe(0);
  }
});

test("a latitude where the sun does not rise is a coding error, not a NaN", () => {
  // No beach in this inventory is anywhere near it, which is exactly why this
  // must raise: a silent NaN would reach a reader as an empty cell.
  expect(() => daylightOn("2026-12-21", { lat: 78, lon: -117 })).toThrow(
    /neither rises nor sets/,
  );
});

test("a malformed date is refused rather than turned into a plausible day", () => {
  expect(() => daylightOn("24-08-2026", LA_JOLLA)).toThrow(/YYYY-MM-DD/);
});

test("a segment is reduced to the point between its ends", () => {
  const middle = midpointOf({
    upper: { lat: 32.98, lon: -117.272 },
    lower: { lat: 32.949, lon: -117.265 },
  });

  expect(middle.lat).toBeCloseTo(32.9645, 4);
  expect(middle.lon).toBeCloseTo(-117.2685, 4);
});
