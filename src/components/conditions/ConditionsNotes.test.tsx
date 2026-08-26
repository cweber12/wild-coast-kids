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

test("the forecast is named as a model, beside the height that is a measurement", () => {
  // The page now carries two wave numbers for one beach on one day. The
  // difference between them has to be stated where a reader looking at both
  // will find it -- see docs/adr/0016.
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/modelled rather than measured/)).toBeDefined();
  expect(screen.getByText(/two wave numbers/)).toBeDefined();
});

test("CDIP and Scripps are credited where the forecast is explained", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/Scripps Institution of Oceanography/)).toBeDefined();
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
  // Five: three since the safety framing became a standing notice above the
  // readings, a fourth when the week gained a modelled wave height beside the
  // measured one, and a fifth when the rows began leading with what daylight
  // reaches. The named-term assertions elsewhere in this file are what stop a
  // note being dropped silently; this number only tracks them.
  expect(terms.length).toBe(5);
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

/**
 * Finding 8 of the conditions-page design review. As a single column this block
 * was 520px of prose in a 1440px section, leaving 920px blank beside it for its
 * full height — the complaint the brief opens with, reproduced in the page's own
 * closing section. The notes are independent of one another, so columns cost a
 * reader nothing to scan.
 *
 * The cap moves from the list to each note, which is what the review's "each
 * still capped at its own measure" requires: on a very wide screen the columns
 * stop growing rather than pulling the lines back out to the 83 characters they
 * measured before.
 *
 * Per ADR-0001 jsdom applies no stylesheets, so this proves the classes are
 * referenced, not that three columns render. The measurements are in the PR.
 */
test("the notes lay out in columns, each keeping its own measure", () => {
  const { container } = render(
    <ConditionsNotes entries={ENTRIES} reach={REACH} />,
  );

  const list = container.querySelector("dl");

  expect(list?.className).toContain("md:grid-cols-2");
  expect(list?.className).toContain("xl:grid-cols-3");

  // On the list the cap would hold the whole grid inside 520px and put the
  // three columns back into the one ribbon this replaces.
  expect(list?.className).not.toContain("max-w-130");
  const notes = Array.from(list?.children ?? []);
  expect(notes.length).toBeGreaterThan(0);
  for (const note of notes) {
    expect(note.className).toContain("max-w-130");
  }
});

test("the reader is told why the leading figure is not the day's lowest", () => {
  // The cell says "Lowest daylight tide" and shows a higher number than the one
  // beneath it. Without this, that reads as a fault -- see docs/adr/0017.
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(
    screen.getByText(/because those are the ones you can be there for/),
  ).toBeDefined();
  expect(
    screen.getByText(/nothing here is a judgement about when you should go/),
  ).toBeDefined();
});
