/**
 * What `public.sessions` must be true of, and the reading of it.
 *
 * Nothing here opens a socket. The part that can be wrong is the part that
 * decides the verdict, and it is decided by a pure function that tests call
 * directly with a hand-written set of observations — the same split as
 * gates.mjs and built-css.mjs (ADR-0002). check-db.mjs does the talking.
 *
 * These assertions are the executable form of what
 * docs/plans/session-schedule-from-supabase.md promised instead of a checklist.
 * Add an assertion by adding a row to `judge`.
 */

/**
 * Every column the site expects, and no others. Checked as a set: a renamed
 * column fails here rather than surfacing later as an empty schedule, which is
 * the job a generated type would otherwise do (ADR-0008).
 */
export const EXPECTED_COLUMNS = [
  "id",
  "program",
  "title",
  "summary",
  "starts_at",
  "ends_at",
  "location_name",
  "location_url",
  "price_cents",
  "published",
  "created_at",
  "updated_at",
];

/**
 * The title both probe rows carry, so cleanup can find them without knowing
 * their ids. Probe rows are dated far in the past as well, so a leaked one can
 * never reach the site — its query asks only for sessions still to come.
 */
export const PROBE_TITLE = "__db_check_probe__";

/**
 * What check-db.mjs saw. Every field is `null` when the step could not run,
 * which is reported as "not checked" rather than counted as a pass.
 *
 * @typedef {object} Observations
 * @property {string|null} configError  Why the environment is unusable, if it is.
 * @property {string|null} reachError   Why the table could not be read, if it could not.
 * @property {string[]|null} columns    Column names of a probe row, as the API returned them.
 * @property {number|null} anonVisible  Probe rows the anon key can see. Must be 1.
 * @property {number|null} adminVisible Probe rows the service role can see. Must be 2.
 * @property {boolean|null} badProgramRejected    Did `program = 'nope'` fail to insert?
 * @property {boolean|null} badRangeRejected      Did `ends_at <= starts_at` fail to insert?
 */

/**
 * A step that could not run is not a step that passed.
 *
 * Unlike the gate table, where SKIP is a benign "this needs a display or a
 * credential a fresh clone lacks", every row here is meant to be checkable
 * whenever this command is run at all. `n/c` therefore fails the run: the whole
 * point of the command is to verify, and it did not.
 *
 * @param {string} name
 * @param {boolean|null} ok  null means the step could not run.
 * @param {string} [note]
 * @returns {{ name: string, ok: boolean, label: string, note?: string }}
 */
function row(name, ok, note) {
  if (ok === null) return { name, ok: false, label: "n/c", note };
  return { name, ok, label: ok ? "PASS" : "FAIL", note };
}

/**
 * Decide every assertion from one set of observations.
 *
 * @param {Observations} observations
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function judge(observations) {
  const {
    configError,
    reachError,
    columns,
    anonVisible,
    adminVisible,
    badProgramRejected,
    badRangeRejected,
  } = observations;

  const missing = columns
    ? EXPECTED_COLUMNS.filter((column) => !columns.includes(column))
    : [];
  const extra = columns
    ? columns.filter((column) => !EXPECTED_COLUMNS.includes(column))
    : [];

  const rows = [
    row(
      "config",
      configError === null,
      configError ?? "SUPABASE_URL and both keys are usable",
    ),
    row(
      "table reachable",
      configError !== null ? null : reachError === null,
      reachError ?? "public.sessions answered",
    ),
    row(
      "columns",
      columns === null ? null : missing.length === 0 && extra.length === 0,
      columns === null
        ? undefined
        : [
            missing.length ? `missing: ${missing.join(", ")}` : "",
            extra.length ? `unexpected: ${extra.join(", ")}` : "",
            missing.length || extra.length
              ? ""
              : `all ${EXPECTED_COLUMNS.length} columns present, none extra`,
          ]
            .filter(Boolean)
            .join("; "),
    ),
    // Ordered deliberately. "Anon is blind to the unpublished row" is the
    // assertion that matters, and on its own it is satisfied by a table with no
    // rows in it at all. The service-role row below is what makes it mean
    // something: it proves both probes exist and only one of them got through.
    row(
      "rls: service role sees both probes",
      adminVisible === null ? null : adminVisible === 2,
      adminVisible === null ? undefined : `saw ${adminVisible} of 2`,
    ),
    row(
      "rls: anon sees the published probe",
      anonVisible === null ? null : anonVisible >= 1,
      anonVisible === null ? undefined : `saw ${anonVisible}`,
    ),
    row(
      "rls: anon is blind to the unpublished probe",
      anonVisible === null || adminVisible === null
        ? null
        : adminVisible === 2 && anonVisible === 1,
      anonVisible === null || adminVisible === null
        ? undefined
        : anonVisible > 1
          ? `anon saw ${anonVisible} of the ${adminVisible} probe rows — an unpublished row is public`
          : `anon saw 1 of ${adminVisible}`,
    ),
    row(
      "constraint: program rejects an unknown value",
      badProgramRejected,
      badProgramRejected === false
        ? "a row with program = 'nope' inserted successfully"
        : undefined,
    ),
    row(
      "constraint: ends_at must follow starts_at",
      badRangeRejected,
      badRangeRejected === false
        ? "a row ending before it starts inserted successfully"
        : undefined,
    ),
  ];

  const width = Math.max(...rows.map((r) => r.name.length));
  const lines = rows.map((r) => {
    const note = r.note ? `  (${r.note})` : "";
    return `  ${r.label.padEnd(4)}  ${r.name.padEnd(width)}${note}`.trimEnd();
  });

  const notChecked = rows.filter((r) => r.label === "n/c").length;
  if (notChecked > 0) {
    lines.push(
      "",
      `  ${notChecked} assertion(s) could not be checked, which fails this command:`,
      "  an unverified table is not a verified one.",
    );
  }

  return { ok: rows.every((r) => r.ok), lines };
}

const PAST = "2000-01-01T00:00:00Z";
const PAST_END = "2000-01-01T01:00:00Z";

/**
 * One published and one not. The pair is what makes the RLS reading mean
 * something: either alone is satisfied by a table nothing can see into.
 *
 * Dated to the year 2000 so that a probe left behind by a killed process can
 * never reach the site — the schedule asks only for sessions still to come.
 */
