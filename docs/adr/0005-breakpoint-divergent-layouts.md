# 0005 — Breakpoint-divergent layouts render twice

Date: 2026-08-14. Status: accepted.

## Context

The gallery shows the same nine images two ways. Below `lg` it is one
horizontally scrolling row the reader swipes a tile at a time. At `lg` and up
it is a static grid split across two snap stops, because one stop cannot hold
three rows at a readable size — see `docs/plans/gallery-aspect-rhythm.md`.

Those two layouts want the images in different places in the DOM. The swipe row
needs all nine in one scroll container. The grid needs three in stop A and six
in stop B, in separate `<section>` elements, because a snap stop is a box and
two stops are two boxes.

CSS cannot reparent. `display: contents` was investigated and does not help:
flattening stop A's wrappers to make the tiles join one scroller also flattens
the heading into it, which would make "What kids make here." a slide in the
gallery.

The alternatives were to give phones several short rows instead of one — three
rows of two, where a two-tile row does not scroll at all and the reader has
more to scroll past, not less — or to show phones fewer images than desktops,
which drops content silently.

This repo has a stated preference against duplicated DOM. PR #14 removed the
looping gallery strip, and `GallerySection.test.tsx` records the gain: every
placeholder is rendered once "full stop", where the strip had rendered each
twice and relied on `aria-hidden` to keep the copy quiet.

## Decision

A layout that genuinely diverges by breakpoint may render its content twice,
with each copy hidden at the widths where it does not apply — `lg:hidden` on
one, `hidden lg:*` on the other.

The gallery does this: a swipe row holding nine tiles and a grid holding nine
tiles, one of the two hidden at every width. Eighteen nodes in the document,
nine visible.

Three obligations come with it, and they are what make this a decision rather
than a shortcut:

- **Exactly one copy is visible at any width.** Not "usually one" — the hidden
  copy uses `display: none`, so it is out of the layout, out of the tab order
  and out of the accessibility tree.
- **The tests assert names per layout, not per document.** `getAllByRole` in
  jsdom sees both copies, because jsdom applies no stylesheets; an assertion
  written against the whole document would either fail or have to be weakened
  to "at least one", which asserts nothing.
- **One list, two render sites.** The duplication is two `.map()` calls over a
  single exported array, never two copies of the content. If the two ever
  disagree, that is a bug the composition tests catch.

## Consequences

This is not the marquee's duplication returning. That strip rendered the same
tiles twice _in the same layout, both visible_, as a mechanism — the second
copy existed so the loop had something to scroll into, and `aria-hidden` was
needed precisely because both were on screen. Here the copies are alternatives:
never both rendered, so nothing needs hiding from assistive tech by hand, and
deleting one would delete a layout rather than tidy a mechanism.

The cost is that the accessibility guarantee moves from provable to
browser-verified. In jsdom, nine names appear twice; only `display: none`
makes that untrue, and the gate cannot see it. That gap is inherited from
ADR-0001 and closing it means Playwright.

When photographs replace the placeholders, the hidden copy must not be
fetched. `loading="lazy"` covers it — a `display: none` image never enters the
viewport, so it never loads — but it stops being free the moment anyone writes
an eager `<img>`, and a phone would then pay for nine desktop images it cannot
see.

The rule has a boundary worth stating: this licenses duplication when the
layouts genuinely diverge in DOM structure, not when they differ only in size,
spacing or direction. Those are one layout with variant classes, which is what
every other section on this site is.
