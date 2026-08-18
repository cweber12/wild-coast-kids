import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Art from "./page";

/** Unconfigured on purpose, for the reasons set out in `coop/page.test.tsx`. */
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

test("the art page exposes its landmark, heading and reserved slots", async () => {
  render(await Art());

  expect(screen.getByRole("main")).toBeDefined();

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toContain("Art");

  expect(screen.getByText(/schedule & pricing coming soon/i)).toBeDefined();
  expect(
    screen.getByRole("img", { name: "Student artwork gallery" }),
  ).toBeDefined();
});

test("the page CTA routes to the booking page", async () => {
  render(await Art());

  expect(
    screen.getByRole("link", { name: /book a class/i }).getAttribute("href"),
  ).toBe("/book");
});

test("an unreachable schedule is reported to the server log", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  render(await Art());

  expect(error).toHaveBeenCalledWith(
    expect.stringContaining("art schedule unavailable"),
  );
});

// The half of the reserved slot's promise this slice can keep. Prices vary from
// one class to the next, which is why they live on the row rather than in page
// copy, and why the schedule is where a parent finds them.
test("published art sessions show their times and their prices", async () => {
  vi.stubEnv("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_test");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "22222222-2222-2222-2222-222222222222",
          program: "art",
          title: "Watercolor Basics",
          summary: "Intro watercolor for ages 8+. Materials included.",
          starts_at: "2026-09-15T20:00:00+00:00",
          ends_at: "2026-09-15T22:00:00+00:00",
          location_name: "Studio — North Park",
          location_url: null,
          price_cents: 4500,
        },
      ],
    }),
  );

  render(await Art());

  expect(
    screen.getByRole("heading", { level: 3, name: "Watercolor Basics" }),
  ).toBeDefined();
  expect(screen.getByText("$45")).toBeDefined();
  expect(screen.getByText("Studio — North Park")).toBeDefined();
  expect(screen.queryByText(/schedule & pricing coming soon/i)).toBeNull();
});

// Art's accent is purple where the co-op's is ocean, and the component derives
// it from the program rather than being told, so a page cannot ask for the
// wrong one.
test("the art schedule carries the art accent", async () => {
  vi.stubEnv("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
  vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_test");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "33333333-3333-3333-3333-333333333333",
          program: "art",
          title: "Ink and Collage",
          summary: null,
          starts_at: "2026-09-22T20:00:00+00:00",
          ends_at: "2026-09-22T22:00:00+00:00",
          location_name: null,
          location_url: null,
          price_cents: null,
        },
      ],
    }),
  );

  render(await Art());

  expect(
    screen.getByRole("heading", { level: 2, name: "Upcoming sessions" })
      .className,
  ).toContain("text-purple");
});
