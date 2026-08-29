import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConditionsNotes } from "./ConditionsNotes";
import { REGION_HEADING } from "./headingRank";

const ENTRIES = [
  "beach_type is UNKNOWN upstream for most of these beaches.",
  "TWC0405 Point Loma failed once and is now re-measured rather than assumed.",
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

/**
 * The clause this replaced asserted that the sky was "named as an airport
 * reading, and why it is one" -- true while the card showed one. The reason
 * survives the figures rather than going with them: a reader who wonders why a
 * beach site has no cloud reading is owed the answer, and it is the same answer
 * that justified the deletion.
 */
test("the airports are still named, as the reason there is no reading", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(
    screen.getByText(
      /only stations in this county publishing either one are airports/,
    ),
  ).toBeDefined();
  expect(
    screen.getByText(
      /describes its own field rather than a beach kilometres away/,
    ),
  ).toBeDefined();
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
  expect(screen.getByText("Cloud cover")).toBeDefined();
  // The airport entry is gone with the figures it explained. A note about a
  // reading the page no longer carries would be prose describing nothing.
  expect(screen.queryByText("Sky and visibility")).toBeNull();
});

/**
 * The block renders on every beach, including ones with no sky station and no
 * buoy, so it must describe how the page works rather than assert that this
 * shore has any particular reading. "Where they are shown" is the hedge that
 * makes the airport sentence true at a lagoon.
 */
test("it explains the page rather than claiming this beach has these readings", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  // No beach-specific claim: the block renders on beaches the cloud forecast
  // reaches and beaches it does not.
  expect(
    screen.getByText(/rather than a reading taken anywhere/),
  ).toBeDefined();
});

/**
 * The week's forecast is a different kind of figure from the readings on the
 * cards, and the block a reader goes to for "what does this number mean" has to
 * say which. It must NOT yet claim the page carries no current sky reading: the
 * air card still shows one until ADR-0020's deletion slice lands, and a note
 * saying otherwise would be false while both are on screen.
 */
test("the cloud row is explained as a forecast for a square of the map", () => {
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/this beach's own square/)).toBeDefined();
  expect(
    screen.getByText(/rather than the cloudiest hour of it/),
  ).toBeDefined();
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
  // reaches. The sixth was the gridded cloud row's entry, which stood beside
  // the airport one for one PR and then replaced it when sky left the card.
  // The named-term assertions elsewhere in this file are what stop a note being
  // dropped silently; this number only tracks them.
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

test("the reader is told why the week leaves the overnight extremes out", () => {
  // ADR-0017 put the daylight extreme first and the day's own beneath it, and
  // this entry explained the pair. ADR-0023 removed the second figure from the
  // week, so what needs explaining changed: not why the leading number is the
  // higher one, but where the lower one went. Left unsaid, a reader who saw a
  // -0.2 ft last week finds it gone with nothing to account for it.
  render(<ConditionsNotes entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/so the week leaves them out/)).toBeDefined();
  expect(
    screen.getByText(/the day below draws the whole twenty-four hours/i),
  ).toBeDefined();
  expect(
    screen.getByText(/nothing here is a judgement about when you should go/),
  ).toBeDefined();
});
