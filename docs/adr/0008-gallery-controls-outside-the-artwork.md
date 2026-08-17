# 0008 — The gallery's paging controls sit outside the artwork

Date: 2026-08-17. Status: accepted.

## Context

Finding 4 of `DESIGN_REVIEW.md` called the gallery row "unfinished as an
interaction" and prescribed four fixes: page by the row's width, hide the
scrollbar, size the tiles so 3–4 are visible, and **move the controls onto the
row's left and right edges**. PR #14 did all four. The controls became `size-11`
circles, absolutely positioned at `left-3 md:left-6` and `right-3 md:right-6`,
overlaying the row.

Issue #45 then read the code and predicted the row rests past its own gutter.
Measuring confirmed it, and turned up a second fault the issue did not name: the
control's footprint is wider than the gutter it sits in. At `md`+ the gutter is
48px and the control occupies 24 + 44 = 68, overhanging the artwork by 20px;
below `md` it is 24 against 12 + 44 = 56, overhanging by 32.

Two measurements make this a design question rather than a tuning one.

**A 44px control cannot fit a 24px gutter.** ADR-0004 requires 44px below `md`
and `--spacing-gutter-sm` is 24px. No offset exists that puts the control in the
gutter on a phone. The only ways to make it fit are to shrink the control below
`md` — which ADR-0004 forbids — or to inset the row past the page gutter, which
costs the phone about 20% of its tile width.

**Padding is empty space only at the scroll extremes.** Mid-scroll, artwork
slides through the padding band. So an overlaid control sits on artwork at some
scroll position regardless of what the padding is, and `scroll-padding` — the
fix #45 proposes — cannot change that. The alternative that does, ending the
scrollport at the gutter, was measured and removes the partial tile at the
row's trailing edge: the share arithmetic in `galleryImages.ts` makes three
tiles fill the scrollport exactly. With the scrollbar already hidden, that
partial tile is the only thing on screen saying nine images exist.

## Decision

**A row whose content the reader is meant to study puts its paging controls
outside the artwork.** For the gallery that means the section's heading block,
above the row, rather than overlaid on its edges.

Finding 4's placement instruction is **superseded**. Its other three fixes
stand, and the finding as a whole was right about what it saw: controls sitting
below-left of a row with a visible scrollbar and per-item paging were
unfinished. Moving them onto the row's edges was the fix available at the time
for a row that had no other home for them.

## Consequences

The controls keep 44px at every width. Once they are out of the gutter there is
nothing to fit them into, so ADR-0004 needs no argument and the control's size
gains no breakpoint variation — the "second, invisible axis of variation" that
ADR-0004 says it wrote itself as a breakpoint rule to avoid.

`scroll-padding` becomes sufficient rather than partial, so the row keeps its
padding and keeps bleeding off-screen, and the partial tile at the trailing edge
survives. That partial tile is load-bearing: it is the row's only remaining
scrollability cue, and this decision is what lets it stay.

The controls' relationship to the row stops being positional, so it is stated:
the row takes an `id` and the buttons take `aria-controls`. Tab order changes —
the controls now come before the region they drive, which is the ordinary
reading order for a header control.

This has a boundary, and it is the same one ADR-0007 drew for motion. That
decision said motion decorates and does not carry, so a strip of words may loop
while a row of artwork may not. The same distinction applies here: an overlaid
control is a reasonable pattern for a dense row of thumbnails, where the
covered pixels are the edge of something nobody is studying. It is wrong for
nine pieces of children's artwork, which ADR-0007 already established is the
page's proof. This licenses moving controls off content the reader dwells on;
it is not a general rule against overlaid controls.

**The gate cannot check this.** jsdom applies no stylesheets (ADR-0001), so no
test can measure whether a control overlaps a tile. The class contract can
assert the pager is not absolutely positioned and that `aria-controls` names the
row, which catches the arrangement being undone; it cannot confirm that nothing
overlaps at a given width. That stays a browser measurement, recorded in
`docs/plans/gallery-row-gutter.md`.

What this costs is proximity on a phone. Below `md` the controls sit above the
row rather than on it, further from the thing they move, and the compensation is
that a phone reader swipes rather than pressing them. That is a trade taken
knowingly, and it is the part most likely to be re-litigated.
