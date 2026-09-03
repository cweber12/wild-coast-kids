# Conditions: fetching mechanics and render structure

> Planned 2026-09-03. In flight.

An audit of `/conditions` for production readiness, and the work it prescribes.

**Where the numbers come from.** Every figure below was measured on 2026-09-03
against `area-routes` at `6356360`, which is PR #229 and unmerged — the beach
page was measured at its nested URL, `/conditions/<area>/<beach>`. On `main` at
`af9ab71` that page is still `/conditions/<slug>`. **All five defects were then
re-verified present on `main`**, and every line number cited below is `main`'s.
The defects live in the panels and the readers, which both route shapes share.

**Figures expire.** Re-derive before implementing; see _Working these issues_.

**PR #229 is not a blocker.** It touches the routes, `ConditionsSection`,
`AreaSelector`, `AreaBeaches` and `areas.ts`. It touches none of
`conditions.ts`, `DayPanel.tsx`, `WeekPanel.tsx`, `Caveats.tsx`, `daylight.ts`
or `selectedDay.tsx`, which is everything this plan changes. The two can run
concurrently.

## The problem, from the reader's point of view

Nothing here is visible to a reader today except one bug, and that one only at
midnight. The rest is the difference between a page that is fast by design and a
page that is fast by accident — and the module is about to grow. Areas PR 3 adds
readings at the area scope, which means new readers in the same file. Every
defect below is one the new readers would inherit.

## What was measured

One beach page, production build, Next 16.3.0:

| Measure                          | Value                        |
| -------------------------------- | ---------------------------- |
| Cold render                      | 848 ms                       |
| Warm render (ISR hit)            | 5.6 ms                       |
| HTML                             | 362,275 B (49,351 B gzipped) |
| — of which RSC flight payload    | 272,143 B (**75.2%**)        |
| Serialized hourly points         | 810                          |
| Area page, for comparison        | 78,634 B                     |
| `fetch()` invocations per render | **15**                       |
| Distinct upstream endpoints      | **8**                        |

ISR is correct on the nested routes and needs no work: `Cache-Control:
s-maxage=900`, `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`.

Duplicate calls, from a wrapped `fetch` over the four panels' read sets:

```
3x  api.tidesandcurrents.noaa.gov/.../datagetter
3x  api.weather.gov/gridpoints/SGX/54,21
2x  api.weather.gov/products/types/SRF/locations/SGX
2x  thredds.cdip.ucsd.edu/.../D0498_forecast.nc
2x  api.weather.gov/products/f324e29e-...
1x  ndbc.noaa.gov/data/realtime2/46254.txt
1x  ndbc.noaa.gov/data/realtime2/LJAC1.txt
1x  api.weather.gov/gridpoints/SGX/54,21/forecast
```

Next's request memoization collapses these to 8 at the network (the fetch-cache
held 9 entries after a cold render). The network is fine. The derivations are
not: all 15 run.

---

## The findings

Eight. **Five become three tracker issues; three stay in this file.**

The three that stay are decisions rather than work, and a tracker row for a
decision nobody has taken is a row that ages. They are recorded here, under
_Decisions still open_, and this plan is where they are settled.

| Finding                                | Lands as |
| -------------------------------------- | -------- |
| C1 — one clock per render              | Issue A  |
| C2 — twin grid readers become one      | Issue B  |
| C3 — readers memoize their derivations | Issue B  |
| C4 — caveat prose serialized twice     | Issue C  |
| C5 — sunrise carries false precision   | Issue C  |
| C6 — re-price the week payload         | _below_  |
| C7 — `/conditions` revalidate          | _below_  |
| C8 — split `conditions.ts`             | _below_  |

---

## Issue A — One clock per render

`bug` `autonomous` `ready-for-agent`. Blocked by nothing. **Merge before Issue
B.**

