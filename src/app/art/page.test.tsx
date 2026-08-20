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

  expect(screen.getByText(/fall dates coming soon/i)).toBeDefined();
  expect(
    screen.getByRole("img", { name: "Student artwork gallery" }),
  ).toBeDefined();
});

// The slot stands in for the schedule and nothing else. It promised pricing
// while pricing had nowhere to live; pricing now has a section of its own, and
// a reserved slot that promises what has already arrived is the exact drift the
// component was extracted to stop.
test("the reserved slot no longer promises pricing", async () => {
  render(await Art());

  expect(screen.getByText(/fall dates coming soon/i)).toBeDefined();
  expect(screen.queryByText(/pricing coming soon/i)).toBeNull();

  // ...while the page still states the prices themselves.
  expect(screen.getByText("$20")).toBeDefined();
});

test("the page CTA routes to the booking page", async () => {
  render(await Art());

  expect(
    screen.getByRole("link", { name: /book a class/i }).getAttribute("href"),
  ).toBe("/book");
});

// The page has to answer "what is this?" before a parent has any use for
// "when is it?". These assert the answer is on the page at all — the wording
// will be revised, but a page that silently loses it should fail.
test("the art page says what makes the program different", async () => {
  render(await Art());

  const approach = screen.getByRole("heading", {
    level: 2,
    name: "What makes it different",
  });
  expect(approach).toBeDefined();

  expect(
    screen.getByRole("heading", { level: 3, name: "Skills, not copies" }),
  ).toBeDefined();
  expect(
    screen.getByRole("heading", { level: 3, name: "Art history every class" }),
  ).toBeDefined();
  expect(
    screen.getByText(/creative freedom needs something to stand on/i),
  ).toBeDefined();
});

// The list is a labelled region rather than a bare `ul`, so a screen reader
// reaches it from the landmark menu instead of having to scroll into it.
test("the approach list is named by its own heading", async () => {
  render(await Art());

  const heading = screen.getByRole("heading", {
    level: 2,
    name: "What makes it different",
  });
  const region = screen.getByRole("region", {
    name: "What makes it different",
  });

  expect(region.getAttribute("aria-labelledby")).toBe(heading.id);
});

// The prices are asserted as the strings a reader sees. Importing TIERS and
// asserting against it would pass whatever the numbers were.
test("the art page states all three pricing tiers", async () => {
  render(await Art());

  expect(
    screen.getByRole("heading", { level: 2, name: "Packages & pricing" }),
  ).toBeDefined();

  expect(
    screen.getByRole("heading", { level: 3, name: "Drop-in" }),
  ).toBeDefined();
  expect(screen.getByText("$20")).toBeDefined();

  expect(
    screen.getByRole("heading", { level: 3, name: "6-pack" }),
  ).toBeDefined();
  expect(screen.getByText("$100")).toBeDefined();

  expect(
    screen.getByRole("heading", { level: 3, name: "12-pack" }),
  ).toBeDefined();
  expect(screen.getByText("$200")).toBeDefined();
});

// Class size and the shared-pack rule are the two facts a parent asks about
// that no session row carries.
test("the art page states the class cap and that packs are shared", async () => {
  render(await Art());

  expect(screen.getByText(/capped at ten kids/i)).toBeDefined();
  expect(
    screen.getByText(/siblings can draw from the same one/i),
  ).toBeDefined();
});

// The monthly themed class has no price yet, and a named package without a
// number generates email rather than signups.
test("the art page does not advertise the monthly class yet", async () => {
  render(await Art());

  expect(screen.queryByText(/monthly/i)).toBeNull();
});

test("an unreachable schedule is reported to the server log", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  render(await Art());

  expect(error).toHaveBeenCalledWith(
    expect.stringContaining("art schedule unavailable"),
  );
});

// A session that carries its own price still shows it. The standing weekly
// tiers are page copy — a pack spans sessions and cannot live on a row — but
// that did not remove `price_cents`, and a one-off priced differently from the
// tiers says so here. Both readings are live at once, deliberately.
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
  expect(screen.queryByText(/fall dates coming soon/i)).toBeNull();
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
