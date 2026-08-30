import { describe, expect, it } from "vitest";
import type { GridDaySeries } from "@/lib/conditions";
import { gridWindReadings, needleFrom } from "./needles";

/** 2026-08-17 in Pacific: sunrise 06:15, sunset 19:30, as epoch milliseconds. */
const SUNRISE = Date.UTC(2026, 7, 17, 13, 15);
const SUNSET = Date.UTC(2026, 7, 18, 2, 30);
const hour = (utcHour: number) => Date.UTC(2026, 7, 17, utcHour, 0);

function published(
  hours: readonly { atMs: number; value: number }[],
): GridDaySeries {
  return {
    kind: "published",
    hours: hours.map((h) => ({ ...h, published: true })),
  };
}

describe("gridWindReadings", () => {
  it("pairs each direction with the speed published for the same instant", () => {
    const readings = gridWindReadings(
      published([{ atMs: hour(18), value: 281 }]),
      published([{ atMs: hour(18), value: 9 }]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([{ degreesTrue: 281, weight: 9 }]);
  });

  it("pairs by instant and not by position", () => {
    // The two series are gapless in the committed run, so joining by index
    // happens to work today and would put the wrong speed on the wrong bearing
    // the first time one of them is short.
    const readings = gridWindReadings(
      published([
        { atMs: hour(18), value: 281 },
        { atMs: hour(19), value: 20 },
      ]),
      published([{ atMs: hour(19), value: 12 }]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([{ degreesTrue: 20, weight: 12 }]);
  });

  it("keeps only the hours inside the daylight window", () => {
    // The arc is the range the wind swings through during daylight, and the
    // fixture's overnight hours swing across north: 340, 20, 150 in the first
    // three. Including them would draw an arc nobody could have stood in.
    const readings = gridWindReadings(
      published([
        { atMs: hour(9), value: 340 },
        { atMs: hour(18), value: 281 },
        { atMs: hour(23), value: 270 },
      ]),
      published([
        { atMs: hour(9), value: 3 },
        { atMs: hour(18), value: 9 },
        { atMs: hour(23), value: 7 },
      ]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([
      { degreesTrue: 281, weight: 9 },
      { degreesTrue: 270, weight: 7 },
    ]);
  });

  it("drops an hour whose speed the cell did not publish", () => {
    const readings = gridWindReadings(
      published([
        { atMs: hour(18), value: 281 },
        { atMs: hour(19), value: 300 },
      ]),
      published([{ atMs: hour(18), value: 9 }]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([{ degreesTrue: 281, weight: 9 }]);
  });

  it("has nothing to read when the cell publishes no direction", () => {
    expect(
      gridWindReadings(
        {
          kind: "absent",
          reason: "the cell declares windDirection and published none",
        },
        published([{ atMs: hour(18), value: 9 }]),
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([]);
  });

  it("has nothing to read when the cell publishes no speed to weight by", () => {
    expect(
      gridWindReadings(
        published([{ atMs: hour(18), value: 281 }]),
        {
          kind: "absent",
          reason: "the cell declares windSpeed and published none",
        },
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([]);
  });
});

describe("needleFrom", () => {
  it("carries the resultant bearing and the arc it swung through", () => {
    const needle = needleFrom([
      { degreesTrue: 260, weight: 6 },
      { degreesTrue: 280, weight: 6 },
    ]);

    expect(needle?.fromDegT).toBeCloseTo(270, 6);
    expect(needle?.spreadDeg).toBeCloseTo(20, 6);
  });

  it("is withheld when there is nothing to draw", () => {
    expect(needleFrom([])).toBeNull();
  });

  it("is withheld when the hours cancel and there is no direction to point", () => {
    // A spread without a bearing is half an instrument: an arc with no needle
    // in it says the wind had a range and declines to say where in it. Both or
    // neither.
    expect(
      needleFrom([
        { degreesTrue: 90, weight: 5 },
        { degreesTrue: 270, weight: 5 },
      ]),
    ).toBeNull();
  });
});
