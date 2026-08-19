import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { WindToday } from "./WindToday";

const KNKX = {
  name: "San Diego, Miramar MCAS/Mitscher Field Airport",
  distanceM: 10_429,
};
const NEAR = { name: "San Diego International Airport", distanceM: 1_600 };

const READING = {
  kind: "reading" as const,
  visibilityMi: 10.0,
  visibilityAtCeiling: true,
  airTempF: 69.98,
  windMph: 5.82,
  gustMph: null,
  windDirDegT: 320,
  sky: "Clear",
};

test("the ten-mile ceiling reads as a floor, never as an exact measurement", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={READING}
    />,
  );

  // METAR stops at ten miles. "10 miles" would claim a precision upstream
  // never offered.
  expect(screen.getByText(/Visibility 10 miles or more/)).toBeDefined();
});

test("a visibility below the ceiling is given as the measurement it is", () => {
  render(
    <WindToday
      beachName="Oceanside Harbor Beach"
      station={NEAR}
      state={{ ...READING, visibilityMi: 8.0, visibilityAtCeiling: false }}
    />,
  );

  expect(screen.getByText(/Visibility 8 miles\./)).toBeDefined();
});

test("wind is given in plain words, from the direction it blows from", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={READING}
    />,
  );

  // 320 degrees true. Naming it as the direction the wind blows *towards*
  // would reverse every reading on the page.
  expect(screen.getByText(/Wind 6 mph from the north-west/)).toBeDefined();
});

test("air temperature and sky come from the same reading", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={READING}
    />,
  );

  expect(screen.getByText("70°F")).toBeDefined();
  expect(screen.getByText(/Sky: clear/)).toBeDefined();
});

test("the temperature is the panel's largest figure and visibility is not", () => {
  // The reorder is the whole of this slice, so it is asserted rather than
  // left to a screenshot. Visibility held this slot and sits at METAR's
  // ten-mile ceiling most of the time, which made the largest text on the
  // panel a near-constant describing an airport. See ADR 0010.
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={READING}
    />,
  );

  expect(screen.getByText("70°F").className).toContain("text-4xl");
  expect(
    screen.getByText(/Visibility 10 miles or more/).className,
  ).not.toContain("text-4xl");
});

test("the four values are still read in one sentence beneath the temperature", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={READING}
    />,
  );

  // Wind, then sky, then visibility -- least useful last. One node, so the
  // order is asserted rather than three independent presence checks.
  expect(
    screen.getByText(
      /Wind 6 mph from the north-west\. Sky: clear\. Visibility 10 miles or more\./,
    ),
  ).toBeDefined();
});

test("a gust is shown when the station published one", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{ ...READING, gustMph: 14.2 }}
    />,
  );

  expect(screen.getByText(/gusting 14/)).toBeDefined();
});

test("no wind value says so rather than reading as calm", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{ ...READING, windMph: null, windDirDegT: null }}
    />,
  );

  // A blank here would read as a still day.
  expect(screen.getByText(/reported no wind speed/)).toBeDefined();
});

test("a genuine calm is named as calm, not as a missing reading", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{ ...READING, windMph: 0, windDirDegT: 0 }}
    />,
  );

  expect(screen.getByText(/The wind is calm/)).toBeDefined();
});

test("a station publishing no visibility says so rather than rendering blank", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{ ...READING, visibilityMi: null, visibilityAtCeiling: false }}
    />,
  );

  expect(screen.getByText(/reported no visibility/)).toBeDefined();
});

test("the airport and its distance are attributed, because fog differs across it", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={READING}
    />,
  );

  expect(
    screen.getByText(/Miramar MCAS.*about 10 km from this beach/),
  ).toBeDefined();
  expect(screen.getByText(/not a reading taken at the shore/)).toBeDefined();
});

test("a nearby station is attributed without a distance", () => {
  render(
    <WindToday
      beachName="Spanish Landing Park"
      station={NEAR}
      state={READING}
    />,
  );

  expect(screen.getByText(/San Diego International Airport\./)).toBeDefined();
});

test("no station is a permanent fact about the place, with its reason", () => {
  render(
    <WindToday
      beachName="Imperial Beach pier area"
      station={null}
      state={{
        kind: "no-station",
        reason:
          "the lower endpoint published upstream (32.1327, -117.1332) is outside San Diego County, so no station can be joined to it",
      }}
    />,
  );

  expect(screen.getByText(/gap in what is published/)).toBeDefined();
  expect(screen.getByText(/outside San Diego County/)).toBeDefined();
  // Never invite a reader to retry something that will never work.
  expect(screen.queryByText(/Try again shortly/)).toBeNull();
});

test("an unavailable feed is transient, and says so differently", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{
        kind: "unavailable",
        detail: "NWS KNKX returns 404 for its latest observation.",
        drift: false,
      }}
    />,
  );

  expect(screen.getByText(/Try again shortly/)).toBeDefined();
  expect(screen.getByText(/returns 404/)).toBeDefined();
});

test("drift is disclosed as a bug here rather than a problem upstream", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{
        kind: "unavailable",
        detail: "windSpeed is published in wmoUnit:kn, not wmoUnit:km_h-1.",
        drift: true,
      }}
    />,
  );

  expect(
    screen.getByText(/bug here rather than a problem at the station/),
  ).toBeDefined();
});

test("a visibility under a mile keeps its decimal, being the reading that matters", () => {
  render(
    <WindToday
      beachName="Torrey Pines State Beach"
      station={KNKX}
      state={{ ...READING, visibilityMi: 0.25, visibilityAtCeiling: false }}
    />,
  );

  // Rounded to whole miles this would render "0 miles", which reads as an
  // instrument fault rather than as thick fog.
  expect(screen.getByText(/Visibility 0\.3 miles\./)).toBeDefined();
});

test("one mile is singular", () => {
  render(
    <WindToday
      beachName="Torrey Pines State Beach"
      station={KNKX}
      state={{ ...READING, visibilityMi: 1.2, visibilityAtCeiling: false }}
    />,
  );

  expect(screen.getByText(/Visibility 1 mile\./)).toBeDefined();
});

test("wind with no direction is still given as a speed", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{ ...READING, windDirDegT: null }}
    />,
  );

  expect(screen.getByText(/Wind 6 mph\./)).toBeDefined();
});

test("no sky simply goes unsaid", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{ ...READING, sky: null }}
    />,
  );

  expect(screen.queryByText(/Sky:/)).toBeNull();
});

test("a missing temperature says so rather than leaving the panel headed by nothing", () => {
  render(
    <WindToday
      beachName="La Jolla Shores Beach"
      station={KNKX}
      state={{ ...READING, airTempF: null }}
    />,
  );

  // Sky and wind may go unsaid on the line beneath. The primary slot cannot:
  // an empty one would read as a rendering fault, and it is the figure the
  // reader came for.
  expect(screen.getByText("No temperature reading")).toBeDefined();
});
