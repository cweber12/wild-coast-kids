import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const readSurfZone = vi.fn();
const readDaylightWeek = vi.fn();
vi.mock("@/lib/conditions", () => ({ readSurfZone, readDaylightWeek }));

const { RipLevel } = await import("./RipLevel");

const TODAY = "2026-08-17";
const TOMORROW = "2026-08-18";
const SLUG = "la-jolla-shores-beach";

/**
 * The daylight read is computed rather than fetched and cannot fail, so it has
 * no absent state to cover. What it decides here is which of the bulletin's
 * dated days is today's, which is the join this component makes and the one
 * place it could pick the wrong one.
 */
function daylight(dates: string[] = [TODAY, TOMORROW]) {
  readDaylightWeek.mockReturnValue({
    beachName: "La Jolla Shores Beach",
    atMs: 0,
    days: dates.map((localDate, index) => ({
      localDate,
      isToday: index === 0,
    })),
  });
}

function forecast(days: { localDate: string; level: string }[]) {
  readSurfZone.mockResolvedValue({
    beachName: "La Jolla Shores Beach",
    state: {
      kind: "forecast",
      issuedMs: 0,
      headline: null,
      staleAfterHours: null,
      days: days.map((day) => ({
        ...day,
        periodName: "TODAY",
        meaning: "Life threatening rip currents are unlikely.",
        surfHeight: "1 to 3 feet.",
        waterTemperature: "70 to 74 degrees.",
      })),
    },
  });
}

beforeEach(() => {
  readSurfZone.mockReset();
  readDaylightWeek.mockReset();
  daylight();
});

test("today's level is the one printed, not the bulletin's first day", async () => {
  // The bulletin is ascending and today is usually its first entry, so a
  // component that took days[0] would pass nearly always. Today is put second
  // in the BULLETIN here so that shortcut fails. The daylight read keeps its
  // real shape -- today is its first day by construction, which is the fact
  // this component leans on to know which date to look for.
  forecast([
    { localDate: TOMORROW, level: "High" },
    { localDate: TODAY, level: "Low" },
  ]);

  render(await RipLevel({ slug: SLUG }));

  expect(screen.getByText("Low")).toBeDefined();
  expect(screen.queryByText("High")).toBeNull();
});

test("the label says what the word beside it is", async () => {
  forecast([{ localDate: TODAY, level: "Moderate" }]);

  render(await RipLevel({ slug: SLUG }));

  expect(screen.getByText("Rip current risk")).toBeDefined();
  expect(screen.getByText("Moderate")).toBeDefined();
});

/**
 * ADR-0015. A surface on this page is decoration and not a verdict, because
 * ADR-0009 forbids this site the verdict — so a three-step severity palette
 * would be this site deciding what red means on top of a scale the office
 * already publishes in words.
 *
 * Asserted as the three class strings being identical rather than as the
 * absence of any one colour: a check for "not red" passes the moment somebody
 * picks amber.
 */
test("the level is set identically whether it says Low or High", async () => {
  const classes: string[] = [];

  for (const level of ["Low", "Moderate", "High"]) {
    forecast([{ localDate: TODAY, level }]);
    const { unmount } = render(await RipLevel({ slug: SLUG }));
    classes.push(screen.getByText(level).className);
    unmount();
  }

  expect(new Set(classes).size).toBe(1);
});

/**
 * The trap `SurfZone`'s docstring records, which this line walks into harder
 * for being shorter. After a label reading "Rip current risk", a value like
 * "none forecast" parses as *there is no rip current risk here* — a safety
 * judgement ADR-0009 forbids, and worst at exactly the beaches that reach these
 * branches, because a lagoon is calm until the day it is not.
 *
 * So every absent state is asserted to say nothing about the water. The full,
 * careful sentence for each of them is in the day panel's block, which is on
 * the page in all three states.
 */
const SILENT_STATES: [string, unknown][] = [
  [
    "a beach the product does not describe",
    { kind: "no-surf-zone", reason: "it is a bay rather than open coast" },
  ],
  [
    "a bulletin that could not be read",
    { kind: "unavailable", detail: "the request timed out.", drift: false },
  ],
];

for (const [name, state] of SILENT_STATES) {
  test(`${name} says nothing about the water`, async () => {
    readSurfZone.mockResolvedValue({
      beachName: "La Jolla Shores Beach",
      state,
    });

    const { container } = render(await RipLevel({ slug: SLUG }));
    const text = (container.textContent ?? "").toLowerCase();

    expect(text).toContain("rip current risk");
    // The readings that would be verdicts about the water. Matched as whole
    // words: "below" contains "low", and an over-strict substring check here
    // fails the honest wording rather than the dishonest one.
    for (const verdict of [
      "none",
      "no rip",
      "safe",
      "low",
      "moderate",
      "high",
    ]) {
      expect(text).not.toMatch(new RegExp(`\b${verdict}\b`));
    }
  });
}

/**
 * The bulletin reaches a beach but its days stop before today — a real state,
 * because the office's periods are named rather than dated and a stale one can
 * cover only days already past.
 *
 * Silent would be the failure this repo is built to avoid, so the line still
 * renders and still carries its label; what it must not do is borrow another
 * day's level.
 */
test("a bulletin that does not reach today borrows no other day's level", async () => {
  forecast([{ localDate: TOMORROW, level: "High" }]);

  const { container } = render(await RipLevel({ slug: SLUG }));

  expect(screen.queryByText("High")).toBeNull();
  expect(container.textContent).toContain("Rip current risk");
  expect(container.textContent).not.toBe("Rip current risk");
});
