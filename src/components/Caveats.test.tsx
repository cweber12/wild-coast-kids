import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Caveats } from "./Caveats";

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

test("says how far the site reaches, in beaches, without being opened", () => {
  // A reader looking for a beach that is not in the chooser has no way to
  // tell whether the county never listed it or this site left it out. The
  // sentence is outside the disclosures for that reason.
  render(<Caveats entries={ENTRIES} reach={REACH} />);

  expect(
    screen.getByText(/answers for 41 of the 73 beaches San Diego County lists/),
  ).toBeDefined();
});

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
  expect(
    screen.getByText(/answers for 41 of the 41 beaches San Diego County lists/),
  ).toBeDefined();
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
  // than no disclosure. The reach sentence stays: it is a statement about what
  // this site covers rather than a caveat, and it is true either way.
  render(<Caveats entries={[]} reach={REACH} />);

  expect(
    screen.queryByText("What we are unsure about in this data"),
  ).toBeNull();
  expect(screen.getByText(/answers for 41 of the 73/)).toBeDefined();
});
