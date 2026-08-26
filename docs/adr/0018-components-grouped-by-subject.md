# 0018 — Components are grouped by subject, and the root is the default

Date: 2026-08-26. Status: accepted.

## Context

`src/components/` was one flat directory of 85 files — 45 modules and 40
co-located tests. Alphabetical order was the only structure, so the conditions
tool's twenty-two modules were interleaved with the nav, the placeholder and the
gallery, and nothing but reading the imports said where the subsystem started or
stopped.

The imports already said it. Measured on `main` at `a1edf43`: of 105 relative
imports inside `src/components/`, 91 stayed inside one of three clusters and 14
crossed a boundary — every one of them pointing into the same cluster of
reusable shapes. There were zero crossings between the other clusters in any
direction. The structure existed; the directory did not name it.

## Decision

**Components are grouped by subject, and a directory exists when a cluster has
earned one. The root is where a module lives until then.**

- **`src/components/conditions/`** — the conditions tool: the section, the beach
  selector, the notes and caveats, the today and week panels, their readings,
  and the helpers `cardText`, `disclosure`, `headingRank` and `mopLine`.

- **`src/components/ui/`** — the site's reusable shapes, in the glossary's own
  words: `PillLink`, `Placeholder`, `ReservedSlot`, `SnapSection`, `touchTarget`.
  **A closed list of five. Adding a sixth is a decision, not a default.** A `ui/`
  module is presentational, imports nothing from `src/lib`, and names nothing
  about the program, the session, the interest list or the conditions.

- **`src/components/layout/`** — the chrome the root layout renders on every
  route: `Nav`, `NavLink`, `Footer`.

- **The root** — everything else. A loose file there is the deliberate default,
  not an oversight. It moves into a directory when a cluster around it has
  earned one, and not before.

`ui/` is the single sink of the dependency graph: every cross-directory import
points into it, and it imports out of nothing. Each module keeps its co-located
test beside it.

Grouping is **by subject, not by route**. Components import each other
relatively; everything outside `src/components` imports through the `@/` alias.
Neither of those changed.

## Alternatives considered

**Mirror `src/app/`.** Rejected on evidence. `art/`, `book/`, `coop/` and
`community/` would be empty — no component is exclusive to those routes. The
largest cluster has no route directory to mirror at all, because the landing
page is `src/app/page.tsx`, a file rather than a directory. And routes move
where subjects do not: this IA has already been reorganised once, and
reparenting a route would rename every mirrored directory for no semantic
reason.

**Seven directories rather than three**, adding `home/`, `home/gallery/`,
`sessions/` and `interest-list/`. Deferred, with a trigger: the landing page's
shape settling. `home/` would group files whose only shared property is that the
landing page composes them, it churns wholesale on a redesign, and it would put
the landing teaser in `home/` while the conditions page's own section sat in
`conditions/`. `sessions/` would hold one component. The root-is-the-default
rule above is what makes the half-organised result read as a decision.

**A gate row asserting `ui/` membership.** Prose cannot enforce a closed list,
and a gate could. Deliberately not built here — it is a new gate, not a move —
but it is a live candidate, and that `touchTarget` was assigned to the root in
this decision's own first draft is some evidence it would earn its keep.

## Consequences

- **`ui/` is a closed list, and prose is all that holds it closed.** The next
  module that looks reusable is a decision to make against the rule above, in
  the open, rather than a file to drop in.

- **A file at the root means "no cluster yet", not "not yet sorted".** Anyone
  tidying the root into directories for its own sake is working against this
  decision, not finishing it.

- **Component paths written before this date are stale everywhere they appear.**
  About 25 mentions across 16 modules in `docs/plans/`, `docs/adr/` and
  `.design/` name a module at its old path, and
  `.design/wild-coast-kids-landing/DESIGN_REVIEW-2026-08-11.md` already named a
  component that had been renamed before this. Those files are dated records and
  are not edited to match — `docs/plans/README.md` says why. A path in them that
  resolves to nothing is expected, and this ADR is where the move is recorded.

- **`Conditions.tsx` became `ConditionsTeaser.tsx`.** The move would otherwise
  have left a file named `Conditions.tsx` beside a directory named `conditions/`
  that did not contain it. `ConditionsTeaser` matches the glossary's **Teaser**
  term.

- **Nothing about the shipped site changed.** The whole value is in how quickly
  the next reader finds the right file.
