# The design docs describe a site that no longer exists

> **Historical.** Planned 2026-08-15, shipped in PR #43 on 2026-08-15.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

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

## Addendum — 2026-08-17: #27 is five items, and the gallery bugs have moved

#26 has merged. This records what changed under #27 between the plan being
written and the branch starting. Nothing in _Decisions_ changes: the IA doc is
still corrected in place, with no addendum of its own.

**#27 is five items, not three.** The plan above describes it as the three
errors in the doc's Content Hierarchy and Component Reuse Map — the section
order, the auto-scrolling gallery, and `GalleryStrip`. Re-checking the document
against the code on 2026-08-17 found two more with the same cause and in
sections the first three do not reach: the Content Growth Plan's **Gallery
strip** bullet, which repeats the looping claim and adds that "adding photos is
a data change, not a layout one"; and the Component Reuse Map's **Section
shell** row, which predates `SnapSection`. A fix scoped to items 1–3 would have
left both behind, in one case one table row below a row it corrected.

The count is no longer free, which is why the growth-plan bullet is wrong
twice. `src/components/galleryImages.test.ts` asserts the list divides into
whole rows of three, that each row is two `tall` tiles and one `wide` one, and
that the wide tile alternates side. Photos arrive in composed threes or the
gate fails.

**#40 is closed, so the _Out of scope_ bullet naming it is one issue stale.**
It folded into #38 (PR #44): its `md`–`lg` claim died when #37 moved the `stops`
variant to `lg` × 39rem, so that band has no stops left to overflow, and the
width-driven growth above `lg` is recorded on #38 as a stated exception rather
than a scheduled fix. What the bullet _decides_ is unchanged and still binding:
**#38 is open and the two-stop grid is still parked** (`galleryImages.ts`,
`docs/plans/gallery-aspect-rhythm.md`), so the prose states what is built — one
paged row, three tiles to a page from `lg` — and describes no grid.

**#45 closed and ADR-0008 landed, so the pager is part of what the prose must
match.** When this plan was written the gallery's controls were overlaid on the
row's left and right edges. They now sit in the section's heading block, above
the artwork, and the row keeps the page's gutter with its snap positions offset
to match. That makes item 2's "header + film strip" stale in both halves rather
than one: the strip is a paged row, and the header is where the pager lives.

## Addendum — 2026-08-17: #47 takes two Component Reuse Map rows, and the pill row names a shape

#27 has merged. Two rows of the Component Reuse Map were split out of it into
#47 rather than fixed alongside it, because their cause is different: they
drifted with the routed pages (`docs/plans/nav-pages-scaffolding.md`), not with
the section-snapping reorder #27 corrects. They belong to this plan all the
same — the same table in the same document, under the same decision that the IA
doc is corrected in place with no addendum of its own. Nothing in _Decisions_
or _Scope_ changes.

**The pill row names a shape, and says so.** It read `Pill button` under a
column headed `Component`, listing "Nav CTA, hero CTAs, card CTAs, form
submit". Two of those four are not one component: the nav CTA is a `NavLink`
(`src/components/Nav.tsx`) and the form submit is a bare
`<button type="submit">` (`src/components/InterestListForm.tsx`). What every
entry shares is `rounded-pill`.

The alternative was to keep it a component row — name `PillLink` and list its
eleven call sites. Rejected because this is a reuse map, and the reuse worth
recording is that three implementations converge on one shape; that convergence
is where the next drift will be, and a row naming only `PillLink` would have
dropped the nav CTA and the form submit out of the map entirely. #47's scope is
these two rows, so adding a third for them was not available. A descriptive
name in the first column with the identifiers in the third is what `Looping
track` and `Section shell` already do, so this costs the table no consistency.

**The `Placeholder` row was short by three call sites and one retired name.**
`Placeholder` has eight call sites. The row's "strip" is what `GalleryRow` was
called, and the row omits the reserved gallery box on each of `/art`, `/coop`
and `/community` — slots the routed pages added after the row was written.

