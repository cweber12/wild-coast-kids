import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { localMidnightOf } from "@/lib/pacific-time";
import type { SurfZoneView } from "@/lib/conditions";
import { SurfZone } from "./SurfZone";

/** 1:54 AM Pacific on Wednesday 2026-09-02, the morning bulletin's issuance. */
const ISSUED = localMidnightOf("2026-09-02") + 3_600_000 + 54 * 60_000;

const MEANING = {
  Low: "Life threatening rip currents are unlikely but still could occur.",
  Moderate: "Life threatening rip currents are possible.",
  High: "Life threatening rip currents are likely.",
} as const;

function forecast(
  days: {
    localDate: string;
    periodName: string;
    level: "Low" | "Moderate" | "High";
  }[],
  headline: string | null = null,
): SurfZoneView["state"] {
  return {
    kind: "forecast",
    issuedMs: ISSUED,
    headline,
    days: days.map((day) => ({ ...day, meaning: MEANING[day.level] })),
  };
}

test("states the level and the publisher's own sentence for it", () => {
  render(
    <SurfZone
      state={forecast([
        { localDate: "2026-09-02", periodName: "TODAY", level: "High" },
      ])}
      localDate="2026-09-02"
      when="today"
    />,
  );

  expect(screen.getByText("High")).toBeDefined();
  // ADR-0009 forbids this site forming the judgement, and writing the words
  // that explain it would be forming it one step removed. This sentence is the
  // bulletin's own, so its presence is what makes the level word safe to print.
  expect(screen.getByText(MEANING.High)).toBeDefined();
});

/**
 * The period's own name, printed beside the day.
 *
 * The bulletin names its periods and never dates them; working out which days a
 * period covers is this repo's arithmetic. Showing the office's name for it is
 * what keeps ours and theirs apart -- and on an afternoon bulletin it is how a
 * reader can tell that one period covers both Tuesday and Wednesday.
 */
test("names the period the office issued, not just the day we resolved it to", () => {
  render(
    <SurfZone
      state={forecast([
        {
          localDate: "2026-09-02",
          periodName: "THIS AFTERNOON THROUGH WEDNESDAY",
          level: "Moderate",
        },
      ])}
      localDate="2026-09-02"
      when="Wednesday"
    />,
  );

  expect(screen.getByText(/THIS AFTERNOON THROUGH WEDNESDAY/)).toBeDefined();
});

/**
 * Measured 2026-08-28: the office headlined `HIGH RIP CURRENT RISK` over a
 * `TODAY` that read Moderate, because Saturday was the High one. Both are
 * correct at their own scope. Reconciling them -- taking the worse, or hiding
 * the headline when it disagrees -- would be this site editing a safety
 * product, so both are shown and the copy says which is which.
 */
test("shows a headline that names a level the day does not, and scopes it", () => {
  render(
    <SurfZone
      state={forecast(
        [{ localDate: "2026-09-02", periodName: "TODAY", level: "Moderate" }],
        "HIGH RIP CURRENT RISK",
      )}
      localDate="2026-09-02"
      when="today"
    />,
  );

  expect(screen.getByText("HIGH RIP CURRENT RISK")).toBeDefined();
  expect(screen.getByText("Moderate")).toBeDefined();
  // Without this the pair reads as a contradiction rather than as two scopes.
  expect(
    screen.getByText(/covers the whole bulletin rather than one day/i),
  ).toBeDefined();
});

test("carries no headline line when the office published none", () => {
  render(
    <SurfZone
      state={forecast([
        { localDate: "2026-09-02", periodName: "TODAY", level: "Low" },
      ])}
      localDate="2026-09-02"
      when="today"
    />,
  );

  expect(screen.queryByText(/headlined this bulletin/i)).toBeNull();
});

/**
 * The horizon, met as a reader meets it: by stepping to a day past it.
 *
 * The bulletin reaches two or three days depending on when it was issued, and
 * the week grid offers seven. So this sentence is what four or five of the
 * seven days show, and it says why rather than leaving a blank that reads as a
 * failure.
 */
test("says the forecast does not reach a day beyond its horizon", () => {
  render(
    <SurfZone
      state={forecast([
        { localDate: "2026-09-02", periodName: "TODAY", level: "Low" },
      ])}
      localDate="2026-09-06"
      when="Sunday"
    />,
  );

  expect(screen.getByText(/does not reach Sunday/i)).toBeDefined();
  expect(screen.getByText(/twice a day/i)).toBeDefined();
  expect(screen.queryByText("Low")).toBeNull();
});

/**
 * Half the inventory. The sentence names the water rather than reporting that a
 * lookup came back empty, which is the voice `wave_buoy_null_reason` already
 * uses at these same 25 beaches.
 */
test("a sheltered beach is told why the product is not about it", () => {
  render(
    <SurfZone
      state={{
        kind: "no-surf-zone",
        reason:
          "the National Weather Service issues this forecast for San Diego County's " +
          "coastal areas, and a bay, lagoon or inlet has no surf zone, so it does not " +
          "describe the water here",
      }}
      localDate="2026-09-02"
      when="today"
    />,
  );

  expect(screen.getByText(/no surf zone/i)).toBeDefined();
  // Not an outage and not a horizon: a permanent fact about this water.
  expect(screen.queryByText(/could not be read/i)).toBeNull();
  expect(screen.queryByText(/does not reach/i)).toBeNull();
});

test("a quiet office is reported with the upstream reason, not summarised", () => {
  render(
    <SurfZone
      state={{
        kind: "unavailable",
        detail:
          "The National Weather Service returned HTTP 503 for SGX's surf zone bulletins.",
        drift: false,
      }}
      localDate="2026-09-02"
      when="today"
    />,
  );

  expect(screen.getByText(/HTTP 503/)).toBeDefined();
});

/**
 * A judgement reissued twice a day is one whose age a reader can act on, and
 * this block is the only place the page says when it was made.
 */
test("attributes the bulletin and states when it was issued", () => {
  render(
    <SurfZone
      state={forecast([
        { localDate: "2026-09-02", periodName: "TODAY", level: "Low" },
      ])}
      localDate="2026-09-02"
      when="today"
    />,
  );

  expect(
    screen.getByText(/Surf zone forecast, San Diego County Coastal Areas/),
  ).toBeDefined();
  expect(screen.getByText(/issued 1:54 AM/)).toBeDefined();
});

/**
 * ADR-0015 records that a surface on this page is decoration and never a
 * verdict, because ADR-0009 forbids the verdict. A three-step severity palette
 * would be this site choosing what red means on top of a scale the office
 * already publishes in words, so the level is emphasised identically at all
 * three levels.
 *
 * Asserted as sameness rather than by naming a class, so the rule survives a
 * change of type scale. jsdom applies no stylesheets (ADR-0001), so what this
 * proves is that one code path renders all three -- a human confirms the
 * emphasis reads.
 */
test("the three levels are rendered with the same emphasis", () => {
  const classNames = (["Low", "Moderate", "High"] as const).map((level) => {
    const { container, unmount } = render(
      <SurfZone
        state={forecast([
          { localDate: "2026-09-02", periodName: "TODAY", level },
        ])}
        localDate="2026-09-02"
        when="today"
      />,
    );
    const found = screen.getByText(level).className;
    unmount();
    void container;
    return found;
  });

  expect(new Set(classNames).size).toBe(1);
});
