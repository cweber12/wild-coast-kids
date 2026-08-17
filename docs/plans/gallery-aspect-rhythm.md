# Gallery aspect rhythm and the two-stop grid

Issue #19. The design decisions in this file were taken with the repo owner in
an interview on 2026-08-14; where a decision was theirs rather than derived,
this file says so.

## Problem, from the user's point of view

Every tile in the gallery is 4:3, so nine pieces of children's artwork read as
one uniform contact sheet. The reference template varied its aspect ratios, and
that print-zine rhythm is part of the "coastal pop editorial" direction in the
brief. This was finding 4 of `DESIGN_REVIEW-2026-08-11.md` and is finding 10 of
the current `DESIGN_REVIEW.md`, deferred both times because the tiles were too
small for the variation to read.

Underneath that sits a second complaint: the artwork is small. At a 1900px
window a tile is 439px wide, and the row shows four of them with a fifth
half-visible — a strip of thumbnails rather than a gallery of work.

## Solution

The gallery becomes two stops, and its tiles come in two shapes.

**At `lg` and up** the paged row is replaced by a static grid across two snap
stops. Stop A carries the heading, the intro line and one row of three. Stop B
carries two more rows of three and nothing else. Every row is two 4:3 tiles and
one 16:9 tile, all the same height, so the wide one is wider; the wide tile
alternates **right / left / right** down the three rows.

**Below `lg`** the existing paged row stays, showing one tile at a time at 85%
of the row's width with the next peeking. All nine images are reachable there;
the wide ones are simply shorter in their slot and vertically centred.

At a 1900×866 window a 4:3 tile goes from 439×329 to 473×355, and the wide
tiles are 631×355. At 768 the swipe tile is 571 wide.

## Implementation decisions

- **Equal heights, unequal widths.** A row holds one height; the 16:9 tile
  takes the extra width. Because every row holds the same set of ratios, every
  row totals the same width whatever the order — so alternating the wide tile's
  position keeps the grid's outer edges flush, which is what makes the rhythm
  read as deliberate rather than as a hole. _Rejected: equal columns with the
  wide tile shorter._ With only three rows, the empty surface under a short
  tile reads as a gap, and alternating its position moves the gap around
  instead of making a pattern.

- **16:9 for the wide tile**, chosen by the owner from 3:2, 16:9 and 2:1. It is
  the ratio the web already assumes, and the contrast with 4:3 is unmistakable:
  631px against 473px. 3:2 was only 13% wider than its neighbours, which risks
  reading as a wobble rather than as variation; 2:1 crops a photographed
  painting too hard.

- **Widths are 30 / 30 / 40 of the row.** Not a magic ratio: 4/3 : 4/3 : 16/9
  normalises to exactly 0.3 : 0.3 : 0.4. So a tile is a percentage of the row
  plus `aspect-4/3` or `aspect-video`, and equal heights fall out arithmetically
  rather than being asserted by a second rule that could disagree.

- **The grid's width is capped from the stop's height**, not from the window's
  width, and the grid is centred:

  ```
  max-width: calc((100dvh - var(--spacing-nav) - 4.5rem) * 20 / 9 + 3rem)
  ```

  Two rows want 813px at a 1900px window and the stop offers about 782px, so
  width-first sizing overflows. `4.5rem` is the 24px row gap plus 24px of
  breathing space above and below; `3rem` is the two 24px gaps inside a row;
  `20/9` is half of the 40/9 row-width-per-unit-height that the 30/30/40 shares
  imply. `--spacing-nav` is the same token `SnapSection` subtracts, so nothing
  here measures anything or invents a constant. _Rejected: letting the grid
  overflow._ That is must-fix 1 of the last review returning — `justify-center-safe`
  start-aligns an over-tall section, so the second row would sit below the fold
  with nothing to say it is there. _Rejected: shrinking the gutters on short
  windows._ The gutter is a page-wide rhythm token; bending it for one section
  at some window heights makes the gallery's edges disagree with every other
  stop's.

  It lives in an `@utility gallery-fit` in `globals.css` rather than as an
  arbitrary value in JSX — the `no-scrollbar` precedent — so the arithmetic
  carries its explanation, and so the `stylesheet` gate row can assert it emits
  real CSS.

- **One tile size across all three rows.** Stop A has spare height, but a row
  that is 4% larger there would land its left and right edges at a different
  inset from stop B's, and a snap is an animated scroll, so both are briefly on
  screen. The three rows are one grid the snap divides.

