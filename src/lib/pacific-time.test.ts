import { expect, test } from "vitest";
import { localDateOf, localTimeOf, SITE_TIME_ZONE } from "./pacific-time";

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
