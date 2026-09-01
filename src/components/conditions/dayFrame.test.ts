/**
 * The day's geometry, called directly.
 *
 * These functions were reached through `HourChart.test.tsx` and one direct
 * import in `selectedHour.test.tsx` while this module held only `nightBands`
 * and a one-line `hourOfDay`. ADR-0040 gave it rules whose whole value is being
 * right on two specific dates, and a rule about 2027-03-14 should not cost a
 * jsdom render to assert.
 */

import { describe, expect, test } from "vitest";
import { localMidnightOf, localTimeOf } from "@/lib/pacific-time";
import { hourOfDay, instantOfHour, nightBands } from "./dayFrame";

const HOUR = 3_600_000;

/** California falls back here: 25 hours. */
const FALL_BACK = "2026-11-01";
/** And springs forward here: 23. */
const SPRING_FORWARD = "2027-03-14";
/** An ordinary Monday, so a failure says which kind of day broke. */
const ORDINARY = "2026-08-17";

describe("hourOfDay", () => {
  test("counts positions from the day's own midnight", () => {
    const start = localMidnightOf(ORDINARY);
    expect(hourOfDay(start, start)).toBe(0);
    expect(hourOfDay(start + 14 * HOUR, start)).toBe(14);
  });

  test("rounds to the nearest position rather than truncating", () => {
    // A published point at 2:20 belongs to the hour it is in, not to the one
    // before it. The series this feeds are hourly, so the offsets are minutes.
    const start = localMidnightOf(ORDINARY);
    expect(hourOfDay(start + 14 * HOUR + 20 * 60_000, start)).toBe(14);
    expect(hourOfDay(start + 14 * HOUR + 40 * 60_000, start)).toBe(15);
  });

  test("a fall-back day has twenty-five positions", () => {
    // The property that makes this a position and not a clock hour, and the
    // reason ADR-0040 stopped anything speaking it. Position 24 exists and its
    // clock reads 11 PM.
    const start = localMidnightOf(FALL_BACK);
    const end = localMidnightOf("2026-11-02");
    expect(hourOfDay(end, start)).toBe(25);
    expect(localTimeOf(instantOfHour(24, start))).toBe("11:00 PM");
  });

  test("a spring-forward day has twenty-three", () => {
    const start = localMidnightOf(SPRING_FORWARD);
    expect(hourOfDay(localMidnightOf("2027-03-15"), start)).toBe(23);
  });
});

describe("instantOfHour", () => {
  test("is the exact inverse of hourOfDay on an ordinary day", () => {
    const start = localMidnightOf(ORDINARY);
    for (let hour = 0; hour <= 24; hour += 1) {
      expect(hourOfDay(instantOfHour(hour, start), start)).toBe(hour);
    }
  });

  test("is the exact inverse across a fall-back transition too", () => {
    // The claim in its docstring, asserted rather than argued: elapsed time
    // does not repeat even where the wall clock does, so adding hours to a
    // midnight is right for *this* question and wrong for a clock reading.
    const start = localMidnightOf(FALL_BACK);
    for (let hour = 0; hour <= 25; hour += 1) {
      expect(hourOfDay(instantOfHour(hour, start), start)).toBe(hour);
    }
  });

  test("is the exact inverse across a spring-forward transition", () => {
    const start = localMidnightOf(SPRING_FORWARD);
    for (let hour = 0; hour <= 23; hour += 1) {
      expect(hourOfDay(instantOfHour(hour, start), start)).toBe(hour);
    }
  });

  test("the instant it returns is a real instant, not a clock reading", () => {
    // Position 3 on a fall-back day is 2 AM, which is the whole point: the two
    // numbers diverge and this function answers the geometry's question.
    const start = localMidnightOf(FALL_BACK);
    expect(localTimeOf(instantOfHour(3, start))).toBe("2:00 AM");
    expect(localTimeOf(instantOfHour(3, localMidnightOf(SPRING_FORWARD)))).toBe(
      "4:00 AM",
    );
  });
});

describe("nightBands", () => {
  const bounds = {
    startMs: localMidnightOf(ORDINARY),
    endMs: localMidnightOf("2026-08-18"),
    sunriseMs: localMidnightOf(ORDINARY) + 6 * HOUR,
    sunsetMs: localMidnightOf(ORDINARY) + 19 * HOUR,
  };
  const x = (atMs: number) => ((atMs - bounds.startMs) / (24 * HOUR)) * 240;

  test("draws the two dark ends of a day, not one band across its middle", () => {
    const bands = nightBands(bounds, x, 240);
    expect(bands.map((band) => band.side)).toEqual([
      "before-dawn",
      "after-dusk",
    ]);
    expect(bands[0]).toMatchObject({ x: 0, width: 60 });
    expect(bands[1]).toMatchObject({ x: 190, width: 50 });
  });

  test("a band with no width is dropped rather than drawn at zero", () => {
    // A polar summer, which this coast does not have -- and a caller handing in
    // a sunrise before its own day start, which is a bug rather than a place.
    const bands = nightBands(
      { ...bounds, sunriseMs: bounds.startMs, sunsetMs: bounds.endMs },
      x,
      240,
    );
    expect(bands).toEqual([]);
  });
});
