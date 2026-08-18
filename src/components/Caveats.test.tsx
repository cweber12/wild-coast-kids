import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Caveats } from "./Caveats";

const ENTRIES = [
  "beach_type is UNKNOWN upstream for most of these beaches.",
  "TWC0405 Point Loma does not deliver predictions.",
];

test("every caveat given is rendered, not a summary of them", () => {
  render(<Caveats entries={ENTRIES} />);

  for (const entry of ENTRIES) {
    expect(screen.getByText(entry)).toBeDefined();
  }
});

test("they sit behind a disclosure, so the tide time is not buried", () => {
  const { container } = render(<Caveats entries={ENTRIES} />);

  expect(container.querySelector("details")).not.toBeNull();
  expect(
    screen.getByText("What we are unsure about in this data"),
  ).toBeDefined();
});

test("nothing is rendered when there is nothing to disclose", () => {
  // An empty disclosure inviting a reader to open it and find nothing is worse
  // than no disclosure.
  const { container } = render(<Caveats entries={[]} />);
  expect(container.firstChild).toBeNull();
});
