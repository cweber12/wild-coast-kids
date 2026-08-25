import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WavesToday } from "./WavesToday";
import { DISCLOSURE_TARGET } from "./disclosure";

const NEAR = { name: "Scripps Nearshore", distanceM: 1400 };
const FAR = { name: "Point Loma South", distanceM: 34_159 };

test("a reading leads with the height and puts it in plain words", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={{
        kind: "reading",
        heightFt: 2.62,
        periodS: 5,
        directionDegT: 278,
        waterTempF: 69.98,
      }}
    />,
  );

  expect(screen.getByText("2.6 ft")).toBeDefined();
  // A height alone tells a surfer what they need and a parent very little, so
  // the plain-language companion survives the move to a card. The period left
  // this sentence and became a figure of its own; what it must not do is stop
  // being said.
  expect(screen.getByText(/about waist high/)).toBeDefined();
  expect(screen.getByText("5 s")).toBeDefined();
});

test("water temperature comes from the same reading, rounded", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={{
        kind: "reading",
        heightFt: 2.62,
        periodS: 5,
        directionDegT: 278,
        waterTempF: 69.98,
      }}
    />,
  );
  // Shown as a figure now rather than as the tail of a sentence, and still
  // rounded: the buoy publishes 69.98 and nobody swims to two decimal places.
  expect(screen.getByText("70°F")).toBeDefined();
});

test("a buoy reporting no water temperature says so rather than omitting it", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={{
        kind: "reading",
        heightFt: 2.62,
        periodS: null,
        directionDegT: null,
        waterTempF: null,
      }}
    />,
  );
  // A buoy that publishes waves and no water temperature is a measured fact
  // about that buoy, not a hypothetical. Both figures state their absence
  // rather than vanishing, because a missing row reads as an oversight and a
  // blank one reads as a calm sea.
  expect(screen.getAllByText("Not reported").length).toBe(2);
  expect(screen.getByText("Water")).toBeDefined();
});

/**
 * That an open-water buoy is not the breaking wave is asserted in
 * `ConditionsNotes.test.tsx` now — it is true at every beach, so it was
 * collected rather than repeated under each reading. What stays here is the
 * buoy, and the distance when there is one worth disclosing.
 */
test("a nearby buoy is credited without a distance", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={{
        kind: "reading",
        heightFt: 2.62,
        periodS: 5,
        directionDegT: 278,
        waterTempF: 69.98,
      }}
    />,
  );
  const line = screen.getByText(/NDBC/).textContent ?? "";
  expect(line).toContain(NEAR.name);
  expect(screen.queryByText(/km from this beach/)).toBeNull();
});

test("a distant buoy discloses how far away it is", () => {
  render(
    <WavesToday
      beachName="Tijana River"
      buoy={FAR}
      state={{
        kind: "reading",
        heightFt: 3.1,
        periodS: 9,
        directionDegT: 270,
        waterTempF: 68,
      }}
    />,
  );
  // 34 km up the coast, because the only buoy south of Point Loma is dead.
  expect(screen.getByText(/about 34 km from this beach/)).toBeDefined();
});

test("a bay beach is told this is expected, not a fault", () => {
  render(
    <WavesToday
      beachName="Agua Hedionda Lagoon"
      buoy={null}
      state={{
        kind: "no-buoy",
        reason:
          "every wave buoy sits on the open coast, and ocean swell does not reach into a bay or lagoon, so no buoy describes the water here",
      }}
    />,
  );

  expect(
    screen.getByText(/that is what we expect rather than a fault/),
  ).toBeDefined();
  // Not an outage: nothing invites the reader to try again.
  expect(screen.queryByText(/Try again shortly/)).toBeNull();
  expect(screen.queryByText(/Measured at NDBC buoy/)).toBeNull();
  expect(screen.getByText(/does not reach into a bay or lagoon/)).toBeDefined();
});

test("an unavailable buoy is a sentence with the reason behind a disclosure", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={{
        kind: "unavailable",
        detail:
          "NDBC 46254's newest observation is 214 minutes old, past the 180 minute limit.",
        drift: false,
      }}
    />,
  );

  expect(screen.getByText(/could not get a wave reading/)).toBeDefined();
  expect(screen.getByText(/past the 180 minute limit/)).toBeDefined();
  // No number anywhere that could read as a calm sea.
  expect(screen.queryByText(/ft$/)).toBeNull();
});

test("drift is named as a bug here rather than a problem at the buoy", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={{
        kind: "unavailable",
        detail: "NDBC 46254: the column layout has drifted.",
        drift: true,
      }}
    />,
  );
  expect(
    screen.getByText(/a bug here rather than a problem at the buoy/),
  ).toBeDefined();
});

/**
 * ADR-0004's 44px floor, on the elements that were the last thing on this page
 * under it. A `<summary>` is background-less, so it takes the floor at every
 * breakpoint and carries no `md:min-h-0` -- see `disclosure.ts` for why the
 * display is left alone and why the padding is part of the composition.
 *
 * Every summary the component can render rather than a named one, because the
 * failure this repo has is drift: a disclosure added later without the floor.
 * Per ADR-0001 jsdom applies no stylesheets, so this proves the class is
 * referenced, not that the box measures 44px. That stays a human check.
 */
test("every disclosure this card can render composes the touch-target floor", () => {
  const renders = [
    render(
      <WavesToday
        beachName="Kellogg Park"
        buoy={null}
        state={{
          kind: "no-buoy",
          reason: "every wave buoy sits on the open coast",
        }}
      />,
    ),
    render(
      <WavesToday
        beachName="La Jolla Shores Beach"
        buoy={NEAR}
        state={{
          kind: "unavailable",
          detail: "NDBC 46254's newest observation is 214 minutes old.",
          drift: false,
        }}
      />,
    ),
  ];

  const summaries = renders.flatMap((r) => [
    ...r.container.querySelectorAll("summary"),
  ]);

  // The no-buoy "Why not" is the one the review measured at 279x17; the
  // unavailable disclosure eighteen lines below it in the source is the one a
  // fix scoped to what rendered that day would have left behind.
  expect(summaries).toHaveLength(2);
  for (const summary of summaries) {
    expect(summary.className).toContain(DISCLOSURE_TARGET);
  }
});
