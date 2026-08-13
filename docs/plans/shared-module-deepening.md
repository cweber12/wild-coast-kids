# Shared module deepening

## Problem, from the user's point of view

Two things a visitor meets today are wrong, and both come from one cause:
the nav is `position: fixed`, so every page separately guesses how much
room to leave for it.

- Clicking "🎨 Book Art Class" or "Tuesday Co-op →" on the landing page
  scrolls the target section up under the nav bar. Nothing sets
  `scroll-padding-top`, and `html` has `motion-safe:scroll-smooth`, so the
  reader watches their destination slide behind the menu.
- The desktop offset reserves `--spacing-nav: 70px` for a nav that occupies
  roughly 82px. Nothing has noticed because each page's first section adds
  60–80px of its own padding on top.

Nobody can catch either one, because the offset lives as a hand-copied
class in six unrelated modules and no gate can see a stylesheet.

Behind that sit two shapes the site is made of that have no module at all:
the reserved slot (six copies) and the pill CTA (eleven call sites across
five different geometries, including the same "Book a class" rendered two
different sizes).

## Solution

The nav joins the document flow. Pages stop reserving space for it
entirely — the offset class is deleted from all five pages and from `Hero`
— and the two places that still need the nav's height sit next to the nav:
`scroll-padding-top` in `globals.css`, and the hero poster's height.

Then the reserved slot and the pill each get one module, so the six and
the eleven become call sites rather than copies.

## Implementation decisions

- **Nav in the document flow, not a better offset.** Rejected: a layout
  wrapper carrying the padding with `HeroViewport` opting out — keeps the
  number and adds an opt-out to know about; and tokens-only — fixes the
  wrong number but leaves the leak, so a sixth page can still forget it.
- **`overflow-x-hidden` moves off `body` first, as its own slice.** Per
  spec, setting `overflow-x: hidden` computes `overflow-y` to `auto`, which
  makes `body` a scroll container — the classic way `position: sticky`
  silently stops sticking. Both strips already clip through their own
  `overflow-hidden` wrappers, so it should be removable. This slice goes
  first because it is the one that can invalidate the approach.
- **The nav's height is measured in a browser**, not derived from class
  arithmetic. The arithmetic that found the 70px/82px mismatch is a reason
  to measure, not a measurement.
- **The poster stays exactly one viewport.** `HeroViewport` becomes
  `min-h-[calc(100dvh-var(--spacing-nav))]`. This is the one module that
  still knows the nav's height, down from six. Rejected: plain `min-h-dvh`,
  which would drop the marquee below the fold.
- **`ReservedSlot` takes its copy as props, not children.** The module owns
  the "X coming soon." / blank line / detail rhythm, because that rhythm is
  what has been drifting. Two tones — light, and on-ocean — which is two
  adapters, so the variant is real rather than hypothetical.
- **`PillLink` carries a closed list of five tones** named for the palette
  tokens: `yellow`, `purple`, `ocean`, `outline-light`, `outline-dark`.
  Links only. The interest-list form's submit control stays a `button`, and
  the nav's Book Now pill keeps its own responsive geometry — it is chrome,
  not a body CTA. Every `href` goes through `next/link`, hashes included.
  Rejected: an `as`/`fullWidth` axis, which puts geometry back in the
  interface; and branching on a leading `#` to emit a bare `<a>`, which
  hides an invariant the types do not show.
- No new dependencies. `docs/adr/0003-nav-in-document-flow.md` records the
  flow decision and the `overflow-x` constraint, because a reader seeing a
  non-fixed nav under a full-bleed poster will otherwise "fix" it back.

## Test seams

- **Class contract**, following the `StripTrack.test.tsx` precedent that
  jsdom applies no stylesheets so the contract is the seam: the offset
  class is absent from every page's `main`, `html` carries the
  scroll-padding, `PillLink` maps each tone to its classes, `ReservedSlot`
  renders its label and hides its emoji from assistive tech.
- **The existing assertions are the regression net for both extractions.**
  Page tests already assert every reserved slot by its copy and every CTA
  by its `href`; those assertions stay untouched, and their staying green
  is the evidence the extraction preserved behavior.
- **The scroll-padding slice is a bugfix**, so its regression test is
  committed first and must fail first.
- **Outside the gate's reach, needs a human in a browser:** that the nav
  actually sticks after the `overflow-x` change, that the poster still
  measures exactly one viewport, that anchors land clear of the nav, and
  that eleven pills look unchanged. ADR-0001 already records why unit tests
  cannot reach this; both PRs are marked needs-human for it.
