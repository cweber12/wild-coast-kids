import { expect, test } from "vitest";
import capturedPayload from "./__fixtures__/coops-9410230-hilo-20260817.json";
import { parseCoopsHiLo, type TideExtreme } from "./coops-predictions";
import { localTimeOf } from "./pacific-time";
import { lowestLowOn } from "./tide-day";

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
