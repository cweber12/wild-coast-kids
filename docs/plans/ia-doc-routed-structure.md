# IA doc describes the routed structure

> **Historical.** Planned 2026-08-14, shipped in PR #28 on 2026-08-14.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

Issue: [#25](https://github.com/cweber12/wild-coast-kids/issues/25).

## Problem, from the reader's point of view

`.design/wild-coast-kids-landing/INFORMATION_ARCHITECTURE.md` is the document
that defines this site's URL structure. It says the site is one page navigated
by four intra-page anchors, and lists `/#art`, `/#coop`, `/#conditions` and
`/#community` as its addresses.

Five of those statements are false against the code:

- `src/components/Nav.tsx` links to `/art`, `/coop`, `/conditions` and
  `/community` — routes, not anchors — with `/book` on the Book Now pill.
  Six routes exist under `src/app/`.
- The only surviving `id` in `src/` is `community`, on the `SnapSection`
  wrapping the interest-list teaser (`src/app/page.tsx`). `#art` and `#coop`
  were retired by the section-snapping work; `#conditions` by issue #17.
- The nav is `sticky top-0` and sits in the document flow, not `fixed`
  (`docs/adr/0003-nav-in-document-flow.md`).
- Below `md` the nav wraps to two rows rather than merely tightening.
- "Anything beyond that (blog, schedules, multiple pages) is a new IA
  exercise" — multiple pages arrived in `docs/plans/nav-pages-scaffolding.md`.

`/#conditions` is the sharpest: it reads as a live URL in the URL-structure
document and resolves to nothing.

## Solution

Correct the four sections of `INFORMATION_ARCHITECTURE.md` that make claims
about routing — Site Map, Navigation Model, User Flows, URL Strategy — plus
the one sentence in Content Growth Plan that says multiple pages do not exist,
and add a short Content Hierarchy subsection for the routed pages, which the
document does not mention at all.

Every route, link target and id written into the document is read out of the
code, not out of the issue text.

## Implementation decisions

- **The code wins.** The document is the thing that drifted; nothing under
  `src/` changes. Where the issue's summary of the code and the code disagree,
  the code is what gets written down. (It did disagree once: the issue lists
  four routed nav links and omits `/book`, which is a sixth route and the
  target of the Book Now pill and of three in-content CTAs.)
- **Anchors are described as retired, not silently deleted.** The URL Strategy
  section names `#art`, `#coop` and `#conditions` as retired and says what a
  surviving link to one would now do. A reader arriving from an old link or an
  old review needs to be told the anchor is gone, not to find no trace of it.
- **`#community` is documented as the one survivor**, with its call sites, so
  the "stable API" sentence keeps a referent instead of being deleted.
- **Two slices, because the causes differ.** Slice 1 is the routing
  correction, which is issue #25. Slice 2 restores the last true statement in
  Content Growth Plan, which the routes falsified. They commit separately so
  the routing correction can be reverted on its own.

## Verification seams

The gate does not read prose, so verification is two greps stated in the PR
body rather than a test:

1. Every `/#`- and `#`-style URL left in the document, checked against
   `grep -rn 'id=' src/` — only `community` may appear.
2. Every route the document lists, checked against the directories under
   `src/app/`.

Plus `npm run gate`, which must stay green on a docs-only change.

## Considered and rejected

- **Rewriting the whole document to match today's code.** The document has
  drift from the section-snapping work too — the home page's section order,
  a `GalleryStrip` component that is now `GalleryRow`, and a gallery described
  as auto-scrolling when it now has prev/next controls. Different change,
  different cause; folding it in would make one commit that cannot be
  described without "and". Filed separately.
- **Deleting the retired anchors and saying nothing.** Cheapest edit, worst
  document: the next person to find a `/#conditions` link elsewhere in the
  repo learns nothing about why it is dead.
- **Leaving Content Hierarchy alone entirely.** It would then describe the
  hierarchy of one of six pages without saying the other five exist, which is
  the same class of error this issue is fixing.
- **Adding a gate that greps prose for dead anchors.** Tempting, but the gate
  table judges the repo, and `.design/` holds dated records that are
  _supposed_ to contain historical URLs (`DESIGN_REVIEW.md`). A gate that
  cannot tell a record from a spec would have to be silenced immediately.

## Out of scope

- `DESIGN_REVIEW.md` and `DESIGN_REVIEW-2026-08-11.md` — dated records of what
  was found on a given day. Rewriting a review to match today's code destroys
  the thing that makes it evidence.
- `TASKS.md` — a record of work completed against the brief as it then stood.
- `DESIGN_BRIEF.md` — its drift is a judgement call about design direction,
  tracked as #26.
- Any file under `src/`. This is a factual correction to prose.
- Whether the routed structure is the _right_ structure. #26 asks that; this
  plan only makes the document agree with what was built.
