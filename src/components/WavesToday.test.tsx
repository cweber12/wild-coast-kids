import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WavesToday } from "./WavesToday";

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
  // A height alone tells a surfer what they need and a parent very little.
  expect(screen.getByText(/about waist high, 5 seconds apart/)).toBeDefined();
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
  expect(screen.getByText(/The water is 70°F/)).toBeDefined();
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
  expect(screen.getByText(/reported no water temperature/)).toBeDefined();
});

test("the reading is attributed as open water, not as the breaking wave", () => {
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
  expect(
    screen.getByText(/not the height of the wave breaking at the shore/),
  ).toBeDefined();
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
