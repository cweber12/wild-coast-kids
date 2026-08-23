# Plan: keep the gates inside this checkout

> **Historical.** Planned 2026-08-14, shipped in PR #34 on 2026-08-14.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

Status: agreed 2026-08-14. Issues #31 and #29 (the same defect, filed twice).

## The problem, from the point of view of someone working here

Concurrent agent sessions create git worktrees at `.claude/worktrees/<id>/`.
Each one is a full second copy of the repo, checked out on a **different
branch**, living inside this checkout. `.claude/` is not in `.gitignore`, and
none of the gate tooling is scoped to the tree it is supposed to be judging, so
most of the gates walk into those copies and report on code that is not on this
branch.

`npm run gate` therefore goes red — or, worse, ships wrong output — depending on
whether an unrelated agent happens to have a worktree open. CI on a fresh clone
has no worktrees and is unaffected, so local and CI disagree. CLAUDE.md says that
divergence is the first bug to fix, and it is the same failure mode as #4: a gate
that fails for reasons unrelated to the tree teaches people to re-run until
green.

The build half is not merely noisy, it **ships**. Tailwind's automatic source
detection scans every non-gitignored file, so class names from an unmerged
branch compile into this branch's stylesheet. #31's reporter found two utilities
deleted on `issue-18-nav-touch-targets` still present in the production CSS,
emitted from two worktree copies of `Nav.tsx`. That is the same defect class as
#15 (`docs/`, `.design/`) and #24 (root Markdown), except that a worktree can
contribute class names that exist on no branch anyone is looking at. It also
defeats the `stylesheet` row that #23 added, whose whole premise is that
presence in the built CSS means the app uses it.

## What was actually measured

Both issues propose a fix without establishing which gates the fix reaches. It
was reproduced before planning: a worktree was created at
`.claude/worktrees/repro-31` on `issue-25-ia-routed-structure`, a probe file
planted inside it, and every gate run with and without `/.claude/` in
`.gitignore`.

| Gate                | Walks into `.claude/`?                                | Fixed by `.gitignore` alone? |
| ------------------- | ----------------------------------------------------- | ---------------------------- |
| `format` (prettier) | yes — flagged the probe's bad formatting              | **yes**                      |
| `lint` (eslint)     | yes — flagged the probe's unused disable directive    | **no**                       |
| `typecheck` (tsc)   | **no**                                                | n/a                          |
| `test` (vitest)     | yes — 51 test files collected where the repo has 25   | **no**                       |
| `build` (tailwind)  | yes — the probe's `rotate-45` landed in the built CSS | **yes**                      |
| `stylesheet`        | no — reads `.next/` only                              | n/a                          |

Two claims in the issues are wrong, and both would have produced a fix that
looked complete and was not:

- **#31: "vitest can then be left alone."** Vitest does not read `.gitignore`.
  With `/.claude/` ignored it still collected 51 files. ESLint's flat config
  does not read `.gitignore` either — it kept reporting the probe, and it also
  reports `coverage/`, which has been gitignored all along.
- **#29: "`typecheck` passes only by luck."** TypeScript's wildcard `include`
  excludes dot-directories by design. A type error planted in
  `.claude/worktrees/repro-31/probe/bad.ts` was not reported; the identical
  error at the repo root was. `typecheck` is not affected and is not touched.

One trap worth recording, because it will mislead the next person who verifies
the Tailwind half: the first rebuild after adding the ignore rule **still
contained the leaked class**. That was Next's build cache. `.next/` has to be
removed before the stylesheet reflects a source-detection change.

## The solution

Three independent one-line scopings, one per tool that was measured to descend:

1. `/.claude/` in `.gitignore` — settles `format` and `build`.
2. `**/.claude/**` added to vitest's `test.exclude` — settles `test`.
3. `.claude/**` added to eslint's existing `globalIgnores` — settles `lint`.

Each names the same directory in the vocabulary its own tool understands.

## Implementation decisions

**`/.claude/`, not `/.claude/worktrees/`.** Nothing under `.claude/` is tracked
(`git ls-files .claude` is empty), and the harness writes local session state
and `settings.local.json` there too — all of it equally feeds prettier and
Tailwind. The narrower rule would name only the symptom that happened to be
observed. If something under `.claude/` ever needs tracking, a `!` negation is
one line and the reason for it will be explicit.

**Three one-liners, not a shared module.** A `scripts/gate-scope.mjs` exporting
the pattern to all three consumers was considered and rejected: three strings in
three different glob dialects do not deduplicate cleanly, the module would be
indirection with no logic in it, and it would be a new abstraction that outlives
the task — so it would need an ADR to justify a constant. The drift risk it
guards against is covered instead by the tests below, which assert each tool's
own answer rather than the text of any config.

**`exclude` extends `configDefaults.exclude`, it does not replace it.** Setting
`test.exclude` overrides vitest's defaults wholesale, and the default is
`["**/node_modules/**", "**/.git/**"]`. Dropping that while fixing this would
trade one class of foreign test files for another. The spread is the part of
this change most likely to be broken by a later edit, so it is what the test
pins.

**No new dependency, no ADR.** Nothing here is a decision that outlives the
task; it is three configs being told what tree they are judging.

