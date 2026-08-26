import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WavesToday } from "./WavesToday";
import { DISCLOSURE_TARGET } from "./disclosure";

const NEAR = { name: "Scripps Nearshore", distanceM: 1400 };
const FAR = { name: "Point Loma South", distanceM: 34_159 };

const READING = {
  kind: "reading",
  heightFt: 2.62,
  periodS: 5,
  directionDegT: 278,
  waterTempF: 69.98,
} as const;

/** Today's peak, as `WavePanel` hands it over: already selected, already worded. */
const PEAK = {
  line: { id: "D0498", distanceM: 325 },
  daylight: { timeLabel: "11:00 AM", heightFt: 0.8, periodS: 6.25 },
  allDay: { timeLabel: "2:00 AM", heightFt: 1.1, periodS: 5 },
};

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

/* =========================================================================
 * The forecast beside the measurement
 * ========================================================================= */

test("the forecast is a second group with its own figures", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={READING}
      peak={PEAK}
    />,
  );

  expect(screen.getByText("11:00 AM")).toBeDefined();
  expect(screen.getByText("0.8 ft")).toBeDefined();
  // Whole seconds, as the measured period beside it is.
  expect(screen.getByText("6 s")).toBeDefined();
});

test("the two sources are labelled by kind, not by distance", () => {
  // Both are a wave height in feet, so which is nearer is not the distinction
  // a reader has to make. Which is an instrument and which is a model is.
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={READING}
      peak={PEAK}
    />,
  );

  expect(screen.getByText(/NDBC/).textContent).toContain("Measured now");
  const forecast = screen.getByText(/MOP line D0498/).textContent ?? "";
  expect(forecast).toContain("Forecast today");
  expect(forecast).toContain("CDIP, Scripps Institution of Oceanography");
  expect(forecast).toContain("about 0.3 km from this beach");
  expect(forecast).toContain("not a measurement");
});

test("one stat group never spans the two sources", () => {
  // ADR-0010, and here it is load-bearing rather than tidy: the two groups
  // carry the same quantity in the same unit, so a single group of five would
  // let a reader attribute the model's height to the buoy.
  const { container } = render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={READING}
      peak={PEAK}
    />,
  );

  const groups = [...container.querySelectorAll("dl")];
  expect(groups).toHaveLength(2);
  expect(
    [...groups[0].querySelectorAll("dt")].map((n) => n.textContent),
  ).toEqual(["Period", "Water"]);
  expect(
    [...groups[1].querySelectorAll("dt")].map((n) => n.textContent),
  ).toEqual(["Biggest at", "Height", "Period", "Biggest all day"]);
});

test("the card leads with the measurement even when only the model answered", () => {
  // The one thing ADR-0016 refuses outright: promoting a modelled height into
  // the slot a measurement had. A quiet buoy leads with nothing.
  const { container } = render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={{
        kind: "unavailable",
        detail: "NDBC 46254 returns 404.",
        drift: false,
      }}
      peak={PEAK}
    />,
  );

  expect(container.querySelector(".text-stat")).toBeNull();
  // And the forecast is still there, so the card is not empty.
  expect(screen.getByText("11:00 AM")).toBeDefined();
});

test("no forecast renders no second block, and no explanation either", () => {
  // Three different reasons -- no line bound, CDIP quiet, a forecast that no
  // longer reaches today -- all render the same way here, because the week
  // grid below says which it was in words.
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={READING}
    />,
  );

  expect(screen.queryByText(/MOP line/)).toBeNull();
  expect(screen.queryByText(/Forecast today/)).toBeNull();
  expect(screen.queryByText(/Biggest at/)).toBeNull();
});

test("the day's biggest joins the same group, since it is the same line", () => {
  // One MOP line, one request, read twice through different windows -- so a
  // second group would imply a second source. The measured half above is the
  // one that genuinely has another.
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={READING}
      peak={PEAK}
    />,
  );

  expect(screen.getByText("Biggest all day")).toBeDefined();
  expect(screen.getByText("2:00 AM · 1.1 ft")).toBeDefined();
});

test("a daylight peak that is also the day's biggest says so rather than repeating", () => {
  render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={READING}
      peak={{ ...PEAK, allDay: null }}
    />,
  );

  expect(screen.getByText("None bigger")).toBeDefined();
});

test("no estimate in daylight leaves only the day's own, not three blanks", () => {
  // StatGroup renders a null as "Not reported", which is right for a station
  // that published nothing and wrong for three figures that were never asked
  // for. The group carries what there is.
  const { container } = render(
    <WavesToday
      beachName="La Jolla Shores Beach"
      buoy={NEAR}
      state={READING}
      peak={{ ...PEAK, daylight: null }}
    />,
  );

  expect(screen.queryByText("Not reported")).toBeNull();
  const forecast = [...container.querySelectorAll("dl")][1];
  expect(
    [...forecast.querySelectorAll("dt")].map((n) => n.textContent),
  ).toEqual(["Biggest all day"]);
});
