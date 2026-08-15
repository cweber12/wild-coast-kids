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

## Out of scope

Real photography, and the final decision about which images are wide. Renaming
`GalleryRow`. A browser-driven gate row — it would genuinely prove the fit, but
it is a new dev dependency and an architecture decision, so it is its own issue
with its own ADR. Any change to the other five stops.
