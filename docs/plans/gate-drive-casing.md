# Gate hardening: normalize the cwd drive-letter casing (issue #4)

> **Historical.** Planned 2026-08-12, shipped in PR #6 on 2026-08-12.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

Date: 2026-08-12.

## Problem, from the user's point of view

`npm run gate` sometimes fails on the test gate with every vitest suite dead at
boot — zero tests run, and an error at `vitest.setup.ts:6` claiming `"vitest"
is imported directly without running "vitest" command`. Re-running with an
unchanged tree passes. A gate that fails for reasons unrelated to the tree
teaches people to re-run until green, which is the end of the gate meaning
anything.

## Diagnosis (evidence, not theory)

- 10/10 runs launched with a cwd of `c:\Projects\...` (lowercase drive) failed
  with the exact symptom; 10/10 runs with `C:\Projects\...` passed. A
  controlled experiment — same command, same tree, only the spawn `cwd`
  differing in drive-letter case — reproduced fail/pass deterministically.
- Coverage mode is not a factor: plain `vitest run` fails identically under a
  lowercase-drive cwd.
- Mechanism: Node's ESM loader keys its module cache by file URL.
  `file:///c:/...` and `file:///C:/...` are different keys, so the worker loads
  a second copy of `@vitest/runner`; the setup file's `afterEach` registers
  against the copy that holds no suite state, which is precisely the error
  vitest prints.
- The "intermittency" is which terminal launched the gate. Some shells and
  agent harnesses put a lowercase drive letter in `process.cwd()`; most put
  uppercase. Nothing about the tree, timing, or cache was ever involved. The
  ~14s "environment" figure in the failing output is vitest summing jsdom boot
  across 12 files and was a red herring.

## Decision

Normalize the drive-letter casing of the cwd that `scripts/run-gates.mjs`
passes to every gate subprocess:

- `normalizeDriveCasing(path)` — pure, in `scripts/gates.mjs`, unit-tested.
  Uppercases a leading `[a-z]:` and touches nothing else.
- `run-gates.mjs` passes `cwd: normalizeDriveCasing(process.cwd())` in the
  existing `spawn` options. This edits an existing statement rather than
  adding new untested plumbing, so the deliberately-untested surface of
  `run-gates.mjs` (ADR 0002) does not grow and the coverage floor is not
  eroded by the fix.

### Considered and rejected

- **Normalize `root` in `vitest.config.mts`.** Tested; insufficient. The
  config file and worker module URLs still derive from the process cwd — the
  failure reproduces with `root` normalized.
- **`fs.realpathSync.native(process.cwd())`** — canonicalizes the whole path,
  covering casing drift beyond the drive letter. Rejected because gates.mjs is
  the filesystem-free tested seam ("nothing in this file spawns a process or
  touches the filesystem"), so realpath could only live untested in
  run-gates.mjs. The observed failure class is the drive letter; the broader
  class is noted in issue #5, not speculatively engineered here.
- **A vitest wrapper script for all test npm scripts.** Fixes `npm run test`
  from a lowercase shell too, but is new untested plumbing with a coverage
  floor interaction. Split off as issue #5.

## Test seams

- `scripts/gates.test.mjs` unit-tests `normalizeDriveCasing`: lowercase drive
  uppercased, uppercase left alone, POSIX paths left alone, non-drive path
  segments untouched. These are the regression tests, at the seam the repo
  already trusts for gate logic.
- The end-to-end property — "the gate passes when launched from a
  lowercase-drive shell" — has no cheap automated seam: it needs a subprocess
  spawning the full gate suite (minutes) or a nested vitest-in-vitest run
  (slow, fragile under coverage). Per ADR 0002 the subprocess layer stays
  deliberately untested; the e2e verification is run manually and its output
  pasted into the PR.

## Out of scope

- Direct `npm run test` / `test:watch` / `test:coverage` from a
  lowercase-drive shell (issue #5).
- Path-casing mismatches beyond the drive letter (noted in issue #5).
- Reporting the underlying behavior upstream to vitest.

## Slices

1. This plan file.
2. `normalizeDriveCasing` in gates.mjs + unit tests + use in run-gates.mjs
   spawn options (one behavior change, tests in the same commit).