**The counts are the check, and _Verification_ above already requires it.**
`grep -rn "<Placeholder" src/ --include=*.tsx` less its tests returns eight,
and `<PillLink` returns eleven. #47 adds no new check.

**`src/` stays out, and one thing in it now carries the retired name.**
`Placeholder`'s own docstring says "gallery strip", and `globals.css` claims
the gallery still runs the marquee animation — a claim `GalleryRow.test.tsx`
asserts against. Both are filed as #54 rather than fixed here.

## Addendum — 2026-08-18: #53 corrects two "embed" sentences, and the reader-facing copy splits off

#54 has merged. #53 corrects the last two places in these two documents that
still describe the conditions tool as an embed, a plan ADR-0009 retired. It
belongs to this plan for the same reason #47 did: the same two documents, under
the same decision that each is corrected in place. Nothing in _Decisions_ or
_Scope_ changes.

**The scope is two sentences, and the third candidate became its own issue.**
The issue named a third target — the reserved slots' own copy, "Drop the URL and
it embeds here automatically" — and left to triage whether it belonged here or
to the first conditions slice. It belongs to neither, and is now #59. Two
reasons. It is copy a visitor reads rather than a note for the team, so no gate
and no plan can settle it: what it should say is a content decision, and
`docs/plans/conditions-tool.md` has slices 4 and 5 open, which makes "how
finished is the tool" a live question rather than a settled one. And #50 already
removed the `/conditions` half of it, so what remains is one line in one file
with a different owner.

**What the sentences must not do is claim the tool is unbuilt.** ADR-0009 says
built here; #50 shipped the first reading, so `/conditions` names today's lowest
tide at La Jolla Shores today. But the landing teaser still carries its reserved
slot, and slices 4 and 5 are open. So the corrected sentences say three things
and no more: the tool is built here rather than embedded, the teaser's dashed box
still waits, and `docs/plans/conditions-tool.md` is where its state is recorded.
Naming a slice count or a completion state here would put this plan's prose in
the business of tracking another plan's progress, which is how both go stale.

**The brief's bullet stays an _Out of Scope_ bullet.** It is tempting to delete
it now that the tool is real, but this brief is the landing page's, and the
conditions tool is genuinely not part of it — it is built under its own plan.
What was wrong was the word for the thing excluded, not the exclusion.

**A third drift was found and filed, not folded in.** `CONTEXT.md:102` says the
teaser and `/conditions` "both currently carry a reserved slot". #50 made that
false. It is #60 rather than a third slice here, because the cause differs — a
count broken by #50, not the word retired by ADR-0009 — and because `CONTEXT.md`
is the glossary rather than one of this plan's two documents.

### Amended 2026-08-18: #53 is three specs, not two

Confirmed with Cole mid-branch rather than expanded quietly. #53 reasons that
"three design docs were not [amended], and two of them are specs rather than
dated records", and counts `INFORMATION_ARCHITECTURE.md`, `DESIGN_BRIEF.md` and
`TASKS.md`. It missed a fourth file, and that file is a third spec:
`DESIGN_TOKENS.css:74` reads `--radius-box: 20px; /* conditions embed box */`.

It qualifies on the issue's own test. Its header says the block "replaces the
scaffold tokens in `src/app/globals.css`" during the build, so it is the
authoritative source for the tokens rather than a record of what they once were
— the same standing as the brief and the IA doc, and the opposite of `TASKS.md`.

The comment is wrong twice, and only one half is this plan's drift. `embed` is
ADR-0009's, and it is what brings the line into scope. The other half is that
`rounded-box` is no longer the conditions box alone: `ReservedSlot` uses it for
all five slots and the three routed pages use it for their gallery boxes. Both
are corrected in one line, because a comment naming the wrong thing for the
wrong reason cannot be half-fixed — and the sibling tokens already list their
callers this way (`co-op activity tiles, inputs`), so the shape was set.

This does not reopen the `src/`-stays-out decision. `globals.css:110` carries the
same token with no comment on it, so there is nothing there to correct.
