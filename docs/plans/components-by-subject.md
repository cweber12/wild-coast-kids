# Group components by subject

## Problem, from the user's point of view

The user here is the next person to open this repository, and increasingly the
next agent to be handed one of its issues.

`src/components/` is a single flat directory holding 85 files — 45 modules and
40 co-located tests. Nothing in the directory says which files belong together,
so every question about a component starts with a grep.

Three costs, in order of how often they are paid:

1. **The conditions tool is invisible as a unit.** Twenty-two modules form one
   subsystem — the section, the beach selector, the notes and caveats, the today
   and week panels, their readings, and four helpers. Alphabetical order
   interleaves them with the nav, the placeholder and the gallery.
2. **Blast radius is invisible.** "What breaks if I change the pill?" and "what
   breaks if I change the quote stats?" have very different answers — four
   routes against one — and the directory gives no hint which is which.
3. **Agents burn context finding the right files.** An agent asked to work on
   the conditions tool scans 85 filenames to find the 41 that matter, and cannot
   tell from the names which 41 those are.

The directory grew 39% in the six days issue #116 sat open, and 22 of the 24
files added were conditions. This gets worse monotonically and the cost of
fixing it scales with the file count.

## Solution

Group modules by **subject**, not by route, and only where a cluster has earned
a directory. Three directories, and the root as the default for everything else.
The binding form of this — the layout, the `ui/` membership rule and the
root-is-the-default rule — is
[`docs/adr/0018-components-grouped-by-subject.md`](../adr/0018-components-grouped-by-subject.md),
which is the file kept current. This one records what was decided on the way in.

No module's behaviour changes. Every file moves with its co-located test.

## The evidence the clusters are real

Measured on `main` at `a1edf43`, 2026-08-26. Of **105** relative imports inside
`src/components/`, **91 stay inside a bucket** and **14 cross a boundary**. All
fourteen point into `ui/`:

| From       | To  | Count |
| ---------- | --- | ----- |
| root       | ui  | 7     |
| conditions | ui  | 5     |
| layout     | ui  | 2     |

Zero crossings between `conditions/`, `layout/` and the root in any direction,
and `ui/` has no outbound crossings at all. The layout is a strict layering with
`ui/` as its single sink. Exactly one test file crosses a boundary
(`BeachSelector.test.tsx` → `ui/touchTarget`), and it crosses into the sink like
everything else.

This names a structure that already exists rather than imposing a new one.

## Implementation decisions

- **Moves are pure renames.** Every file moves with `git mv`; content changes
  only where an import specifier must. Nothing is reformatted, split or merged
  in the same commit, with the single explicitly separate exception of the
  `ConditionsTeaser` rename.

- **The import convention is unchanged.** Components import each other
  relatively; everything outside `src/components` imports through `@/`. Nesting
  makes some relative specifiers reach up one level (`../ui/…`). Switching
  intra-component imports to the alias was considered and rejected: it is a
  convention change, and it belongs to its own slice with its own justification
  rather than smuggled into a move.

- **`ui/` moves first.** It is the sole sink of the dependency graph, so moving
  it first flushes out every cross-boundary import while the rest of the tree is
  still where it was.

- **`touchTarget` joins `ui/`.** It is presentational, imports nothing from
  `src/lib`, names nothing about the program, the session, the interest list or
  the conditions, and is consumed by all three directories — the most
  cross-cutting shape in the repo. Leaving it at the root would have made the
  root a shared-utility bucket, contradicting the rule that the root is where
  things live until a cluster earns a directory.

- **`Conditions.tsx` is renamed to `ConditionsTeaser.tsx`.** After the move
  there would be a file named `Conditions.tsx` sitting directly beside a
  directory named `conditions/` that does not contain it — worse than the status
  quo, where the two are merely adjacent alphabetically, and this move is what
  creates it. `ConditionsTeaser` matches the glossary's existing **Teaser** term.
  Renaming anything else stays out of scope.

- **The rules go in the ADR, not `CONTEXT.md`.** Below its title `CONTEXT.md`
  has one section heading — `## Language` — and eighteen `**Term**:` entries. It
  is a glossary; layout rules are decisions. `CONTEXT.md` gets one line inside
  its existing **Conditions** entry naming the subsystem's directory, which is
  the same thing **Observation station**, **Crop** and **Session** already do
  for theirs.

- **Stale documentation is pointed at, not rewritten.** About 25 path mentions
  across 16 modules in `docs/plans/`, `docs/adr/` and `.design/` name a module
  that moves. A pointer is scale-invariant where a rewrite would not be, and
  `docs/plans/README.md` already forbids editing a shipped plan. The ADR's
  consequences say that component paths written before it predate the move; that
  is the same remedy `CONTEXT.md`'s **Observation station** entry already uses
  for the `weather-stations.json` rename.