**The defect (C1).** Every reader in `src/lib/conditions.ts` defaults
`nowMs = Date.now()`, and every call site takes the default. That is ~12
independent clock readings per beach render. `DayPanel` reads its clock _before_
its `await Promise.all`
([DayPanel.tsx:386](../../src/components/conditions/DayPanel.tsx#L386));
`WeekPanel` reads its clock _after_
([WeekPanel.tsx:138](../../src/components/conditions/WeekPanel.tsx#L138)). The
two are separated by a full network round trip — 374 ms measured — so a render
beginning in the last ~400 ms of a Pacific day gives the two regions different
seven-day spines.

**Proven**, with `readDaylightWeek` called either side of Pacific midnight:

```
DayPanel  clock -200ms -> first day 2026-09-03 (Thu, Sep 3)
WeekPanel clock +200ms -> first day 2026-09-04 (Fri, Sep 4)
day arrays identical: false
```

`resolveSelected(null, dates)` then resolves to a different first day in each
region: the week grid highlights Thursday while the day panel draws Friday. ISR
caches that page and serves it for 15 minutes.

**It also falsifies a docstring.**
[`selectedDay.tsx`](../../src/components/conditions/selectedDay.tsx) says _"Both
build their days from `weekOfDays`, so both first columns are today, and the two
cannot disagree even before anything is chosen."_ True of the helper, false of
the argument. Correcting that prose is part of this issue, not a follow-up.

**The fix.** Resolve `nowMs` once per request and thread it to every reader. The
injectable parameter already exists for exactly this and no call site uses it.
Prefer threading over a module-level cache: the readers stay pure and their
tests keep injecting.

**Seam.** The readers' existing `nowMs` parameter — no new seam needed. The
regression test renders `WeekPanel` and `DayPanel` together with a clock pinned
200 ms before Pacific midnight and a slow upstream, asserting both name the same
first day.

**Done when.**

- A regression test **committed failing first**, then passing.
- No `Date.now()` reachable from a reader except through the one resolved value.
- The `selectedDay.tsx` docstring states what the code now guarantees.
- `npm run gate` green, output in the PR body.

## Issue B — The grid is read once, and readers memoize

`enhancement` `autonomous` `ready-for-agent`. **Blocked by Issue A** — see the
note at the end.

Two commits, in this order.

### Commit 1 — the twin grid readers become one (C2)

`readSkyWeek` ([conditions.ts:1421](../../src/lib/conditions.ts#L1421)) and
`readGridpointWeek` ([conditions.ts:1608](../../src/lib/conditions.ts#L1608))
call `fetchGridForecast(beach.grid_cell)` with identical arguments and share
~25 lines of identical preamble — the same beach lookup, the same `no-cell`
branch, the same binding. One projects cloud, the other wind. This is why
`gridpoints/SGX/54,21` is requested three times.

**The fix.** One read over the forecast cell with two projections. Keep both
public names if the call sites read better for it; what must not survive is two
independent fetches and two copies of the preamble.

**Seam.** The existing `SkyWeekView` / `GridpointWeekView` return types. Both
have `no-cell`, `unavailable` and `week` states that must keep behaving
identically — the panels branch on them.

### Commit 2 — readers memoize their derivations (C3)

There is no `React.cache()` anywhere in `src/`. The code issues 15 requests for
8 endpoints and relies entirely on Next patching `fetch` to collapse them. Two
costs:

1. **The dedup is the framework's, not ours.** Move one read to a Supabase
   client (ADR-0013 already puts Supabase reads in the codebase) or to plain
   `undici` and it silently becomes 15 real requests. No test would fail.
2. **Only the network is deduped.** All 15 parse-and-join passes still run over
   the same responses.

**The fix.** Wrap each reader in `React.cache()`. One line each. This is a new
convention, so it wants a short ADR at the next free number — the `adr-numbers`
gate row will reject a taken one.

**Seam.** A counting `fetch` stub around the four panels' combined read set,
asserting invocations equal distinct endpoints. That test is the thing that
makes the property ours instead of Next's, so it is the point of the commit
rather than a check on it. Commit 1 wants the same harness — build it there and
reuse it.

**Done when.**

- `fetchGridForecast` is invoked once per beach render.
- `fetch()` invocations per beach render equal distinct endpoints (8 at time of
  writing — **re-derive, do not hardcode**).
- The test fails if a `cache()` wrapper is removed.
- Existing `conditions.test.ts` cases for both readers pass unchanged.
- ADR filed at the next free number.
- `npm run gate` green, output in the PR body.

**Why Issue A blocks this.** `React.cache()` keys on its arguments. Until A
threads one resolved `nowMs`, each caller's distinct `Date.now()` makes every
call a cache miss and the memoization does nothing. This is a hard dependency,
not a preference — and CLAUDE.md says not to start an issue whose blocker has
not merged.

## Issue C — Two payload wins

`enhancement` `autonomous` `ready-for-agent`. Blocked by nothing, blocks
nothing, shares no file with A or B. Safe at any point.

### Caveat prose is serialized twice (C4)

[`Caveats.tsx:71`](../../src/components/conditions/Caveats.tsx#L71) uses the
full caveat paragraph as the React key (`key={entry}`), so each appears twice in
the flight payload — once as the key, once as the child. Measured: 23 repeated
long strings, **8,895 wasted bytes**.

`inventoryCaveats()` returns bare strings, so the fix needs either an index
(acceptable — the list is static and never reordered within a render) or a shape
carrying an id.

### Sunrise carries precision astronomy does not have (C5)

`"sunriseMs":1788441904157.1416` — full float precision on a computed sunrise.
28 such timestamps per beach page. Round in `daylight.ts` where the value is
produced, not at each call site. Seconds are lossless for everything the page
draws: labels are to the minute, and the day chart's night band is a pixel
boundary.

**Done when.**

- No caveat string appears more than once in the rendered flight payload,
  asserted from a render rather than by inspection.
- `sunriseMs` / `sunsetMs` are integers, asserted.
- Existing daylight and `DaylightWeek` tests pass unchanged.
- `npm run gate` green, output in the PR body.

---

## Order

```
Issue C  ──────────────────────────────  any time, parallel-safe
Issue A  ──────►  merge  ──────►  Issue B
                                  (branch cut from the merged main)
```

**Both A and B before areas PR 3.** That slice adds readers at the area scope;
written before this work lands, each would take its own `Date.now()` and go
unmemoized, and fixing them afterwards costs more than establishing the contract
first. If that ordering is refused, A and B wait until after areas PR 4 — the
one thing that must not happen is the two trains running at once.

PR #229 is orthogonal and needs no coordination.

## Working these issues

One issue per fresh session, in the order above, each branch cut from a `main`
that already has its blocker merged. No orchestration, no agent fan-out: the
audit is done, the prescriptions are here, and a fresh session reading this file
plus its issue has what it needs.

**Start every session with the preflight.** It is short, and it may end the
session:

1. Re-derive the figures the issue depends on. **Do not trust a number in this
   file** — it was measured on 2026-09-03 against an unmerged branch.
2. Check the prescribed fix against the real signatures. A _fix_ clause is
   falsifiable by reading the code, and reading it is cheaper than discovering
   it mid-implementation.
3. Confirm the named seam still exists at that path.
4. `gh pr list`, and check no open branch has moved the same lines.

**If the finding has evaporated or the fix does not typecheck against what is
there now, say so and stop.** Closing an issue as no-longer-true is a good
outcome, not a failed session.

Then CLAUDE.md's full lane: one commit per named change, gates green at each,
`/code-review` before opening the PR, gate output pasted into the body. **Do not
merge.** Cole merges.

---

## Decisions still open

Not tracker issues. They are decisions, and this file is where they are settled.

### C6 — Re-price the week-ahead payload

`DayPanel` builds all seven `DayView`s — four series × ~24 hours, plus
pre-rendered `wording` and `surfZone` nodes per day — and hands them to a client
component that shows one. The beach page is **4.6× the area page**, and roughly
six sevenths of that difference is never rendered.

This is a deliberate trade, recorded in `selectedDay.tsx`: shipping the week is
what makes day-switching instant with no JS fetch, and keeping the day out of
the URL is what preserves `revalidate = 900`. The trade was priced when the day
panel was smaller. At 272 KB it wants re-pricing, and whichever way it goes it
is an ADR:

- keep it, and record the number so the next reader knows it was chosen;
- a route handler for the six days that are not today, forfeiting instant
  switching;
- trim what each day carries — the pre-rendered `wording` and `surfZone` nodes
  are the largest per-day items that are not series data.

### C7 — `/conditions` revalidates for a reason that expired

[`conditions/page.tsx`](../../src/app/conditions/page.tsx) carries a 30-line
docstring justifying `revalidate = 900` because _"this page names today's lowest
tide, and a page prerendered yesterday would name yesterday's."_ It does not any
more — the readings moved down to the beach level. Grepping the rendered page,
the only "low tide" on it is the glossary definition of the datum. The route
regenerates four times an hour to reproduce a byte-identical page.

**It interacts with areas PR 3**, which puts area-level readings back on this
route — at which point the 900 becomes correct again. So the options are: drop
it now and restore it in PR 3; keep it and correct the prose to say it is held
_for_ PR 3; or leave both alone. A judgement about work in flight, and best
taken when PR 3 is planned rather than now.

### C8 — `conditions.ts` at 2,016 lines

Fourteen readers sharing a handful of private helpers (`weekOfDays`,
`predictionsWindow`, `daylightByDate`). It is the file every panel imports and
every change touches; C2's twins are what that size produces. Splitting by
product — tide / wave / sky / surf-zone — with the day-frame helpers in their
own module would make C1 and C3 structurally hard to reintroduce.

**Its own plan, not this one, and not until areas PR 4 has merged** — it would
otherwise conflict with every remaining slice of `areas-over-locations.md`.

---

## Out of scope

- **Anything about ISR or `revalidate` on the nested beach route.** Verified
  correct; do not touch it.
- **The four Suspense boundaries and the failure isolation.** They are the best
  part of this module. Five publishers going quiet independently is a design
  decision, not an accident, and none of this work may collapse them.
- **Re-joining any station, buoy, MOP line or grid cell.** Same exclusion the
  areas plan carries.
- **New dependencies.** None of this work needs one; proposing one means
  stopping and asking.