- **The grid starts at `lg`, not at `md`.** Three-across at 768px gives a
  192×144 tile — smaller than the 278px tile the same artwork gets on a phone,
  and the opposite of this issue's purpose. Tablets keep the swipe row, where a
  tile at 768 is 571 wide. So the responsive rule is one line: small screens
  swipe, large screens grid. _Rejected: three presentations_ (swipe on phones,
  a 3-up paged row on tablets, a grid on laptops) — three things to design,
  test and keep in agreement instead of two.

- **Stop B is wrapped in `hidden lg:contents` in `page.tsx`.** `SnapSection`'s
  `min-h` starts at `md`, so between 768 and 1024 an empty stop B would be a
  blank mist screen. `display: contents` at `lg` dissolves the wrapper so the
  section behaves exactly as a direct child, and `main.children` still counts
  the stops.

- **Both stops are mist, and stop B carries no heading.** The owner's call: the
  second stop follows the first immediately, so nothing needs restating. It
  costs nothing for assistive tech — a `<section>` with no accessible name is
  not exposed as a landmark, and a screen reader reads linearly, so the heading
  precedes all nine images however the stops fall.

- **Nine tiles render twice** — once in the swipe row, once in the grid — with
  one layout hidden at any width. See `docs/adr/0005-breakpoint-divergent-layouts.md`;
  it is the decision most likely to be re-litigated, because PR #14 was
  partly celebrated for deleting the marquee's duplicated DOM.

- **An image carries its own aspect**: `GALLERY_IMAGES` becomes
  `{ label, aspect }`, and the gate asserts the composition invariants over the
  data. _Rejected: deriving the aspect from the index._ It cannot break, but
  reordering the list then silently re-crops the images, which becomes a live
  hazard the moment photographs replace placeholders. _Rejected: three literal
  rows._ The alternation rule would exist nowhere, so no test could call a
  wrong row wrong.

- **Which three images are wide is provisional.** The owner's call: the current
  labels are example content from the reference template, not a brief for the
  real photographs, and the tagging will be redone when those arrive. Positions
  3, 4 and 9 are tagged wide to produce the right/left/right rhythm, and the
  source says so, in the same spirit as the placeholder quote in `QuoteStats`.

- **`GalleryRow` keeps its name and its behaviour.** It shows one tile at a
  time rather than a row of them below `lg`, which strains the name, but
  renaming a module PR #14 just landed is a change of its own with its own
  justification, not a rider on this one. Its `scrollBy(clientWidth)` still
  lands one tile per press: at 768 a press moves 672px against a 595px stride,
  and `snap-mandatory` pulls back to the nearer snap point.

- **Tiles in the swipe row take `self-center`.** A flex child defaults to
  `stretch`, which forces a height and makes `aspect-ratio` yield nothing; the
  wide tiles would be stretched to the 4:3 tiles' height. Centring keeps the
  row's height set by its tallest tile, so nothing jumps mid-swipe. It sits on
  the tile rather than as `items-center` on the row because `GalleryRow`
  deliberately owns no tile geometry.

- **24px between tiles, both axes** — `--spacing-gutter-sm`, a token the page
  already has. Owner's call, and nearly free: because height caps the tile size,
  going from 16px to 32px only moves a tile from 511 to 500 wide at 1900.

- No new dependencies.

## Test seams

The gate can prove the data and the class contract. It cannot prove that two
rows fit an 866px window, because jsdom applies no stylesheets (ADR-0001). That
division was agreed rather than discovered:

- **The composition invariants, over the data** — this is the seam that makes
  the rhythm a rule rather than an accident. Rows chunk by three; every row is
  two 4:3 and one 16:9; the wide tile alternates right/left/right; the list
  length is a multiple of three. A tenth image or a mistagged one fails the
  gate instead of quietly going ragged.
- **The class contract**, per the `StripTrack`/`SnapSection` precedent: the
  swipe row carries `lg:hidden`, the grid `hidden lg:*`, the grid container
  `gallery-fit`, tiles their width and aspect classes.
- **Accessible names, per layout.** `GallerySection.test.tsx`'s "exposed
  exactly once" assertion cannot survive two render sites unchanged; it becomes
  once per visible layout, scoped to a container. That the hidden copy leaves
  the accessibility tree is `display: none` doing its job, and is a browser
  fact, not a jsdom-provable one.
- **`page.test.tsx`:** the landing page is seven stops, not six.
- **The `stylesheet` gate row:** `gallery-fit` must emit a declaration, so a
  typo inside the `calc()` is caught by the build rather than by an eye.
- **Outside the gate, needs a human in a browser:** that two rows fit at
  1900×866 and 1280×800, that nothing clips at 1024, that the A→B snap reads as
  continuation rather than as a new section, that a swipe moves one tile at 375
  and 768, and whether the side margins on a short wide window read as intent.