- `npm run gate` green at every commit. The coverage floor rises as the new
  modules land their tests.

## Slices

PR A — branch `nav-in-flow`:

1. This plan.
2. Move `overflow-x-hidden` off `body`; confirm both strips still clip.
3. The nav joins the document flow: measured token, offset deleted from the
   five pages and `Hero`, `HeroViewport` on `calc`. Ships ADR-0003.
4. `scroll-padding-top` on `html`, so anchors land clear of the nav.
   Regression test first.

PR B — branch cut from `main` after PR A merges:

5. Say "interest list" on the interest-list form's submit control.
6. Rename `CommunityForm` to the teaser it now is.
7. `ReservedSlot`, and its six call sites.
8. `PillLink`, and its eleven call sites.

Slices 5 and 6 are the two gaps left open by the `/community` fix in
`nav-pages-scaffolding.md`; they lead PR B because they are small and
because slice 5 is what makes `CONTEXT.md`'s interest-list entry true of
the code. If PR B grows past the reviewable guide, it splits between
slices 7 and 8 — they share no files with each other.

Per-slice issues are skipped, per CLAUDE.md §5: these are sequential, they
touch the same files, and two people could not pick up two of them without
colliding.

## Addendum — 2026-08-12 (correction, before slice 2)

**Slice 2 is dropped, and the constraint that justified it was wrong.**

The plan above claims `overflow-x: hidden` on `body` makes `body` a scroll
container and breaks `position: sticky`. That is the wrong reading of the
spec for this configuration. Overflow propagates: when the root element's
overflow is `visible` — nothing sets it on `html` here — the **body's**
overflow value is applied to the viewport instead, and `body` itself is
then treated as `overflow: visible`. So `body` is not a scroll container,
and sticky descendants behave normally. The gotcha is real when overflow
sits on `html` or on an intermediate ancestor, neither of which applies.

So `overflow-x-hidden` stays where it is. Removing it would have risked
reintroducing the horizontal scroll it was presumably added to suppress,
to fix a problem that was not there.

**Slice 3 changes shape as a result.** The plan said to measure the nav's
height and write it into the token. That keeps the token _describing_ an
emergent value, which is the same drift that produced the 70px/82px
mismatch in the first place — it would just be correct for a while longer.

Instead the dependency inverts: the nav takes its height **from** the
token (`min-h-nav-sm md:min-h-nav`), so the token is the source of truth
rather than a description of one. Nothing needs measuring, and the two
remaining consumers — the hero poster's height and `scroll-padding-top` —
are correct by construction rather than by vigilance.

`min-h-*` rather than a fixed `h-*`: pinning the height exactly would
guarantee the calc is exact to the pixel, but it clips the nav if a reader
scales text up. The inexactness this concedes is a few pixels on the
poster's height and a few pixels of extra gap above an anchor target, and
neither is visible; clipped navigation is. The trade is recorded in
ADR-0003.

## Addendum — 2026-08-13 (PR B build)

- **Slice 5 covered one more CTA than planned.** The plan scoped it to the
  form's submit control, but the co-op card said "Join interest list"
  without the article. `CONTEXT.md` says every CTA that joins the interest
  list reads "Join the interest list", so both moved together — the point
  of the slice is that the glossary becomes true of the code.
- **`CommunityForm` became `InterestListTeaser`.** Both halves of the name
  come from the glossary.
- **`PillLink` unifies geometry as well as tone**, which the plan implied
  but did not say. Eleven call sites carried five paddings; they converge
  on the one the hero and the page CTAs already used, so the most common
  pill is unchanged and the rest move two or three pixels. Solid and
  outline now differ by exactly the border width so their outer boxes line
  up — already true on the program cards, not in the hero.
- **The coverage floor rises** to what the repo now achieves, per the rule
  in the threshold comment.

## Out of scope

Real copy, images and logo; the booking provider and its embed; the
conditions tool itself; a form backend; dark mode.

Also deliberately not done:

- **Naming the conditions embed slot as its own module.** The reserved slot
  for it exists twice, so the future one-line swap is two — but it is cheap
  once slice 7 lands, and it is only ×2. Its own slice, later.
- **A data-driven `ProgramCard`.** The two cards diverge structurally (an
  activity grid against a badge row), so the module would need about a
  dozen parameters — an interface as complex as the implementation it
  hides. Shallow by construction.
- **A routes or links map module.** Fails the deletion test: delete it and
  the strings simply inline again. Constants concentrate nothing.
- **A generic `PageShell`.** The five page openings are near-identical, but
  the part that actually matters is the nav offset, and slice 3 removes
  that without inventing a module.
