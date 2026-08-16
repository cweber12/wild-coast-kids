# 0006 — Tailwind source detection is opt-in, not opt-out

Date: 2026-08-15. Status: accepted.

## Context

Tailwind v4 scans every non-gitignored file in the project by default and
compiles any utility name it finds. Prose counts: a class name written in a
plan, a review or an instruction file becomes a real rule in the shipped
stylesheet.

That is not merely dead CSS. This repo reads the built stylesheet as evidence.
The `stylesheet` gate row (`scripts/check-built-css.mjs`, ADR 0002's split)
asserts that `justify-center-safe`, `min-h-footer` and `scroll-pt-nav-sm` emit
real declarations, and that `snap-none` does not — because "the class is in the
built CSS" is what proves a utility resolved to something rather than silently
to nothing. Every one of those assertions rests on the scanner seeing only
files that are actually shipped. The moment prose feeds it, presence stops
proving anything.

PR #22 (issue #15) excluded `docs/` and `.design/`. `README.md`, `CONTEXT.md`,
`CLAUDE.md` and `AGENTS.md` sit at the repo root, outside both, and were still
scanned. Issue #24 filed that as latent: an audit of the built stylesheet at
the time found no prose-only class had survived, so there was nothing to
remove. Planting one sentence in `CLAUDE.md` that names `snap-none` while
explaining the convention was enough to make the gate red, which is exactly the
document the issue predicted would do it by accident.

`scripts/` was scanned too, and had been paid for. `built-css.mjs` could not
write the names it checks as plain strings, because doing so would compile them
into the very stylesheet it reads — a forbidden name present because the table
forbids it, required names emitted by the table rather than by the app. It
carried the class names split into `segments: ["snap", "none"]`, a
`utilityName()` join, and a guard test walking `scripts/` to fail if anyone ever
spelled one in full.

## Decision

`src/app/globals.css` imports Tailwind with automatic detection switched off
and names the application directory as the only source:

```css
@import "tailwindcss" source(none);
@source "../../src";
```

Detection is therefore opt-in. A new source directory has to be declared before
its classes compile.

## Consequences

The rejected alternative was to keep detection automatic and add the four root
files to the existing `@source not` list. It is a smaller diff and it fixes
today's instance. It does not fix the shape: the hazard returns silently the
next time anyone adds a Markdown file, a config, or a fixture at the root, and
nothing fails at the moment it is introduced — the audit that found it this
time was manual and one-off. Opt-out means the correct list is "everything
anyone will ever add", which is not a list that can be maintained.

Inverting also retires the `scripts/` workaround rather than leaving it to be
re-derived. `built-css.mjs` now spells the utilities it checks as plain
strings, `utilityName()` is gone, and the guard test that walked `scripts/` is
deleted — that test existed only to enforce a constraint this decision removes.
The comment explaining why names were split is gone with it, which is most of
the win: the next reader of that file no longer has to understand a defence
against a hazard that no longer exists.

The cost is a new failure mode with an unhelpful symptom. If someone adds a
component outside `src/`, its utilities compile to nothing and the page renders
unstyled with no error — Tailwind does not warn about a class it never saw. The
opt-out arrangement would have compiled them silently instead. Both are silent;
this one fails toward missing CSS rather than toward CSS that lies, and the
`stylesheet` gate row catches the case that matters by asserting real
declarations rather than mere presence.

The invariant is now stated in CLAUDE.md's _Project invariants_, and the
sentence that states it names `snap-none` on purpose. It is the canary: it sits
in a root Markdown file, the gate forbids it, and it would fail the moment
detection stopped being opt-in. The documentation and the regression test are
the same sentence.
