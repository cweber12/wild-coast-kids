import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  fetchSessions,
  MAX_SESSIONS,
  normalizeBaseUrl,
  parseSessions,
  sessionsUrl,
  SessionsDriftError,
} from "./sessions";

/**
 * `fetch` is stubbed rather than reached, the same way `upstream.test.ts` does
 * it. What is under test is the policy around the request — what a 500 means,
 * what a changed table means, what an unset variable means — none of which a
 * live project having a good day can show you.
 */
const fetchMock = vi.fn();

const BASE = "https://abcdefghijklmnopqrst.supabase.co";
const NOW = new Date("2026-08-18T12:00:00Z");

/** A row exactly as PostgREST returns one. */
const row = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  program: "coop",
  title: "Tidepool Walk at Cabrillo",
  summary: null,
  starts_at: "2026-09-08T17:00:00+00:00",
  ends_at: "2026-09-08T20:00:00+00:00",
  location_name: null,
  location_url: null,
  price_cents: null,
  ...overrides,
});

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SUPABASE_URL", BASE);
  vi.stubEnv("SUPABASE_ANON_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("normalizeBaseUrl", () => {
  // The exact malformation that was in .env.local and made every request fail
  // with a PostgREST error naming nothing. The site tolerates it; check:db does
  // not (issue #76).
  test.each([
    [BASE, BASE],
    [`${BASE}/`, BASE],
    [`${BASE}/rest/v1`, BASE],
    [`${BASE}/rest/v1/`, BASE],
  ])("%s becomes %s", (given, expected) => {
    expect(normalizeBaseUrl(given)).toBe(expected);
  });
});

describe("sessionsUrl", () => {
  test("asks for one program's published, future sessions, oldest first", () => {
    const url = new URL(sessionsUrl(BASE, "coop", NOW));

    expect(url.pathname).toBe("/rest/v1/sessions");
    expect(url.searchParams.get("program")).toBe("eq.coop");
    expect(url.searchParams.get("published")).toBe("is.true");
    expect(url.searchParams.get("starts_at")).toBe(
      "gte.2026-08-18T12:00:00.000Z",
    );
    expect(url.searchParams.get("order")).toBe("starts_at.asc");
    expect(url.searchParams.get("limit")).toBe(String(MAX_SESSIONS));
  });

  // Projecting columns rather than select=* is what keeps a column added later
  // from silently reaching the page.
  test("names its columns rather than selecting everything", () => {
    const select = new URL(sessionsUrl(BASE, "art", NOW)).searchParams.get(
      "select",
    );

    expect(select).not.toContain("*");
    expect(select).toContain("price_cents");
  });

  test("tolerates a base URL with the REST path already on it", () => {
    expect(new URL(sessionsUrl(`${BASE}/rest/v1/`, "art", NOW)).pathname).toBe(
      "/rest/v1/sessions",
    );
  });
});

describe("parseSessions", () => {
  test("maps a row to camelCase and keeps its nulls distinct", () => {
    const [parsed] = parseSessions([
      row({ summary: "Low-tide exploration.", price_cents: 4500 }),
    ]);

    expect(parsed).toMatchObject({
      program: "coop",
      title: "Tidepool Walk at Cabrillo",
      summary: "Low-tide exploration.",
      startsAt: "2026-09-08T17:00:00+00:00",
      locationName: null,
      priceCents: 4500,
    });
  });

  test("an empty result is a valid schedule with nothing in it", () => {
    expect(parseSessions([])).toEqual([]);
  });

  // The whole point of parsing rather than casting: the compiler cannot catch a
  // column renamed in Postgres, so the boundary has to.
  test.each([
    ["a payload that is not an array", { rows: [] }],
    ["a row that is not an object", [null]],
    ["a renamed title column", [{ ...row(), title: undefined }]],
    ["an empty title", [row({ title: "" })]],
    ["a program the site does not have", [row({ program: "virtual" })]],
    ["a price that is not whole cents", [row({ price_cents: 45.5 })]],
    ["a price that is a string", [row({ price_cents: "4500" })]],
    ["a summary that is not text", [row({ summary: 42 })]],
  ])("refuses %s as drift", (_case, payload) => {
    expect(() => parseSessions(payload)).toThrow(SessionsDriftError);
  });

  // location_url is typed by hand and rendered as an href.
  test.each([
    ["javascript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["not a url at all"],
  ])("refuses %s as a location URL", (locationUrl) => {
    expect(() => parseSessions([row({ location_url: locationUrl })])).toThrow(
      SessionsDriftError,
    );
  });

  test("accepts an ordinary map link", () => {
    const [parsed] = parseSessions([
      row({
        location_name: "Cabrillo",
        location_url: "https://maps.example.com/cabrillo",
      }),
    ]);

    expect(parsed.locationUrl).toBe("https://maps.example.com/cabrillo");
  });
});

describe("fetchSessions", () => {
  test("returns the parsed sessions and sends the anon key", async () => {
    fetchMock.mockResolvedValue(jsonResponse([row()]));

    const result = await fetchSessions("coop", NOW);

    expect(result).toMatchObject({ kind: "ok" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.apikey).toBe("sb_publishable_test");
  });

  // force-dynamic overrides fetch caching to no-store in this version of Next,
  // so a revalidate here would be configuration that reads as meaningful and is
  // discarded. Asserted so nobody adds one back.
  test("names no revalidate, because the route's dynamic rendering discards it", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await fetchSessions("coop", NOW);

    expect(fetchMock.mock.calls[0][1].next).toBeUndefined();
  });

  test.each([
    ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
    ["SUPABASE_ANON_KEY", "SUPABASE_URL"],
  ])("is unavailable when %s is unset", async (unset) => {
    vi.stubEnv(unset, "");

    const result = await fetchSessions("coop", NOW);

    expect(result).toMatchObject({ kind: "unavailable", drift: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("is unavailable, not thrown, when the request does not complete", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const result = await fetchSessions("coop", NOW);

    expect(result).toMatchObject({ kind: "unavailable", drift: false });
    if (result.kind === "unavailable")
      expect(result.reason).toContain("fetch failed");
  });

  test("is unavailable on an error status, naming it", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    const result = await fetchSessions("coop", NOW);

    if (result.kind !== "unavailable") throw new Error("expected unavailable");
    expect(result.reason).toContain("HTTP 500");
    expect(result.drift).toBe(false);
  });

  test("is unavailable when the body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });

    const result = await fetchSessions("coop", NOW);

    expect(result).toMatchObject({ kind: "unavailable", drift: false });
  });

  // Drift is flagged separately because it is a bug to chase rather than a
  // service having a bad day, and `npm run check:db` will name it.
  test("flags a changed table as drift rather than as an outage", async () => {
    fetchMock.mockResolvedValue(jsonResponse([row({ program: "virtual" })]));

    const result = await fetchSessions("coop", NOW);

    expect(result).toMatchObject({ kind: "unavailable", drift: true });
  });

  test("warns rather than truncating silently when the ceiling is reached", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      jsonResponse(
        Array.from({ length: MAX_SESSIONS }, (_, i) => row({ id: `id-${i}` })),
      ),
    );

    const result = await fetchSessions("coop", NOW);

    expect(result).toMatchObject({ kind: "ok" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("truncated"));
  });

  test("does not warn on an ordinary term's worth of sessions", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      jsonResponse(
        Array.from({ length: 14 }, (_, i) => row({ id: `id-${i}` })),
      ),
    );

    await fetchSessions("coop", NOW);

    expect(warn).not.toHaveBeenCalled();
  });
});
