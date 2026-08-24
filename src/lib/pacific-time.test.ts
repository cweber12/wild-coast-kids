import { describe, expect, test } from "vitest";
import {
  addLocalDays,
  localDateOf,
  localDayLabel,
  localDayOf,
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
