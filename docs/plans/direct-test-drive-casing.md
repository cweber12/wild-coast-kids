# Direct test scripts: normalize the cwd drive-letter casing (issue #5)

Date: 2026-08-12.

## Problem, from the user's point of view

`npm run test`, `test:watch`, and `test:coverage` invoked from a shell whose
cwd has a lowercase drive letter (`c:\Projects\...`) fail with every vitest
suite dead at boot — the same failure #4 fixed for `npm run gate`. The gate is
safe because `scripts/run-gates.mjs` normalizes the cwd it spawns gates with,
but nothing normalizes the cwd on the direct path, so a developer or agent
running the test scripts by hand still hits it. Reproduced before this fix:
12/12 suites fail with `Vitest failed to find the current suite` at
`vitest.setup.ts:6`, exit code 1.

The mechanism is documented in `docs/plans/gate-drive-casing.md`: Node's ESM
loader keys its module cache by file URL, so a lowercase-drive cwd loads
`@vitest/runner` twice (`file:///c:/` vs `file:///C:/`) and the setup file's
`afterEach` registers against the copy with no suite state.

## Decision

Route all three test scripts through `scripts/run-vitest.mjs`, a thin wrapper
that normalizes the process cwd and then hands control to vitest **in the same
process**:

- `process.chdir(normalizeDriveCasing(process.cwd()))` — reuses the pure,
  already-tested function from `scripts/gates.mjs`. Runs before any vitest
  module loads, so the whole vitest graph (and the workers it spawns, which
  inherit the cwd) sees the normalized path.
- Then `await import(...)` of vitest's own bin entry, resolved from vitest's
  `package.json` `bin` field rather than a hardcoded path. In-process import
  keeps stdio, watch-mode interactivity, argument forwarding
  (`npm run test -- <filter>`), and the exit code native — no subprocess
  plumbing, no signal forwarding, no argument quoting.

The gate table keeps calling `npm run test:coverage`; the run-gates spawn
normalization and the wrapper normalization are idempotent together.

### Considered and rejected

- **`process.chdir` in `vitest.config.mts`.** Tested; does not work. Vitest
  captures the cwd before the config loads, so the workers still boot with the
  lowercase-drive module URLs. (Same family as the `root` normalization
  rejected in #4.)
- **A wrapper that spawns vitest as a child process** (the shape
  `run-gates.mjs` uses). Works, but needs stdio inheritance, exit-code
  plumbing, and argument joining under `shell: true` — more untested
  statements for the same behavior the in-process import gives for free.
- **`fs.realpathSync.native(process.cwd())` in the wrapper** — would
  canonicalize casing drift beyond the drive letter too. Rejected for the same
  conservatism as #4: realpath also resolves symlinks and junctions, so it can
  silently retarget the cwd, which is more than this fix should do. The only
  observed failure class is the drive letter; broader drift stays out of scope
  until observed.
- **Fixing it upstream in vitest.** Right long-term, useless now — the repo
  needs working test scripts before any upstream release lands. Noted in #5;
  not attempted here.

## Test seams

- The normalization logic is `normalizeDriveCasing`, already unit-tested in
  `scripts/gates.test.mjs` (#4). This slice adds no new decision logic — the
  wrapper is entry-point plumbing in the ADR-0002 sense: deliberately thin,
  deliberately untested, because faking the OS (a process cwd, a module
  cache) costs more than it returns.
- The end-to-end property — "`npm run test` passes from a lowercase-drive
  shell" — has the same seam economics as in #4: an automated version would
  nest a full vitest boot inside a vitest run under coverage (slow, fragile,
  and skipped everywhere but Windows). Per the precedent set there, it is
  verified manually before and after the fix and the output pasted into the
  PR.

## Coverage floor

`scripts/**/*.mjs` is in the coverage include set and nothing is excluded to
flatter the number, so the wrapper's handful of statements report as 0%
covered and pull the statement/line ratios down — this is the floor
interaction issue #5 predicted. Resolution: re-baseline the floor to the new
actuals in the same commit, and amend the config comment so the rule
distinguishes the two ways the number can fall. Coverage of _tested_ code must
never be eroded to make a commit pass; the _denominator growing_ because
deliberately-untested entry plumbing was added (per ADR 0002) is a different
event, and the commit doing it must name the statements and why they are
untested. This commit is the worked example.

## Out of scope

- Path-casing drift beyond the drive letter (never observed; see rejected
  realpath option above).
- Reporting the underlying double-load behavior upstream to vitest.
- Any change to the gate runner — #4's fix stands as-is.

## Slices

1. This plan file.
2. `scripts/run-vitest.mjs` + route `test`, `test:watch`, `test:coverage`
   through it + re-baseline the coverage floor (one behavior change; the floor
   move is a consequence of the same commit's new file).

## Addendum, 2026-08-12: the cwd is not the only leak

Implementing slice 2 showed the chdir alone does not fix the failure — the
12/12 boot deaths reproduced unchanged. The second leak: `require.resolve`
walks up from the wrapper's **own module URL**, which inherits the launching
shell's casing, so the vitest bin path — and with it vitest's entire module
graph — still loaded under `file:///c:/...` while the chdir'd cwd said `C:`.
The wrapper therefore normalizes both the cwd and the resolved bin path before
importing. Verified end-to-end after the change: `npm run test` and
`npm run test:coverage` both pass from a lowercase-drive cwd (12/12 suites, 37
tests), and both still fail-fast reproduced before it.
