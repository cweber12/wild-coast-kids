# Landing page section snapping

## Problem, from the user's point of view

The landing page is six self-contained pieces of content read as one long
scroll, so a reader on a laptop almost never sees one of them whole. They
stop on half a program card, or the top of the form with the heading gone.
The page has no sense of "here is the next thing"; it has a sense of "keep
going".

Two smaller things sit under that:

- The gallery strip moves on its own. A reader who wants to look at one
  piece of artwork has to wait for it to come round again, and cannot go
  back to the one that just left.
- The parent quote sits fourth, between the program cards and the
  conditions teaser, where it interrupts the two things a visitor came for
  rather than closing the page.

## Solution

On screens `md` and up the landing page snaps: one section per screen, six
stops. Below `md`, and for anyone who asked for reduced motion, it stays an
ordinary scrolling page.

The order changes so the quote closes the page:

1. Hero and marquee band
2. Gallery heading and image row
3. Art classes and Tuesday co-op cards
4. Conditions
5. Interest list
6. Parent quotes and footer

The gallery strip stops moving by itself and gains prev/next controls.

## Implementation decisions

- **Snap on the viewport**, `scroll-snap-type` on `html`. Rejected: a nested
  scroll container on the landing page — the sticky nav from ADR-0003 sits
  outside it so `position: sticky` would no longer relate to the scrolling,
  `scroll-pt-nav` would stop applying, and the footer would be outside the
  scroller entirely. `html` is shared by every route, but a snap container
  with no snap children is inert, so it scopes itself.
- **`md` and up only.** Two sections cannot fit a phone: the program cards
  are `≥1116px` (two cards at `min-h-[520px]`, stacked, plus gap and
  padding) and the interest list is `≥680px` before its teaser column (the
  form card alone is `min-h-140`). A phone has `100dvh − 90px`, between
  577px and 754px. Mandatory snapping over a section twice the viewport
  height means fighting the snap to read the most important content on the
  page. Rejected: `proximity` snapping, which is too weak to read as
  intentional on desktop either; and redesigning those two sections to fit a
  phone, which is a design project rather than this change.
- **`motion-reduce:snap-none`.** Mandatory snap overrides where the reader
  chose to stop, which is the thing that setting exists to opt out of. This
  matches the stance the repo already takes in `StripTrack`
  (`motion-reduce:animate-none`) and on `html` (`motion-safe:scroll-smooth`).
  Because snapping is already off below `md`, this is the same code path
  phone users get rather than an exotic one.
- **A `SnapSection` module** owning the height, the vertical centring and
  `md:snap-start`, wrapping each of the six. Otherwise
  `min-h-[calc(100dvh−var(--spacing-nav))]` is pasted at six call sites,
  which is exactly the drift ADR-0003 removed from the nav offset.
- **The hero's CTAs move to `/book` and `/coop`.** Under this grouping
  `#art` and `#coop` are the same screen, so two prominent buttons would go
  to one place; and both ids sit on `<article>` elements _inside_ a section,
  so an anchor jump lands at a non-snap position and the browser then snaps
  to whichever stop is nearest. Sending them to the pages gives them
  something the scroll gesture cannot already do. `#community` survives —
  the co-op card and the `/book` and `/coop` pages all point at it — with
  its id moving up to section 5's `SnapSection`.
- **The gallery row scrolls natively**, `overflow-x` with `snap-x`, and the
  buttons call `scrollBy`. Touch fling, trackpad, keyboard and screen-reader
  navigation all work without being reimplemented, and there is no index to
  desync when a resize turns four-and-a-half visible items into two.
  Rejected: an indexed carousel with a transform. The row is focusable
  (`tabindex="0"`, `role="group"`, `aria-label`) so arrow keys scroll it and
  it has an accessible name.
- **`GalleryRow` is a client module; `GallerySection` stays a server
  component** holding the heading — the same split as `InterestListTeaser`
  and `InterestListForm`.
- **`StripTrack` keeps one adapter.** The marquee genuinely needs the loop,
  so the module stays, but its doc comment claims two adapters justify the
  seam and that stops being true. The comment gets corrected rather than
  the module deleted.
- **Section 6 is not forced to a full screen.** `QuoteStats` and `Footer`
  come to about 507px against 816px available on a 900px window, and
  `Footer` lives in the root layout, so it cannot take `snap-align` without
  planting a snap point on every other route. The section takes its natural
  height and the document end acts as the final stop; the cost is that the
  last screen shows some of section 5 above the quotes, varying with window
  height. Rejected: moving `Footer` into the landing page's last section,
  which would give an exact screen at every size but contradicts the
  shared-chrome decision in `nav-pages-scaffolding.md` and needs a way to
  avoid double-rendering.
