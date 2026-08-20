# A gate that each ADR number names one decision (issue #109)

Date: 2026-08-20.

## Problem, from the user's point of view

Two unrelated decisions were both filed as ADR-0008 — where the gallery's
paging controls sit (17 Aug) and how the site reads Supabase (18 Aug). For two
days the number that decisions are cited by pointed at two documents, and the
fourteen bare `ADR-0008` references in the repo were indistinguishable. Three
test files carry a comment about keeping ADR-0008 from being undone; someone
following one had a 5-in-14 chance of opening the wrong document. Fixed in
#102 by renumbering the Supabase ADR to 0013.

Nothing stops the next one. The evidence that this is structural rather than
bad luck:

- Both halves were written in the same week, by an agent, on separate
  branches. A number is chosen by looking at `docs/adr/`, and two branches open
  at once see the same highest number. Neither branch could observe the other.
- `npm run gate` passed for the entire two days the duplicate existed. The
  gate had nothing to say about it, so CI could not be the thing that noticed.
- It was found by a manual audit a day later. That is the only reason it was
  found at all.

A collision is cheapest to fix in the hour it is created and most expensive
once citations accumulate — #102 touched seven files to undo two days of it.

## Decision

A `adr-numbers` gate row asserting that every ADR is identified by exactly one
number. Three properties, one verdict:

1. **Every file in `docs/adr/` is named `NNNN-slug.md`.** The directory is a
   numbered series; a file in it without a number is either a mistake or a
   decision nobody made.
2. **No number appears twice.** The #102 regression.
3. **Each file's `# NNNN` heading declares its own number.** See below.

The failure names both files and the number they share, because the fix
requires knowing which two documents collided.

The gate reports; it never edits. Renumbering rewrites citations across the
repo and the choice of which document moves is a judgement — #102 moved
Supabase because the gallery had the number first. `docs/adr/` is an input
here, and CLAUDE.md's read-only rule applies.

### The heading is checked too

#109 left this open. It is included.

During #102 the file was renamed and its `# 0008 —` heading edited by hand as
a separate step. A filename-only check passes a document that has been renamed
but still announces itself as 0008 — the same class of defect, a number naming
the wrong thing, and the heading is what a reader sees first.

The match is on the number alone (`^#\s*(\d{4})`), not the separator or the
title. All thirteen ADRs today read `# NNNN — Title`, but pinning the em-dash
would make the gate a style rule and fail an ordinary title edit. The number
is the part that must agree; the prose is not the gate's business.

### Test seams

The split ADR-0002 established, and that `built-css.mjs` / `check-built-css.mjs`
already follow: the part that can be wrong is pure and unit-tested, the part
that touches the filesystem is thin.

- `adrNumber(filename)`, `headingNumber(text)` — pure parsers, called directly.
- `auditAdrs(entries)` — the verdict, over a list of `{ file, number, heading }`.
  Every failure mode is reachable from a literal array, so the duplicate case
  is tested without a duplicate existing in the tree.
- `readAdrs(root)`, `checkAdrNumbers(root)` — the filesystem walk, tested
  against a temp directory as `built-css.test.mjs` does, so the walk is
  exercised for real rather than mocked.
- `scripts/check-adr-numbers.mjs` — entry plumbing only, deliberately
  untested, and named as such in the coverage note below.

The regression test for #102 is `auditAdrs` rejecting two files that share a
number. A `mustFail` gate row cannot serve here: `mustFail` runs a command, and
there is no duplicate left in the tree for it to fail on. Manufacturing one to
satisfy the mechanism would mean committing the bug back.

### Considered and rejected

- **Leave it to review.** This is what happened. Both halves of #102 were
  reviewed and merged; neither reviewer could see the other branch.
- **A script that renumbers automatically.** It would have to rewrite citations
  in seven files and pick which document moves. Both are judgement, and a gate
  that edits its own input violates the read-only rule.
- **Check the filename only.** Cheaper by three lines, and passes exactly the
  stale-heading state #102 had to fix by hand.
- **Also assert the slug matches the title.** Titles are prose and get edited;
  slugs are stable because renaming a file breaks links. Coupling them would
  fail the gate on ordinary copy edits and teach people to work around it.
- **Number `docs/plans/` too.** Plans are not cited by number — they are cited
  by filename, and nothing in the repo refers to "plan 0007". There is no
  collision to prevent.

## Coverage

`vitest.config.mts` includes `scripts/**/*.mjs`, so both new files count.
`check-adr-numbers.mjs` sits at 0% by design, joining `run-gates.mjs`,
`run-vitest.mjs`, `check-built-css.mjs` and `check-db.mjs`. That grows the
untested denominator, which is reason 1 of the two the config admits. The floor
is re-derived from what the run actually achieves and the commit names the
uncovered statements.

## Out of scope

- Renumbering anything. #102 did that; every number is unique today.
- Any check on ADR content, status, or date.
- The `ADR-0008` references in commit messages and closed pull requests that
  mean Supabase. Those cannot be rewritten; the note in the date line of
  `0013-supabase-reads-over-plain-fetch.md` is the whole mitigation.

## Slices

| #   | Slice                | Delivers                                                                                                  |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| 0   | Write this plan down | This file                                                                                                 |
| 1   | The gate             | `adr-numbers.mjs`, `check-adr-numbers.mjs`, `adr-numbers.test.mjs`, the `gates.mjs` row, floor re-derived |
