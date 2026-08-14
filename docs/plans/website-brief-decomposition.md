# Website brief: decomposition into PRDs

Splits the client brief (Lena's answers to a 55-question form, 14 Aug 2026)
into eight PRDs plus a register of open questions. This file names the units
and the dependencies between them. It does not plan any of them — each PRD
gets its own `docs/plans/<slug>.md` when it starts.

Written 13 Aug 2026.

## Problem, from the user's point of view

Lena answered 47 of 55 questions about what the site should be. The answers
arrived as one document covering everything from a fabricated testimonial to a
booking provider she has not chosen. Worked as a single list it produces one
enormous branch that cannot be reviewed, cannot be verified, and stalls
entirely the first time it hits a fact only she can supply — and fourteen of
those facts are open.

The site meanwhile carries claims she has told us are untrue, including an
invented parent testimonial, on a site selling paid classes.

## Solution

Eight PRDs, split by **what unblocks each one** rather than by which part of
the site it touches. Every PRD has exactly one answer to "what has to be true
before this can start", and four of the eight need nothing from Lena to begin.

Each PRD that touches a fact she has not confirmed is split in half: a
_remove-the-false-claim_ half that ships on our authority, and a
_state-the-real-fact_ half that waits for her. The deception comes down
without waiting for a reply.

## Corrections to the brief

The brief is the client's answers, faithfully rendered, but three of its
statements about _this repo_ are wrong. Recorded here because the PRDs below
depend on the corrected version.

1. **The source data is not in the repo.** The brief cites
   `docs/form-responses/anon-2026-08-14T03-56-16Z.json`. That directory is
   empty and git has no history for it; the file lives only in the Supabase
   `form-responses` bucket. Every PRD citing the brief cites this document,
   not a file it can open.

2. **The conditions tool is not half built, and it is not in this repo.** It
   is `socal-coastal-data` — a Next.js 16 application with 26 spots across the
   Oceanside-to-Border-Field corridor, tidepool and surf activities, a verdict
   model of windows/gates/thresholds, evidence ledgers with explicit
   provenance classes, and roughly 174 merged pull requests. Of the five
   readouts Lena asked for, four exist: tide windows from NOAA stations, surf,
   daylight as a gate on every window, and the plain-English verdict, which is
   its core output rather than a feature of it. **Visibility does not exist**
   in any form. Of her four named beaches, **La Jolla and Tourmaline are
   already spots; Bird Rock and Marine Room are not.** The repo has no deploy
   configuration and has never been deployed, so what blocks the conditions
   section here is a deploy, not a build.

   `CONTEXT.md` already described this correctly — "built separately and
   embedded here". The glossary knew; the brief did not.

3. **`docs/conditions/safe-to-swim-nextjs.md` is untracked and redundant.** It
   is an integration guide for California's fecal-indicator-bacteria dataset —
   a sixth data source, for a question `socal-coastal-data` already models via
   county water-quality stations. It was never committed, so retiring it
   deletes a local file and changes nothing in the repo.

## Implementation decisions

- **Split by blocker, not by site section.** A section-based split (hero PRD,
  gallery PRD, cards PRD) reads tidier but scatters the one blocker that
  matters — Lena answering — across every unit, and files the fabricated
  testimonial in the same PRD as the gallery pipeline, so the urgent work
  waits on the slow work. Rejected for that reason.

- **Blocked facts split their PRD in half rather than gating it.** Two
  alternatives were rejected: a single "client answers" PRD that everything
  depends on, which leaves the invented testimonial up until she replies; and
  per-PRD blocked-fact lists with no central record, which loses track of
  whether an answer ever arrived. The chosen shape takes both halves — split
  PRDs, plus a register (PRD-0) that nothing depends on.

- **The brief's build order is inverted.** She asked for "the images" next.
  The images turn out to be a permission-and-pipeline project (PRD-4), not a
  file drop, because no family has given written permission and the gallery is
  a developer-edited array. Only the logo and hero (PRD-5) are the file drop
  she had in mind.

- **Colours are a design question, not a claim.** She ticked the purple/ocean
  program split as wrong-or-undecided, which un-approves it as a fixed token
  pair. That is a decision for her, so it sits in PRD-0; PRD-1 leaves the
  colours alone rather than treating them as copy to delete.

- **One PRD is cross-repo.** PRD-6's work is mostly in `socal-coastal-data`.
  It stays in this list because what it delivers — a conditions section that
  is not a reserved slot — is a change to this site.

## The PRDs

### PRD-0 · Open questions register

The fourteen facts only Lena can supply, each recorded with what it blocks and
where the answer lands when it arrives. Also holds two design questions the
brief surfaces without asking: whether the purple/ocean program colours
survive, and whether a third homepage card exists.

Not a build. Nothing depends on it; it exists so that "did we ever hear back
about the price?" has one place to be answered.

**Blocked by:** nothing. **Blocks:** nothing.

### PRD-1 · Take down what isn't true

The launch blocker, and the only PRD with a legal edge.

- Both quotes and their `— Parent, Wild Coast Kids` attributions out of
  `src/components/QuoteStats.tsx`. Note that the file's own comment flags only
  the second quote as invented; her answer says no parent quote is real, so
  the code's record is wrong here too.
- Every unverified claim out of `src/components/ProgramCards.tsx`: the day,
  the hours, the four activity tiles, "Spots limited for fall", "Fall 2026",
  and the two she was never asked about — "Group & Private" and the medium
  list. The `Charter eligible` badge stays; the form confirms it.
- `Book Now` out of `src/components/Nav.tsx`.
- "Tuesday" out of the co-op's name everywhere — nav, card, `/coop`,
  placeholder labels, tests, and `CONTEXT.md` — since the day is explicitly
  undecided. Its own slice, per the repo's rename-is-not-a-bugfix rule.

Design for one consequence rather than discovering it: with the quotes gone,
`QuoteStats` is two stat tiles holding down a `height="screen-less-footer"`
snap stop. The section needs a shape that survives being honest.

**Blocked by:** nothing.

### PRD-2 · One call to action, pointed at the interest list

Resolves the brief's central contradiction: the action she wants visitors to
take (book a class) is the one thing the site cannot do, and she declined
payments explicitly. The page keeps one dominant call to action and points it
at the interest list, built so the destination is a one-line swap once booking
exists. Decides the fate of the `/book` route, which is a real page today.

**Blocked by:** PRD-1, and her one-sentence confirmation — this is the only
place the brief overrides a literal answer.

### PRD-3 · The interest list actually collects

`src/components/InterestListForm.tsx` swaps to "You're in!" and discards the
submission. A form that says you are in when you are not is the same species
of problem as the invented quote; the brief does not flag it.

Adds a Supabase destination (reusing the insert-only bucket pattern already
running the questionnaire), labels the last two fields optional as she asked,
and keeps cadence out of the signup copy — "occasional", never "weekly",
because she does not know how often she will write. The four interest
checkboxes ship unchanged and are reworded later: their labels are the same
disputed co-op activities PRD-1 removes from the card.

**Blocked by:** PRD-2.

### PRD-4 · Photo permission and the photo pipeline

Two deliverables that must not be separated, because either alone is useless:
the release form to send families, and a way for Lena to add a photo without a
developer or a build she cannot run. `src/components/GallerySection.tsx` is a
hardcoded array of nine strings today.

Carries the hands-and-backs-of-heads-only rule as an enforceable constraint
rather than a note. The release is drafted here and flagged for a qualified
read before it goes to any family — a consent form for children's images does
not ship on an agent's say-so.

**Blocked by:** nothing to start. **Blocks:** every real gallery image.

### PRD-5 · Real logo, hero, domain

The three assets she has in hand. Independent of PRD-4: no child is
identifiable in a logo. `src/components/Placeholder.tsx` already carries the
accessible name the real image inherits, so swapping in a photograph changes
nothing for assistive tech. `public/` is empty today.

**Blocked by:** her sending the files.

### PRD-6 · Conditions: deploy and embed (cross-repo)

Deploy `socal-coastal-data`; add Bird Rock and Marine Room as spots; decide
visibility — add a feed or drop it from what the site promises, since it is
the one readout of the five that does not exist; then embed or link it from
`src/components/Conditions.tsx` and delete the untracked safe-to-swim guide.

States explicitly that the tool never announces a co-op cancellation. She was
unsure; the recommendation is no. An automated tool implying a real-world
event is cancelled is a safety-adjacent claim derived from a data feed.

**Blocked by:** nothing.

### PRD-7 · Booking provider recommendation

Research and a written decision, no implementation — an ADR, since the choice
outlives the task. She handed the choice over explicitly and does not want
payments on the site now.

The charter requirement is the discriminator: most class-booking products
handle cards well and institutional billing badly, and the vendor-portal
detail means the invoice leg probably lives in PCA's system rather than the
booking tool's. Current features and pricing get verified directly rather than
recalled.

**Blocked by:** nothing. **Feeds:** PRD-2's later swap.

### PRD-8 · The copy read-through

Her real request behind "Not sure — read it to me again": every sentence of
copy on the site, out of layout, as a flat list she can approve line by line.
Runs last so she is not reading copy that PRD-1 is about to delete.

Resolves "should the site say homeschool" by putting the word in a draft and
letting her react to it, and settles the fourth nav label, which she handed
over.

**Blocked by:** PRD-1 through PRD-3 landing.

## Order

```
PRD-0 ─────────────────────────────────────── (anytime, no dependents)
PRD-1 ──> PRD-2 ──> PRD-3 ──────────> PRD-8
PRD-4 ─────────────────────────────── (parallel)
PRD-5 ─────────────────────────────── (parallel, needs her files)
PRD-6 ─────────────────────────────── (parallel, other repo)
PRD-7 ─────────────────────────────── (parallel, research only)
```

One chain has real sequencing. Four PRDs run alongside it, and three of those
four need nothing from Lena to begin.

Start with PRD-1.

## Verification

This file plans no code, so it declares no test seams. Each PRD agrees its own
seams in its own plan file before its first slice, per `CLAUDE.md`.

Two properties this decomposition is meant to hold, and how to check them:

- **No PRD asserts a fact from the brief's open-questions list.** Checkable by
  reading each PRD's plan against PRD-0's register.
- **Every PRD leaves the site truthful at its last commit**, not only at the
  end of the chain. PRD-1 is the test case: it must be mergeable and shippable
  on its own, with nothing downstream required to make the site honest.

## Out of scope

- Everything on her "events, mom meet ups, snorkeling, surf club, book club"
  list. She was asked what else might sit alongside the two programs and
  answered "None of these yet — finish what is started." The only obligation
  it creates is that the information architecture survive a third and fourth
  program without a rewrite.
- Authentication and any members-only area. She was unsure; unsure is not a
  reason to build auth.
- Taking payments. Declined explicitly, and the most expensive thing in the
  form.
- The open hygiene issues (#15–#19). Unrelated to the brief, and none of them
  collides with it.

## Addenda

_(none yet — amend with dated entries when the plan changes; never rewrite
above this line)_
