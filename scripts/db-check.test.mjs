import { describe, expect, test } from "vitest";
import {
  configErrorFor,
  EXPECTED_COLUMNS,
  gatherObservations,
  judge,
} from "./db-check.mjs";

/** A run where everything the command can assert, asserted true. */
const healthy = (overrides = {}) => ({
  configError: null,
  reachError: null,
  columns: [...EXPECTED_COLUMNS],
  anonVisible: 1,
  adminVisible: 2,
  badProgramRejected: true,
  badRangeRejected: true,
  ...overrides,
});

/** The text of one row, found by the name it prints under. */
const rowFor = (observations, name) =>
  judge(observations).lines.find((line) => line.includes(name));

describe("judge", () => {
  test("a healthy database passes every assertion", () => {
    const { ok, lines } = judge(healthy());

    expect(ok).toBe(true);
    expect(lines.filter((line) => line.includes("FAIL"))).toEqual([]);
    expect(lines.filter((line) => line.includes("n/c"))).toEqual([]);
  });

  test("a bad configuration fails and marks everything downstream unchecked", () => {
    const { ok, lines } = judge({
      configError: "NEXT_PUBLIC_SUPABASE_URL is not set",
      reachError: null,
      columns: null,
      anonVisible: null,
      adminVisible: null,
      badProgramRejected: null,
      badRangeRejected: null,
    });

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("NEXT_PUBLIC_SUPABASE_URL is not set");
    expect(lines.join("\n")).toContain("could not be checked");
  });

  // The distinction the `n/c` label exists to keep: unlike a skipped gate row,
  // an assertion this command could not make is a failure, not a pass.
  test("an unchecked assertion fails the run rather than passing quietly", () => {
    const { ok } = judge(healthy({ badRangeRejected: null }));

    expect(ok).toBe(false);
    expect(rowFor(healthy({ badRangeRejected: null }), "ends_at")).toContain(
      "n/c",
    );
  });

  test("a renamed column is caught as one missing and one unexpected", () => {
    const renamed = EXPECTED_COLUMNS.map((column) =>
      column === "starts_at" ? "start_at" : column,
    );
    const line = rowFor(healthy({ columns: renamed }), "columns");

    expect(judge(healthy({ columns: renamed })).ok).toBe(false);
    expect(line).toContain("missing: starts_at");
    expect(line).toContain("unexpected: start_at");
  });

  // The assertion the whole command exists for. An unpublished row reaching the
  // anon key means the select policy is wrong or RLS is off.
  test("anon seeing both probe rows fails, and says why", () => {
    const leaking = healthy({ anonVisible: 2 });

    expect(judge(leaking).ok).toBe(false);
    expect(rowFor(leaking, "blind")).toContain("an unpublished row is public");
  });

  // A table containing nothing satisfies "anon cannot see the unpublished row"
  // vacuously. The service-role count is what stops that reading, so an empty
  // table has to fail rather than look clean.
  test("an empty table cannot pass the RLS assertions vacuously", () => {
    const empty = healthy({ anonVisible: 0, adminVisible: 0 });

    expect(judge(empty).ok).toBe(false);
    expect(rowFor(empty, "service role")).toContain("saw 0 of 2");
    expect(rowFor(empty, "blind")).toContain("FAIL");
  });

  test("a constraint that did not reject its bad row fails, naming the row", () => {
    const line = rowFor(healthy({ badProgramRejected: false }), "program");

    expect(judge(healthy({ badProgramRejected: false })).ok).toBe(false);
    expect(line).toContain("program = 'nope' inserted successfully");
  });

  test("an unreachable table fails and reports what the API said", () => {
    const { ok, lines } = judge(
      healthy({
        reachError: "HTTP 404 — Could not find the table 'public.sessions'",
        columns: null,
        anonVisible: null,
        adminVisible: null,
        badProgramRejected: null,
        badRangeRejected: null,
      }),
    );

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("Could not find the table");
  });
});

