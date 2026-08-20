# The session schedule comes from Supabase

Issue: [#74](https://github.com/cweber12/wild-coast-kids/issues/74).

## Problem, from the reader's point of view

A parent who wants to know when the next art class or co-op Tuesday happens
cannot find out. `/art` and `/coop` each end in a dashed reserved slot
promising a schedule; `/book` — the target of the nav pill, the hero CTA and
three in-content CTAs — says online booking is on its way. The site describes
both programs in detail and cannot say when either one meets.

Supabase has been provisioned since early on: `.env.example` names the
variables, `scripts/setup-secrets-wizard.sh` fills them, and `.env.local` holds
values. No code has ever talked to it. This is the first slice that does.

## Solution

One table, `public.sessions`, holding one row per dated session of either
program. `/art` and `/coop` each render their own program's upcoming published
sessions in place of the reserved slot. Lena adds and edits rows in Supabase
Studio; the site follows on the next request.

Nothing is bookable and nothing is collected. There is no account, no RSVP, no
payment, no email, and no personal data of any kind in this table.

## Relationship to the source build plan

This work started from a seven-step `Events & Calendar Module` build plan
(`00-overview.md`, `01-schema-and-rls.md`). That document assumes Supabase and
R2 are "already wired up", which is false here — there is no client, no data
layer, and no auth — and it assumes a vocabulary this repo has already ruled
out. What survives is roughly its steps 1 and 2, collapsed into one vertical
path and rescoped to read-only. Its steps 3–7 (ICS feed, RSVP, admin CRUD,
Square payments, Google Calendar mirror) are out of scope and undecided.

Three defects in the source document are corrected here rather than copied:

1. `updated_at timestamptz not null default now()` never updates. A column
   default fires on insert only. All four of its tables carry this, so all four
   would report a last-modified time that is really a created time. Fixed with
   a trigger.
2. Its build order puts a schema-only step first, which CLAUDE.md forbids.
3. `event_type as enum ('meetup', 'class', 'virtual')` uses `class`, which
   `CONTEXT.md` reserves for one session of the art program.

## Implementation decisions

- **The word is Session.** `CONTEXT.md` already defines **Program** and says "a
  class is one session of the art program", and user-facing copy uses "session"
  five times across `ProgramCards.tsx`, `/art` and `/book`. `event` appears in
  `src/` only as the DOM handler parameter in `InterestListForm.tsx`, so a
  domain concept by that name would collide twice over. `CONTEXT.md` gains a
  **Session** entry in slice 1.

- **One row is one dated session.** Grain is the only part of this schema that
  is expensive to change, and finer grain aggregates upward cheaply while
  coarser grain explodes downward expensively. Every future the source document
  plans — capacity, RSVP, payments, ICS, a Google mirror — arrives as an
  additive column or as a new table referencing rows that already exist. A term
  row ("Tuesdays, Sep–Dec") would instead need a data migration the first time
  anything wants to point at one date, plus an exceptions table the first time a
  week is skipped. A fall term is roughly 14 rows; volume is a non-issue.

- **Programs stay hardcoded.** `ProgramCards.tsx` is a bespoke design — its own
  colours, emoji, `[ 01 ]`/`[ 02 ]` numbering and a 520px height budget set by
  issue #37. Making it data-driven is a design regression, not a feature. The
  `program` column is a foreign key to code, not to a table.

- **`public`, not a dedicated schema.** The source document's isolation
  contract was written to fence off four tables, two functions and a view; this
  is one read-only table. A non-`public` schema only works once it is added to
  PostgREST's exposed-schemas list, which is a dashboard setting — so "clone the
  repo, run the migration" would not reproduce a working environment. That is
  the same silent-divergence failure the CI story below is built to avoid.
  Isolation here comes from RLS and from the module boundary in code.

- **The base URL is normalized and validated where it enters.** `getSessions`
  trims a trailing slash and a trailing `/rest/v1` off
  `SUPABASE_URL`, and rejects a value that is not an `https://` URL,
  logging the reason and returning the unavailable result. This is not
  hypothetical hardening: that exact malformation was in `.env.local` during
  planning and made every request fail with a PostgREST error that named nothing
  useful. Boundaries validate; interiors trust.

- **`program` is a check constraint, not a Postgres enum.** Adding an enum value
  later is `alter type … add value`, which has transaction restrictions; a check
  constraint is a plain `alter table`. The TypeScript union is the source of
  truth and the data module validates at the boundary.

- **Plain `fetch` against PostgREST, not `@supabase/supabase-js`.** The SDK
  would be this repo's fourth runtime dependency — it has three — and drags in
  auth, storage, realtime and functions to use none of them. An injected `fetch`
  is a cleaner seam than a mocked module, and Next's own fetch handling applies
  to it. If auth or RSVP ever lands, adopting the SDK is contained behind this
  one module. Recorded as ADR-0013.

- **The routes render dynamically.** `.github/workflows/gate.yml` passes no
  `env` and no `secrets`, and the gate table runs `npm run build`. A page that
  fetched at build time would need credentials in CI, which would turn every PR
  red whenever Supabase blinked or a key rotated. `export const dynamic =
"force-dynamic"` keeps the build credential-free and makes a new row live on
  the next request rather than the next deploy.

- **Emptiness and failure look the same on screen and differ in the log.** Both
  render the existing `ReservedSlot`, whose copy — "Schedule & pricing coming
  soon" — is true in both cases and which a parent cannot act on differently.
  A failure additionally logs its reason server-side: missing configuration,
  HTTP status, or parse error. The operator learns; the visitor is not handed an
  error they cannot use. One Supabase outage degrades one section rather than
  500ing the page.

- **No feature flag.** The source document's `NEXT_PUBLIC_EVENTS_ENABLED` exists
  to stop a broken module taking the site down, and the fallback above already
  does that per section, automatically. `published` on each row is the real kill
  switch and needs no deploy.

- **No slug and no per-session route.** Sessions render inline on the program
  pages. A detail page is a new route and a new IA exercise, and nothing needs
  deep links.

- **Migrations are committed SQL, applied by hand.** `supabase/migrations/` is
  the conventional path, so adopting the Supabase CLI later moves no files. With
  one migration there is no history to track; `npm run check:db` is the drift
  detector, which is the property that actually matters. Revisit when there is a
  second migration.

## Schema

```sql
-- supabase/migrations/0001_sessions.sql

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  program       text        not null check (program in ('art', 'coop')),
  title         text        not null,
  summary       text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  location_name text,
  location_url  text,
  price_cents   integer     check (price_cents is null or price_cents >= 0),
  published     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ends_after_start check (ends_at > starts_at)
);

-- Matches the only query the site makes.
create index sessions_program_starts_at on public.sessions (program, starts_at);

-- A `default now()` fires on insert only, so without this the column reports a
-- creation time under a name that promises a modification time. Plain plpgsql
-- rather than the moddatetime extension: no extension schema to get wrong.
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;

create policy "public reads published sessions"
  on public.sessions for select
  using (published = true);

grant select on public.sessions to anon, authenticated;
```

There is deliberately **no insert, update or delete policy**. Writes happen in
Studio under the service role, which bypasses RLS. An unpublished row is
invisible to the anon key, which is what makes `published` a working kill
switch.

`price_cents` is nullable, and null means "not priced here" rather than free.
If every art class turns out to be the same price, the column stays null and
pricing lives in page copy — `TODO(verify)` with Lena whether price varies per
session.

## Test seams

Agreed before slice 1, per CLAUDE.md.

| Seam                              | What it isolates                      | How it is tested                       |
| --------------------------------- | ------------------------------------- | -------------------------------------- |
| `sessionsUrl(base, program, now)` | PostgREST query construction          | Pure function; asserted string         |
| `parseSessions(body)`             | Boundary validation of untrusted rows | Pure function; malformed rows rejected |
| `getSessions(program, deps)`      | The network call                      | Injected `fetch` stub — no `vi.mock`   |
| `SessionSchedule({ result })`     | All three render states               | Synchronous component; RTL render      |
| `formatSessionWhen(session)`      | `America/Los_Angeles` rendering       | Pure function; fixed instants          |
| `npm run check:db`                | That the migration did what it says   | Assertions against the live project    |

Two seams are load-bearing enough to have been proven rather than assumed:

- **An async page still renders under the existing test style.** `render(await
Coop())` works with Testing Library 16, React 19 and jsdom — verified with a
  throwaway suite on 2026-08-17, which passed and was deleted. This matters
  because `src/app/coop/page.test.tsx` currently does `render(<Coop />)`, and
  every page test in the repo shares that shape.
- **The degradation path is tested for free.** Vitest does not load
  `.env.local`, so `getSessions` returns its unavailable result inside the test
  run and the page renders the `ReservedSlot` — exactly what the existing page
  assertions already check. The page tests change by one word and gain coverage
  of the failure path.

`npm run check:db` follows ADR-0002's split, the same one `check-built-css.mjs`
uses: a thin entry point that resolves, prints and exits, over a pure module
where the verdict is decided and unit-tested. It asserts, against the live
project, that RLS is enabled, that the anon key sees a published row, that the
anon key does **not** see an unpublished row, and that the column set matches.
It is not a gate row: `gates.mjs` declares `skip` as a static string and
`run-gates.mjs` honours it unconditionally, so a `skip:` row can never run, even
locally with credentials. Teaching the table a conditional skip is shared
infrastructure changed for one caller and is filed as [#75](https://github.com/cweber12/wild-coast-kids/issues/75).

## Slices

Each leaves the repo working and the gates green.

| #   | Slice                                                          | Delivers                                                                                    |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0   | Write this plan down                                           | This file, plus ADR-0013 on reading Supabase over plain fetch                               |
| 1   | The sessions table, and a command that proves it               | `supabase/migrations/0001_sessions.sql`, `npm run check:db`, `CONTEXT.md` gains **Session** |
| 2   | `/coop` lists its published sessions                           | `src/lib/sessions.ts`, `SessionSchedule`, `/coop` async, coverage floor re-derived          |
| 3   | `/art` lists its sessions, with price                          | `/art` async, price rendering, coverage floor re-derived                                    |
| 4   | The IA document stops calling real schedules a future exercise | `INFORMATION_ARCHITECTURE.md`                                                               |

Slice 1 is not a schema-only slice: `npm run check:db` is a consumer of the
migration that can be demonstrated on its own, which is the property CLAUDE.md
is protecting. Slices 2 and 3 each depend on 1. Slice 4 depends on 2 and 3
because it describes what they built.

Estimated at roughly 500–600 lines including tests, which is at the edge of the
~400-line reviewability guide. If slice 2 lands larger than expected, split at
the 2/3 boundary into a second PR rather than growing this one.

## Verification

`npm run gate` at every slice, output pasted in the PR body, plus
`npm run check:db` output for slices 1–3.

The coverage floor in `vitest.config.mts` is pinned to two decimals at what the
repo achieves today. New files under `src/` enter the denominator, so the floor
is re-derived in the same commit that moves it, naming which statements are
uncovered and why — which is what the config's own comment requires.

## Considered and rejected

- **Following the source document's build order.** Its step 1 delivers schema,
  RLS and seed data with nothing reading them. That is the horizontal slice
  CLAUDE.md names explicitly: it cannot be demonstrated except by the step that
  finally uses it.
- **`@supabase/supabase-js`.** The boring, well-documented choice, and the right
  one the moment auth or writes arrive. Today it is five sub-packages for one
  anonymous `select`, and it replaces an injected function with a mocked module.
- **A dedicated `schedule` schema.** Better namespace hygiene, and cheap to set
  up now rather than after `public` becomes a junk drawer. Rejected because it
  depends on a dashboard setting no migration records, so a fresh project would
  fail in a way the repo cannot see.
- **Modelling the co-op as a term with a weekly rhythm.** Matches how the
  programme is described and keeps a term-wide edit to one row. Rejected on
  grain: a skipped week, a moved location, or any future RSVP each need concrete
  dates, and generating them later is a data migration rather than an added
  column.
- **Prerendering with Supabase secrets in CI.** Faster pages, real static HTML.
  Rejected because it makes every pull request depend on Supabase's uptime and
  breaks the gate's fresh-clone premise.
- **A `cancelled` flag.** Genuinely useful — deleting a row makes a session
  vanish with no explanation. Rejected for now because nobody has stated the
  requirement, and it is a one-column additive change the first time a session
  is actually cancelled.
- **A combined `/schedule` route.** Would need a fifth nav link, and the nav
  already wraps to two rows below `md` with four links plus the pill (ADR-0004).
  Reconsider when there is enough data to fill a page.
- **Adopting the Supabase CLI.** `supabase start` would give a local Postgres in
  Docker and let `check:db` run unskipped in CI, which is strictly better
  verification. Rejected as disproportionate to one read-only table; revisit when
  writes arrive.

## Out of scope

- Registrations, RSVP, capacity, waitlists, and any personal data. Nothing in
  this table describes a person.
- Payments. `price_cents` is a number to display, not to charge.
- Auth, admin accounts, and `app_metadata` roles. There is no admin user.
- Admin CRUD. Lena edits rows in Supabase Studio.
- Session images and R2. R2 is provisioned and unused; wiring it is separate.
- An ICS feed and any Google Calendar mirror.
- `/book`'s reserved slot, which is about a booking provider and stays.
- The interest-list form's missing destination, which is a different table and
  a different slice.
- Whether `gates.mjs` should support a conditional skip. Filed as
  [#75](https://github.com/cweber12/wild-coast-kids/issues/75).
- Making `scripts/setup-secrets-wizard.sh` validate what it is handed. It
  accepted a project URL with `/rest/v1/` on the end and pushed it to Vercel
  unchallenged, which is how the malformation above survived six days. A shape
  check at the prompt would have caught it. Different cause, different slice —
  filed as [#76](https://github.com/cweber12/wild-coast-kids/issues/76).

## Open questions

- **Resolved.** The Supabase project responded `PGRST125` on every REST path
  during planning. The cause was `SUPABASE_URL` carrying a
  `/rest/v1/` suffix, so every request asked for `/rest/v1//rest/v1/…`. The
  project, both keys and GoTrue are all healthy; `.env.local` is corrected and
  the anon key now returns `PGRST205` — "no such table" — which is what slice 1
  creates. See the boundary-validation decision above, which exists because of
  this.
- **Resolved.** Vercel held the same malformed URL under the old
  `NEXT_PUBLIC_SUPABASE_URL` name, unreadable because the variable was marked
  Sensitive. Rather than repair it, the rename slice replaced both variables
  with `SUPABASE_URL` and `SUPABASE_ANON_KEY` across Production, Preview and
  Development — Preview had none of them at all, which under the old prefix
  would have baked `undefined` into every preview build until each was rebuilt.
- **Resolved.** Art-class prices vary per session, confirmed 2026-08-18, so
  `price_cents` is a real column rather than speculative and slice 3 renders it.
- **Resolved.** One issue, not four. The slices are strictly sequential and
  touch overlapping files, so two people could not pick two of them up without
  colliding — which is the test CLAUDE.md sets for whether splitting earns its
  keep. Worked from this file on one branch.

## Addenda

### 2026-08-18 — a fifth slice, before slice 2

The plan above lists four slices. A fifth was added between slices 1 and 2,
after a question about how the Supabase variables were labelled in Vercel:
**read the Supabase config at runtime, not from the bundle**
(`SUPABASE_URL` / `SUPABASE_ANON_KEY`, no `NEXT_PUBLIC_` prefix).

It is not a tidying pass. A `NEXT_PUBLIC_` value is substituted into the build
output rather than read at run time — measured, not assumed; see ADR-0013 —
which would have made two of this project's existing problems unfixable without
a redeploy: the malformed Production URL, and a Preview environment that had no
Supabase variables at all and would have inlined `undefined` into every build.
That defeats the reason "The routes render dynamically" was chosen above.

Taken before slice 2 because it was cheapest there: no application code read the
variables yet, only `check-db.mjs` named them.

The slice order is therefore 0, 1, **runtime config**, 2, 3, 4.

### 2026-08-20 — three of the six test seams name code that does not exist

The Test seams table above (lines 190–197) was agreed before slice 1 and never
revisited. Three of its six rows name things that were never written under
those names. The table is left standing, because it is the record of what was
agreed; this says what shipped instead. The same correction applies to the two
other places the body names `getSessions`, at lines 78 and 207.

**`getSessions(program, deps)` is `fetchSessions(program, now)`.** There is no
`deps` parameter. The function reads `SUPABASE_URL` and `SUPABASE_ANON_KEY`
from the environment itself, and takes an optional `now` for the
upcoming-sessions filter. `getSessions` appears nowhere in `src/` or
`scripts/` — only in this file.

**The `fetch` stub is the global one, not an injection.**
`src/lib/sessions.test.ts` does `vi.stubGlobal("fetch", fetchMock)`. This was a
deliberate reversal rather than drift: the 2026-08-18 amendment to ADR-0013
records that Next instruments `fetch` itself — caching, revalidation, and the
`no-store` that `force-dynamic` applies — so a module holding an injected
function has no guarantee it was handed the instrumented one. That makes the
injected seam one that can lie. The ADR was amended; this table was not.
`scripts/db-check.mjs` still injects its `fetch`, for the reason the amendment
gives: it is a command-line script with no Next instrumentation to preserve.

**`formatSessionWhen(session)` was never written.** The composition lives in an
unexported `when()` inside `SessionSchedule.tsx`, so it is not a seam. The
helper that module does export is `formatPrice(cents)`, which this table never
mentioned.

**What was actually lost is less than the list suggests.** The
`America/Los_Angeles` rendering that `formatSessionWhen` was meant to isolate
_is_ tested as a pure function against fixed instants — just not where the
table looked. `when()` delegates to `localDayOf` and `localTimeOf` in
`src/lib/pacific-time.ts`, and `src/lib/pacific-time.test.ts` asserts both,
including the exact `"Tue, Sep 8"` this feature renders and the evening instant
that is already the next day in UTC. That is a better seam than the one
proposed: it is shared with the conditions tool and the tide day, so one set of
assertions holds for all three rather than one per feature.

What is reachable only by rendering is the single line that joins them,
`day · start – end`, and `SessionSchedule.test.tsx:40` covers it by asserting
`"Tue, Sep 8 · 10:00 AM – 1:00 PM"` from a fixed UTC input. There is no
coverage hole, and extracting a `formatSessionWhen` today would isolate a
template literal. No code changes for this; the record was the thing that was
wrong.

One row is understated rather than wrong: `SessionSchedule({ result })` also
takes `program`, `emoji`, `headline` and `detail`, and the reserved-slot branch
is driven by all of them.
