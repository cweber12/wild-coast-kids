import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The regions fetch, and an async server component cannot be rendered by this
// client-side test renderer. Their own suites cover every branch of them; here
// the subject is the page shell around them.
vi.mock("@/components/conditions/WeekPanel", () => ({
  WeekPanel: ({ slug }: { slug: string }) => <p>week for {slug}</p>,
}));
vi.mock("@/components/conditions/DayPanel", () => ({
  DayPanel: ({ slug }: { slug: string }) => <p>day for {slug}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { default: Conditions, revalidate, metadata } = await import("./page");
const { DEFAULT_BEACH_SLUG } = await import("@/lib/beaches");

/**
 * The sentence that introduces this page now lives only here.
 *
 * It used to be a lead paragraph on the page as well, above the readings, where
 * it described the site to somebody who had just clicked "Conditions" to reach
 * it. That copy came off for the space; this is the copy that was always doing
 * the work, because a description is read by people who have *not* arrived.
 *
 * Asserted rather than assumed: with the on-page paragraph gone, nothing else
 * in the suite would notice this string being deleted, and the page would
 * quietly stop describing itself to search and to a shared link.
 */
test("the page still introduces itself where an introduction is read", () => {
  expect(metadata.description).toContain(
    "Real-time surf, tide, wind and visibility for San Diego's coast",
  );
  expect(metadata.description).toContain("families planning tidepool visits");
});

test("the conditions page exposes its landmark and heading", () => {
  render(<Conditions />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("conditions");
});

test("it opens on the named default beach", () => {
  render(<Conditions />);

  expect(screen.queryByText(/conditions tool coming soon/i)).toBeNull();
  expect(screen.getByText(`week for ${DEFAULT_BEACH_SLUG}`)).toBeDefined();
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
