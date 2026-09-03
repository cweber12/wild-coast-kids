import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Caveats } from "./Caveats";
import { DISCLOSURE_TARGET } from "./disclosure";

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
    {
      slug: "harbor-beach",
      name: "Harbor Beach",
      why: "its tide station 9410230 is 39.4 km away",
    },
  ],
};

test("every caveat given is rendered, not a summary of them", () => {
  render(<Caveats entries={ENTRIES} reach={REACH} />);

  for (const entry of ENTRIES) {
    expect(screen.getByText(entry)).toBeDefined();
  }
});

/**
 * A caveat costs its bytes once, not twice.
 *
 * This component is a server component, so what reaches the browser is not the
 * HTML above but a serialization of the element tree it returns — and a React
 * key is part of that tree. Keying a list item on the caveat prose therefore
 * ships every paragraph twice: once as the key, once as the child. Measured on
 * a built beach page before this was fixed: 24 caveats, each present twice,
 * 9,291 bytes of the flight payload spent on the copies.
 *
 * `render` above cannot see it. A key never reaches the DOM, so the defect and
 * the fix produce byte-identical markup and every assertion in this file passes
 * either way. So this calls the component and counts occurrences in the tree it
 * returns, which is the thing that gets serialized.
 */
test("no caveat is serialized twice, which keying on the prose would do", () => {
  const tree = JSON.stringify(Caveats({ entries: ENTRIES, reach: REACH }));

  for (const entry of ENTRIES) {
    const escaped = JSON.stringify(entry).slice(1, -1);
    expect(tree.split(escaped)).toHaveLength(2);
  }
});

/*
  The reach sentence used to be asserted here. It is rendered by
  `ConditionsNotes` now -- this whole component sits inside that region's closed
  disclosure, and the sentence has to stay visible -- so the test moved with it.
  Left here it would have asserted a sentence this component no longer renders.
*/

test("names every beach it does not serve, and the reason for each", () => {
  render(<Caveats entries={ENTRIES} reach={REACH} />);

  for (const beach of REACH.excluded) {
    expect(screen.getByText(beach.name)).toBeDefined();
    expect(screen.getByText(new RegExp(beach.why))).toBeDefined();
  }
});

test("puts the excluded beaches behind their own disclosure, counted", () => {
  // Thirty-two names would bury the sentence above them, and a reader who
  // wants one of them is looking for a specific beach rather than reading a
  // list. The count belongs in the summary, where it is visible closed.
  render(<Caveats entries={ENTRIES} reach={REACH} />);

  expect(screen.getByText(/Why the other 2 are not here/)).toBeDefined();
});

test("claims no exclusions when there are none", () => {
  // A disclosure headed "why the other 0 are not here" is worse than none,
  // and this is the state the tolerance being raised would produce.
  render(
    <Caveats
      entries={ENTRIES}
      reach={{ listed: 41, served: 41, excluded: [] }}
    />,
  );

  expect(screen.queryByText(/are not here/)).toBeNull();
});

test("they sit behind a disclosure, so the tide time is not buried", () => {
  const { container } = render(<Caveats entries={ENTRIES} reach={REACH} />);

  expect(container.querySelector("details")).not.toBeNull();
  expect(
    screen.getByText("What we are unsure about in this data"),
  ).toBeDefined();
});

test("the uncertainty disclosure is absent when there is nothing to disclose", () => {
  // An empty disclosure inviting a reader to open it and find nothing is worse
  // than no disclosure.
  render(<Caveats entries={[]} reach={REACH} />);

  expect(
    screen.queryByText("What we are unsure about in this data"),
  ).toBeNull();
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
test("both disclosures compose the touch-target floor", () => {
  const { container } = render(<Caveats entries={ENTRIES} reach={REACH} />);

  const summaries = [...container.querySelectorAll("summary")];

  expect(summaries).toHaveLength(2);
  for (const summary of summaries) {
    expect(summary.className).toContain(DISCLOSURE_TARGET);
  }
});
