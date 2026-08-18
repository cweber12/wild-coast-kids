import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The panel fetches, and an async server component cannot be rendered by this
// client-side test renderer. Its own suite covers every branch of it; here the
// subject is the page shell around it.
vi.mock("@/components/TidePanel", () => ({
  TidePanel: ({ slug }: { slug: string }) => <p>panel for {slug}</p>,
}));

const { default: Conditions, revalidate } = await import("./page");

test("the conditions page exposes its landmark and heading", () => {
  render(<Conditions />);

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("conditions");
});

test("the reserved slot is gone, replaced by the tide panel", () => {
  render(<Conditions />);

  expect(screen.queryByText(/conditions tool coming soon/i)).toBeNull();
  expect(screen.getByText("panel for la-jolla-shores")).toBeDefined();
});

test("the page revalidates often enough that 'today' does not go stale", () => {
  // Fifteen minutes. The predictions themselves are cached for six hours; this
  // number exists because the page names *today's* low tide and a page rendered
  // yesterday would name yesterday's.
  expect(revalidate).toBe(900);
});
