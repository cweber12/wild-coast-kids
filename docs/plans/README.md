# Plans

A plan is written **before** the work, as its own first commit, and describes
what someone intended to build and why. Once the work ships, that intent does
not change — but the code keeps moving, so the plan starts describing something
that is no longer there.

**That is expected, and it is not a defect.** A shipped plan is a dated record,
like a receipt. The code is the truth about what the code does.

## Every plan says which it is

Each file carries a note under its title:

> **Historical.** Planned 2026-08-14, shipped in PR #32 on 2026-08-14.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

A plan still being worked carries no such note. One plan is in flight —
[`sky-from-the-grid.md`](sky-from-the-grid.md) — and every other file here is
historical.

## What that means in practice

- **A historical plan is not edited again.** No addenda, no corrections, no
  bringing it up to date. Editing it would make it neither a record of what was
  decided nor a description of the code — the worst of both.
- **A historical plan drifting from the code is not a bug.** Do not open an
  issue for it. Issue #103 was exactly that: a plan naming three functions that
  no longer existed, reported as a defect, and answered with an addendum that
  made the file longer without making anything truer.
- **If a decision in a plan is still binding, it belongs in an ADR.** ADRs are
  short, few, and maintained. `docs/adr/` is where you look for what is still
  true; `docs/plans/` is where you look for why someone once thought so.
- **The rejected options are the part worth keeping.** That is why these files
  are marked rather than deleted — "considered and rejected" is expensive to
  reconstruct and is the first thing anyone re-litigates.

## Writing a new one

See `CLAUDE.md`. Not every change needs a plan; this directory is already the
largest body of prose in the repository, and a plan that duplicates its issue
and its PR body is a third copy that goes stale on its own.

When your work merges, add the historical note as part of the merge, so the
next reader knows what they are holding.
