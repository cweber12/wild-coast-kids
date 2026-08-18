# 0008 — Supabase is read over plain fetch, and a failed read degrades

Date: 2026-08-18. Status: accepted.

## Context

Until now this site has talked to nothing. Every page is static, every
component is a render, and the twenty-five test files are all render tests.
Supabase and R2 have been provisioned since early on — `.env.example` names the
variables and `scripts/setup-secrets-wizard.sh` fills them — and no code has
ever imported either.

The session schedule (#74, `docs/plans/session-schedule-from-supabase.md`) is
the first data access, so it decides the shape of all of them. Three
constraints converge on it.

**The dependency budget.** The repo has three runtime dependencies: `next`,
`react`, `react-dom`. `@supabase/supabase-js` would be the fourth and brings
five sub-packages — auth, storage, realtime, functions, postgrest — of which a
read-only anonymous `select` uses one.

**CI has no credentials.** `.github/workflows/gate.yml` passes no `env` and no
`secrets`, and the gate table runs `npm run build`. Any route that fetched at
build time would need Supabase credentials in CI, which would make every pull
request depend on Supabase's uptime and on a key that can rotate. Giving the
gate secrets would also break the fresh-clone premise CLAUDE.md holds it to.

**The existing test culture has no network in it.** A seam that needs a mocked
module would be the first of its kind here, and would sit oddly beside
`gates.mjs` and `built-css.mjs`, where ADR-0002 already established the split
this repo uses: a thin edge that does I/O over a pure core that decides things
and is unit-tested directly.

One more thing informed this. The configured project URL turned out to carry a
`/rest/v1/` suffix, so every request would have asked for `/rest/v1//rest/v1/…`
and PostgREST answered `PGRST125 — Invalid path specified in request URL`. That
error is indistinguishable from a dead project, a rotated key or a network
fault. A malformed value at the edge produced a diagnosis that took a
half-hour and named nothing useful.

## Decision

Supabase is read with plain `fetch` against PostgREST. No client library.

The `fetch` is a parameter, not an import, so a test passes a stub rather than
intercepting a module. The base URL is normalized and validated where it enters
— a trailing slash and a trailing `/rest/v1` are stripped, and a value that is
not an `https://` URL is refused by name. Routes that read Supabase render
dynamically, so the build never needs a credential.

A read has three outcomes and the caller must handle all three: rows, no rows,
or an explicit failure carrying its reason. A failure renders `ReservedSlot` and
logs why on the server. It does not throw.

Neither the project URL nor the anon key carries a `NEXT_PUBLIC_` prefix. They
are `SUPABASE_URL` and `SUPABASE_ANON_KEY`, read at runtime on the server.

This decision covers reads of public data. It says nothing about R2, and
nothing about authenticated access, which does not exist yet.

## Consequences

We own the query string and the parsing. PostgREST's filter grammar —
`program=eq.art`, `published=is.true`, `order=starts_at.asc` — is now repo
knowledge rather than something a library hides. For one table and one query
that is a few lines; it would stop being a good trade somewhere north of a
handful of queries, and that is the signal to revisit.

There are no generated types. The TypeScript type is hand-written, which means
the compiler cannot catch a column renamed in the database — the parser will,
at runtime, by rejecting rows. That is why `npm run check:db` asserts the
column set as well as the RLS behaviour: it is the only thing standing where a
generated type would have stood, and without it a schema change would surface
as an empty schedule rather than a failure.

The build stays credential-free and CI is unaffected by Supabase's uptime. What
that costs is static HTML: these routes render per request, so every visitor
pays a round trip and there is no cached page to serve during an outage. At
this site's traffic that is not worth optimising, and revalidation is available
later without revisiting this decision.

Degradation is per section rather than per page. A Supabase outage costs one
dashed box on `/art` and `/coop`; the rest of both pages, and the whole of the
rest of the site, are untouched. This is what makes the source build plan's
`NEXT_PUBLIC_EVENTS_ENABLED` flag unnecessary — the isolation it was there to
provide is structural, not a switch someone has to remember to throw.

Dropping the `NEXT_PUBLIC_` prefix is not about secrecy — the anon key is
public by design, and RLS is what protects the data. It is about when the value
is read. A `NEXT_PUBLIC_` variable is substituted into the bundle at build time,
including in server code: a probe page built on 2026-08-18 with
`NEXT_PUBLIC_PROBE_SENTINEL=ZZPUBLICZZ` and `PROBE_SENTINEL=ZZSERVERZZ` put the
literal `ZZPUBLICZZ` into `.next/server/chunks/ssr/`, while the unprefixed one
survived as a `process.env` lookup and its value appeared nowhere.

So a prefixed variable would make the environment part of the artefact. Fixing
a wrong URL in Vercel would need a redeploy rather than an edit, and a preview
deployment built before its variables existed would serve `undefined` until
rebuilt — which is exactly the state this project's Preview environment was in.
That directly contradicts the reason these routes render dynamically at all: a
change should be live on the next request. Unprefixed, both the data and the
configuration behave that way. The cost is that a future client component
wanting Supabase directly would need the names changed back, and ADR-0008's
own advice is that such a component is the moment to adopt the SDK anyway.

Validating at the boundary is cheap insurance bought after the fact rather than
before it, which is the honest description. The malformed URL is fixed and
`scripts/setup-secrets-wizard.sh` should reject it at the prompt (#76), but a
second line of defence is worth its four lines when the failure it prevents
presents as "Supabase seems to be down".

What this genuinely costs is the well-lit path. Every Supabase tutorial, answer
and documentation page assumes `createClient`. Someone arriving to add
authentication will find no client object to hang a session on, and will have to
decide whether to adopt the SDK then — which is the right moment for it, because
token refresh is real work that a library should do. Adopting it later is
contained: one module changes, and the injected-`fetch` seam its callers depend
on can stay exactly as it is.

## Amendment, 2026-08-18: the seam is the global fetch, not an injected one

The Context above claims that "a seam that needs a mocked module would be the
first of its kind here". **That was false when it was written.**
`src/lib/upstream.test.ts` already stubs the global — `vi.stubGlobal("fetch",
fetchMock)` — with a docstring explaining why. The conditions work landed while
this decision was being drafted, and the claim was made against the repository
as it stood earlier in the same session.

So the decision changes to match the repository rather than the other way
round. `src/lib/sessions.ts` calls the global `fetch` and its tests stub it, the
way `upstream.ts` does. Changing this repo's fetch-testing convention would be
its own slice with its own justification, and there is none: the argument for
injection was never that it was better, only that nothing here did otherwise.

Using the global is in fact the stronger choice for a second reason the original
draft missed. Next instruments `fetch` itself — caching, revalidation, and the
`no-store` override that `force-dynamic` applies. A module holding an injected
function has no guarantee it was handed the instrumented one, which for a
framework whose caching is a property of that function is a seam that can lie.

`scripts/db-check.mjs` keeps its injected fetch. It is a command-line script
rather than a rendered route, there is no Next instrumentation to preserve, and
nothing under `scripts/` sets a contrary precedent — `gates.test.mjs` and
`built-css.test.mjs` avoid the question entirely by having no I/O to seam. Two
neighbourhoods, each following its own established practice, is the outcome
CLAUDE.md's "follow the patterns already in the repo" actually asks for.

Everything else stands: no SDK, nothing throws, failures become an
`unavailable` result carrying their reason, and the configuration is read at
runtime without a `NEXT_PUBLIC_` prefix.
