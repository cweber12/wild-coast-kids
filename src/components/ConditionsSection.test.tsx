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
