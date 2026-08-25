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
vi.mock("@/components/WeekPanel", () => ({
  WeekPanel: ({ slug }: { slug: string }) => <p>week for {slug}</p>,
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
  // The week is the second half of what this page is for — planning rather
  // than now — and it mounts on its own boundary, so a section that dropped it
  // would still render every card above it.
  expect(screen.getByText(`week for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
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

/**
 * The tense is the claim. Named animals, a named window and a named place in
 * the past tense read as a report of what was found here, and no such report
 * exists — the map is deferred. On a page whose discipline is that every figure
 * names its station and nothing unmeasured is asserted, this was the one
 * sentence a skimming reader could come away believing.
 *
 * The three forecast slots in `WeekPanel` do not have the problem because each
 * describes a product shape — "Swell height and period for each day" — rather
 * than asserting something about the world. This slot has to read the same way.
 * The rolling week stays in the copy: a seven-day window is what the product
 * is (#121), and under "Will show" it describes the map rather than the coast.
 */
test("the slot says what the map will show, not what was found", () => {
  render(<ConditionsSection slug={DEFAULT_BEACH_SLUG} />);

  const slot = screen.getByText(/A map of what people have found here/);

  expect(slot.textContent).toContain(
    "Will show octopus, nudibranchs, sea hares and leopard sharks logged " +
      "near this beach in the past week",
  );
});