describe("configErrorFor", () => {
  const url = "https://abcdefghijklmnopqrst.supabase.co";

  test("a bare project URL with both keys is usable", () => {
    expect(configErrorFor(url, "anon", "service")).toBeNull();
  });

  // The exact malformation that made every request fail with PGRST125 and read
  // as a dead project. The runtime module trims it; this one refuses it.
  test("the REST endpoint pasted in place of the project URL is refused", () => {
    expect(configErrorFor(`${url}/rest/v1`, "anon", "service")).toContain(
      "/rest/v1",
    );
  });

  test("a trailing slash is refused before the path check sees it", () => {
    expect(configErrorFor(`${url}/`, "anon", "service")).toContain(
      "trailing slash",
    );
  });

  test("a bare origin is not mistaken for having a path", () => {
    // `new URL(...).pathname` is "/" for an origin, so a naive emptiness check
    // rejects every valid URL there is.
    expect(configErrorFor(url, "anon", "service")).toBeNull();
  });

  test.each([
    ["url", undefined, "anon", "service", "NEXT_PUBLIC_SUPABASE_URL"],
    ["anon key", url, "", "service", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    ["service key", url, "anon", undefined, "SUPABASE_SERVICE_ROLE_KEY"],
  ])("a missing %s is named", (_what, u, a, s, expected) => {
    expect(configErrorFor(u, a, s)).toContain(expected);
  });

  test("a non-https URL is refused", () => {
    expect(
      configErrorFor("http://abcdefghijklmnopqrst.supabase.co", "anon", "svc"),
    ).toContain("https://");
  });
});

/**
 * A fetch stub standing in for PostgREST. It answers by method, path, key and
 * the rows being written, and records what it was asked, so a test can assert
 * the probe rows were swept as well as read.
 */
function stubFetch(answer) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const path = String(url).split("/rest/v1/")[1] ?? String(url);
    const rows = init.body ? JSON.parse(init.body) : [];
    calls.push(`${method} ${path}`);
    const { status = 200, body = [] } =
      answer({ method, path, key: init.headers?.apikey, rows }) ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    };
  };
  return { fetch, calls };
}

const deps = (fetch) => ({
  fetch,
  url: "https://abcdefghijklmnopqrst.supabase.co",
  anonKey: "anon",
  serviceKey: "service",
});

const fullRow = Object.fromEntries(EXPECTED_COLUMNS.map((c) => [c, null]));

/**
 * A database behaving exactly as the migration intends: both check constraints
 * hold, and the select policy hides the unpublished probe from the anon key.
 *
 * The constraints are modelled rather than stubbed to a constant, because
 * every insert goes to the same path -- a stub that answered "created" to any
 * POST would report both constraints holding when neither did.
 */
const healthyServer = ({ method, path, key, rows }) => {
  if (method === "DELETE") return { status: 200 };
  if (method === "POST") {
    const violates = rows.some(
      (r) => !["art", "coop"].includes(r.program) || r.ends_at <= r.starts_at,
    );
    return violates
      ? { status: 400, body: { message: "violates check constraint" } }
      : { status: 201, body: rows.map(() => fullRow) };
  }
  if (path.startsWith("sessions?title="))
    return {
      status: 200,
      body: key === "anon" ? [fullRow] : [fullRow, fullRow],
    };
  return { status: 200, body: [] };
};

