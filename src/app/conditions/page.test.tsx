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
const { DEFAULT_AREA_SLUG } = await import("@/lib/areas");

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

  // Matched case-insensitively because the `<h1>` is a wordmark now and its
  // text is the single capitalised word (ADR-0058). The assertion that matters
  // here is that a level-one heading exists at all and names the page; which
  // register it is painted in is `ConditionsSection`'s to assert.
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toMatch(/conditions/i);
});

/**
 * It opened on a beach until 2026-09-02 and asserted the week rendered for it.
 * The door is an area's now, and an area carries no readings yet — so what says
 * the page opened on something real is that the area's own beaches are on
 * offer, which is the thing a reader reaches for next.
 *
 * That was a list of links until 2026-09-11 and is the beach control now
 * (ADR-0060). The claim is unchanged — this area, its beaches, reachable from
 * here — so the assertion moved to the control rather than being dropped.
 */
test("it opens on the named default area", () => {
  render(<Conditions />);

  expect(screen.queryByText(/conditions tool coming soon/i)).toBeNull();

  const beaches = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  expect(beaches).toBeDefined();
  // The area itself, then its own beaches — not some other area's.
  expect([...beaches.options].map((option) => option.textContent)).toContain(
    "WindanSea Beach",
  );
  expect(beaches.options[0].textContent).toBe("All of La Jolla");
});

/**
 * On the area's default beach rather than on the area's own view. La Jolla's
 * ten beaches share a tide station and an air station and nothing else, so
 * the area view opened the tool on a bold absence, two paragraphs about what
 * could not be shown and a tide-only week (audit of 2026-09-17). The default
 * beach is a row in `areas.json`, and the regions answer for it.
 */
test("it opens on the default area's default beach", () => {
  render(<Conditions />);

  const beaches = screen.getByLabelText("Choose a beach") as HTMLSelectElement;
  expect(beaches.value).toBe("la-jolla-shores-beach");
  expect(screen.getByText("week for la-jolla-shores-beach")).toBeDefined();
});

test("a reader can choose another area from here", () => {
  render(<Conditions />);

  const select = screen.getByLabelText("Choose an area") as HTMLSelectElement;
  expect(select.value).toBe(DEFAULT_AREA_SLUG);
  // Every area is offered, not a curated subset. Eighteen where the chooser
  // offered 51 beaches: the inventory did not shrink, it grouped. The partition
  // is total, so no beach became unreachable in the trade -- `areas.test.ts`
  // and the `areas` gate row are what say so.
  expect(select.querySelectorAll("option").length).toBe(18);
});

test("the page revalidates often enough that 'today' does not go stale", () => {
  // Fifteen minutes. The predictions themselves are cached for six hours; this
  // number exists because the page names *today's* low tide and a page rendered
  // yesterday would name yesterday's.
  expect(revalidate).toBe(900);
});