## Slices

1. This plan and ADR-0005.
2. Images carry their aspect, and the row varies its ratios. `galleryImages.ts`,
   the aspect-to-class mapping, and the 30/30/40 shares applied inside the
   existing paged row at `lg` and up. This stands alone: it is the original
   issue — the tiles stop being uniform — with the composition unchanged.
3. The grid takes over at `lg`, across two stops. `GalleryOpening` and
   `GalleryContinued`, `gallery-fit`, `GalleryRow` becomes `lg:hidden`,
   `page.tsx` gains stop B and `page.test.tsx` counts seven.
4. The documentation catches up: `CONTEXT.md` gains **Stop** and corrects
   **Strip** to mean the marquee alone, `DESIGN_BRIEF.md` gets a dated addendum,
   and finding 10 of `DESIGN_REVIEW.md` is closed.

Slice 2 before 3 so the tile geometry exists and is verified before the
composition that depends on it. One branch and one PR: well inside the
reviewable guide, and no two people could take these slices without colliding,
so splitting them into issues would buy nothing.

## Addendum — 2026-08-14: slice 3 is descoped, and why

Slice 2 shipped. Before building slice 3, the owner reported the landing page
snapping badly, and measurement in a browser at their own window moved the
decision.

Their viewport is 1536×639 CSS pixels: a 1920×1080 display at 125% Windows
scaling gives 1536×864, and Chrome's own furniture takes 177px more. That
leaves **555px** for a stop, against the ~782px this repo's snapping was built
and reviewed at (`DESIGN_REVIEW.md` records 1900×866).

Measured on plain `main` and on this branch at that window, content height per
stop against the 555px available:

| stop          | main | this branch | overflows by |
| ------------- | ---- | ----------- | ------------ |
| hero          | 612  | 612         | 57           |
| gallery       | 421  | 473         | —            |
| cards         | 577  | 577         | 22           |
| conditions    | 312  | 312         | —            |
| interest list | 560  | 560         | 5            |
| quotes        | 297  | 297         | —            |

Identical but for the gallery, which grew and still fits. So the reported
breakage is a property of the page at short viewports, not of this work: three
sections are taller than their stop, `justify-center-safe` therefore
start-aligns them rather than centring, and mandatory snapping over an
over-tall section is what makes the page feel like it will not settle.

That reaches this plan through the numbers. A 4:3 tile at 1536px wide:

| layout                              | tile width |
| ----------------------------------- | ---------- |
| `main` before this branch, 4 across | 348        |
| slice 2, three across with rhythm   | **417**    |
| slice 3's grid, capped at 555px     | **322**    |

Slice 2 already makes the artwork larger on that screen. Slice 3 would make it
smaller than it was before this issue started — the failure this plan predicted
for tablets, which turns out to apply to the owner's own laptop. The two-stop
grid only pays for itself above roughly 800px of usable height, which is a
premise the page does not currently meet.

**Decision:** this issue ends after slice 2 and the documentation slice. The
height problem is filed as its own issue, since it affects the hero, the
program cards and the interest list on `main` and has nothing to do with the
gallery. The two-stop grid is filed separately and blocked on it.

Slices 3 and 4 above are therefore superseded: 3 is not built, and 4 becomes
slice 3 of this branch. The rest of this file records what was decided for the
grid, and stands as the design for the issue that will build it.

## Addendum — 2026-08-17: the row stays, and the grid is parked

The owner asked for the gallery row to be kept as it is. The grid is not
withdrawn: the design above stands, and the point of this addendum is that
nobody has to derive it a second time. What changes is its standing in the
tracker. Issues #38 and #40 are consolidated into one `needs-triage` PRD on
**#38**, so there is one place to look rather than two that each hold half the
story.

**Parked, not blocked.** The 2026-08-14 addendum filed #38 as blocked on #37, on
the premise that fixing the stop's height would unblock it. #37 landed and did
not. It made the stops fit 555px by trimming three sections rather than by
giving them more room, so a stop is still 555px on the machine the site is
reviewed from, and none of the grid's arithmetic moved. A capped grid gives a
4:3 tile of `0.667 × (stopHeight − 72)` — the 322px the last addendum measured.
Reaching parity with the **417px** tile the paged row already ships needs a
**697px** stop, which is a 781px viewport, and `stop-height-threshold.md`'s own
addendum established that this display cannot exceed 639. So the blocker was
never #37. It is the display, and no issue in this repo can close it.

