import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Coop from "./page";

/**
 * The page is an async server component, so it is called and its result
 * rendered rather than rendered as an element. Testing Library handles the tree
 * that comes back; what it cannot do is await one for you.
 *
 * The environment is stubbed empty on purpose rather than left to chance.
 * Vitest does not load `.env.local`, so these tests would degrade anyway — but
 * relying on that would make them start reaching a real project the day someone
 * adds env loading to the runner.
 */
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_ANON_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("the co-op page exposes its landmark, heading and reserved slots", async () => {
  render(await Coop());

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("co-op");

  expect(screen.getByText(/full co-op details coming soon/i)).toBeDefined();
  expect(
    screen.getByRole("img", { name: "Co-op adventures photo gallery" }),
  ).toBeDefined();
});

test("the page CTA routes to the landing page's interest list", async () => {
  render(await Coop());

  expect(
    screen
      .getByRole("link", { name: /join the interest list/i })
      .getAttribute("href"),
  ).toBe("/#community");
});

// The reader sees the same reserved slot whether the schedule is empty or
// unreachable, so the log is the only place the difference exists. A silent
// fallback would make a broken database indistinguishable from a quiet term.
test("an unreachable schedule is reported to the server log", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  render(await Coop());

  expect(error).toHaveBeenCalledWith(
    expect.stringContaining("coop schedule unavailable"),
  );
});

test("published sessions replace the reserved slot", async () => {
  vi.stubEnv("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_test");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "11111111-1111-1111-1111-111111111111",
          program: "coop",
          title: "Tidepool Walk at Cabrillo",
          summary: null,
          starts_at: "2026-09-08T17:00:00+00:00",
          ends_at: "2026-09-08T20:00:00+00:00",
          location_name: null,
          location_url: null,
          price_cents: null,
        },
      ],
    }),
  );

  render(await Coop());

  expect(
    screen.getByRole("heading", {
      level: 3,
      name: "Tidepool Walk at Cabrillo",
    }),
  ).toBeDefined();
  expect(screen.queryByText(/full co-op details coming soon/i)).toBeNull();
});
