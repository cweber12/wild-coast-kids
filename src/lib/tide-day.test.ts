import { expect, test } from "vitest";
import capturedPayload from "./__fixtures__/coops-9410230-hilo-20260817.json";
import { parseCoopsHiLo, type TideExtreme } from "./coops-predictions";
import { localTimeOf } from "./pacific-time";
import { lowestLowBetween, lowestLowOn } from "./tide-day";

function capturedExtremes(): TideExtreme[] {
  return parseCoopsHiLo(capturedPayload, {
    stationId: "9410230",
    beginDate: "20260817",
    endDate: "20260818",
  });
}

test("picks the deeper of a day's two lows, not the first", () => {
  // On 2026-08-17 in California the captured payload holds two lows: 1.368 ft at
  // 6:24 AM and 1.51 ft at 7:46 PM. A tidepooling group needs the deeper one.
  const lowest = lowestLowOn(capturedExtremes(), "2026-08-17");
  expect(lowest).not.toBeNull();
  expect(lowest!.feet).toBe(1.368);
  expect(localTimeOf(lowest!.atMs)).toBe("6:24 AM");
});

test("a day with one low in the window returns it", () => {
  const lowest = lowestLowOn(capturedExtremes(), "2026-08-18");
  expect(lowest!.feet).toBe(2.006);
  expect(localTimeOf(lowest!.atMs)).toBe("6:47 AM");
});

test("highs are never mistaken for lows, even when a high is lower", () => {
  const extremes: TideExtreme[] = [
    { atMs: Date.UTC(2026, 7, 17, 15, 0), feet: 0.2, kind: "high" },
    { atMs: Date.UTC(2026, 7, 17, 20, 0), feet: 1.9, kind: "low" },
  ];
  const lowest = lowestLowOn(extremes, "2026-08-17");
  expect(lowest!.kind).toBe("low");
  expect(lowest!.feet).toBe(1.9);
});

test("a date the window does not cover is null, which is not a flat tide", () => {
  expect(lowestLowOn(capturedExtremes(), "2026-08-20")).toBeNull();
  expect(lowestLowOn([], "2026-08-17")).toBeNull();
});

test("a negative low is selected over a positive one", () => {
  const extremes: TideExtreme[] = [
    { atMs: Date.UTC(2026, 7, 17, 14, 0), feet: 0.4, kind: "low" },
    { atMs: Date.UTC(2026, 7, 18, 2, 0), feet: -0.6, kind: "low" },
  ];
  // Both fall on 2026-08-17 in California; the second is 7 PM local.
  const lowest = lowestLowOn(extremes, "2026-08-17");
  expect(lowest!.feet).toBe(-0.6);
});

test("the zone is a parameter, so the day boundary is testable", () => {
  const extremes = capturedExtremes();
  // In UTC, the first low belongs to 2026-08-17; in California it does not.
  expect(lowestLowOn(extremes, "2026-08-17", "UTC")!.feet).toBe(1.366);
  expect(lowestLowOn(extremes, "2026-08-17")!.feet).toBe(1.368);
});

/* =========================================================================
 * lowestLowBetween: the low a reader can actually reach
 * ========================================================================= */

/** Sunrise and sunset at La Jolla on 2026-08-17, to the minute. */
const SUNRISE = Date.UTC(2026, 7, 17, 13, 14);
const SUNSET = Date.UTC(2026, 7, 18, 2, 33);

test("picks the lowest low inside the window, not the day's lowest", () => {
  // The whole point of the second selection. The 3:14 AM low is deeper and a
  // parent cannot use it; the 6:41 PM low is the one they can stand in front of.
  const extremes: TideExtreme[] = [
    { atMs: Date.UTC(2026, 7, 17, 10, 14), feet: -0.42, kind: "low" },
    { atMs: Date.UTC(2026, 7, 18, 1, 41), feet: 0.9, kind: "low" },
  ];

  expect(lowestLowOn(extremes, "2026-08-17")!.feet).toBe(-0.42);
  expect(lowestLowBetween(extremes, SUNRISE, SUNSET)!.feet).toBe(0.9);
});

test("takes the deeper of two lows when both fall in daylight", () => {
  const extremes: TideExtreme[] = [
    { atMs: Date.UTC(2026, 7, 17, 14, 0), feet: 1.4, kind: "low" },
    { atMs: Date.UTC(2026, 7, 18, 1, 0), feet: 0.3, kind: "low" },
  ];

  expect(lowestLowBetween(extremes, SUNRISE, SUNSET)!.feet).toBe(0.3);
});

test("highs are never mistaken for lows inside the window either", () => {
  const extremes: TideExtreme[] = [
    { atMs: Date.UTC(2026, 7, 17, 15, 0), feet: 0.2, kind: "high" },
    { atMs: Date.UTC(2026, 7, 17, 20, 0), feet: 1.9, kind: "low" },
  ];

  const lowest = lowestLowBetween(extremes, SUNRISE, SUNSET);
  expect(lowest!.kind).toBe("low");
  expect(lowest!.feet).toBe(1.9);
});

test("both ends are inclusive, because a boundary is not a reason to withhold", () => {
  // The alternative excludes a reading for landing exactly on an instant
  // computed from an ephemeris, which is precision neither end has.
  const atSunrise: TideExtreme[] = [{ atMs: SUNRISE, feet: 0.5, kind: "low" }];
  const atSunset: TideExtreme[] = [{ atMs: SUNSET, feet: 0.5, kind: "low" }];

  expect(lowestLowBetween(atSunrise, SUNRISE, SUNSET)).not.toBeNull();
  expect(lowestLowBetween(atSunset, SUNRISE, SUNSET)).not.toBeNull();
});

test("no low in the window is null, which is not a flat tide", () => {
  const overnight: TideExtreme[] = [
    { atMs: Date.UTC(2026, 7, 17, 10, 14), feet: -0.42, kind: "low" },
  ];

  expect(lowestLowBetween(overnight, SUNRISE, SUNSET)).toBeNull();
  expect(lowestLowBetween([], SUNRISE, SUNSET)).toBeNull();
});

test("the window pins the day, so no date filter is needed beside it", () => {
  // Only one local date's lows can fall between that date's sunrise and
  // sunset, so a second date filter would be a second way of saying the same
  // thing -- and two ways of saying it can disagree about the zone.
  const extremes: TideExtreme[] = [
    { atMs: Date.UTC(2026, 7, 16, 20, 0), feet: -1.0, kind: "low" },
    { atMs: Date.UTC(2026, 7, 17, 20, 0), feet: 0.4, kind: "low" },
    { atMs: Date.UTC(2026, 7, 18, 20, 0), feet: -1.0, kind: "low" },
  ];

  expect(lowestLowBetween(extremes, SUNRISE, SUNSET)!.feet).toBe(0.4);
});