That is why the label is `needs-triage` rather than `ready-for-agent` or
`needs-human`: there is nothing to implement and nobody to unblock. There is a
decision to re-evaluate if the circumstances change.

### What survived of issue #40

Three claims were made there. Checked against the tree on 2026-08-17:

| claim                                                           | verdict                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| The stop's height grows 543 → 734 between `md` and `lg`         | **Dead.** #37 moved `stops` to `lg`; that band has no stops. |
| It is a regression from `f4c3408` dropping the two-up `md` step | **Wrong.** The change was deliberate — see below.            |
| Above `lg` the height grows with width without limit            | **Live.** Recorded below rather than fixed.                  |

The regression claim is the one worth writing down, because the evidence for it
was a commit message and the evidence against it is this plan. `f4c3408` did
drop `md:w-[calc((100%-1rem)/2)]`, and its message did say "Below lg nothing
changes shape", which is false for the `md`–`lg` band. But the body of this plan
chose that shape before the code existed: "Tablets keep the swipe row, where a
tile at 768 is 571 wide." 571 is `0.85 × (768 − 96)`, computed for the new
behaviour, not inherited from the old. The plan is the record; the commit
message was imprecise about a decision it had already taken.

### The width-driven overflow is recorded, not fixed

The live half is real. Fitted to the three measured points (473 at 1536, 559 at
1920, 703 at 2560), the section's content height is `0.225 × W + 127`, so it
exceeds its stop when

```
viewportHeight < 0.225 × viewportWidth + 211
```

A stop only exists from 39rem tall, so triggering it needs a window **wider than
about 1836px and short for its width**. Worked through the maximised-window
arithmetic in `stop-height-threshold.md` — display height less the taskbar and
the browser's furniture — **no 16:9 or 16:10 display reaches it at any
scaling**, and the reason is the threshold itself: such a window has to be
shorter than about 727 CSS pixels of display to overflow, and it stops having
stops at all at 849. It runs out of stop before it runs out of room. Wider
ratios can: a 32:9 panel (5120×1440, 3840×1080) overflows, and a 21:9 does in a
narrow band of scalings. So can any window sized by hand to be wide and short.

The review machine cannot produce it at all, for a different reason than usual.
Its 639px viewport would overflow above about 1902px of width, but its display
is only 1536 CSS pixels wide, so no window on it is ever wide enough. This is
the mirror image of the two-stop grid's problem: that one is blocked by a screen
too short, and this one is hidden by a screen too narrow.

**The `gallery-fit` cap designed above does not transfer to it.** That cap
worked because stop B carried two rows and no heading, so the arithmetic had
only rows to budget. In the single-stop row that shipped, the heading and the
row share one stop, so a cap has to subtract the heading block — 160px measured
at 1536, being the 473 total less the 313 tile. That is a constant standing in
for something nobody measured on purpose, which is the failure `CLAUDE.md` names
as fixing a symptom with a constant. Deriving it instead means restructuring the
section so the row takes the leftover height, and that is a layout change, which
is the thing this addendum exists to decline.

So the overflow is stated as an exception rather than left implied: `CONTEXT.md`
says a stop is 540px and every section is built to fit it, and one section does
not.

### What follows from this

- `docs/adr/0005-breakpoint-divergent-layouts.md` gains a dated note that its
  rule has no instance in the code, since the grid it was written for never
  shipped. The body is left alone — it is a dated record, and the
  `display: contents` finding in it is the reason nobody should try reparenting
  again.
- `CONTEXT.md`'s **Stop** entry names the gallery as the one section that does
  not fit at every width, with the condition above.
- `DESIGN_BRIEF.md` gains a dated addendum. Its 2026-08-15 entry promises "the
  fix is the `gallery-fit` cap already designed for issue #38", and that promise
  is now wrong twice over — the cap does not transfer, and no fix is scheduled.
- `galleryImages.ts` and its test keep every composition invariant and change
  their reasons. Rows of three, two tall and one wide, and the alternating side
  are all still load-bearing, but not for the grid's flush edges: three tiles
  and their two gaps total exactly one content width, which is what makes
  `scrollBy(clientWidth)` land a whole page of three. Verified arithmetically at
  1024, 1536 and 1900 — a press overshoots the stride by the gutter and
  `snap-mandatory` pulls back to the correct tile. Mistag one image and a page
  comes up short.

## Out of scope

Real photography, and the final decision about which images are wide. Renaming
`GalleryRow`. A browser-driven gate row — it would genuinely prove the fit, but
it is a new dev dependency and an architecture decision, so it is its own issue
with its own ADR. Any change to the other five stops.
