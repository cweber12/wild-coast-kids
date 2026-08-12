# 0002 — The gate command is a Node script with a table, not chained npm scripts

Date: 2026-08-11. Status: accepted.

## Context

CLAUDE.md specifies the gate command precisely: one command, a row per gate, the
failing gate's own output, non-zero exit if a gate fails, if a gate declared
MUST FAIL passes, or if coverage drops below the floor. It also requires that
the gate set live as a table in code rather than in prose, and that gates
needing a display, credentials, or machine state a fresh clone lacks be declared
in the table but skipped by default.

The obvious cheap alternative is a chained npm script:
`"gate": "npm run lint && tsc --noEmit && npm test && npm run build"`.

## Decision

`scripts/gates.mjs`, run as `npm run gate`. The gate set is an array of
descriptors. A pure function maps collected results to an exit code and printable
rows; a thin subprocess layer runs the commands and records their exit codes and
output.

## Consequences

The chained-script alternative cannot meet the spec, which is what settles it:
`&&` short-circuits, so a run reports one failing gate instead of all of them;
there is no way to express MUST FAIL, since a failing command simply stops the
chain; there is no way to declare a gate present-but-skipped; and the gate set
becomes an unreadable string in `package.json` instead of a table someone can
add a row to.

Cost: a script to maintain, and a small amount of subprocess plumbing that is
not itself unit-tested because faking the OS costs more than it returns. The
plumbing is kept deliberately thin so that the untested surface stays small; all
the logic that can be wrong lives in the pure function, which is tested.

Because the exit code comes from our own code rather than from the shell, a bug
in the verdict function could report green while a gate is red. That is the
sharpest risk this decision creates, and it is why the MUST-FAIL and
skipped-is-not-a-pass cases are unit-tested explicitly rather than assumed.

Adding a gate later means adding a row, which is the property CLAUDE.md asked
for.