describe("gatherObservations", () => {
  test("a healthy database yields observations that judge accepts", async () => {
    const { fetch } = stubFetch(healthyServer);

    const seen = await gatherObservations(deps(fetch));

    expect(seen).toMatchObject({
      configError: null,
      reachError: null,
      anonVisible: 1,
      adminVisible: 2,
      badProgramRejected: true,
      badRangeRejected: true,
    });
    expect(seen.columns).toEqual(EXPECTED_COLUMNS);
    expect(judge(seen).ok).toBe(true);
  });

  test("probe rows are swept before the run and deleted after it", async () => {
    const { fetch, calls } = stubFetch(healthyServer);

    await gatherObservations(deps(fetch));

    const deletes = calls.filter((c) => c.startsWith("DELETE"));
    expect(deletes.length).toBeGreaterThanOrEqual(2);
    expect(calls.at(-1)).toBe("DELETE sessions?title=eq.__db_check_probe__");
  });

  // The config guard has to come before any traffic: a malformed URL would
  // otherwise surface as a confusing HTTP error instead of naming itself.
  test("a bad configuration short-circuits before any request is made", async () => {
    const { fetch, calls } = stubFetch(healthyServer);

    const seen = await gatherObservations({ ...deps(fetch), url: undefined });

    expect(seen.configError).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(calls).toEqual([]);
  });

  test("a missing table is reported without attempting to insert probes", async () => {
    const { fetch, calls } = stubFetch(() => ({
      status: 404,
      body: { message: "Could not find the table 'public.sessions'" },
    }));

    const seen = await gatherObservations(deps(fetch));

    expect(seen.reachError).toContain("Could not find the table");
    expect(calls.filter((c) => c.startsWith("POST"))).toEqual([]);
  });

  test("a failed probe insert is reported as such, not as a missing table", async () => {
    const { fetch } = stubFetch(({ method }) =>
      method === "POST"
        ? { status: 403, body: { message: "permission denied" } }
        : { status: 200, body: [] },
    );

    const seen = await gatherObservations(deps(fetch));

    expect(seen.reachError).toContain("could not insert probe rows");
    expect(seen.reachError).toContain("permission denied");
  });

  test("a network failure is caught and named rather than crashing the command", async () => {
    const boom = async () => {
      throw new TypeError("fetch failed");
    };

    const seen = await gatherObservations(deps(boom));

    expect(seen.reachError).toBe("TypeError: fetch failed");
    expect(judge(seen).ok).toBe(false);
  });

  // The leak this whole command exists to catch, driven end to end: a policy
  // that lets the unpublished probe through must not produce a clean run.
  test("a server that leaks the unpublished row produces a failing verdict", async () => {
    const { fetch } = stubFetch((request) =>
      request.path.startsWith("sessions?title=")
        ? { status: 200, body: [fullRow, fullRow] }
        : healthyServer(request),
    );

    const seen = await gatherObservations(deps(fetch));

    expect(seen.anonVisible).toBe(2);
    expect(judge(seen).ok).toBe(false);
  });
});

describe("gatherObservations, when the API misbehaves", () => {
  // A proxy or gateway in front of Supabase answers HTML, not JSON. Parsing has
  // to survive that and still report the status, or the command dies with a
  // SyntaxError instead of telling you what happened.
  test("a non-JSON error body is carried through rather than thrown on", async () => {
    const { fetch } = stubFetch(() => ({ status: 502 }));
    const html = async (url, init) => {
      const response = await fetch(url, init);
      return { ...response, text: async () => "<html>Bad Gateway</html>" };
    };

    const seen = await gatherObservations(deps(html));

    expect(seen.reachError).toContain("HTTP 502");
    expect(judge(seen).ok).toBe(false);
  });

  test("an error body with no message still names the status", async () => {
    const { fetch } = stubFetch(() => ({ status: 500, body: {} }));

    const seen = await gatherObservations(deps(fetch));

    expect(seen.reachError).toBe("HTTP 500 — no message");
  });

  // If a check constraint is missing, the row this command uses to probe it
  // actually lands. That must be reported as a failure *and* cleaned up, or the
  // next run inherits a stray row.
  test("a missing constraint fails the assertion and removes the row it let in", async () => {
    const { fetch, calls } = stubFetch((request) =>
      request.method === "POST"
        ? { status: 201, body: request.rows.map(() => fullRow) }
        : healthyServer(request),
    );

    const seen = await gatherObservations(deps(fetch));

    expect(seen.badProgramRejected).toBe(false);
    expect(seen.badRangeRejected).toBe(false);
    expect(judge(seen).ok).toBe(false);
    expect(calls.at(-1)).toBe("DELETE sessions?title=eq.__db_check_probe__");
  });

  test("a read that fails leaves its count unchecked rather than zero", async () => {
    const { fetch } = stubFetch((request) =>
      request.path.startsWith("sessions?title=")
        ? { status: 500, body: { message: "boom" } }
        : healthyServer(request),
    );

    const seen = await gatherObservations(deps(fetch));

    expect(seen.anonVisible).toBeNull();
    expect(seen.adminVisible).toBeNull();
    expect(judge(seen).ok).toBe(false);
  });
});
