import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TideToday } from "./TideToday";

const NEAR_STATION = {
  name: "La Jolla (Scripps Institution Wharf)",
  water: "open-coast",
  distanceM: 1369,
};

const FAR_STATION = {
  name: "La Jolla (Scripps Institution Wharf)",
  water: "open-coast",
  distanceM: 56_557,
};

test("a reading leads with the time and names the beach", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{ kind: "reading", timeLabel: "6:24 AM", feet: 1.368 }}
    />,
  );

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toContain("Lowest tide today");
  expect(heading.textContent).toContain("La Jolla Shores Beach");
  expect(screen.getByText("6:24 AM")).toBeDefined();
});

test("a positive height is described against the average low", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{ kind: "reading", timeLabel: "6:24 AM", feet: 1.368 }}
    />,
  );
  expect(screen.getByText(/1\.4 ft above the average low tide/)).toBeDefined();
});

test("a negative height explains its own minus sign", () => {
  render(
    <TideToday
      beachName="Cabrillo"
      station={NEAR_STATION}
      state={{ kind: "reading", timeLabel: "3:12 PM", feet: -0.4 }}
    />,
  );
  // The sign is the most useful fact on the page for a tidepooler and the most
  // likely to read as an error, so it is explained where it appears.
  expect(
    screen.getByText(/-0\.4 ft — the water drops below the average low/),
  ).toBeDefined();
});

/**
 * The datum and the safety qualification are asserted in
 * `ConditionsNotes.test.tsx` now. They were the same sentences under all three
 * panels, so they were collected into one block; what this panel still owes the
 * reader is which station answered for this beach.
 */
test("the station that supplied the prediction is credited here, not elsewhere", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{ kind: "reading", timeLabel: "6:24 AM", feet: 1.368 }}
    />,
  );
  // Read off the rendered paragraph rather than matched as a pattern: the
  // station's name carries parentheses, and building a regex from it turns
  // them into a capture group that matches a string the page never renders.
  const attribution =
    screen.getByText(/NOAA Tides & Currents/).textContent ?? "";
  expect(attribution).toContain(NEAR_STATION.name);
  // A plain ampersand reaches the reader. Written `&amp;` in the string
  // attribute it would have rendered as the entity itself.
  expect(attribution).toContain("NOAA Tides & Currents");
});

test("a nearby station is credited without a distance", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{ kind: "reading", timeLabel: "6:24 AM", feet: 1.368 }}
    />,
  );
  expect(screen.queryByText(/km away/)).toBeNull();
});

test("a distant station discloses how far away it is", () => {
  render(
    <TideToday
      beachName="San Onofre State Beach"
      station={FAR_STATION}
      state={{ kind: "reading", timeLabel: "6:24 AM", feet: 1.368 }}
    />,
  );
  // 57 km up the coast is the difference between a prediction for this shore and
  // the nearest one anybody publishes, so it is said where the number is given.
  expect(screen.getByText(/57 km away/)).toBeDefined();
  expect(
    screen.getByText(/nearest open-coast station publishing predictions/),
  ).toBeDefined();
});

test("no low in the window says so, and says it is not a calm sea", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{ kind: "no-low-today" }}
    />,
  );
  expect(
    screen.getByText(/gap in our request rather than a calm sea/),
  ).toBeDefined();
});

test("a beach with no station says so permanently, and credits no station", () => {
  render(
    <TideToday
      beachName="Imperial Beach pier area"
      station={null}
      state={{
        kind: "no-station",
        reason:
          "the lower endpoint published upstream (32.1327, -117.1332) is outside San Diego County",
      }}
    />,
  );

  expect(
    screen.getByText(/No tide station could be matched to it/),
  ).toBeDefined();
  // Not an outage: nothing here invites the reader to try again later.
  expect(screen.queryByText(/try again shortly/)).toBeNull();
  expect(screen.queryByText(/NOAA Tides/)).toBeNull();
  expect(screen.getByText(/outside San Diego County/)).toBeDefined();
});

test("an unavailable reading is a sentence, with the upstream reason behind a disclosure", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "unavailable",
        detail: "NOAA returned HTTP 503 for station 9410230.",
        drift: false,
      }}
    />,
  );

  expect(
    screen.getByText(/could not get today's tide prediction/),
  ).toBeDefined();
  expect(screen.getByText("What went wrong")).toBeDefined();
  expect(
    screen.getByText("NOAA returned HTTP 503 for station 9410230."),
  ).toBeDefined();
  // No blank and no zero: nothing here can be read as a calm sea.
  expect(screen.queryByText(/ft above the average low/)).toBeNull();
});

test("drift is called out as a bug here rather than a problem at the station", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "unavailable",
        detail:
          'CO-OPS 9410230: expected a "predictions" array and found undefined.',
        drift: true,
      }}
    />,
  );
  expect(
    screen.getByText(/a bug here rather than a problem at the station/),
  ).toBeDefined();
});
