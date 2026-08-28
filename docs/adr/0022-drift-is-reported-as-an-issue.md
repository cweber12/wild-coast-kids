# 0022 — Drift is reported as an issue, and the run that reports it passes

Date: 2026-08-27. Status: accepted.

## Context

ADR-0009 promised a weekly probe and was explicit that it was not an
aspiration. Four probes exist. Until now nothing ran them: `gate.yml` was the
only workflow and has no `schedule`, and no row in the gate table touches the
network — correctly, because the gate must pass on a fresh clone with no
credentials.

So the probes ran when someone remembered, which since 2026-08-18 was never.
That is measurable rather than rhetorical: `TWC0405` Point Loma went from dead
to answering in those nine days and nothing noticed, which is issues #159 and
#161.

Three things constrain what a scheduled run can do.

**The probes share exactly one contract: the exit code.** Non-zero when what
was measured disagrees with what is committed. Nothing else is uniform —
`probe-grid-cells.mjs` throws a Node stack trace where `probe-mop-lines.mjs`
and `probe-observation-stations.mjs` print a sentence and call `process.exit`,
and `probe-tide-stations.mjs` has no `--check` flag at all because it has no
other mode (ADR-0021). Rewriting them into a common shape is a bigger change
than this and would have to be justified on its own.

**Regenerating and opening a pull request cannot be uniform either.**
`probe-tide-stations.mjs` never writes, by design: its table carries
hand-written prose no probe can reproduce. So "open a PR with the regenerated
file" covers three of the four probes at best. More decisively, every
generator's own failure message asks the reader to _"read the diff, and say in
the commit message what changed upstream."_ A bot can produce the diff. It
cannot say why, and that sentence is the thing being asked for.

**The default workflow token is read-only.**
`default_workflow_permissions` is `read`, so a workflow that omits an explicit
`permissions:` block fails at the API call rather than at parse time.

## Decision

**A weekly workflow runs every probe, and drift is reported as a GitHub
issue.** Not a pull request, and not a red build.

**Every probe runs on every invocation, and every outcome is reported** —
including the clean ones. One probe failing must not stop the rest, so the
reporting of each is wrapped individually and its error is carried into that
probe's row rather than thrown.

**Three outcomes, kept distinct: `unchanged`, `moved`, `unreachable`.**

**A probe's upstream hosts are a column in its table row.** This is the part
worth arguing, because it is the only way the three outcomes can be told apart
under the constraint above. The shared contract is the exit code, and an exit
code cannot separate "upstream changed" from "upstream is having a bad day" —
both are 1. So the runner asks the question the probes cannot: _if a probe
failed, is its publisher answering at all?_ A probe that failed while its
publisher answered measured something and disagrees; a probe that failed while
its publisher did not answer measured nothing. That check needs the hosts, so
the hosts live in the row rather than as knowledge inside the runner, and
adding a probe stays "add a row".

Any HTTP response counts as answering, a 400 or a 500 included. The question is
whether the publisher is there, not whether it is happy — CO-OPS retired
`product=datums` and it now answers HTTP 400 forever, which is a real change
worth reporting rather than a bad connection to write off.

**A failure is retried once before it is believed.** The cheapest explanation
for a probe failing once is that a publisher blinked, and a retry that comes
back clean costs one run and saves an issue nobody should have read.

**De-duplication is keyed on a marker in the issue body, not on its title.** A
probe still reporting drift next week comments on the open issue rather than
filing a second. The marker is `<!-- probe-drift:<name> -->`, because whoever
triages the issue will rewrite the title and a match on title text would file a
fresh issue the moment somebody made the first one clearer.

**The run passes when it reports successfully, whatever it found.** This is the
first thing someone will want to change, so it is stated here. A run that found
drift and successfully filed it has done its job. Failing as well delivers the
same news twice — once as an issue somebody can act on, once as a red X on a
repo with no open PR that nobody can — and the red X is the copy that trains
people to ignore both. Failure is reserved for the reporting itself failing: an
API call rejected, a probe that could not be spawned.

**The workflow commits nothing, pushes nothing, and opens no pull request.** It
is granted `contents: read` and `issues: write` and nothing else.

**The gate table is untouched.** It stays offline so it passes on a fresh
clone. This is a separate workflow for that reason.

## Consequences

**Something finally runs the probes.** That is the whole point, and everything
below is the cost of it.

**A probe that crashes on a refused connection is still reported as `moved`,
not `unreachable`, if its publisher recovers before the runner's own check.**
The window is seconds and the retry narrows it further, but it is real, and it
is a direct consequence of consuming exit codes rather than parsing output. The
honest fix is for the probes to signal the difference themselves — a distinct
exit code for "could not measure" — which is deliberately not done here because
changing four probes' contracts is its own decision. `probe-tide-stations.mjs`
already draws this line internally, per station; it just has no way to say so
through an exit code.

**The reachability check is a second network call per failing probe**, made to
an origin the probe just used. It runs only when a probe has already failed, so
a quiet week costs nothing.

**An unreachable publisher files an issue too.** A run that swallowed it would
be the silent failure this repo forbids, and a publisher that stays unreachable
is exactly the rot worth chasing. A publisher having one bad morning is
absorbed by the retry; one having a bad week produces one issue, not five,
because of the marker.

**Issues filed by this workflow accumulate if nobody closes them.** That is
intended — an open issue is the record that a probe is still reporting drift,
and the comment thread is its history. It does mean a probe left unfixed grows
a comment a week.

**The probe list can drift from the scripts.** A row naming a renamed script
would go quiet rather than fail, which is the exact failure this workflow
exists to remove. `probes.test.mjs` asserts every row names a file that exists,
which is why that test reaches the filesystem when nothing else in the table
does.

**`workflow_dispatch` is on it as well as the schedule**, so a run can be
triggered by hand rather than waited for. Note the GitHub constraint that
follows: a workflow is only dispatchable once it is on the default branch, so
the first by-hand run of any new workflow is necessarily after it merges.
