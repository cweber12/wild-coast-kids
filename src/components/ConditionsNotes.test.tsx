import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConditionsNotes } from "./ConditionsNotes";
import { REGION_HEADING } from "./headingRank";

const ENTRIES = [
  "beach_type is UNKNOWN upstream for most of these beaches.",
  "TWC0405 Point Loma does not deliver predictions.",
];

const REACH = {
  listed: 73,
  served: 41,
  excluded: [
    {
      slug: "san-onofre-state-beach",
      name: "San Onofre State Beach",
      why: "its tide station 9410230 is 56.6 km away",
    },
  ],
};

/**
 * The four assertions below moved here from `TideToday` and `WavesToday` when
 * the shared explanation was collected into one block. They assert the same
 * properties those tests asserted; only the component that owns them changed.
 */

test("the datum is named, so a negative tide height is not read as an error", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/mean lower low water/)).toBeDefined();
  expect(
    screen.getByText(/more of the sand and reef is uncovered/),
  ).toBeDefined();
});

test("predictions are named as astronomy rather than as a measurement", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/astronomy rather than a measurement/)).toBeDefined();
});

test("a wave height is attributed as open water, not as the breaking wave", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(
    screen.getByText(/not the height of the wave breaking at the shore/),
  ).toBeDefined();
});

test("the sky is named as an airport reading, and why it is one", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/come from an airport/)).toBeDefined();
  // The clause `WindToday.test.tsx` used to assert, kept verbatim so the
  // property did not weaken when it changed component.
  expect(screen.getByText(/only published by airports/)).toBeDefined();
  expect(screen.getByText(/coastal fog is exactly what changes/)).toBeDefined();
});

/**
 * The property this block used to hold, kept as a negative now that it has
 * moved — the same way the airport clause was kept verbatim when it arrived
 * here from `WindToday.test.tsx`. The standing notice in `ConditionsSection`
 * asserts it positively and adds the clause ADR-0009 names, and this block
 * saying it too would be the page stating one thing twice.
 */
test("the safety framing is not repeated here, it is above the readings", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.queryByText(/None of it is a safety assessment/)).toBeNull();
  // Three notes, not four, and the three that stay are all about reading a
  // figure -- which is what the heading above them promises.
  expect(screen.getByText("Tide heights")).toBeDefined();
  expect(screen.getByText("Wave heights")).toBeDefined();
  expect(screen.getByText("Sky and visibility")).toBeDefined();
});

/**
 * The block renders on every beach, including ones with no sky station and no
 * buoy, so it must describe how the page works rather than assert that this
 * shore has any particular reading. "Where they are shown" is the hedge that
 * makes the airport sentence true at a lagoon.
 */
test("it explains the page rather than claiming this beach has these readings", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/Where they are shown/)).toBeDefined();
});

/**
 * Caveats moved inside this block. `ConditionsSection.test.tsx` asserts the
 * whole chain from the data files to the page; this one asserts the single link
 * that moved, so a regression here names the component that broke.
 */
test("the caveats it is given still reach the reader from inside it", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  for (const entry of ENTRIES) {
    expect(screen.getByText(entry)).toBeDefined();
  }
  expect(screen.getByText(/41 of the 73 beaches/)).toBeDefined();
});

test("each note is a term and its explanation, not a run of prose", () => {
  const { container } = render(
    <ConditionsNotes entries={ENTRIES} reach={REACH} />,
  );

  // A description list, so the pairing survives for a reader who cannot see
  // the bolding that carries it visually. Asserted as a pairing rather than as
  // two independent counts: a note that lost its `<dd>` is the failure this
  // catches, and the count alone would not see it.
  const terms = container.querySelectorAll("dt");
  const details = container.querySelectorAll("dd");

  expect(terms.length).toBe(details.length);
  // Three since the safety framing became a standing notice above the
  // readings. The named-term assertions elsewhere in this file are what stop a
  // note being dropped silently; this number only tracks them.
  expect(terms.length).toBe(3);
});

test("it is a labelled region, so the notes are reachable as a landmark", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  const heading = screen.getByRole("heading", {
    name: /how to read these numbers/i,
  });
  expect(heading).toBeDefined();
});

/**
 * ADR-0014: a region heading is display register, so it outranks the card and
 * day headings inside the page. This block introduces one of the page's two
 * regions and rendered at 10px — the smallest token in the system, and smaller
 * than the 13px body it introduces.
 */
test("the block's heading takes the region rank", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  const heading = screen.getByRole("heading", {
    name: "How to read these numbers",
  });

  expect(heading.className).toBe(REGION_HEADING);
  // Per ADR-0001 jsdom applies no stylesheets, so this proves the rank is
  // referred to, not that 34px renders. That stays a human check.
  expect(heading.className).not.toContain("text-2xs");
});
