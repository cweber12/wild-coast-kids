# The gallery row's gutter, and where its controls belong

> **Historical.** Planned 2026-08-17, shipped in PR #46 on 2026-08-17.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

Issue #45. Branch `issue-45-gallery-row-gutter`.

Confirms and widens the code reading filed as #45: the row does rest past its
own gutter, and the controls have a second, independent problem that the
proposed fix does not touch.

## Problem, from the reader's point of view

On every load, at every width, the gallery's leftmost artwork sits flush against
the edge of the screen and the `←` control sits on top of it. Nothing else on
the page does this — the `What kids make here.` heading directly above the row,
and the program cards below it, both keep the page's `--spacing-gutter` inset.
The gallery alone loses it, and the reader's first sight of the artwork is a
tile with a button parked over its corner.

Scrolling does not clear it. At the far end of the row the `→` control overlaps
the last tile too, by less — which is the tell that there are two faults here,
not one.

## What is actually wrong, measured

Measured in Chrome against the dev server, reading the live DOM before any
interaction. Numbers below are at 1536x639 — Cole's review window — and at 375
wide.

**Fault A: the row rests past its own gutter.** A scroll container's snapport is
its scrollport reduced by `scroll-padding`, which is unset here. `snap-start`
therefore aligns a tile's left edge with the _padding box_ start, so the first
tile's snap position is `scrollLeft: padding-left` — not `0`. Under
`scroll-snap-type: x mandatory` the container must rest on a snap position, so
it comes to rest one whole gutter in, having consumed its own left padding:

|      | `scrollLeft` at rest | `scroll-padding-left` | tile 1 left | `h2` left |
| ---- | -------------------- | --------------------- | ----------- | --------- |
| 1536 | **48**               | `auto`                | **0**       | 48        |
| 375  | **24**               | `auto`                | **0**       | 24        |

This is exactly the reading in #45, confirmed.

**Fault B: the controls are wider than the gutter they sit in.** Independent of
A, and not fixed by it. `CONTROL_CLASSES` is `size-11` — 44px, per ADR-0004 —
offset by `left-3 md:left-6`. The control's inner edge therefore lands past the
content edge:

|            | gutter | control footprint | overhang into the artwork |
| ---------- | ------ | ----------------- | ------------------------- |
| `md`+      | 48     | 24 + 44 = 68      | **20px**                  |
| below `md` | 24     | 12 + 44 = 56      | **32px**                  |

The 20px figure is measurable today at the scroll end, where the padding _is_
honoured and fault A is out of the way. It matches the screenshot on #45
captioned "rightmost image slightly overlaps control".

**Fault B cannot be fixed by moving the control into the gutter.** Below `md`
the gutter is 24px and ADR-0004 requires 44px, so a 44px control will never fit
a 24px band. That is not a tuning problem; it is arithmetic.

**And padding is not empty space except at the extremes.** `scroll-padding`
alone was measured: it fixes the resting state (`scrollLeft: 0`, tile 1 at 48)
and nothing else. Mid-scroll, artwork slides _through_ the padding band, so the
control is over a tile again on page 2. Padding reserves space at the scroll
extremes only.

## Solution

Two changes, neither of which fights the other:

1. **`scroll-pl-gutter-sm md:scroll-pl-gutter` on the row**, matching its
   padding. The snapport now starts where the gutter ends, so the first tile's
   snap position is `0` and the row rests on its own inset. This is the fix #45
   proposes, and with change 2 in place it is sufficient rather than partial.
2. **The controls move out of the artwork band** into the heading block's
   right-hand column, above the paragraph.

Change 2 is what makes change 1 enough: `scroll-padding` was only ever
insufficient because the controls were inside the band the artwork scrolls
through. Take them out and the mid-scroll case stops mattering.

### What this costs, measured

Nothing that shows. The controls take no horizontal space in their new home, so
the tiles are untouched, and they fit in vertical space that is already empty:

|            | tall tile | wide tile | tile height | whole tiles | peek   |
| ---------- | --------- | --------- | ----------- | ----------- | ------ |
| 1536 today | 413.1     | 550.8     | 309.8       | 3           | 72px   |
| 1536 after | 413.1     | 550.8     | 309.8       | 3           | 72px   |
| 375 today  | 265.2     | —         | 198.9       | 1           | 70.8px |
| 375 after  | 265.2     | —         | 198.9       | 1           | 70.8px |

The vertical budget at 1536x639: the gallery stop is 555px and its section
content 473px, so there is 82px of slack. It is not needed. The heading block is
123.2px tall because the `h2` runs to two lines, while the paragraph beside it
is 40.8px and bottom-aligned by `md:items-end` — leaving **82.4px of empty
height above the paragraph**, in a column 134px wide. Two 44px controls and a
`gap-3` come to 100px. The pair fits in space the layout is already spending, at
zero added height.