### The vi.mock strings are the hazard

Eight `vi.mock` calls name a moved module by path. They are strings, so the type
checker cannot see them. Four live in the conditions route tests and — the ones
that are easy to miss — four live in `src/components/ConditionsSection.test.tsx`,
which mocks its sibling panels through the alias even though they will share a
directory. A missed string either throws or, worse, resolves to the real module
and the test silently stops asserting what it claims to. The check is a grep for
zero remaining matches, and its output goes in the PR body.

## Test seams

The property that matters is that **the shipped site is unaffected by a change
that only moves files.** No new test asserts a directory exists — that tests the
implementation, and the type checker already fails if a path is wrong.

The single gate command is the seam, and it is already the highest one
available:

- **typecheck** catches every broken import specifier. Primary seam.
- **build** catches anything the type checker resolves and the bundler does not.
- **test with coverage floor** catches a test file that silently stopped being
  collected. The floor is global and pinned to two decimal places, so a pure
  move must leave it identical. It must not be adjusted here: a move that
  changes coverage means something was lost.
- **stylesheet** turns "`@source "../../src"` names a directory, so
  subdirectories should stay scanned" into evidence. The built stylesheet is
  hashed before and after.
- **adr-numbers** asserts the new ADR's number is the next free one.

Two checks the gate cannot make go in the PR body rather than into code: the
`vi.mock` grep above, and `git diff --stat -M`, which is the evidence a reviewer
most needs for "these are all pure renames".

## Slices

1. This plan file and ADR-0018.
2. `ui/` — five modules, 9 files. First, because it is the sink.
3. `layout/` — three modules, 6 files.
4. `conditions/` — twenty-two modules, 41 files, including the eight `vi.mock`
   string updates.
5. Rename `Conditions.tsx` → `ConditionsTeaser.tsx`.
6. The `CONTEXT.md` line.

Six slices is one past the repo's ~5-slice reviewability guide. Both of the last
two are small and neither can be dropped without shipping a state already known
to read wrong, so the guide is knowingly exceeded rather than overlooked. If a
reviewer would rather split, the boundary is after slice 4.

**One branch, no issue split.** The repo's test for splitting is whether two
people could take two slices without colliding. They could not — every slice
touches import paths.

## Considered and rejected

**Mirroring `src/app/`.** Rejected on evidence, re-checked 2026-08-26:

- `art/`, `book/`, `coop/` and `community/` would be **empty**. No component is
  exclusive to those routes; their pages compose `PillLink`, `Placeholder`,
  `SessionSchedule`, `ReservedSlot` and `InterestListForm`, all shared.
- The largest cluster has **no route directory to mirror**. The landing page is
  `src/app/page.tsx`, a file at the root of `src/app/`, not a directory.
- Routes move; subjects do not. This IA has already been reorganised once, and
  reparenting a route would rename every mirrored directory for no semantic
  reason.

**Seven directories rather than three** — adding `home/`, `home/gallery/`,
`sessions/` and `interest-list/`. Deferred, not abandoned. Those four are where
the judgement calls live: `home/` groups files whose only shared property is
that the landing page composes them, it churns wholesale on a redesign, and it
would force the landing teaser into `home/` while the conditions page's own
section sits in `conditions/`. `sessions/` would hold a single component. The
trigger for reconsidering is the landing page's shape settling; it has not
fired.

Deferring costs a root directory that looks half-organised. The
root-is-the-default rule is what answers that, and it is in the ADR because it
is the part that has to stay true.

**A gate row enforcing `ui/` membership.** Prose cannot enforce a closed list.
A gate row could, and is a candidate follow-up — that `touchTarget` was assigned
wrongly in the issue's own first draft is some evidence it would earn its keep.
Out of scope here because it is a new gate, not a move.

**Rewriting the stale paths in `docs/` and `.design/`.** Rejected: the repo's
own rule is that a shipped plan is a dated record and is not edited again, and
ADRs and design reviews are equally records of what was decided when.

## Out of scope

- Renaming anything other than `Conditions.tsx`.
- The four deferred directories.
- Changing the import convention from relative-within to alias-within.
- A gate row enforcing `ui/` membership.
- Adding the missing test for `Hero.tsx`, or direct tests for `cardText`,
  `disclosure`, `headingRank` and `touchTarget`. Those gaps predate this work.
- Any behaviour, styling, copy or accessibility change whatsoever.
- Moving anything outside `src/components/`. `src/lib`, `src/data` and `src/app`
  are untouched apart from import specifiers.