- **Section 6 gains a second quote**, laid out as two quotes above a row of
  the two stat tiles, closing about 140px of that gap and giving the parent
  voices the prominence that suits a closing screen. Its bottom border goes,
  since that edge now meets the footer.
- **The second quote is invented copy in the same voice as the first.**
  Recorded because it is a deliberate choice against this repo's placeholder
  discipline: every other unfinished thing on the site announces itself as
  unfinished, and a testimonial is a claim about a real family. It ships
  with a comment marking it as placeholder to replace before launch, so it
  is discoverable rather than indistinguishable.
- No new dependencies. No ADR: ADR-0003 already records the nav and
  scrolling model this builds on, and nothing here decides a dependency, a
  data format or a threading contract.

## Test seams

- **Class contract**, per the `StripTrack.test.tsx` precedent that jsdom
  applies no stylesheets: `SnapSection` carries `md:snap-start`, the height
  calc and `motion-reduce:snap-none`; `html` carries the snap type.
- **`GalleryRow`:** the controls exist and are labelled, they call `scrollBy`
  on the row, and the row carries its `tabindex`, `role` and `aria-label`.
  Each of the nine placeholders is exposed exactly once — with the loop gone
  there is no `aria-hidden` duplicate, so the existing assertion in
  `GallerySection.test.tsx` gets simpler and stronger rather than weaker.
- **`page.test.tsx`:** the six sections render, in this order. This is the
  seam for the reordering, and it is the one that would catch a section
  being dropped.
- **Hero CTAs:** their new `href`s.
- **Outside the gate, needs a human in a browser:** that snapping snaps,
  that each section fills a screen, that the row advances by one item, and
  that section 6 looks right at more than one window height. Inherited from
  ADR-0001.
- `npm run gate` green at every commit; the coverage floor rises as the new
  modules land tests.

## Slices

Blocked until #13 merges: this touches `Hero`, `ProgramCards`, `QuoteStats`,
`InterestListTeaser`, `GallerySection` and `page.tsx`, all of which that PR
changes.

1. This plan.
2. Move the quotes to the end of the page: two quotes above a stats row,
   bottom border off, second quote added.
3. `SnapSection`, wrapping the six sections, and the snap classes on `html`.
4. Point the hero's CTAs at `/book` and `/coop`; move `#community` onto
   section 5.
5. `GalleryRow`: stop the auto-scroll, add the controls and the focusable
   row; correct `StripTrack`'s doc comment.

Slice 2 before 3 so the section that is hardest to size exists in its final
form before anything depends on its height. Slices 4 and 5 are independent
of each other and of 3.

If this runs past the reviewable guide it splits between 4 and 5 — slice 5
shares no files with the rest.

## Out of scope

Real quote copy, real images, a booking provider, the conditions tool, a
form backend, dark mode.

Also deliberately not done:

- **Snapping on phones**, and the redesign of the program cards and the
  interest list that it would require.
- **An exact one-screen section 6**, which needs `Footer` to leave the
  shared layout.
- **The `#conditions` id.** Nothing links to it — the teaser points at the
  `/conditions` route — but `Conditions.test.tsx` asserts it as stable API.
  Retiring it is its own slice.

## Addendum — 2026-08-15 (the stops need a height threshold too)

Issue #37, `docs/plans/stop-height-threshold.md`.

- **"`md` and up only" is now "`md` and up, and 45rem tall".** The reasoning
  above sized the stops against phones and a 900px window, and never against a
  scaled desktop. A 1080p display at 125% Windows scaling reports a 639px
  viewport, which leaves a stop 555px; the hero needs 612, the program cards
  623 at their tallest and the interest list 560. `md:` alone let mandatory
  snapping run over three over-tall sections.

  The gate is now a `stops` custom variant carrying both conditions, and every
  class this plan put behind `md:` — the snap type on `html`, `SnapSection`'s
  heights, centring and snap alignment, and the sections' `py-0` — sits behind
  it instead. `md:snap-start` in the decisions and test seams above therefore
  reads `stops:snap-start` in the code.

- **`motion-reduce:snap-none` was never implemented**, and this addendum is
  where that stops being invisible. The code expresses the same intent with
  `motion-safe:` on the enabling classes, which is why `snap-none` is a
  FORBIDDEN row in `scripts/built-css.mjs` — the two lines of prose above are
  its only occurrences in the repo, and its appearance in the built stylesheet
  would mean this file was feeding Tailwind's scanner.

- **Rejecting `proximity` still holds**, for a second reason: it would have
  left the over-tall stops over-tall and only stopped the page fighting about
  it.
