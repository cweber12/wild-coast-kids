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
import { axisTicks, hourOfDay, instantOfHour, nightBands } from "./dayFrame";

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

describe("axisTicks", () => {
  const LABELLED = [0, 3, 6, 9, 12, 15, 18, 21];
  const bounds = (localDate: string, nextDate: string) => ({
    startMs: localMidnightOf(localDate),
    endMs: localMidnightOf(nextDate),
  });

  /**
   * Where a tick sits, as the percentage `HourChart` positions it by.
   *
   * Rounded to two places because 28% of a 25-hour day comes back as
   * 28.000000000000004 in binary floating point. The browser is laying out a
   * few hundred pixels, so the hundredth of a percent this drops is a
   * ten-thousandth of one of them.
   */
  const at = (ticks: { atMs: number }[], startMs: number, spanMs: number) =>
    ticks.map((tick) =>
      Number((((tick.atMs - startMs) / spanMs) * 100).toFixed(2)),
    );

  test("an ordinary day is eight ticks, evenly spaced, named the usual way", () => {
    const day = bounds(ORDINARY, "2026-08-18");
    const ticks = axisTicks(LABELLED, day);

    expect(ticks.map((tick) => tick.clockHour)).toEqual(LABELLED);
    expect(at(ticks, day.startMs, 24 * HOUR)).toEqual([
      0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5,
    ]);
  });

  test("a fall-back day keeps the names and bends the spacing", () => {
    // ADR-0040's choice, in numbers. The wide gap is the first one -- midnight
    // to 3 AM -- which is the span that really did hold four hours. The old
    // axis put all eight at 12.5% and named the fifth "12 PM" while it sat over
    // 11:30 AM.
    const day = bounds(FALL_BACK, "2026-11-02");
    const ticks = axisTicks(LABELLED, day);

    expect(ticks.map((tick) => tick.clockHour)).toEqual(LABELLED);
    expect(at(ticks, day.startMs, 25 * HOUR)).toEqual([
      0, 16, 28, 40, 52, 64, 76, 88,
    ]);
    // Each tick is over the moment it names, which is the whole of the second
    // defect: the old "3 AM" sat over 2:07 AM.
    expect(ticks.map((tick) => localTimeOf(tick.atMs))).toEqual([
      "12:00 AM",
      "3:00 AM",
      "6:00 AM",
      "9:00 AM",
      "12:00 PM",
      "3:00 PM",
      "6:00 PM",
      "9:00 PM",
    ]);
  });

  test("a spring-forward day bends it the other way", () => {
    // The mirror, and the narrow gap is in the same place: the span the missing
    // hour was taken out of.
    const day = bounds(SPRING_FORWARD, "2027-03-15");
    const ticks = axisTicks(LABELLED, day);

    expect(at(ticks, day.startMs, 23 * HOUR)).toEqual([
      0, 8.7, 21.74, 34.78, 47.83, 60.87, 73.91, 86.96,
    ]);
    expect(ticks.map((tick) => localTimeOf(tick.atMs))[1]).toBe("3:00 AM");
  });

  test("an hour the day does not hold is dropped rather than placed", () => {
    // 2 AM never happens on a spring-forward day, so there is nowhere honest to
    // put it. Unreachable from `LABELLED_HOURS`, which is exactly why the
    // contract is asserted here rather than left to be discovered.
    const day = bounds(SPRING_FORWARD, "2027-03-15");

    expect(axisTicks([2], day)).toEqual([]);
    expect(axisTicks([1, 2, 3], day).map((tick) => tick.clockHour)).toEqual([
      1, 3,
    ]);
  });

  test("a repeated hour takes the earlier of the two", () => {
    // A fall-back day holds two 1 AMs and only one tick can be drawn. Also
    // unreachable from `LABELLED_HOURS`, and asserted for the same reason.
    const day = bounds(FALL_BACK, "2026-11-02");
    const [tick] = axisTicks([1], day);

    expect(tick.atMs).toBe(day.startMs + 1 * HOUR);
    expect(hourOfDay(tick.atMs, day.startMs)).toBe(1);
  });

  test("the last hour of a day is reachable, and the next day's is not", () => {
    // 11 PM on a fall-back day is position 24, which a loop bounded at 24 would
    // miss -- and midnight resolves to this day's own, not tomorrow's.
    const day = bounds(FALL_BACK, "2026-11-02");
    const [eleven] = axisTicks([23], day);
    const [midnight] = axisTicks([0], day);

    expect(hourOfDay(eleven.atMs, day.startMs)).toBe(24);
    expect(midnight.atMs).toBe(day.startMs);
  });
});