Below `md` there is no height cost to worry about either: the `stops` variant
requires `min-width: 64rem`, so a phone is an ordinary scrolling page.

## Implementation decisions

**The controls keep 44px at every width.** Moving them out of the gutter removes
the only reason to shrink them, so ADR-0004 needs no argument and
`CONTROL_CLASSES` keeps `size-11`.

**The padding stays; the row keeps bleeding off-screen.** The alternative —
margin instead of padding, so the scrollport ends at the gutter — was measured
and rejected. See below.

**`GalleryRow` keeps the paging mechanic; `GallerySection` places the
controls.** The controls need the scroller's `clientWidth`, so separating them
in the DOM means publishing a seam. The mechanic moves into a
`useGalleryPaging()` hook returning `{ rowRef, page }`; `GalleryRow` renders the
scroller and takes `rowRef`; a `GalleryPager` renders the two buttons and takes
`page`. `GallerySection` composes both, which is where the composition already
lives — it owns tile geometry today for the same reason, and says so in a
comment.

The hook is kept as a named seam for the reason `StripTrack`'s doc comment
gives about the looping mechanic: the interesting part is intricate and worth
one home, not because anything varies across it. `scrollBy(clientWidth)` and
its dependence on `snap-x mandatory` to correct the landing is that intricate
part, and the reasoning currently written into `GalleryRow`'s doc comment moves
with it.

**The buttons gain `aria-controls`, and the row gains an `id`.** Today the
buttons sit next to the row in the DOM and their relationship to it is
positional. Once they are in the heading block that is gone, so it gets stated
instead. This is an addition the current layout should arguably have had; it is
in scope here because the move is what removes the implicit version.

**Tab order changes, and that is accepted.** The controls come before the row in
the DOM after this. A control announced before the region it drives is the
ordinary reading order for a header control, and `aria-controls` names the
target.

## Test seams

Class contract, per the `StripTrack.test.tsx` precedent that jsdom applies no
stylesheets — and per #45's own observation that the class contract is the only
seam jsdom can reach for this:

- **`GalleryRow.test.tsx`:** the row carries `scroll-pl-gutter-sm` and
  `md:scroll-pl-gutter`. This is the regression test for fault A and must fail
  before the fix.
- **`GalleryRow.test.tsx`:** the existing "the controls sit on the row's edges"
  test is replaced, not deleted. It asserts `absolute`/`left-3`/`right-3`, which
  is precisely the arrangement being removed; its replacement asserts the pager
  is not absolutely positioned and the row has no control overlaid on it.
- **`GalleryRow.test.tsx`:** paging still calls `scrollBy` with one
  `clientWidth`, in both directions. This is the existing pair of tests and they
  must survive the hook extraction unchanged in meaning — they are the evidence
  the refactor preserved behaviour.
- **`GallerySection.test.tsx`:** the pager renders inside the heading block, and
  its buttons' `aria-controls` matches the row's `id`.

**`built-css.mjs` gains `REQUIRED` rows for `scroll-pl-gutter-sm` and
`md:scroll-pl-gutter`.** A Tailwind utility that resolves to nothing still
appears in the markup, so the class-contract test above passes either way. The
gate row is what proves the declaration is emitted. It does **not** prove the
value is right; that stays a browser measurement, recorded above.

**Outside the gate, needs a human in a browser:** that the row rests on its
gutter at load, that no control overlaps artwork at any scroll position, and
that the controls read as belonging to the row from their new position. ADR-0001
and ADR-0004 both already record this gap. The measurements above were taken at
1536x639 and 375 only — **768 and 1024 are unverified**, and checking them is
part of slice 2's verification, not an assumption of it.

## Slices

1. This plan, and ADR-0008.
2. **Rest the row on its own gutter.** `scroll-pl-gutter-sm
md:scroll-pl-gutter`, its failing-first class-contract test, and the two
   built-CSS rows. Independently shippable and independently good: it takes the
   left-hand overlap from 68px to 20px and restores the inset at load, without
   depending on slice 3.
3. **Move the paging controls out of the artwork.** The `useGalleryPaging`
   extraction, `GalleryPager`, the heading-block placement, `aria-controls`, and
   the test changes above. Takes the overlap to zero at every width and every
   scroll position.
4. **Catch the docs up.** `CONTEXT.md`'s gallery entry, and an addendum on
   `DESIGN_REVIEW.md` finding 4 recording that its "move the controls onto the
   row's left and right edges" instruction is superseded and why.

Slice 3 depends on slice 2 only for tidiness of review; they touch the same file
but not the same lines. Slice 4 depends on both.

## Considered and rejected

