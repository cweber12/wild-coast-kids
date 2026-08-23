# Plan: a gate row that asserts the built stylesheet

> **Historical.** Planned 2026-08-14, shipped in PR #32 on 2026-08-14.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

Status: agreed 2026-08-14. Issue #23. Follow-up from PR #22 (issue #15).

## The problem, from the point of view of someone working here

Several PRs in this repo verified a Tailwind utility by looking for it in the
built stylesheet: if the class compiles to real declarations it is there, and if
the utility silently resolved to nothing it is not. PR #22 made that reading
trustworthy again by stopping `docs/` and `.design/` from feeding Tailwind's
source detection, so a class name written in prose no longer compiles into the
shipped CSS.

Nothing enforces any of it. `scripts/gates.mjs` has rows for format, lint,
typecheck, test and build; none of them looks at what the build produced. Delete
the two `@source not` lines from `src/app/globals.css`, or add a new prose
directory, and `npm run gate` is still green. PR #22 was merged knowingly
without this test and said so in its body rather than letting the omission pass
unnoticed. This is that omission.

Two things make the check worth encoding in code rather than prose.

**The path in prose was already wrong.** Issue #15 told a reader to check
`.next/static/css/*.css`. That directory does not exist — Next 16 emits app CSS
to `.next/static/chunks/*.css`. A grep against a missing path matches nothing,
which reads exactly like "the class is absent": the precise false pass the check
exists to eliminate.

**Absence alone proves nothing.** "`snap-none` is not in the built CSS" is also
satisfied by an exclusion so broad it compiled no utilities at all. The
assertion has to be two-sided.

## The solution

A `stylesheet` row in the gate table, after `build`, running
`node scripts/check-built-css.mjs`. It reads every `.css` file the build emitted
and asserts both directions:

- **absent:** `snap-none` appears nowhere. It is in no file under `src/`; its
  only occurrences are two lines of prose in
  `docs/plans/section-snapping.md`, which planned `motion-reduce:snap-none` for
  a snapping model the implementation ended up expressing with `motion-safe:`
  variants instead. If it reappears in the built CSS, a directory outside the
  app is feeding Tailwind's scanner again.
- **present, emitting declarations:** `justify-center-safe`, `min-h-footer` and
  `scroll-pt-nav-sm` each compile to at least one rule with at least one
  declaration in its body — not merely appear as a substring.

The row prints the rules it matched, so a green run is evidence rather than an
assertion. If no stylesheet is found the row FAILS. It does not skip: the state
it needs is produced by the gate run itself two rows earlier, so absence is a
failure, not an unavailable machine. CLAUDE.md's skip clause is for state a
fresh clone lacks, which this is not.

## Implementation decisions

**A Node script the row invokes, not an inline shell command.** The obvious
one-liner is the issue's own
`grep -o 'justify-center-safe{[^}]*}' ... | sort -u`. Rejected: this repo is
developed on Windows/PowerShell as well as bash, `grep`, `sort` and glob
expansion are not portable across those shells, and the `command` string in the
table is not a place a regression test can reach. A script is the same shape as
everything else in `scripts/`.

**The path is globbed, never hardcoded to one filename.** The chunk file is
content-hashed (`0-xeu_cey1th1.css` today), so naming it would break on the next
build. The row walks `.next/static` recursively for `*.css` rather than
`.next/static/chunks` specifically — the drift that prompted this issue was
Next moving app CSS between subdirectories of `.next/static`, and a walk from
the parent survives it. Finding zero files fails.

**A class token, not a substring.** `min-h-footer` and `justify-center-safe` are
used in `src/` only under the `md:` variant, so the built selectors are
`.md\:min-h-footer` and `.md\:justify-center-safe`. A matcher anchored on
`.min-h-footer` would have reported the utility missing while it was present and
working — the false failure that mirrors the false pass. The matcher accepts a
class selector whose token _ends_ in the utility name, allowing variant
prefixes, and requires the rule body to hold a declaration.

**Two-sided by table, so adding an expectation is adding a row**, matching the
gate table it hangs off. `FORBIDDEN` and `REQUIRED` each carry the reason the
entry is there, and the reason is printed, so a failure explains itself.

**No new dependency and no ADR.** ADR 0002 already records why the gate runner
is a Node script with a table and why the verdict logic is separated from the
plumbing; this row follows that decision rather than making a new one.

## Test seams

The seam is the directory. `scripts/built-css.mjs` holds the expectation tables,
the class matcher and the audit; the only filesystem call takes the directory to
read as an argument, so every test runs against a temp directory of synthetic
CSS instead of a real build. That gives direct tests of the three cases the real
build cannot produce on demand:

- a required utility present only as a substring (a comment, a prefix of a
  longer name) or with an empty rule body — must FAIL,
- a forbidden utility present — must FAIL,
- no stylesheet at all — must FAIL, not skip.