export const PROBES = [
  {
    program: "coop",
    title: PROBE_TITLE,
    starts_at: PAST,
    ends_at: PAST_END,
    published: true,
  },
  {
    program: "art",
    title: PROBE_TITLE,
    starts_at: PAST,
    ends_at: PAST_END,
    published: false,
  },
];

/** Rows that must not insert, and the assertion each one settles. */
const INVALID = {
  badProgramRejected: {
    program: "nope",
    title: PROBE_TITLE,
    starts_at: PAST,
    ends_at: PAST_END,
  },
  badRangeRejected: {
    program: "art",
    title: PROBE_TITLE,
    starts_at: PAST_END,
    ends_at: PAST,
  },
};

/**
 * Talk to the database and report what was seen. Decides nothing — `judge`
 * does that — so the two can be tested apart.
 *
 * `fetch` arrives as a dependency rather than an import, so the tests drive
 * this with a stub instead of intercepting a module (ADR-0008).
 *
 * It writes. Two probe rows go in under the service role, get read back through
 * the anon key to prove RLS, and are deleted in a `finally`. Leftovers from a
 * killed run are swept first.
 *
 * @param {{ fetch: typeof globalThis.fetch, url?: string, anonKey?: string, serviceKey?: string }} deps
 * @returns {Promise<Observations>}
 */
export async function gatherObservations({ fetch, url, anonKey, serviceKey }) {
  /** @type {Observations} */
  const seen = {
    configError: configErrorFor(url, anonKey, serviceKey),
    reachError: null,
    columns: null,
    anonVisible: null,
    adminVisible: null,
    badProgramRejected: null,
    badRangeRejected: null,
  };
  if (seen.configError !== null) return seen;

  const call = async (key, path, init = {}) => {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { ok: response.ok, status: response.status, body };
  };

  const sweep = () =>
    call(serviceKey, `sessions?title=eq.${PROBE_TITLE}`, { method: "DELETE" });

  /** A constraint that holds is an insert that does not land. */
  const rejects = async (values) => {
    const { ok } = await call(serviceKey, "sessions", {
      method: "POST",
      body: JSON.stringify([values]),
    });
    if (ok) await sweep();
    return !ok;
  };

  const failed = ({ status, body }) =>
    `HTTP ${status} — ${body?.message ?? "no message"}`;

  try {
    const reach = await call(serviceKey, "sessions?select=id&limit=1");
    if (!reach.ok) {
      seen.reachError = failed(reach);
      return seen;
    }

    await sweep();
    const inserted = await call(serviceKey, "sessions", {
      method: "POST",
      body: JSON.stringify(PROBES),
      headers: { Prefer: "return=representation" },
    });
    if (!inserted.ok) {
      seen.reachError = `could not insert probe rows: ${failed(inserted)}`;
      return seen;
    }

    try {
      seen.columns = Object.keys(inserted.body[0]);

      const query = `sessions?title=eq.${PROBE_TITLE}&select=id,published`;
      const asAnon = await call(anonKey, query);
      const asAdmin = await call(serviceKey, query);
      if (asAnon.ok) seen.anonVisible = asAnon.body.length;
      if (asAdmin.ok) seen.adminVisible = asAdmin.body.length;

      for (const [field, values] of Object.entries(INVALID)) {
        seen[field] = await rejects(values);
      }
    } finally {
      // The probes exist by here, so they go whatever the assertions did.
      await sweep();
    }
  } catch (error) {
    seen.reachError = `${error.name}: ${error.message}`;
  }

  return seen;
}

/**
 * Whether the configured project URL is the bare project origin.
 *
 * Strict on purpose, and deliberately unlike the runtime module, which trims
 * the same mistakes and carries on. A check that quietly repaired its input
 * would hide the exact malformation that made every request fail with
 * `PGRST125 — Invalid path specified in request URL` and cost a diagnosis pass
 * to attribute (issue #76). Here the point is to say so.
 *
 * @param {string|undefined} url
 * @returns {string|null} The reason it is unusable, or null when it is fine.
 */
export function configErrorFor(url, anonKey, serviceKey) {
  if (!url) return "SUPABASE_URL is not set";
  if (!anonKey) return "SUPABASE_ANON_KEY is not set";
  if (!serviceKey) return "SUPABASE_SERVICE_ROLE_KEY is not set";
  if (!url.startsWith("https://"))
    return `SUPABASE_URL must start with https:// — got ${url.slice(0, 8)}…`;
  if (url.endsWith("/"))
    return "SUPABASE_URL has a trailing slash; it must be the bare project URL";
  // `new URL("https://x.supabase.co").pathname` is "/", not "" — a bare origin
  // still has a root path. Only anything beyond that is a real path.
  const { pathname } = new URL(url);
  if (pathname !== "/" && pathname !== "")
    return `SUPABASE_URL must have no path — got "${pathname}". Use https://<ref>.supabase.co, not the REST endpoint`;
  return null;
}
