import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TideToday } from "./TideToday";

const BINDING = {
  beachName: "La Jolla Shores Beach",
  stationName: "La Jolla (Scripps Pier)",
  stationRole: "open coast",
};

test("a reading leads with the time and names the beach", () => {
  render(
    <TideToday
      {...BINDING}
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
      {...BINDING}
      state={{ kind: "reading", timeLabel: "6:24 AM", feet: 1.368 }}
    />,
  );
  expect(screen.getByText(/1\.4 ft above the average low tide/)).toBeDefined();
});

test("a negative height explains its own minus sign", () => {
  render(
    <TideToday
      {...BINDING}
      state={{ kind: "reading", timeLabel: "3:12 PM", feet: -0.4 }}
    />,
  );
  // The sign is the most useful fact on the page for a tidepooler and the most
  // likely to read as an error, so it is explained where it appears.
  expect(
    screen.getByText(/-0\.4 ft — the water drops below the average low/),
  ).toBeDefined();
  expect(
    screen.getByText(/more of the sand and reef is uncovered/),
  ).toBeDefined();
});

test("the datum is named once, and predictions are not offered as a safety call", () => {
  render(
    <TideToday
      {...BINDING}
      state={{ kind: "reading", timeLabel: "6:24 AM", feet: 1.368 }}
    />,
  );
  expect(screen.getByText(/mean lower low water/)).toBeDefined();
  expect(screen.getByText(/not a safety assessment/)).toBeDefined();
  expect(screen.getByText(/La Jolla \(Scripps Pier\)/)).toBeDefined();
});

test("no low in the window says so, and says it is not a calm sea", () => {
  render(<TideToday {...BINDING} state={{ kind: "no-low-today" }} />);
  expect(
    screen.getByText(/gap in our request rather than a calm sea/),
  ).toBeDefined();
  expect(screen.getByText(/the tide still goes out/)).toBeDefined();
});

test("an unavailable reading is a sentence, with the upstream reason behind a disclosure", () => {
  render(
    <TideToday
      {...BINDING}
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
  // The reader gets a sentence; the exact reason is available without being in the way.
  expect(screen.getByText("What went wrong")).toBeDefined();
  expect(
    screen.getByText("NOAA returned HTTP 503 for station 9410230."),
  ).toBeDefined();
  // Nothing anywhere renders a number, which is the point: no blank, no zero.
  expect(screen.queryByText(/ft above the average low/)).toBeNull();
});

test("drift is called out as a bug here rather than a problem at the station", () => {
  render(
    <TideToday
      {...BINDING}
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
