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

## Addendum — 2026-08-15: the threshold was answering the wrong question

The 45rem threshold above is wrong, and the reason is a number nobody measured
before choosing it.

```
screen.height       864   1920x1080 at 125% scaling
screen.availHeight  816   less the Windows taskbar
Chrome's furniture  177   tab strip, address bar
max viewport        639   <- maximised, on this display, full stop
```

**The owner's display cannot produce a 720px viewport in a normal window.** Not
by resizing: 639 is the ceiling a maximised Chrome gets, and only F11 fullscreen
clears it. So a 45rem threshold does not merely switch the stops off "on short
windows" — it switches them off permanently on the only machine the site is
reviewed from, and leaves issue #38, the two-stop gallery grid, permanently
unbuildable there, since its own plan needs a stop taller than this one has.

The body of this plan reasoned carefully about which windows should keep the
stops and never asked whether the reviewer's window could be one of them. That
is the same failure as the original bug — designing against an assumed viewport
— committed one level up.

**Decision reversed.** The stops are made to fit 555px rather than switched off
above it. The threshold survives, at a number that admits the machine it was
written for.

### The new arithmetic

| quantity              | value                                |
| --------------------- | ------------------------------------ |
| reviewer's viewport   | 639                                  |
| less the nav          | 555 available                        |
| target for every stop | **540** (15px of headroom)           |
| threshold             | **39rem = 624** (540 + the 84px nav) |

39rem, not 40. 40rem is 640px — one pixel above the ceiling above, which would
have reproduced the whole problem in a plan written to fix it.

### The trims, measured at 1536 before and after

| stop          | was | where the height was                                | change                                                    | now |
| ------------- | --- | --------------------------------------------------- | --------------------------------------------------------- | --- |
| hero          | 612 | 120px of `md:py-15`, 441px of content               | `md:py-5`                                                 | 532 |
| program cards | 577 | `p-9`; the emoji renders 66px tall at `text-[44px]` | `p-7`, `leading-none` on the emoji, two margins tightened | 531 |
| interest list | 560 | `min-h-140` on the form card                        | card `min-h-126`, success `min-h-108`                     | 504 |
| gallery       | 473 | —                                                   | —                                                         | 473 |
| conditions    | 312 | —                                                   | —                                                         | 312 |
| quotes        | 297 | —                                                   | —                                                         | 297 |

Two of the three cost almost nothing, which is why this was the wrong trade to
refuse:

- **The hero's padding is not binding on a tall window.** The text column is
  `justify-center` inside a box already `100dvh - nav` tall, so above the
  threshold the content is centred in the same space whatever the padding is.
  Cutting it changes the poster only on the windows that need it cut.
- **The interest list's `min-h` contradicted its own comment.** The comment says
  it is sized so the success swap does not collapse the card, "≈ the rendered
  form" — but the form is 431px of content in a 72px-padded card, 503 tall,
  while the success state's own `min-h-120` makes it 552. The card was sized to
  the success state and the form paid 57px for it. Both are now derived from the
  form's measured content, which is what the comment always claimed.

### The width half moves to `lg`

`(min-width: 64rem) and (min-height: 39rem)`.

Between 768 and 1023 the cards are 623 and the trim only reaches 585. The extra
is not padding: the two CTA pills wrap to a second line there (97px against 43)
and the co-op paragraph runs 61 against 41, because the two columns are ~360px
wide. Closing that needs shorter pill labels or stacked CTAs and shorter copy —
composition changes that would show at every width to fix one band.

`lg` instead makes that band an ordinary scrolling page. This is the rule
`gallery-aspect-rhythm.md` already chose for the gallery — "small screens
swipe, large screens grid" — now applied to the page rather than to one section,
and it dissolves the `md`–`lg` half of issue #40: there is no stop in that band
to overflow. _Rejected: keeping `md`._ It buys snapping on tablets at the cost
of copy changes on desktops, and leaves an over-tall gallery stop behind anyway.

### What is still not fixed

Issue #40 survives above `lg`, in the other direction: the gallery's tiles are a
percentage of the row with a fixed aspect, so its stop grows with width without
limit — 473 at 1536, 559 at 1920, 703 at 2560. It clears the 540 budget to about
1750px wide and exceeds it beyond that. The fix is the `gallery-fit` cap already
designed in `gallery-aspect-rhythm.md`, which derives the grid's max width from
the stop's height; it belongs to #38 and #40, not here.
