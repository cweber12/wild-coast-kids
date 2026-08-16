# The design docs describe a site that no longer exists

Covers issues #26 (`DESIGN_BRIEF.md`) and #27 (`INFORMATION_ARCHITECTURE.md`).
One decision applied to two documents; a shared plan is what stops them being
resolved differently.

## The problem, from the reader's point of view

`DESIGN_BRIEF.md` is the document design reviews are measured against. Someone
opening it to review the site reads that two synced strips give the page its
pulse, that the nav is a fixed bar of anchor links, and that the components are
called `GalleryStrip` and `CommunityForm`. None of that has been true since
PR #14 and PR #11. They then report the difference as a finding, because that
is what measuring against a brief means.

`INFORMATION_ARCHITECTURE.md` has the same problem in its Content Hierarchy: it
lists the sections in an order the page abandoned when the quote moved to the
close, describes the gallery as auto-scrolling, and names a component that does
not exist.

## What the issues got wrong, and why it matters

**#26 assumes the drift is unrecorded. It is not.** The brief already carries
three dated addenda. The 2026-08-13 one records every item #26 lists — the
gallery no longer moving, the routed nav, the sticky nav, and both component
renames — and it is dated the same day as the `DESIGN_REVIEW.md` whose finding 8
raised them. The addendum was the response to that finding.

That changes the diagnosis. The problem is not that nobody wrote the decision
down. It is that the corrections sit roughly 130 lines below the claims they
correct, so a reader measuring against the brief meets the stale body first and
never learns it was superseded. The record exists somewhere that does not
intercept the reader. That is why finding 8 was raised again after the addendum
already existed — the addendum pattern failed at the one job the brief has.

**#26's supporting evidence is also wrong in one detail.**
`DESIGN_REVIEW-2026-08-11.md` has findings 1–6 and no finding 8. What it has is
a _What Works Well_ section crediting "the synced strips", which the 08-13
review cites as item 6 _of its own_ finding 8. The issue conflated the two. The
second-order-cost argument survives regardless: the drift was re-reported, just
once rather than twice.

## Decisions

**The brief's body states what is true now; the addenda become its change log.**
The three dated addenda stay verbatim under a heading that says what they are —
history, not corrections pending application. The body stops contradicting them.

This reverses the brief's own stated preference. The 08-13 addendum says the
drift was "recorded here rather than rewritten, so the original intent stays
readable", and that was a deliberate choice. It is overturned because the brief
has one job — being the yardstick — and a body that must be reconciled against
three addenda before it can be used does not do that job. The original intent
stays readable anyway: the addenda quote the superseded claims verbatim, which
is the whole reason they are kept rather than folded in.

**Experience principle 2 is restated, not retired.** The marquee still carries
the motion; what was retired is the second synced strip. `docs/adr/0007` records
it, because restating a stated experience principle outlives this task and an
ADR is where that is looked for.

**The IA doc is corrected in place, with no addendum.** It has none today —
issue #25 corrected its routing claims directly — and inventing the pattern for
one document while retiring it in the other would leave two conventions where
there is currently one.

### Considered and rejected

- **Signpost the body instead of rewriting it.** Mark each stale claim
  "superseded — see Addendum 2026-08-13" and change nothing else. Honours the
  file's stated pattern and is a fraction of the diff. Rejected because the
  reviewer still has to reconcile a body against three addenda to know what
  they are measuring against, which is exactly the work that already failed.
- **Collapse the addenda into a single History section.** Cleanest end state.
  Rejected because it flattens the dated granularity of what changed when, and
  the dates are load-bearing: they are what let someone match a review to the
  state of the brief it was written against.
- **Treat the brief as a dated record like the reviews and leave it alone.**
  Rejected because the reviews record what someone saw on a day; the brief
  records what the site is meant to be. Only the second is a spec, and only a
  spec has to be current.

## Scope

**In:** `DESIGN_BRIEF.md` (#26), `INFORMATION_ARCHITECTURE.md` (#27), a new ADR.

**Out:**

- `DESIGN_REVIEW.md`, `DESIGN_REVIEW-2026-08-11.md` and `TASKS.md`. Dated
  records of what was seen and done on a day. Rewriting them to match today's
  code would destroy the evidence that the drift happened at all.
- Anything under `src/`. The code is right; the prose is what drifted. The one
  place this was a live question — whether retiring the gallery's motion
  violated principle 2 or superseded it — is settled by ADR 0007 as superseded,
  so no code change follows.
- The open gallery bugs. Issue #38 (split the grid across two stops) and #40
  (the stop's height grows with viewport width) are unresolved, and ADR 0005
  describes a two-stop grid the code does not yet have. The brief must not
  claim either is done. Where the body would otherwise assert something these
  contradict, it states what is actually built and leaves the bugs to their
  issues.

## Verification

No gate reads prose, so the checks are stated and run by hand:

- every component named in either document resolves to a file under
  `src/components/` or `src/app/`;
- the Content Hierarchy order matches the order of `SnapSection`s in
  `src/app/page.tsx`;
- every claim rewritten in the brief body was checked against the component
  that implements it, not against another document;
- `npm run gate` still passes, which for a prose-only change asserts only that
  nothing was broken in passing — it is not evidence the prose is right.