**Margin instead of padding, so the scrollport ends at the gutter.** This was
the strongest alternative and was measured across four scroll states. It works:
artwork under the controls goes to 0px at rest, page 2, page 3 and the end, the
leading tile lands on exactly 48 every time, and fault A disappears as a side
effect because there is no padding left to consume. It was rejected for one
measured reason: **it kills the peek.** The 0.3/0.3/0.4 share arithmetic
recorded in `galleryImages.ts` makes three tiles and two gaps equal exactly one
content width, so when the scrollport equals the content box, three tiles fill
it precisely and no partial tile remains — measured at 1536, `whole=3
partial=0 peek=0`. With the scrollbar already hidden by `no-scrollbar`, the
partial tile is the only thing on screen saying there are nine images. Trading a
discoverability affordance for an alignment fix is the wrong direction, and it
would have been invisible in review because the row still looks finished.

**Pulling the controls into the gutter** (`md:left-1`, control flush at 48).
Fixes `md`+ only. Below `md` a 44px control cannot fit a 24px gutter, so phones
keep a 32px overlap — the worst case of the two, on the narrowest artwork. Also
cramped: a 44px circle in a 48px band leaves 2px either side.

**Shrinking the controls at `md`+ to fit the gutter** (`md:size-9` at
`md:left-1.5`, measured at 0px overlap). Permitted by ADR-0004, which requires
only 24px above `md` and names these very controls as the site's 44px instance.
Rejected because it buys at `md`+ what the move buys everywhere, while adding a
breakpoint divergence in the control's size — the "second, invisible axis of
variation" ADR-0004 says it wrote itself as a breakpoint rule to avoid.

**Insetting the row far enough below `md` to host a 44px control** (`mx-14`,
56px; measured at 0px overlap at 375). Costs the phone about 20% of its tile
width, taking the scrollport from 312 to 248, and puts the gallery's inset out
of step with the page gutter on exactly the screens where space is scarcest.

**`scroll-padding` alone**, as #45 proposes. Sufficient only in combination with
slice 3; on its own it fixes the load state and leaves both screenshots that
show a scrolled row unchanged. Recorded here because the issue proposes it and a
reader should not conclude it was overlooked.

## Out of scope

- **The controls are dead at the row's ends and do not say so.** Measured: at
  rest `scrollLeft` is already at minimum so `←` does nothing, and after two
  `→` presses the row pins at `maxScroll` and further presses do nothing. Both
  controls stay enabled and styled as active throughout. This is a real defect
  and a separate one — it predates this work and is not caused by it. To be
  filed as its own issue.
- **A scrim or gradient behind the controls**, which is the overlay pattern's
  own fix. Moot once they are out of the artwork.
- **Position indicators** (dots, or a progress bar for the three pages). A
  genuine option for a nine-item row with three visible, and unrelated to
  either fault here.
- **The hidden scrollbar.** `no-scrollbar` removes a visible affordance and a
  mouse drag target; that is a live question, raised by the peek finding above,
  but it is a separate decision.
- **Verifying anything in Firefox or Safari.** Every measurement here is Chrome.
- **The gallery grid**, still parked on issue #38.

## Addendum — 2026-08-17: what implementing it changed

Four things the plan above did not say, recorded rather than edited in.

**`GallerySection` is now a client component.** It holds the paging seam the
row and the pager share, so it holds the hook, so it carries `"use client"`.
The plan said "`GallerySection` composes both" without noticing that follows.
Its own content is static; what hydrates is the wiring between the two. The
alternative — a client wrapper owning the heading block so the section could
stay a server component — was not taken, because it would put the section's
heading layout inside a component named for the row.

**The built-CSS row is `scroll-pl-gutter`, not `md:scroll-pl-gutter`.** The
variant form does not match: the built selector escapes the colon, so
`rulesFor` reads `.md\:scroll-pl-gutter` and a table entry written with a bare
colon finds nothing. This is the case `min-h-footer`'s comment already
documents. The trailing `(?![\w-])` boundary in that matcher is what keeps the
bare form off `scroll-pl-gutter-sm`'s rule, so the two rows do not alias.

**768 and 1024 are now verified**, which the Test seams section listed as an
open obligation. At rest, all four widths: `scrollLeft` 0, first tile on the
gutter. Across four scroll states each — rest, two pages, and the end — the
artwork covered by either control is **0px at every width and every state**,
measured as true rect intersection clipped to the scrollport, and a partial
tile survives in every one.

**Below `md` the section grows by 56px** — the control's 44px plus a `gap-3`.
The plan said there was no height cost to worry about there, which was right
about the consequence and silent about the number. At 1536x639 the stop is
still 555 and the section still 473, unchanged, so the claim that the move is
free holds where a stop exists.
