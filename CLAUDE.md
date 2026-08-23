# Working in this repo

- **Default branch:** `main`
- **Issue tracker:** GitHub Issues on `cweber12/wild-coast-kids`, via `gh`.
- **Ready-for-work label:** `ready-for-agent`
- **Gate command:** `npm run gate` — see _Verification_.
- **Toolchain:** Node 22.18.0 with npm 10.9.3. CI pins the same version in
  `.github/workflows/gate.yml`; if you change one, change both.
- **Setup:** `npm ci` from a fresh clone. Use `npm ci`, not `npm install`, unless
  you are deliberately changing a dependency — `ci` installs exactly the
  lockfile and fails when it has drifted from `package.json`.

**If any of these placeholders are still unfilled when you need them: stop and
ask.** Do not guess a toolchain, invent a gate command, or fall back to the
system interpreter. That is the "never invent an identifier" rule applied to
this file itself.

---

## Pick the lane first

Two lanes. Most work is the full one below; some is not, and running the full
process over a two-line copy fix produces a plan file, a slice table and a PR
body longer than the diff. That is the process working as written, which is the
problem it is worth having a second lane for.

**Take the small lane when both hold:**

- the change is confined to prose — page copy, comments, documentation — and
  touches no logic, no data shape and no contract;
- it contradicts nothing recorded in `docs/adr/` or `CONTEXT.md`.

Not a line count. Five lines inside `src/lib/sessions.ts` are riskier than
sixty lines of page copy, and a rule counting lines would route both wrongly.
The question is what kind of thing changed, not how much of it.

Page copy is prose and takes this lane, but it is still behaviour a reader
sees: it ships with a test like anything else.

**The small lane is:** branch, do it, run the gate, one commit, short PR that
says what changed and why. **No plan file. No slice table. No confirmation
step.** Behaviour changes still ship with a test; the gates still all run and
still have to be green. Nothing about verification relaxes — only the
paperwork.

If you are partway in and any of the three stops holding, stop and switch
lanes. Discovering a change was bigger than it looked is normal; finishing it
in the wrong lane is not.

**Anything else takes the full lane below**, and the guide is size on the way
in, not confidence. Two files that must change together is the full lane even
if each is small.

## How to work: confirm, plan, branch, slice, PR

The full lane. Follow this for any task the small lane above does not take.

### 1. Confirm understanding before doing anything

Say back what you think is being asked, in your own words, including anything
ambiguous and how you intend to read it. If two readings would lead to
materially different work, ask — don't pick one silently.

Also say what you think is _out_ of scope. Most misunderstandings are about
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

**A plan file is for work that is hard to hold in your head, not for every
change that reaches this lane.** Write one when the work will not finish in one
sitting, or when it turns on a choice between approaches someone will question
later. Both are knowable before you start; "how many slices is it" is not, and
by the time you can count them you have already done the thinking the file was
meant to hold. Otherwise the issue and the PR body are the durable record, and
a plan file is a third copy of them that can go stale on its own — which is
what `docs/plans/` currently costs: it is the largest body of prose in this
repository and it describes code that has since moved.

When you skip it, say so in the PR body and say why, so the omission is a
decision rather than a lapse.

The write-up states the problem and the solution _from the user's point of
view_, the implementation decisions, the **test seams**, and what is out of
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

The plan file is the record of what was decided. **While the work is in
flight**, amend it with dated addenda when the plan changes; never rewrite
history in it.

**When the work merges, the plan stops being maintained.** Mark it historical
in the same PR — see [`docs/plans/README.md`](docs/plans/README.md) for the
note and the reasoning. After that it is a dated record, not a description of
the code: it is not amended again, and it drifting from the code is expected
rather than a defect to file. If a decision inside it is still binding, that
decision belongs in an ADR, which is the thing that is kept current.

### 5. Split it into issues, when that earns its keep

Publish one issue per slice, in dependency order, so each can name a real
blocker. Each issue links to the plan file. Mark each as autonomous if it can
be implemented and merged without a human, or needs-human if it requires a
decision or a look at the artifact. Prefer autonomous. A slice whose whole
purpose is that something reads correctly _to a person_ needs a human, because
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
  branch, even when it is two lines. Do not do it here.
- **Noticing something is not the same as filing an issue for it.** Say it in
  the PR body and move on. Open a tracker entry only when it is a real defect
  someone would want to find later, or when it needs a decision before it can
  be worked. A backlog that grows a row every time anyone looks at anything
  stops being a list of what to do next.
- Do not start an issue whose blocker has not merged. The blocker's code is the
  ground the slices stand on, and rebasing half-finished work onto a moved
  blocker is how a verified slice quietly stops being verified.
- If `main` moves while your branch is open: rebase onto it _before_ opening
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

- run the gate command and read its output — see _Verification_,
- run `git status` and `git diff --staged`: the tree contains only that slice's
  changes, and nothing generated, no secrets, no debug residue,
- write the message: imperative subject line ≤ 72 characters saying what
  changed; body saying _why_ — the constraint or bug that made this the right
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

**Prose never reaches the stylesheet.** Tailwind's source detection is opt-in
here: `src/app/globals.css` imports it with `source(none)` and names `src/` as
the only scanned directory. That is what makes "the class is in the built CSS"
evidence that a component uses it — the reading the `stylesheet` gate row and
several PRs before it depend on. It also means this file, `CONTEXT.md` and
`README.md` may name a utility while explaining a convention — `snap-none`,
say — without compiling it into the shipped stylesheet. The gate asserts that
exact name stays absent, so this sentence is the check's canary as well as its
documentation. See `docs/adr/0006-opt-in-tailwind-source-detection.md`.

---

## Agent skills

### Issue tracker

Issues are tracked on GitHub Issues for `cweber12/wild-coast-kids`, via the
`gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage vocabulary, with `ready-for-human` mapped to this repo's
existing `needs-human` label. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.
