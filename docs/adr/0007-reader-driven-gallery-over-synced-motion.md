# 0007 — The gallery is driven by the reader, and motion is the marquee alone

Date: 2026-08-15. Status: accepted.

## Context

`DESIGN_BRIEF.md` states three experience principles. The second is "Motion as
identity, never as obstacle", and it names the mechanism: "the two synced strips
give the page its pulse, but they pause on hover and stop entirely under
`prefers-reduced-motion`."

PR #14 removed one of those strips. The gallery became `GalleryRow` — a
horizontally paged row with prev/next controls at its edges, native scrolling
with `snap-x mandatory`, and a `tabindex="0"` focus stop so arrow keys reach it.
It does not move on its own. The marquee still does, and `StripTrack` — the
looping mechanic built to be shared by both — has had one caller ever since.

That left a question the documents could not answer, and it is why issue #26
was labelled `needs-human`. Either the principle was superseded and the brief
owes it an edit, or the principle stood and the code owes it a change: the
gallery should move again. Nothing in `docs/plans/section-snapping.md` or the
brief's 2026-08-13 addendum settles which, because both record _what_ changed
without saying whether the principle survived it.

## Decision

The principle is **restated, not retired**. Motion remains part of the site's
identity and the marquee carries it. The gallery is driven by the reader.

The brief's principle 2 now reads in terms of one strip rather than two synced
ones, and the gallery is described as paged wherever the brief and
`INFORMATION_ARCHITECTURE.md` described it as gliding.

## Consequences

The reason motion is right for the marquee and wrong for the gallery is that
the two carry different content. The marquee is a band of words the reader
takes in at a glance and does not need to finish; motion costs them nothing.
The gallery is nine pieces of children's artwork, which is the page's proof.
Artwork you want to look at should not slide away, and one you missed should be
one press back — the reason already written into `GallerySection`'s source.
"Never as obstacle" was always the second half of the principle; applied to
content the reader wants to dwell on, it argues against the motion rather than
for it.

So the principle is narrower than it was, and it now has a stated boundary:
motion decorates, it does not carry. A future strip of words may loop. A future
row of things a reader has to study may not.

What this costs is the synced-speed idea, which is genuinely gone. The two
strips shared one pixels-per-second rate and that was a real compositional
quality — `DESIGN_REVIEW-2026-08-11.md` credits it under _What Works Well_.
Nothing replaces it; the page's pulse is now one band rather than a rhythm
across two. That is a loss taken deliberately in exchange for artwork the
reader controls, and it is recorded here so the next person to read that review
does not treat the quality's absence as a regression.

`StripTrack` is now a seam with one caller, which its own doc comment states:
kept because the looping mechanic is intricate, not because anything varies
across it, and to be deleted with the marquee rather than to wait for a second
caller that is not coming. This decision is what makes that permanent — it
settles that no second caller is expected.

The accessibility obligations survive intact and shrink to one strip: the
marquee's duplicate track stays `aria-hidden`, hover still pauses it, and
`prefers-reduced-motion` still stops it. The gallery no longer needs any of
them, having no motion to stop — it needs its own guarantees instead, and has
them: the row is a named focus stop and the controls are the affordance.
