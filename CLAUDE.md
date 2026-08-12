# Working in this repo

<!-- Fill these in when you start the repo. Delete the comment when done. -->

- **Default branch:** `main`
- **Issue tracker:** _(e.g. GitHub Issues via `gh`.)_
- **Ready-for-work label:** `ready-for-agent`
- **Gate command:** _(the one command that runs everything — see Verification.
  If it doesn't exist yet, creating it is the first slice of the first task.)_
- **Toolchain:** _(the exact interpreter/runtime and version, not the system one.)_
- **Setup:** _(the command(s) that take a fresh clone to a working dev environment.)_

**If any of these placeholders are still unfilled when you need them: stop and
ask.** Do not guess a toolchain, invent a gate command, or fall back to the
system interpreter. That is the "never invent an identifier" rule applied to
this file itself.

---

## How to work: confirm, plan, branch, slice, PR

Follow this for any task beyond a one-line fix.

### 1. Confirm understanding before doing anything

Say back what you think is being asked, in your own words, including anything
ambiguous and how you intend to read it. If two readings would lead to
materially different work, ask — don't pick one silently.

Also say what you think is *out* of scope. Most misunderstandings are about
scope, not intent.

### 2. Produce a plan in logical slices

A slice is a change that:

- does one thing you can name in a short sentence,
- leaves the repo working and the gates passing,
- can be committed on its own and understood from its commit message alone.

Rename, refactor, bugfix and new feature are **separate slices**, even when they
touch the same file. If a slice cannot be described without the word "and", it
is probably two slices.

Slices are **vertical**: each cuts a complete path through every layer rather
than delivering one layer across the whole feature. A slice that delivers only a
schema, or only a UI, cannot be demonstrated or verified except by the slice
that finally uses it.

State the slices in order, with the dependencies between them. Estimate nothing;
just make the order defensible.

### 3. Confirm the plan

Present the slice list and wait for agreement before implementing. If the plan
changes mid-flight — and it will, because verification surfaces real bugs — say
so and re-confirm rather than quietly expanding scope.

### 4. Write the plan down before starting slice 1

The conversation that produced the plan is not durable. Write the plan to
`docs/plans/<slug>.md` and commit it as its own first commit. A plan that
exists only in a transcript gets rebuilt slightly differently every time
someone returns to it.

The write-up states the problem and the solution *from the user's point of
view*, the implementation decisions, the **test seams**, and what is out of
scope. Say what was considered and rejected, and why — the rejected options are
most of what makes the accepted one defensible, and they are the first thing
someone re-litigates otherwise.

Agree the seams before starting. They decide whether the work can be verified
at all. Prefer existing seams to new ones, and put a new seam at the highest
point it will sit — logic buried inside a callback or an entry point can only
be tested by running the whole thing.

A decision that will outlive this task (a dependency choice, a data format, a
threading contract) also gets a short ADR in `docs/adr/`: context, decision,
consequences. One page maximum.

The plan file is the record of what was decided. Amend it with dated addenda
when the plan changes; never rewrite history in it.

### 5. Split it into issues, when that earns its keep

Publish one issue per slice, in dependency order, so each can name a real
blocker. Each issue links to the plan file. Mark each as autonomous if it can
be implemented and merged without a human, or needs-human if it requires a
decision or a look at the artifact. Prefer autonomous. A slice whose whole
purpose is that something reads correctly *to a person* needs a human, because
no gate can assert it.

Issues close normally when their PR merges — the plan file, not the issue, is
the durable record.

**Skip this step when it does not earn its keep.** One slice is one issue is
overhead, and a plan small enough to finish on one branch is better worked from
the plan file. The test is whether two people could pick up two of the issues
without colliding. If not, splitting bought nothing.

### 6. Branch per unit of work

Work every issue on its own branch, cut from an up-to-date default branch. Never
commit directly to it.

- Name the branch after the issue: `issue-<number>-<short-slug>`.
- One issue per branch. Work that "was right there" belongs to a different
  branch and a different issue, even when it is two lines. If you notice it,
  file an issue for it and move on.
- Do not start an issue whose blocker has not merged. The blocker's code is the
  ground the slices stand on, and rebasing half-finished work onto a moved
  blocker is how a verified slice quietly stops being verified.
- If `main` moves while your branch is open: rebase onto it *before* opening
  the PR and re-run the gates. After the PR is open, never rewrite pushed
  history — if `main` moves again, merge it in or ask.
- Never force-push to the default branch or to any branch with an open PR.

### 7. Implement one slice, verify it, commit it

**Every slice that changes behavior ships with its own test in the same
commit.** A bugfix slice starts with a failing regression test — commit the
test as MUST FAIL first if the gate table supports it, then make it pass. A
slice verified only by tests that predate it has not been verified.

**Commit after every slice.** Not at the end of the task, not once per session —
after each slice. A clean working tree between slices is the point: it means any
slice can be reverted or bisected on its own.

Before committing a slice:

- run the gate command and read its output — see *Verification*,
- run `git status` and `git diff --staged`: the tree contains only that slice's
  changes, and nothing generated, no secrets, no debug residue,
- write the message: imperative subject line ≤ 72 characters saying what
  changed; body saying *why* — the constraint or bug that made this the right
  change, not a restatement of the diff.

Then move to the next slice. Do not batch commits.

### 8. Push, open a PR, and wait

When every slice is committed and the gates pass, push the branch and open a
pull request. Then stop.

Keep PRs reviewable: if the slice list has grown past what a person can hold in
their head (as a guide, ~400 changed lines or ~5 slices), split the plan into
more than one PR at a dependency boundary rather than shipping one huge one.

The PR body states:

- `Closes #<issue>`, so the tracker closes itself on merge,
- what changed and why, at the level of the slices,
- **the actual output of the gates you ran** — not "tests pass". A claim is not
  evidence. Bugs ship past code that merely did not raise,
- anything you did not do, and why.

Then **wait for confirmation to merge.** Do not merge your own PR unprompted, do
not approve it, and do not bypass hooks or checks to make it mergeable. If a
hook fails, the hook is the message.

On confirmation:

- merge with a **merge or rebase commit, never a squash**. Every slice is meant
  to be revertible and bisectable on its own; squashing destroys the exact
  property step 7 exists to create,
- delete the remote branch, then the local branch,
- return to the default branch and pull, so the next issue starts from the
  merged state.

If changes are requested instead, keep working on the same branch — new slices,
new commits, same rules. Do not rewrite history that has already been pushed.

> **Repo settings, day one:** disable squash-merge in the repository settings,
> protect the default branch (require PRs, require the gate command as a status
> check, no force pushes). Prose cannot enforce a merge strategy; settings can.

### 9. Report honestly

If a slice is blocked, say so and finish the others. If verification fails, show
the output. If you found a bug in your own earlier work, say that plainly —
catching it is worth more than looking tidy.

Before opening the PR, self-audit against the definition of done:

- [ ] every slice: one nameable change, own commit, gates green at that commit
- [ ] behavior changes have tests in the same commit; bugfixes have a
      regression test that failed first
- [ ] gate output pasted in the PR body
- [ ] no invented identifiers, paths, URLs or APIs; open `TODO(verify)` items
      listed in the summary
- [ ] no secrets, credentials, `.env` contents or generated artifacts in any
      commit
- [ ] plan file updated if the plan changed
- [ ] branch is rebased on current `main` (pre-PR) and pushed

---

## Writing the code

Process discipline does not make the code good. These do:

- **Follow the patterns already in the repo.** Match existing naming, error
  handling, module layout and test style before inventing your own. If the
  existing pattern is wrong, changing it is its own slice with its own
  justification — not a side effect.
- **No new dependencies or abstractions without flagging them in the plan.** A
  new library, framework, layer or design pattern is an architecture decision;
  it goes in the plan (and an ADR if it will outlive the task), not silently
  into a diff.
- **Errors are handled or propagated, never swallowed.** An empty catch block,
  a bare `except`, or a logged-and-ignored failure is a bug you are choosing to
  ship.
- **No dead code, no commented-out code, no speculative flexibility.** Delete
  it; git remembers. Do not build for requirements nobody stated.
- **Functions do what their name says, and nothing else.** Side effects that
  the name does not advertise are where the next bug lives.
- **Boundaries validate; interiors trust.** Parse and check input where it
  enters the system, then pass typed/validated values inward — don't re-check
  everywhere or nowhere.

---

## Verification

Don't claim something works because it ran without raising. Assert the property
that matters:

- the output is correct, not merely produced;
- the state actually changed, not merely that the call returned;
- the thing is reachable by a user, not merely constructed;
- the parser produced the right value, not merely no exception.

**One command runs every gate.** It prints a row per gate with the failing
gate's own output, and exits non-zero if a gate fails, if a gate declared MUST
FAIL passes, or if coverage drops below the floor. Run it before committing any
slice and paste its output into the PR body. CI runs the same command — if CI
and local ever disagree, that divergence is the first bug to fix.

**The gate set lives in that command, not in this file.** Prose cannot be run,
so nothing notices when it drifts. Keep it as a table in code; add a gate by
adding a row. Gates needing a display, credentials or machine state a fresh
clone lacks are declared in the table but skipped by default.

At minimum the table grows to include: format check, lint, type check (if the
language has one), tests with coverage floor. Add them as early slices, not as
a cleanup task that never comes.

---

## Security

- **Never commit secrets.** No API keys, tokens, passwords, private keys or
  `.env` files — not even in test fixtures, not even "temporarily". Secrets
  come from the environment; `.gitignore` covers env files from day one.
- If a secret ever lands in a commit, say so immediately. It is compromised the
  moment it is pushed; removing the commit does not un-leak it.
- Do not `curl | sh`, add dependencies from unverified sources, or widen
  permissions/scopes to make an error go away.

---

## General discipline

- **Never invent an identifier, path, URL or API.** If you can't confirm it,
  leave `TODO(verify)` and say so in your summary.
- **Nothing fails silently.** Anything skipped, empty or unusable is reported —
  in the log, in the output, and to the user.
- **Read-only stays read-only.** Never write into an input directory from code,
  and never let generated output be picked up as input on the next run.
- **Don't fix a symptom with a constant.** If a value is off, find why.
- **When this file is wrong, fixing it is a slice.** If a rule here cost you
  time because it was ambiguous or outdated, propose the edit in its own
  commit rather than silently working around it.

---

## Project invariants

<!-- Empty on day one. Add a rule here the first time something is expensive to
learn, and say what it cost — the reason is what stops it being re-litigated.
These are the rules that are specific to this repo and would be wrong elsewhere:
domain constraints, external system quirks, threading contracts, data formats. -->

_(nothing yet)_
