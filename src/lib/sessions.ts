/**
 * The session schedule, read from Supabase.
 *
 * The second module here that touches the network, and the only one that talks
 * to Supabase. It follows `upstream.ts`'s shape deliberately: a URL builder and
 * a parser that are pure and asserted against a committed payload, a fetch that
 * **never throws**, and a result that carries the reason it has nothing rather
 * than an exception for a caller to remember to catch.
 *
 * NO `next.revalidate` HERE, unlike `upstream.ts`. The routes that call this are
 * `force-dynamic`, which in this version of Next overrides every fetch to
 * `no-store` — see the comment in `app/conditions/page.tsx` that measured it.
 * Naming a revalidate would be configuration that reads as meaningful and is
 * discarded. The freshness this module wants is the freshness it gets: a row
 * edited in Supabase Studio is live on the next request.
 *
 * FAILURE POLICY, and where it differs from the conditions panels. Those must
 * say in words why they cannot answer, because a blank tide reading looks like
 * calm water. A schedule has no such hazard: "coming soon" is true whether there
 * are no sessions yet or Supabase is unreachable, and a parent can act on
 * neither. So both render the same reserved slot and the distinction lives in
 * the server log. `drift` still separates a changed table — a bug to chase, and
 * one `npm run check:db` will name — from a bad day.
 */

/** The two programs. A foreign key to `ProgramCards.tsx`, not to a table. */
export type Program = "art" | "coop";

export type Session = {
  id: string;
  program: Program;
  title: string;
  summary: string | null;
  /** ISO 8601, UTC. Rendered in America/Los_Angeles by the component. */
  startsAt: string;
  endsAt: string;
  locationName: string | null;
  locationUrl: string | null;
  /** Integer cents. Null means "not priced here", which is not the same as free. */
  priceCents: number | null;
};

export type ScheduleResult =
  | { kind: "ok"; sessions: Session[] }
  | {
      kind: "unavailable";
      /** Why there is no schedule, in a sentence fit for a server log. */
      reason: string;
      /** True when the table's shape changed, which is a bug rather than an outage. */
      drift: boolean;
    };

/** Thrown by `parseSessions` when a row is not the shape the table promises. */
export class SessionsDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionsDriftError";
  }
}

/**
 * A ceiling on one page's query, not a product decision. A term is around
 * fourteen sessions and both programs together will not approach this; it is
 * here so a runaway table cannot render an unbounded page. Reaching it is
 * reported rather than silently truncating the schedule.
 */
export const MAX_SESSIONS = 50;

const COLUMNS = [
  "id",
  "program",
  "title",
  "summary",
  "starts_at",
  "ends_at",
  "location_name",
  "location_url",
  "price_cents",
].join(",");

/**
 * Trim what the Supabase dashboard hands you that the API does not want.
 *
 * Forgiving on purpose, and unlike `scripts/db-check.mjs`, which refuses the
 * same input by name. A misconfigured site should degrade to its reserved slot
 * rather than break; a command whose whole job is to verify configuration
 * should say the configuration is wrong. See issue #76.
 */
export function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

/**
 * One program's published sessions that have not yet happened, oldest first.
 *
 * `starts_at` rather than `ends_at` is the cutoff, so a session drops off the
 * list when it begins rather than while families are still at it. That is the
 * conservative direction: a schedule that still lists something happening right
 * now is right, and one that lists something already over is not.
 */
export function sessionsUrl(
  base: string,
  program: Program,
  now: Date = new Date(),
): string {
  const url = new URL(`${normalizeBaseUrl(base)}/rest/v1/sessions`);
  url.searchParams.set("select", COLUMNS);
  url.searchParams.set("program", `eq.${program}`);
  url.searchParams.set("published", "is.true");
  url.searchParams.set("starts_at", `gte.${now.toISOString()}`);
  url.searchParams.set("order", "starts_at.asc");
  url.searchParams.set("limit", String(MAX_SESSIONS));
  return url.toString();
}

/** @throws {SessionsDriftError} when a row is not what the table promises. */
function requireString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value === "")
    throw new SessionsDriftError(
      `A session row has no usable "${key}" (got ${JSON.stringify(value)}).`,
    );
  return value;
}

