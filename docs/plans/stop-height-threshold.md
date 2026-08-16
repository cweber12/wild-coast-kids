# Landing page stops: a height threshold

Status: agreed 2026-08-15. Issue #37. Follow-up from `section-snapping.md`,
which designed the stops against a window nobody re-measured.

## The problem, from the reader's point of view

On a 1080p display at 125% Windows scaling — the owner's own machine — Chrome
reports a 1536x639 viewport, and a stop gets 555px after the nav. Three of the
six stops need more than that, so `justify-center-safe` start-aligns them,
exactly as finding 1 of `DESIGN_REVIEW.md` asked it to. The result reads as
three separate faults: sections that are not centred, a page with no vertical
breathing room, and mandatory snapping that refuses to settle where you left
it.

None of those is a bug in a section. The page promises one screen per section
and the screen is smaller than the promise assumed.

## What the stops actually need

Measured on `main` at 2026-08-15, in Chrome, by rendering the page into an
iframe of a fixed CSS size and reading the content height of each stop's child.
The rig reproduces the numbers in issue #37 exactly at 1536x639, which is what
makes the rest of the sweep trustworthy.

| viewport width | hero | gallery | cards | conditions | interest | quotes |
| -------------- | ---- | ------- | ----- | ---------- | -------- | ------ |
| 768            | 570  | 543     | 623   | 277        | 560      | 304    |
| 900            | 588  | 642     | 623   | 299        | 560      | 295    |
| 1023           | 556  | 734     | 550   | 296        | 560      | 313    |
| 1024           | 556  | 347     | 550   | 296        | 560      | 313    |
| 1280           | 602  | 415     | 565   | 312        | 560      | 339    |
| 1536           | 612  | 473     | 577   | 312        | 560      | 297    |
| 1920           | 612  | 559     | 577   | 289        | 560      | 297    |

Two things the 1536-only measurement in the issue could not show:

- **The program cards are tallest at the narrow end**, 623px from 768 to about
  940, not the 577 they measure at 1536. Two columns at their narrowest wrap
  the most copy. 623 is the worst case on the page.
- **The hero's height has a ceiling.** `--text-display` clamps at 80px from
  about 1334px wide up, so the hero stops growing at 612 and stays there.

## The solution

One custom variant, meaning "this window can hold a stop":

```css
@custom-variant stops (@media (min-width: 48rem) and (min-height: 45rem));
```

Every class that describes the one-screen layout moves from `md:` to `stops:`.
Below the threshold the landing page is an ordinary scrolling page with its
section padding back — the same code path phones have had since
`section-snapping.md`, reached by a second door.

The brief claims one screen per section. That claim was false below roughly
780px of usable height; this makes it true by scoping it to the windows where
the page can keep it.

## Implementation decisions

**45rem (720px), derived from the worst stop.** The program cards' 623 plus the
84px nav is 707; 45rem is the next whole rem above it. Every stop the threshold
covers therefore fits at every width from `md` up, with 13px to spare. The
number is a measurement, not a taste — if content grows, re-run the sweep and
move it, rather than nudging a section until it fits.

**The gallery is excluded, and that is issue #40.** Between `md` and `lg` a
tile is `w-[85%]` with `aspect-4/3`, so that stop's height grows linearly with
viewport _width_ — 543 at 768, 734 at 1023, then 347 the moment `lg` lets three
tiles share the row. Covering it would need a 818px threshold, which would
switch the stops off on a 1440x810 laptop to protect a 940-1023px band; and it
would still be the wrong fix, because no `min-height` can bound an overflow
driven by the other axis. It is a regression from #19 (`f4c3408` dropped the
two-up step at `md`) and is filed as its own issue. **After this lands, a
window around 1000px wide still has one over-tall stop.** Said plainly here
because the alternative is a plan that reads as if the page were fixed.

**The variant carries the width condition too**, rather than stacking
`md:stops:`. One name for one layout mode: a call site cannot then have the
height half without the width half, which is exactly the drift the `--spacing-nav`
token was introduced to stop. `stops:` reads as "when this window has stops",
and `stops` is the word `CONTEXT.md` already uses for the thing.

**The children's padding moves with it.** `GallerySection`, `ProgramCards`,
`Conditions`, `InterestListTeaser` and `QuoteStats` drop their own vertical
padding at `md` because the stop supplies that space — `CONTEXT.md`'s Stop
entry says so. Gate the stop's height without gating the padding and a 639px
window gets six sections butted flush together, which is a worse page than the
one being fixed. This is the half most likely to be forgotten, so it gets its
own assertions.

**What stays on `md`.** `md:px-gutter`, `md:grid-cols-2`, `md:gap-*`, `Hero`'s
`md:pb-0` and `HeroViewport`'s `md:min-h-[calc(100dvh-var(--spacing-nav))]` are
about width, or about the poster filling the window — a decision that predates
the stops and survives them. `scroll-pt-nav` stays ungated: the nav is sticky,
so `#community` needs the offset whether or not anything snaps.

**Reduced motion is untouched.** Today `motion-safe:` gates the snap type but
not the forced heights, so a reader who asked for reduced motion still gets
screen-tall centred sections without snapping. That asymmetry predates this
change and is not what #37 is about; noted so the next reader does not think
this plan decided it.

**No new dependencies. No ADR** — ADR-0003 already records the nav and
scrolling model, and a threshold is not a dependency, a data format or a
threading contract.

## Test seams

Class contract, per the `StripTrack.test.tsx` precedent that jsdom applies no
stylesheets:

- **`SnapSection.test.tsx`:** the snap alignment, both height calcs and the
  centring carry `stops:`.
- **`layout.test.tsx`:** `html` carries `motion-safe:stops:snap-y` and
  `motion-safe:stops:snap-mandatory`.
- **The five children's tests:** each carries its `py-section-sm`
  unconditionally _and_ `stops:py-0`. This is the seam for the half that
  jsdom-free eyes would skip.

Beyond the class names:

- **`built-css.mjs` gains a `REQUIRED` row for `snap-start`.** This is the
  assertion that matters most. A `@custom-variant` Tailwind does not register
  makes every `stops:` class compile to nothing at all — silently, and
  invisibly to jsdom, since the class name is still in the markup. The row
  turns that into a red gate. It proves the variant compiles and emits
  declarations; **it does not prove 720 is the right number.** That stays a
  browser measurement, recorded above.
- **Outside the gate, needs a human in a browser:** that a 1536x639 window is
  an ordinary padded page with no snapping, and that a tall window is unchanged
  — six stops, centred. Inherited from ADR-0001.

## Slices

1. This plan.
2. Gate the one-screen layout on window height: the variant, the seven call
   sites, the class-contract tests and the built-CSS row. One slice, because
   gating the stops without gating the padding leaves the page worse than it
   started — there is no half of this that is independently shippable.
3. Catch the docs up: `CONTEXT.md`'s Stop entry, the brief addendum, an
   addendum here on `section-snapping.md`, finding 11 of `DESIGN_REVIEW.md`.

## Out of scope

- **The gallery's width-driven height** — issue #40.
- **Snapping on phones**, still deliberately off.
- **`proximity` snapping**, rejected twice now: `section-snapping.md` rejected
  it as too weak to read as intentional, and it would leave the over-tall stops
  over-tall.
- **Shrinking the sections to fit 555px**, which cannot work without cutting
  the hero's display type or its padding — the one composition every review so
  far has said is right.
- The reduced-motion asymmetry described above.
