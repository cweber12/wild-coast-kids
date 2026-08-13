# 0003 — The nav sits in the document flow

Date: 2026-08-12. Status: accepted.

## Context

The nav was `position: fixed`, so it occupied no space and every page had to
reserve some for it. Six modules carried a hand-copied
`pt-[90px] md:pt-nav` to do that: the five routed pages and `Hero`.

`--spacing-nav: 70px` was described as the nav's height but was not it. By
arithmetic from the nav's own classes the bar renders around 82px on desktop,
so the token under-reserved by roughly 12px; the mobile literal `90px` was
never in the token file at all. Nothing broke visibly because each page's
first section adds 60–80px of its own padding on top, and nothing could
notice, because jsdom applies no stylesheets and the gate cannot see a
rendered layout (ADR-0001).

Separately, `html` carries `motion-safe:scroll-smooth` and the hero's CTAs
target `#art` and `#coop`, but nothing set `scroll-padding-top` — so anchor
targets scrolled up underneath the fixed bar.

## Decision

The nav is `sticky top-0` and participates in the document flow. Pages
reserve nothing; the offset class is deleted from all six modules.

The nav takes its height **from** `--spacing-nav` / `--spacing-nav-sm` via
`min-h-nav-sm md:min-h-nav`, inverting the old direction. The token is the
source of the height rather than a description of it, and the two remaining
consumers — the hero poster's height and `scroll-padding-top` — subtract the
same tokens, so they are right by construction.

## Consequences

A page can no longer forget the offset, because there is no offset to
forget. Adding a seventh route requires knowing nothing about the nav.

`min-h-*` rather than a fixed `h-*` is deliberate. Pinning the height would
make the subtraction exact to the pixel, but it clips the nav when a reader
scales text up. What that concedes is a few pixels on the poster's height and
a few pixels of extra gap above an anchor target — neither visible. Clipped
navigation is very visible. If the nav ever needs to be exactly its token,
that is the trade being reopened.

`HeroViewport` changes from `min-h-dvh` to `100dvh` minus the nav. It is now
the only module outside `globals.css` that knows the nav has a height, and it
knows it only as a subtraction. The poster still measures one window; before
this change it measured one window with the top ~82px hidden behind the bar.

**`overflow-x-hidden` on `body` was investigated and deliberately left
alone.** The obvious worry is that it makes `body` a scroll container and
stops `position: sticky` working. It does not, here: overflow propagates, so
while the root element's overflow is `visible` — nothing sets it on `html` —
the body's value is applied to the viewport and `body` itself behaves as
`overflow: visible`. The hazard is real when overflow sits on `html` or on an
intermediate ancestor. Recorded because removing it looks like an obvious
tidy-up and would risk reintroducing horizontal scroll for no gain.

The gate asserts the class contract — that the nav is sticky, that it takes
the tokens, that the poster subtracts them — in the style
`StripTrack.test.tsx` established. It cannot assert that the nav actually
sticks, or that the poster measures exactly one window. That gap is inherited
from ADR-0001 and closing it means Playwright.