function optionalString(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string")
    throw new SessionsDriftError(
      `A session row's "${key}" is ${typeof value}, expected text or null.`,
    );
  return value;
}

/**
 * A map link, or nothing, and never anything that could execute.
 *
 * `location_url` is typed into Supabase Studio by hand and rendered as an
 * `href`, so `javascript:` reaching it would be stored XSS. Treated as drift
 * rather than quietly dropped: a scheme this refuses cannot have arrived by
 * accident, and one bad row blanking the schedule with a logged reason is a
 * failure someone will chase within the hour. A silently missing link is not.
 *
 * @throws {SessionsDriftError}
 */
function optionalHttpUrl(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = optionalString(row, key);
  if (value === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new SessionsDriftError(
      `A session row's "${key}" is not a URL: ${JSON.stringify(value)}.`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    throw new SessionsDriftError(
      `A session row's "${key}" uses the ${parsed.protocol} scheme, which is not a link.`,
    );
  return value;
}

/**
 * Turn PostgREST's payload into sessions, or refuse it.
 *
 * Boundaries validate; interiors trust. Everything downstream — the component,
 * the date formatter — takes a `Session` and does not re-check it.
 *
 * @throws {SessionsDriftError}
 */
export function parseSessions(payload: unknown): Session[] {
  if (!Array.isArray(payload))
    throw new SessionsDriftError(
      `Supabase returned ${typeof payload}, expected an array of rows.`,
    );

  return payload.map((entry) => {
    if (typeof entry !== "object" || entry === null)
      throw new SessionsDriftError("A session row is not an object.");
    const row = entry as Record<string, unknown>;

    const program = row.program;
    if (program !== "art" && program !== "coop")
      throw new SessionsDriftError(
        `A session row's "program" is ${JSON.stringify(program)}, which is neither art nor coop.`,
      );

    const priceCents = row.price_cents;
    if (
      priceCents !== null &&
      priceCents !== undefined &&
      (typeof priceCents !== "number" || !Number.isInteger(priceCents))
    )
      throw new SessionsDriftError(
        `A session row's "price_cents" is ${JSON.stringify(priceCents)}, expected whole cents or null.`,
      );

    return {
      id: requireString(row, "id"),
      program,
      title: requireString(row, "title"),
      summary: optionalString(row, "summary"),
      startsAt: requireString(row, "starts_at"),
      endsAt: requireString(row, "ends_at"),
      locationName: optionalString(row, "location_name"),
      locationUrl: optionalHttpUrl(row, "location_url"),
      priceCents: (priceCents as number | null | undefined) ?? null,
    };
  });
}

/**
 * Fetch one program's upcoming published sessions.
 *
 * Never throws. A missing configuration, an unreachable project, an error
 * status, a body that is not JSON and a table whose shape has changed all come
 * back as `unavailable` with the reason attached.
 */
export async function fetchSessions(
  program: Program,
  now: Date = new Date(),
): Promise<ScheduleResult> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  const unavailable = (reason: string, drift = false): ScheduleResult => ({
    kind: "unavailable",
    reason,
    drift,
  });

  if (!base || !key)
    return unavailable(
      "SUPABASE_URL or SUPABASE_ANON_KEY is not set, so the schedule cannot be read.",
    );

  let response: Response;
  try {
    response = await fetch(sessionsUrl(base, program, now), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  } catch (cause) {
    return unavailable(
      `The request to Supabase for ${program} sessions did not complete: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!response.ok)
    return unavailable(
      `Supabase returned HTTP ${response.status} for ${program} sessions.`,
    );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    return unavailable(
      `Supabase's response for ${program} sessions was not JSON: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  try {
    const sessions = parseSessions(payload);
    if (sessions.length === MAX_SESSIONS)
      // Not a failure, but not silent either: the reader is seeing a truncated
      // schedule and only the log can say so.
      console.warn(
        `[sessions] ${program} hit the ${MAX_SESSIONS}-row ceiling; the schedule shown is truncated.`,
      );
    return { kind: "ok", sessions };
  } catch (cause) {
    if (cause instanceof SessionsDriftError)
      return unavailable(cause.message, true);
    return unavailable(cause instanceof Error ? cause.message : String(cause));
  }
}