## Test seams

The seam is each tool's own ignore decision. Nothing here asserts the text of a
config file — a test that reads `.gitignore` looking for a line passes just as
happily when the line has stopped working. All three ask the tool:

- **git:** `git check-ignore --quiet <path>` on an agent-worktree path exits 0.
  This is the mechanism prettier and Tailwind both read, so it covers `format`
  and `build` through the thing they actually consult. Rule-based, so it needs
  no fixture on disk.
- **vitest:** plant a `probe.test.ts` under `.claude/`, spawn
  `node scripts/run-vitest.mjs list --filesOnly`, assert the probe is absent —
  and assert a known real test file is present, so the check cannot pass by
  listing nothing. `list` collects without running, so it costs about a second.
- **eslint:** `new ESLint().isPathIgnored()` returns true for a worktree path
  and false for a file under `src/`, again two-sided.

They live in one new file, `scripts/gate-scope.test.mjs`, grown one block per
slice.

**The vitest test writes into `.claude/`, which is otherwise the harness's
territory.** It is the only place the property can be asserted — a probe
anywhere else proves nothing about this defect. It goes in a uniquely named
directory removed in a `finally`, and it is planted directly under `.claude/`
rather than inside `.claude/worktrees/`, so it can never be mistaken for, or
collide with, a real worktree.

**Nothing in `scripts/` may spell a Tailwind utility.** `built-css.test.mjs`
enforces this and the addendum to `docs/plans/assert-built-stylesheet.md`
explains why: this directory feeds the scanner. The probe fixture is named for
what it is and carries no class names.

## Slices

1. **The plan.** This file.
2. **Ignore `/.claude/` in git**, with the `git check-ignore` test.
3. **Scope vitest's discovery to this checkout**, with the `vitest list` test.
4. **Scope eslint to this checkout**, with the `isPathIgnored` test.
5. **The coverage floor**, if slices 2–4 move it. Same reasoning as the third
   slice of `assert-built-stylesheet.md`: the floor is what the repo achieves
   today, and raising it is its own change.

Slices 2–4 are independent of each other; the order is the order the gate table
runs in.

## Considered and rejected

**`.gitignore` alone, as #31 suggests.** Measured above: it leaves `lint` and
`test` broken. It is a necessary third of the fix, not the whole one.

**Positive scoping — pointing each tool at `src/` and `scripts/` — as #29
suggests.** Genuinely narrower, and it would not need revisiting when the next
tool starts writing into the repo. Rejected for eslint, which is where it breaks
down: flat config has no single positive root, so it would mean attaching
`files` to every block inherited from `eslint-config-next` and re-attaching them
whenever that preset changes. Doing it for vitest but not eslint would leave two
tools scoped in opposite directions for no reason a reader could recover.
`@source "../../src"` for Tailwind is the same idea and belongs to #24, which
already owns it.

**A `mustFail` gate row that creates a worktree and expects the gate to go red.**
The only way to prove the whole gate set is scoped rather than three tools
individually. Rejected: it means creating and destroying git worktrees during a
gate run, on CI, for a property three cheap tests already cover from the inside.

**Deleting or relocating the worktrees.** #31 says explicitly not to; at least
one was locked and in use. The harness's placement is not this repo's to change.

## Out of scope

- **`typecheck`.** Measured as unaffected. Adding a `.claude` exclusion to
  `tsconfig.json` would be a change with no failure behind it.
- **`src/app/globals.css`.** The `@source not` lines are untouched. Inverting
  them to a positive `@source` is #24.
- **`coverage/` being linted.** `npx eslint` reports one warning from
  `coverage/block-navigation.js` today, because eslint does not read
  `.gitignore`. Real, pre-existing, and a different directory with a different
  reason; it does not fail the gate (warnings exit 0). Filed separately rather
  than folded in here.
- **The agent harness's choice to put worktrees inside the repo.** Not this
  repo's decision.

## Addenda

<!-- Dated entries when the plan changes. Never rewrite the above. -->

### 2026-08-14 — slice 5 did not fire, and the whole thing was run end to end

**The coverage floor did not move.** Slice 5 was conditional and the condition
never arose: coverage after all three scopings is 78.94 / 81.81 / 89.06 / 79.88,
identical to before. `coverage.include` covers `scripts/**/*.mjs`, so a new file
there looked like it would shift the ratio, but vitest excludes test files from
instrumentation by default and this change adds no source. No slice, no commit.

**The three tests pass individually against a synthetic probe; the gate was
also run against the real thing.** A worktree was created at
`.claude/worktrees/verify-31` on `issue-25-ia-routed-structure` — the same
condition #31 and #29 were filed under — and given a badly formatted file, a
file with a lint error, and a component using `rotate-45`, a utility no file in
this checkout mentions. With `.next/` removed first, so the build cache could
not hide the Tailwind half:

- all six gate rows PASS;
- the built stylesheet contains no `.rotate-45` rule;
- vitest collects 27 files, every one of them under `src/` or `scripts/`.

The 27 is worth writing down because it contradicts the issues' arithmetic:
they say the repo has 25 test files. It had 26 by the time this branch was cut
(#32 and #33 merged in between), and this branch adds `gate-scope.test.mjs`.
