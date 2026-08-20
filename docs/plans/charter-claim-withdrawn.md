# The site stops claiming charter-fund eligibility (issue #104)

Date: 2026-08-20.

## Problem, from the parent's point of view

The site tells a parent the programs are charter-fund eligible in seven places
and gives them nowhere to read what that means. PR #99 narrowed `/art`'s
reserved slot to the dates it stands in for, which was right — charter copy was
only riding along because the slot was the page's one stand-in — but it left
the claim asserted everywhere and explained nowhere.

A parent who filters on charter funding is the parent most likely to act on the
claim, and there is nothing for them to act on. "Charter eligible" answers none
of the questions that decide whether their family can actually use it: which
charters, whether Wild Coast Kids is an approved vendor, and what they have to
do.

## Decision

**Withdraw the claim until there is copy that explains it.** Chosen by the
program's owner on 2026-08-20, over the two alternatives below.

This is deliberately reversible and expected to reverse. The claim is not
believed to be false — the program is understood to be charter-fund eligible —
so this is not a correction. It is declining to assert something the site
cannot yet support.

### Considered and rejected

- **Write the charter-fund section now.** The preferred outcome and the reason
  #104 was labelled `needs-human`. Rejected because the facts do not exist in
  this repository to write it from. `docs/reference/art-program.md` is the
  document that exists precisely to hold supplied domain knowledge — it was
  committed on 2026-08-19 because "none of it is derivable from the code" — and
  it covers the pricing model, the pack decisions and five open questions
  without mentioning charter funding once. Writing the copy would mean
  inventing a factual claim about public money, which CLAUDE.md's rule against
  inventing what cannot be confirmed exists to prevent.
- **Keep the claim and route to the interest list.** A line on `/art` saying
  the funding is worth asking about, promising no specifics, pointing at the
  interest list the whole site already uses. Cheapest, and closes the gap
  today. Rejected by the owner: it still asserts eligibility, and a parent who
  has to ask what a claim means has been sold a question rather than an answer.

### The cost, stated plainly

Charter families are a segment the site was deliberately courting, and the
phrase is what let them self-identify. Removing it will cost some of those
signups until the copy exists. That is the price of not making a funding claim
the site cannot explain, and it is why this plan records how the claim comes
back rather than treating the removal as an end state.

## What changes

Seven shipped surfaces assert it. #104 named three; these are all of them.

| Where                                | Today                               | After                               |
| ------------------------------------ | ----------------------------------- | ----------------------------------- |
| `src/app/layout.tsx:23`              | metadata: "Charter fund eligible."  | sentence dropped                    |
| `src/app/art/page.tsx:10`            | metadata: ", charter fund eligible" | clause dropped                      |
| `src/components/Hero.tsx:31`         | "Charter fund eligible."            | sentence dropped                    |
| `src/components/Marquee.tsx:9`       | phrase in the strip                 | phrase dropped, seven remain        |
| `src/components/ProgramCards.tsx:56` | yellow badge on the art card        | badge dropped, "All levels" remains |
| `src/components/Footer.tsx:15`       | "Charter Eligible · K–8"            | "K–8"                               |
| `src/components/QuoteStats.tsx:45`   | purple stat tile                    | tile dropped; see below             |

**The QuoteStats tile is the only one that leaves a hole.** It is one of two
tiles in a `md:grid-cols-2`. No replacement statistic is invented to fill the
space — that would be the same mistake in a different colour — so the question
is only what the survivor does with the room.

The grid keeps `md:grid-cols-2` and the remaining tile keeps the width it has
always had, sitting under the left-hand quote. Dropping the column was tried
first and rejected on the rendered page: it stretches the tile to the full
1425px section width with "K–8" in the leftmost eighth, which reads as
something deleted rather than as one stat. Half-width, the tile is unchanged
from what shipped and the empty column lines up with the quote above it.

The stale comment at `src/app/art/page.tsx:178` — "Charter-fund copy is
genuinely unwritten and is a separate slice" — is corrected in the same slice,
because it now describes a decision that has been taken.

## Test seams

Four existing assertions pin the exact strings and change with the code:
`Footer.test.tsx:10`, `Marquee.test.tsx:8`, `QuoteStats.test.tsx:21-22`.
`Marquee.test.tsx` uses the phrase only as a probe for "every phrase appears
twice", so it moves to another phrase and keeps its subject.

**Three guards assert the claim stays gone**, following the idiom already in
`src/app/art/page.test.tsx` for the monthly themed class — "asserts it stays
absent, so it cannot be half-added later":

- `src/app/page.test.tsx` — covers Hero, Marquee, ProgramCards and QuoteStats
  in one assertion, since the landing page renders all four.
- `src/components/Footer.test.tsx` — the footer is in `layout.tsx`, so no page
  test reaches it.
- `src/app/art/page.test.tsx` — covers `/art`.

The guards are what make this reversible on purpose rather than by accident:
whoever restores the claim has to delete a test that says why it went, which is
the moment to check the copy exists.

## Documentation

Two design documents describe the claim and go stale. The repo already has a
convention for each, set by `docs/plans/design-doc-drift.md`:

- **`DESIGN_BRIEF.md`** — body states what is true now, dated addenda are the
  change log. Body updated, addendum added.
- **`INFORMATION_ARCHITECTURE.md`** — corrected in place, no addendum. It has
  no addenda today and inventing the pattern for one document while retiring it
  in the other would leave two conventions.

Left alone as historical records, per CLAUDE.md's rule against rewriting
history: `TASKS.md` (a completed-task log), `docs/plans/wild-coast-kids-landing.md`
(a plan), and the `DESIGN_BRIEF.md` addenda already there.

## How the claim comes back

Not by re-adding the phrase. The facts land in `docs/reference/art-program.md`
first — which charters or vendor systems, whether Wild Coast Kids is an
approved vendor, and what a parent actually does — because that is the file
for supplied knowledge that is not derivable from the code. Copy is written
from it, and the guards come out in the same slice that adds the copy.

That question is now recorded there, as open question 6. A plan under
`docs/plans/` is where a task is worked out; the reference doc is where someone
asking what is still unknown about the program actually looks.

## Out of scope

- Writing any charter-fund copy. That is the whole reason #104 is `needs-human`
  and the facts are not available.
- No ADR. The state is explicitly temporary and expected to reverse; ADRs here
  record decisions meant to hold.
- `/coop`, `/book` and `/community`, which never carried the claim.
- The interest-list flow, untouched.

## Slices

| #   | Slice                           | Delivers                                                                  |
| --- | ------------------------------- | ------------------------------------------------------------------------- |
| 0   | Write this plan down            | This file                                                                 |
| 1   | Withdraw the claim from the UI  | Seven surfaces, four updated assertions, three absence guards             |
| 2   | Correct the design docs         | `DESIGN_BRIEF.md` body + addendum, `INFORMATION_ARCHITECTURE.md` in place |
| 3   | Record what would bring it back | `docs/reference/art-program.md` open question 6                           |
