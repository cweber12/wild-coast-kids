# Plan: one command that runs every gate

> **Historical.** Planned 2026-08-11, shipped in PR #1 on 2026-08-11.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

Status: agreed 2026-08-11.

## The problem, from the point of view of someone working here

CLAUDE.md tells you to run the gate command before committing any slice, and to
paste its output into the PR body. That command does not exist. Its placeholder
in CLAUDE.md is still unfilled, and the file's own instruction for that case is
to stop and ask rather than invent one.

What exists today is three separate commands — `npm run lint`, `npx tsc
--noEmit`, `npm run build` — that a person has to remember, run in the right
order, and interpret individually. There is no test runner at all, so "every
slice that changes behavior ships with its own test" is currently impossible to
comply with. There is no format check, so formatting drifts silently.

The practical cost: every rule in CLAUDE.md that depends on verification is
unenforceable, and the first person to skip a check will not be noticed.

## The solution

One command, `npm run gate`, that runs every gate, prints a row per gate, prints
the failing gate's own output, and exits non-zero if any gate fails, if a gate
declared MUST FAIL passes, or if coverage drops below the floor. CI runs the
same command, so local and CI cannot disagree about what "green" means.

The gate set lives in a table in code, not in prose. Adding a gate is adding a
row. Prose cannot be run, so nothing notices when prose drifts.

## Implementation decisions

**The table is data; the verdict is a pure function.** `scripts/gates.mjs` holds
an array of gate descriptors (`name`, `command`, `mustFail`, `skip`). A separate
pure function takes the collected results and returns the exit code and the rows
to print. It does not spawn anything.

**Gates that a fresh clone cannot run are declared and skipped by default**, per
CLAUDE.md, rather than omitted. A skipped gate prints as skipped. Nothing fails
silently.

**Coverage floor ratchets from actual.** The floor is set to whatever the repo
genuinely achieves once the first tests land, and is only ever raised. A floor
invented ahead of the code either asserts nothing or blocks the first real
commit, and a floor that blocks gets lowered under pressure — which is worse
than no floor, because it looks like a gate while having been negotiated away.

**Prettier lands in its own slice.** Introducing it reformats the whole repo.
Mixed into a behavioral commit, that diff would bury the behavior change and
destroy the revert/bisect property that one-slice-one-commit exists to create.

## Test seams

Agreed before starting, per CLAUDE.md.

The seam is the split between _deciding_ and _spawning_. The gate runner's real
logic is: given a set of results, what is the exit code and what gets printed?
That is pure and gets unit-tested directly — including the two cases most likely
to be wrong and least likely to be exercised by accident:

- a gate declared MUST FAIL that _passed_ must fail the run;
- a skipped gate must not count as a pass.

Neither can be tested by running the real gates, because the real gates are all
expected to pass. Putting the seam at the pure function means these are ordinary
unit tests instead of elaborate process fakes.

The subprocess layer stays deliberately thin — spawn, capture, record exit code
— because everything in it is untestable without faking the OS.

Component rendering is tested through the public route component, not through
internal helpers, so the tests survive refactors of the internals.

## Slices, in order

Each leaves the repo working and the gates passing.

1. **Vitest and a first rendering test.** Yields a working `npm test`.
   Blocks 2 — the gate runner's own tests need a runner to exist.
2. **The gate runner.** `scripts/gates.mjs` and `npm run gate`, with rows for
   lint, typecheck, test and build, plus unit tests for the pure verdict
   function. Blocks 3, 4, 5 — they all add rows to a table that must exist.
3. **The coverage floor**, wired into the runner via `@vitest/coverage-v8`.
4. **Prettier and the format row.**
5. **CI running `npm run gate`.** Last, because it should run the finished gate
   set rather than be amended five times.

## Considered and rejected

**Jest instead of Vitest.** Also officially documented for Next.js, via
`next/jest`, and more mature. Rejected because Vitest is faster, ESM-native
(this repo is ESM throughout — `eslint.config.mjs`, `postcss.config.mjs`), and
needs no transform configuration to run the same TypeScript the app already
compiles. Jest's ESM story would be ongoing config friction for no benefit here.
Both share the async-Server-Component limitation below, so that constraint did
not distinguish them. See `docs/adr/0001-test-runner.md`.

**`node:test` with zero new dependencies.** Genuinely attractive — Node 22 has
it built in. Rejected because it has no JSX transform and no DOM, so every React
component test would need a hand-rolled setup that duplicates what Vitest
provides. The dependency saved is smaller than the bespoke harness bought.

**Chaining npm scripts (`lint && tsc && test && build`).** Rejected because it
cannot satisfy the requirements: `&&` stops at the first failure, so you learn
about one broken gate per run instead of all of them; there is no way to express
MUST FAIL; there is no way to declare a gate as skipped-but-present; and the
gate set ends up as an unreadable string in `package.json` rather than a table.
See `docs/adr/0002-gate-runner-in-node.md`.

**A task runner (Turbo, Nx, just).** Rejected as a dependency and a concept for
a problem that a single readable script solves. Revisit if this becomes a
monorepo.

## Out of scope

- **Playwright and any E2E test.** This is a real, known gap, not an oversight:
  the bundled Next.js 16 docs state that Vitest cannot test `async` Server
  Components and recommend E2E for them. Today's `page.tsx` is a _synchronous_
  Server Component, so it is testable now. **The first `async` page or layout
  in this repo will be untestable by the gate as designed** — at that point,
  adding Playwright is the next plan, not an afterthought.
- Any product feature. This plan adds no user-facing behavior.
- Filling the remaining CLAUDE.md placeholders. A follow-up once the gate has a
  name.
- Deployment and preview environments.

## Addenda

<!-- Dated entries when the plan changes. Never rewrite the above. -->

### 2026-08-11 — a sixth slice, forced by CI

The plan had five slices. CI added a sixth on the first run.

The gate passed locally and failed in CI on `tsc` not finding `LayoutProps`.
That global is emitted by Next.js into `.next/types`, which `tsconfig.json`
includes; it existed on this machine only because a build had already run.
Because the table runs typecheck before build, a fresh clone typechecks against
generated types that are absent — so the error was invisible to anyone who had
ever run the app, and visible only to CI and to a new clone.

The fix is `next typegen && tsc --noEmit`, the documented way to emit those
types without a full build. Reordering the table so build runs first was
rejected: it would fix the symptom by relying on an ordering constraint that no
row in the table states, and the next gate added in the wrong position would
bring the bug back.

Worth recording because it validates the reason CI runs the same command: the
divergence was not caught by any amount of local running, and could not have
been.
