import { describe, expect, test } from "vitest";
import {
  addLocalDays,
  localDateOf,
  localDayLabel,
  localDayOf,
  hourLabelAt,
  localHourOf,
  localMidnightOf,
  localTimeOf,
  SITE_TIME_ZONE,
} from "./pacific-time";

/** 2026-08-18 13:47 UTC, one of the captured predictions. */
const SUMMER_INSTANT = Date.UTC(2026, 7, 18, 13, 47);

/** 2026-01-15 02:30 UTC, when California is on standard time rather than daylight. */
const WINTER_INSTANT = Date.UTC(2026, 0, 15, 2, 30);

test("the site's zone is named, not inferred from the host", () => {
  expect(SITE_TIME_ZONE).toBe("America/Los_Angeles");
});

test("a date is ISO-ordered, so no reassembly can reorder it", () => {
  expect(localDateOf(SUMMER_INSTANT)).toBe("2026-08-18");
});

test("daylight saving is applied, not assumed", () => {
  // Seven hours behind in August...
  expect(localTimeOf(SUMMER_INSTANT)).toBe("6:47 AM");
  // ...and eight in January, which is why the offset is never hard-coded.
  expect(localTimeOf(WINTER_INSTANT)).toBe("6:30 PM");
  expect(localDateOf(WINTER_INSTANT)).toBe("2026-01-14");
});

test("an instant late in the UTC day can be the previous local day", () => {
  const instant = Date.UTC(2026, 7, 17, 1, 41);
  expect(localDateOf(instant)).toBe("2026-08-16");
  expect(localTimeOf(instant)).toBe("6:41 PM");
});

test("the zone is a parameter, so the rule can be tested rather than trusted", () => {
  expect(localDateOf(SUMMER_INSTANT, "UTC")).toBe("2026-08-18");
  expect(localTimeOf(SUMMER_INSTANT, "UTC")).toBe("1:47 PM");
});

describe("localDayOf", () => {
  test("names the weekday and date in the site's zone", () => {
    // 2026-09-08T17:00Z is 10:00 on a Tuesday in San Diego.
    expect(localDayOf(Date.UTC(2026, 8, 8, 17, 0))).toBe("Tue, Sep 8");
  });

  // The reason the zone is named rather than inherited: this instant is already
  // the 9th in UTC while it is still the evening of the 8th on the coast.
  test("uses Pacific rather than UTC to decide which day it is", () => {
    expect(localDayOf(Date.UTC(2026, 8, 9, 3, 0))).toBe("Tue, Sep 8");
  });
});