`scripts/check-built-css.mjs` is the entry point and stays thin — resolve, read,
print, exit — for the same reason `run-gates.mjs` does (ADR 0002): it is the
part that cannot be tested without faking the OS, so it is kept small enough to
read in one sitting. Its uncovered lines show in the coverage ratio in plain
sight rather than being excluded.

The table ordering is itself a test in `gates.test.mjs`: the row is meaningless
before `build` has run, and nothing else in the table states that dependency.

## Slices

One implementation slice, after the plan commit.

1. **The plan.** This file.
2. **The `stylesheet` gate row**, with the script it runs and that script's
   tests. Splitting the script from the row would leave a first slice that
   delivers a layer nothing reaches — the thing CLAUDE.md's vertical-slice rule
   exists to prevent — and the whole change is under 200 lines.

## Considered and rejected

**An inline `grep` pipeline in the row's `command`.** Rejected above: not
portable off bash, and untestable.

**Putting the audit in `scripts/gates.mjs`.** That file is the gate table and
the rules for reading it, and its header promises it touches neither processes
nor the filesystem. Stylesheet knowledge does not belong to it.

**Asserting the exact declaration text** (`min-height:var(--spacing-footer)`).
Rejected: it would pin the row to Tailwind's minifier output and to the token's
current value, so an unrelated rename of `--spacing-footer` fails a gate that is
supposed to be about whether the utility compiled at all. "At least one
declaration" is the property that matters.

**A `mustFail` companion row that deletes the `@source not` lines and expects
the gate to fail.** It is the only way to prove the exclusions are what keeps
`snap-none` out, but it means mutating a tracked file during a gate run.
Rejected as too invasive for the value; the forbidden-class assertion catches
the same regression from the other side.

## Out of scope

- **`src/app/globals.css`.** The `@source not` lines are not touched here.
  Changing the exclusions is issue #24.
- **Proving a component _uses_ a utility.** Tailwind scans comments in `src/`
  too — the bare `.justify-center-safe` rule in today's output comes from the
  JSDoc in `SnapSection.tsx` that explains the choice, not from a `className`.
  This row proves a utility compiles to real CSS; that a component carries the
  class is asserted by the component tests (`SnapSection.test.tsx`,
  `layout.test.tsx`).
- **Any other build output** — HTML, JS, the route manifest. One property, one
  row.
- **The intermittent 5s test-timeout flake under parallel jsdom boot**
  (issue #9). Not touched.

## Addenda

<!-- Dated entries when the plan changes. Never rewrite the above. -->

### 2026-08-14 — the checker fed itself into the stylesheet it checks

The first run of the finished row failed, and it was right to. `scripts/` is
scanned by Tailwind's automatic source detection exactly like `docs/` and
`.design/` were before PR #22, so writing the utility names into
`scripts/built-css.mjs` compiled them into the build the row then read:

```
FAIL  snap-none is in the built CSS — …
ok    .min-h-footer{min-height:var(--spacing-footer)}
ok    .md\:min-h-footer{min-height:var(--spacing-footer)}
```

`.snap-none{scroll-snap-type:none}` was in the output for the first time, and
the bare `.min-h-footer` rule beside the `md:` one had not been there an hour
earlier. Both came from the new expectation table.

This is worse than a failing row: it makes the row assert nothing. The
forbidden name is present because the checker names it, and the required
utilities emit because the checker names them — so the check would stay green
after the app stopped using any of them. A gate that cannot fail is the thing
this issue was filed about, one level up.

**The fix, and why not the obvious one.** The obvious fix is a third
`@source not` line for `scripts/` in `src/app/globals.css`. That file is out of
scope here by decision — the exclusions belong to issue #24, which proposes
replacing them with a positive `@source "../../src"`, inverting detection from
opt-out to opt-in and covering `scripts/` along with the root Markdown it was
filed about.

So the table spells each utility in segments — `["snap", "none"]` — joined at
runtime, and no file under `scripts/` contains a whole utility name, comments
included. No segment is itself a Tailwind utility, so nothing compiles from
them. A test walks `scripts/*.mjs` and fails if any file spells one of the
names, so the constraint is enforced rather than remembered.

The indirection is a workaround for a scanner, and it says so in the file.
**When #24 lands, delete that test and make the segments plain strings** — the
positive `@source` removes the reason for both.

**What this adds to #24.** #24 records the hazard as latent, on the grounds
that no prose-only class survived the audit of PR #22. It is live now, and
`scripts/` is a directory that issue does not mention.

### 2026-08-14 — a third slice: the coverage floor

The new module is well covered and the new entry point is not, and the net is
upward on all four measures. `vitest.config.mts` says the floor is what the
repo achieves today and is raised when coverage rises, so leaving it where it
was would let this change quietly buy slack the next one could spend. Raising
it is its own commit, because it is its own change.
