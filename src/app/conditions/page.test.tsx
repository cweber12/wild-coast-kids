import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The panel fetches, and an async server component cannot be rendered by this
// client-side test renderer. Its own suite covers every branch of it; here the
// subject is the page shell around it.
vi.mock("@/components/conditions/TidePanel", () => ({
  TidePanel: ({ slug }: { slug: string }) => <p>panel for {slug}</p>,
}));
vi.mock("@/components/conditions/WavePanel", () => ({
  WavePanel: ({ slug }: { slug: string }) => <p>waves for {slug}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { default: Conditions, revalidate } = await import("./page");
const { DEFAULT_BEACH_SLUG } = await import("@/lib/beaches");

test("the conditions page exposes its landmark and heading", () => {
  render(<Conditions />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("conditions");
});

test("it opens on the named default beach", () => {
  render(<Conditions />);

  expect(screen.queryByText(/conditions tool coming soon/i)).toBeNull();
  expect(screen.getByText(`panel for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
});

test("a reader can choose another beach from here", () => {
  render(<Conditions />);

  const select = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  expect(select.value).toBe(DEFAULT_BEACH_SLUG);
  // Every beach in the inventory is offered, not a curated subset. It is 51
  // rather than the county's 73 because the inventory itself is bounded by the
  // stations that reach it, not because the chooser hides any of it -- and it
  // is 51 rather than 45 because one of those stations came back.
  expect(select.querySelectorAll("option").length).toBe(51);
});

test("the page revalidates often enough that 'today' does not go stale", () => {
  // Fifteen minutes. The predictions themselves are cached for six hours; this
  // number exists because the page names *today's* low tide and a page rendered
  // yesterday would name yesterday's.
  expect(revalidate).toBe(900);
});