describe("addLocalDays", () => {
  test("moves the calendar by whole days", () => {
    expect(addLocalDays("2026-08-17", 6)).toBe("2026-08-23");
  });

  test("a week across the fall-back is still seven days, not six and a half", () => {
    // California returns to standard time on 2026-11-01, so a week built by
    // adding 24-hour blocks to an instant near local midnight lands an hour
    // earlier each side of it and can repeat a date. A date is not an instant,
    // and this arithmetic is what keeps the difference.
    expect(addLocalDays("2026-10-29", 7)).toBe("2026-11-05");
  });

  test("rolls the month and the year rather than overflowing them", () => {
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLocalDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("localMidnightOf", () => {
  test("the instant it returns is midnight in this zone, not in UTC", () => {
    const midnight = localMidnightOf("2026-08-17");
    expect(localDateOf(midnight)).toBe("2026-08-17");
    expect(localTimeOf(midnight)).toBe("12:00 AM");
    // Daylight time: local midnight is 7 AM UTC, not midnight UTC. Reading a
    // date string as an instant would give the second, which is 5 PM on the
    // day before in California.
    expect(midnight).toBe(Date.UTC(2026, 7, 17, 7, 0));
  });

  test("it follows the zone into standard time", () => {
    const midnight = localMidnightOf("2026-01-15");
    expect(localTimeOf(midnight)).toBe("12:00 AM");
    expect(midnight).toBe(Date.UTC(2026, 0, 15, 8, 0));
  });

  test("the day the clocks go forward is twenty-three hours long", () => {
    // California springs forward on 2026-03-08. A plot spanning that day with
    // a hard-coded 24 hours would draw an hour that did not happen, and put
    // every reading after 2 AM in the wrong place.
    const span = localMidnightOf("2026-03-09") - localMidnightOf("2026-03-08");
    expect(span).toBe(23 * 3_600_000);
  });

  test("the day the clocks go back is twenty-five", () => {
    const span = localMidnightOf("2026-11-02") - localMidnightOf("2026-11-01");
    expect(span).toBe(25 * 3_600_000);
  });

  test("an ordinary day is twenty-four", () => {
    const span = localMidnightOf("2026-08-18") - localMidnightOf("2026-08-17");
    expect(span).toBe(24 * 3_600_000);
  });

  test("it refuses a string that is not a local date rather than guessing", () => {
    expect(() => localMidnightOf("2026-08-17T00:00:00Z")).toThrow(
      /not a YYYY-MM-DD local date/,
    );
  });
});

describe("localDayLabel", () => {
  test("names a date a reader can scan", () => {
    expect(localDayLabel("2026-08-17")).toBe("Mon, Aug 17");
  });

  test("never renders the day before, whatever zone the host runs in", () => {
    // The trap this exists to avoid: reading "2026-01-01" as an instant and
    // formatting it in a zone behind UTC yields New Year's Eve. A local date
    // carries no zone, so it is named in the only one that cannot shift it.
    expect(localDayLabel("2026-01-01")).toBe("Thu, Jan 1");
  });
});

/**
 * The two days a year a position in the day is not a clock hour.
 *
 * California falls back on 2026-11-01 and springs forward on 2027-03-14, so
 * those days hold 25 and 23 hours. Every figure below was taken by running
 * these helpers over both days rather than reasoned about.
 */
const FALL_BACK = "2026-11-01";
const SPRING_FORWARD = "2027-03-14";
const HOUR = 3_600_000;

describe("localHourOf", () => {
  test("reads the clock rather than counting from midnight", () => {
    const midnight = localMidnightOf("2026-08-17");
    expect(localHourOf(midnight)).toBe(0);
    expect(localHourOf(midnight + 15 * HOUR)).toBe(15);
  });

  test("midnight is 0 and not 24", () => {
    // `hour12: false` yields "24" for midnight on some ICU builds, which would
    // make the guard in this function the difference between 0 and a number no
    // clock has. Asserted rather than trusted for the reason `zoneOffsetMs`
    // carries the same guard.
    expect(localHourOf(localMidnightOf("2026-01-15"))).toBe(0);
    expect(localHourOf(localMidnightOf(FALL_BACK))).toBe(0);
  });

  test("a fall-back day repeats an hour, so two positions read the same", () => {
    const start = localMidnightOf(FALL_BACK);
    expect(localHourOf(start + 1 * HOUR)).toBe(1);
    expect(localHourOf(start + 2 * HOUR)).toBe(1);
    // And from there the position runs an hour ahead of the clock for the rest
    // of the day: 25 positions, 24 clock hours.
    expect(localHourOf(start + 12 * HOUR)).toBe(11);
    expect(localHourOf(start + 24 * HOUR)).toBe(23);
  });

  test("a spring-forward day skips one, so 2 AM never reads at all", () => {
    const start = localMidnightOf(SPRING_FORWARD);
    expect(localHourOf(start + 1 * HOUR)).toBe(1);
    expect(localHourOf(start + 2 * HOUR)).toBe(3);
    expect(localHourOf(start + 22 * HOUR)).toBe(23);
  });

  test("the zone is a parameter, so the rule can be tested rather than trusted", () => {
    expect(localHourOf(SUMMER_INSTANT, "UTC")).toBe(13);
  });
});

describe("hourLabelAt", () => {
  test("names the hour in the reader's own clock", () => {
    const start = localMidnightOf("2026-08-17");
    expect(hourLabelAt(start)).toBe("12 AM");
    expect(hourLabelAt(start + 3 * HOUR)).toBe("3 AM");
    expect(hourLabelAt(start + 12 * HOUR)).toBe("12 PM");
    expect(hourLabelAt(start + 15 * HOUR)).toBe("3 PM");
    expect(hourLabelAt(start + 23 * HOUR)).toBe("11 PM");
  });

  test("the words are the repo's own, with an ordinary space", () => {
    // Not `Intl`'s hour-only format, which returns the same string on ICU 77
    // and is free to choose a narrow no-break space on another build. A test
    // reading `toBe("3 PM")` would then fail on CI and nowhere else.
    expect([...hourLabelAt(localMidnightOf("2026-08-17") + 15 * HOUR)]).toEqual(
      ["3", " ", "P", "M"],
    );
  });

  test("the twenty-fifth hour of a fall-back day is 11 PM, not a second noon", () => {
    // The defect this replaces, in one line: reading position 24 as a clock
    // hour fell through to `${hour - 12} PM` and printed "12 PM" -- a second
    // noon, at eleven at night. Position 12 is 11 AM on this day, so the old
    // reading also never named noon at all.
    const start = localMidnightOf(FALL_BACK);
    expect(hourLabelAt(start + 24 * HOUR)).toBe("11 PM");
    expect(hourLabelAt(start + 12 * HOUR)).toBe("11 AM");
    expect(hourLabelAt(start + 13 * HOUR)).toBe("12 PM");
  });

  test("a repeated hour is named twice rather than disambiguated", () => {
    // ADR-0040: two hours honestly share a name on the one day they genuinely
    // do. They stay distinct selections because the position keys them, and
    // neither is ever an axis tick.
    const start = localMidnightOf(FALL_BACK);
    expect(hourLabelAt(start + 1 * HOUR)).toBe("1 AM");
    expect(hourLabelAt(start + 2 * HOUR)).toBe("1 AM");
  });

  test("a spring-forward day names its hours an hour ahead of its positions", () => {
    const start = localMidnightOf(SPRING_FORWARD);
    expect(hourLabelAt(start + 2 * HOUR)).toBe("3 AM");
    expect(hourLabelAt(start + 22 * HOUR)).toBe("11 PM");
  });
});
