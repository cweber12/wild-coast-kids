import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/TidePanel", () => ({
  TidePanel: ({ slug }: { slug: string }) => <p>panel for {slug}</p>,
}));
vi.mock("@/components/WavePanel", () => ({
  WavePanel: ({ slug }: { slug: string }) => <p>waves for {slug}</p>,
}));
vi.mock("@/components/WindPanel", () => ({
  WindPanel: ({ slug }: { slug: string }) => <p>wind for {slug}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { ConditionsSection } = await import("./ConditionsSection");
const { inventoryCaveats, DEFAULT_BEACH_SLUG } = await import("@/lib/beaches");

test("the view carries the chooser, the reading and the caveats", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(screen.getByLabelText("Choose a beach")).toBeDefined();
  expect(screen.getByText(`panel for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  expect(screen.getByText(`waves for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  // Reachable by a reader, not merely built: the three panels come from three
  // agencies and each is mounted on its own Suspense boundary, so a section
  // that dropped one would still render and still pass every other assertion.
  expect(screen.getByText(`wind for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
  expect(
    screen.getByText("What we are unsure about in this data"),
  ).toBeDefined();
  // The reach is part of what this view owes a reader: the chooser offers 41
  // beaches and the county lists 73, and nothing else on the page says so.
  expect(
    screen.getByText(/answers for \d+ of the \d+ beaches San Diego County/),
  ).toBeDefined();
});

test("every caveat the data files carry reaches this page", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  // The other half of the check in src/lib/caveats.test.ts: that one asserts
  // nothing is dropped between the files and the loader, this one asserts
  // nothing is dropped between the loader and the reader.
  for (const caveat of inventoryCaveats()) {
    expect(screen.getByText(caveat)).toBeDefined();
  }
});

/**
 * The sighting map is specified in #121 and deferred. The page says what lands
 * there rather than being silent about it, which is the whole point of a
 * reserved slot: a reader can tell the difference between a feature that is
 * coming and one that was never considered.
 */
test("the page names the sighting map as coming rather than staying silent", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(
    screen.getByText(/A map of what people have found here/),
  ).toBeDefined();
});

/**
 * The claim the map is allowed to make, fixed in the copy before the map
 * exists. iNaturalist records where people with phones went, not where animals
 * are, and a slot promising a density surface would commit the page to
 * something the data cannot support (#121).
 */
test("the slot promises a record of reports, never a survey", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  expect(
    screen.getByText(/reported by naturalists, not surveyed by us/),
  ).toBeDefined();
});
