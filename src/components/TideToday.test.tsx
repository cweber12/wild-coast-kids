import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { TideToday } from "./TideToday";
import { DISCLOSURE_TARGET } from "./disclosure";

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

test("a reading leads with the time, and the beach names the region", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:24 AM", feet: 1.368 },
        allDay: { timeLabel: "3:14 AM", feet: -1.1 },
      }}
    />,
  );

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toContain("Lowest daylight tide");
  expect(screen.getByText("6:24 AM")).toBeDefined();

  // The beach left the visible heading when three cards went side by side —
  // the same constant printed three times is noise, and the page header and
  // the chooser already say which beach this is. It stays in the region's
  // accessible name, for someone navigating by landmark rather than reading
  // the header.
  expect(heading.textContent).not.toContain("La Jolla Shores Beach");
  expect(
    screen.getByRole("region", {
      name: "Lowest daylight tide · La Jolla Shores Beach",
    }),
  ).toBeDefined();
});

test("a positive height is described against the average low", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:24 AM", feet: 1.368 },
        allDay: { timeLabel: "3:14 AM", feet: -1.1 },
      }}
    />,
  );
  // The number is a figure now, beside the sentence that explains it — it was
  // the last measurement on the page still dissolved in prose.
  expect(screen.getByText("1.4 ft")).toBeDefined();
  expect(screen.getByText(/Above the average low tide/)).toBeDefined();
});

test("a negative height explains its own minus sign", () => {
  render(
    <TideToday
      beachName="Cabrillo"
      station={NEAR_STATION}
      state={{
        kind: "reading",
        daylight: { timeLabel: "3:12 PM", feet: -0.4 },
        allDay: { timeLabel: "3:14 AM", feet: -1.1 },
      }}
    />,
  );
  // The sign is the most useful fact on the page for a tidepooler and the most
  // likely to read as an error, so it is explained where it appears.
  expect(screen.getByText("-0.4 ft")).toBeDefined();
  expect(
    screen.getByText(/Below the average low tide — more of the sand and reef/),
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
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:24 AM", feet: 1.368 },
        allDay: { timeLabel: "3:14 AM", feet: -1.1 },
      }}
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
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:24 AM", feet: 1.368 },
        allDay: { timeLabel: "3:14 AM", feet: -1.1 },
      }}
    />,
  );
  expect(screen.queryByText(/km from this beach/)).toBeNull();
});

test("a distant station discloses how far away it is", () => {
  render(
    <TideToday
      beachName="San Onofre State Beach"
      station={FAR_STATION}
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:24 AM", feet: 1.368 },
        allDay: { timeLabel: "3:14 AM", feet: -1.1 },
      }}
    />,
  );
  // 57 km up the coast is the difference between a prediction for this shore and
  // the nearest one anybody publishes, so it is said where the number is given.
  expect(screen.getByText(/about 57 km from this beach/)).toBeDefined();
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
  // No blank, no zero and no height: nothing here can be read as a calm sea.
  expect(screen.queryByText(/average low tide/)).toBeNull();
  expect(screen.queryByText("Height")).toBeNull();
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
      <TideToday
        beachName="Imperial Beach pier area"
        station={null}
        state={{
          kind: "no-station",
          reason: "no tide station could be joined to this beach",
        }}
      />,
    ),
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
    ),
  ];

  const summaries = renders.flatMap((r) => [
    ...r.container.querySelectorAll("summary"),
  ]);

  // Both degraded states, so neither disclosure can be the one that was missed.
  expect(summaries).toHaveLength(2);
  for (const summary of summaries) {
    expect(summary.className).toContain(DISCLOSURE_TARGET);
  }
});

/**
 * ADR-0015. The brief committed 🌊 here and argued against a shell; both of its
 * reasons were re-measured and one of them did not hold. Pinned as a test
 * because a glyph is the kind of thing a later edit changes without noticing
 * that a decision was attached to it — and because 🌊 now means one thing
 * site-wide, Tidepools, which this card leaving it is what protects.
 */
test("the tide card is marked by a shell", () => {
  const { container } = render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:24 AM", feet: 1.368 },
        allDay: { timeLabel: "3:14 AM", feet: -1.1 },
      }}
    />,
  );

  const glyph = container.querySelector('[aria-hidden="true"]');
  expect(glyph?.textContent).toBe("🐚");
});

test("the day's lowest sits beside the daylight one, from the same station", () => {
  // One group and one attribution: both lows come from one station and one
  // request, read twice through different windows. A second group would imply
  // a second source, which is what StatGroup's rule exists to stop.
  const { container } = render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:41 PM", feet: 0.9 },
        allDay: { timeLabel: "3:14 AM", feet: -0.42 },
      }}
    />,
  );

  expect(container.querySelectorAll("dl")).toHaveLength(1);
  expect(screen.getByText("Lowest all day")).toBeDefined();
  expect(screen.getByText("3:14 AM · -0.4 ft")).toBeDefined();
});

test("a daylight low that is also the day's lowest says so rather than repeating", () => {
  render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "reading",
        daylight: { timeLabel: "6:41 PM", feet: 0.9 },
        allDay: null,
      }}
    />,
  );

  expect(screen.getByText("None lower")).toBeDefined();
});

test("no low in daylight leads with nothing, and still gives the day's lowest", () => {
  // ReadingCard refuses to render an empty figure slot, so the card leads with
  // no figure at all rather than promoting a reading a parent cannot use.
  const { container } = render(
    <TideToday
      beachName="La Jolla Shores Beach"
      station={NEAR_STATION}
      state={{
        kind: "reading",
        daylight: null,
        allDay: { timeLabel: "3:14 AM", feet: -0.42 },
      }}
    />,
  );

  expect(container.querySelector(".text-stat")).toBeNull();
  expect(
    screen.getByText(/No low tide falls between sunrise and sunset/),
  ).toBeDefined();
  expect(screen.getByText("3:14 AM · -0.4 ft")).toBeDefined();
});
