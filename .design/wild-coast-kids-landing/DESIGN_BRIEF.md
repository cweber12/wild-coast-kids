# Design Brief: Wild Coast Kids Landing Page

## Problem

A homeschool parent in San Diego hears about Wild Coast Kids and wants to answer
three questions fast: what is this (art classes and an outdoor co-op), is it for
my kid (K–8, charter-fund eligible), and how do I get in (book a class, join the
interest list). Today there is nothing to point them at — the co-op exists in
conversations and a style template, not on the web.

## Solution

A high-energy landing page, with a routed page behind each of its sections. The
first window sells the identity: a bold purple hero with the marquee strip
pinned exactly at the bottom edge of the viewport, so the page opens as one
composed poster. Scrolling reveals proof (a row of kids' work the reader pages
through), then the two offerings as big tactile cards, then the conditions
teaser, then the interest-list form, and finally social proof closing the page.
Two calls to action throughout: book an art class, join the co-op list.

On a window at least `lg` wide and 39rem tall the six sections are snap stops,
one screen each. Anything smaller is an ordinary scrolling page with the
sections' own padding back.

## Experience Principles

1. **Poster first, page second** — the opening viewport is a fixed composition
   (hero + marquee at the fold), not the top of a scroll. This now applies to
   every stop, not only the first: a section that cannot be composed inside the
   540px a stop gets is a bug in the section, not a reason to raise the budget.
2. **Motion as identity, never as obstacle** — the marquee gives the page its
   pulse, pausing on hover and stopping entirely under
   `prefers-reduced-motion`. Motion decorates; it does not carry. The gallery
   is the artwork the page is offering as proof, so the reader drives it rather
   than a clock. Energy must never cost legibility or access.
   See `docs/adr/0007-reader-driven-gallery-over-synced-motion.md`.
3. **Loud surfaces, quiet mechanics** — colors and type shout; the plumbing
   stays boring. Semantic HTML, role-reachable landmarks, a form that works
   with a keyboard. Nothing clever where clever isn't visible.

## Aesthetic Direction

- **Philosophy**: Coastal pop editorial — heavy italic Montserrat (weights up
  to 900), electric yellow against deep purple and ocean blue, pill buttons,
  rounded cards, marquee strips. Kid-brand energy executed with print-zine
  discipline.
- **Tone**: Playful, confident, warm. A place that takes kids' creativity
  seriously without taking itself seriously.
- **Reference points**: The supplied template (`wildcoastkids_placeholders.html`)
  is the canonical reference — its palette, type treatment, and section designs
  carry over. Skate/surf-brand marquees; indie print posters.
- **Anti-references**: Corporate childcare sites (stock-photo pastels, trust
  badges), generic SaaS landing pages, anything beige and cautious.

## Existing Patterns

The repo is a fresh Next.js 16 + Tailwind v4 scaffold; the template supplies
the design language.

- Typography: scaffold uses Geist via `next/font` — **replaced** by Montserrat
  (400/500/700/800/900 + italics), loaded the same `next/font` way.
- Colors: template palette becomes `@theme` tokens: purple `#6B5FAA`, ocean
  `#1A4E8A`, pink `#E8A4B8`, yellow `#E8FF00`, cream `#FAF8F5`, dark `#1A1A2E`.
  The scaffold's `prefers-color-scheme` dark swap is **removed** — one fixed,
  art-directed palette in all themes.
- Spacing: template rhythm (80px section padding, 48px gutters, 24px mobile
  gutters) formalized into the token scale in the tokens phase.
- Components: none exist; every section component is new. Test style follows
  `src/app/page.test.tsx` — role-based reachability assertions.

## Component Inventory

Every component below resolves to a file under `src/components/`. The column is
the file rather than a build status so that the list can be checked against the
tree rather than believed.

| Component          | File                     | Notes                                                                                    |
| ------------------ | ------------------------ | ---------------------------------------------------------------------------------------- |
| Nav                | `Nav.tsx`                | Sticky top bar in the document flow: logo placeholder, routed links, yellow pill CTA     |
| NavLink            | `NavLink.tsx`            | One nav link, at the 44px touch target ADR-0004 sets                                     |
| HeroViewport       | `HeroViewport.tsx`       | Flex column of Hero + Marquee, `100dvh` less the nav; marquee sits at the bottom edge    |
| Hero               | `Hero.tsx`               | Purple split layout, italic 900 headline, two CTAs, photo placeholder (hidden on mobile) |
| Marquee            | `Marquee.tsx`            | Yellow looping text strip; the site's only strip                                         |
| StripTrack         | `StripTrack.tsx`         | The looping mechanic: duplicated track, pause on hover. One caller, Marquee              |
| GallerySection     | `GallerySection.tsx`     | Header ("What kids make here.") + GalleryRow, and the tiles' aspect shares               |
| GalleryRow         | `GalleryRow.tsx`         | Paged row of artwork with prev/next controls; native scroll, snap-x, a named focus stop  |
| galleryImages      | `galleryImages.ts`       | The nine tile labels and their provisional tall/wide tagging                             |
| ProgramCards       | `ProgramCards.tsx`       | Two large cards (Art Classes / Tuesday Co-op) with tags, activities grid, CTAs           |
| Conditions         | `Conditions.tsx`         | Ocean-blue section with a reserved slot for the tool                                     |
| InterestListTeaser | `InterestListTeaser.tsx` | The landing page's interest-list section, wrapping the form                              |
| InterestListForm   | `InterestListForm.tsx`   | Interest-list form; client-side success state only                                       |
| QuoteStats         | `QuoteStats.tsx`         | Parent quotes + K–8 / Charter stat tiles; closes the page                                |
| SnapSection        | `SnapSection.tsx`        | One stop: owns its height and surface, and the padding its content drops                 |
| Footer             | `Footer.tsx`             | Dark bar, logo, program summary. Rendered by `layout.tsx`, so it is on every route       |
| PillLink           | `PillLink.tsx`           | The site's CTA shape, in five closed tones                                               |
| Placeholder        | `Placeholder.tsx`        | Shared labeled dashed-border stand-in for a future image (hero, cards, tiles, logo)      |
| ReservedSlot       | `ReservedSlot.tsx`       | Shared labeled stand-in for decided-but-unbuilt content (schedule, booking, conditions)  |

## Key Interactions

- **Marquee motion**: the marquee animates leftward continuously via a
  duplicated track, at a fixed pixels-per-second rate computed from the track's
  own width so the speed holds however wide the content gets. Hovering pauses
  it; leaving resumes it. `prefers-reduced-motion: reduce` stops it
  permanently.
- **Gallery paging**: prev/next controls at the row's edges move it one
  screenful, and `snap-x mandatory` pulls the result back onto a tile edge, so
  paging stays aligned without the control knowing how many tiles are visible.
  The row is a named focus stop, so arrow keys and assistive tech reach it. It
  never moves on its own.
- **Nav links**: routed links to `/art`, `/coop`, `/conditions`, `/community`,
  plus a pill CTA to `/book`. `#community` is the only anchor left on the site;
  `#art`, `#coop` and `#conditions` were retired with the pages that replaced
  them.
- **Card hover**: program cards lift slightly (translateY) on hover.
- **Form submit**: client-side only — the form hides and the success state
  ("You're in!") appears. No data leaves the page; wiring a destination is a
  future slice.

## Responsive Behavior

- **Snap stops**: the page is six stops on a window at least `lg` wide and
  39rem (624px) tall, and an ordinary scrolling page below either threshold.
  A stop is 540px on the machine the site is reviewed on, and every section is
  built to fit that. The `md`–`lg` band scrolls rather than snapping, because
  the program cards' two columns are narrow enough there that the CTA pills
  wrap. See `docs/plans/stop-height-threshold.md`.
- **Viewport block**: `100dvh` less the nav, hero `flex-1` — one window with
  the marquee at the fold; a `min-h` rather than a fixed height, so it grows
  instead of clipping on short screens.
- **Hero**: photo column hidden ≤768px; text column full-width.
- **Gallery row**: below `lg`, one tile at a time at 85% width with the next
  peeking, swiped or paged. From `lg`, three tiles share a screenful at the
  0.3/0.3/0.4 shares their aspects normalise to. This is the shape the gallery
  keeps; the static grid once planned for it is parked, not pending. Its stop's
  height grows with viewport width without a cap, which overflows a window
  wider than about 1836px and short for its width — a stated exception, not a
  scheduled fix. Issue #38.
- **Program cards**: two columns → one column ≤768px.
- **Quote, conditions, community**: two columns → stacked ≤768px.
- **Nav**: two rows below `md` — logo and CTA above, links beneath — because
  four links plus the pill cannot share a 375px row. One row from `md`.

## Accessibility Requirements

- The marquee stops under `prefers-reduced-motion: reduce` and pauses on hover.
  The gallery needs neither, having no motion of its own to stop; it carries
  its own guarantees instead — the row is a named focus stop reachable by
  arrow keys, and its controls are the affordance.
- Snapping is itself behind `motion-safe`, so a reader who asked for less
  motion gets an ordinary scrolling page at every width.
- Image placeholders carry `role="img"` + `aria-label` describing the future
  image, matching the template's pattern.
- The marquee's duplicate track is `aria-hidden` so screen readers hear the
  content once. The gallery has no duplicate to hide: every tile renders once.
- Form inputs have visible `<label>`s; success state is announced (rendered in
  DOM, not display-toggled invisibly to AT).
- Keyboard: all CTAs and links focusable with visible focus rings; smooth
  scroll respects reduced motion.
- Contrast: yellow `#E8FF00` surfaces use near-black `#1A1A00` text; body text
  on purple/ocean stays at the template's tested opacities or better.

## Change log

Everything above states what the site is now. This section is the record of how
it got there: what each entry describes has already been applied to the body,
and the entries are kept verbatim — including the claims they supersede — so
that a review can be matched to the state of the brief it was written against.

Entries are not corrections waiting to be applied. Until 2026-08-15 they were,
which is what made the body contradict them and got the same drift reported
twice. See `docs/plans/design-doc-drift.md`.

### 2026-08-13 (what has changed since)

This brief described the single-page build of 2026-08-11. Four PRs had
since changed things it still stated as current.

- **The landing page snaps.** From `md` up it is six stops, one screen each:
  hero, gallery, program cards, conditions, interest list, quotes + footer.
  Below `md`, and under `prefers-reduced-motion`, it is an ordinary
  scrolling page — two sections are taller than a phone viewport, so
  snapping them would mean fighting the snap to read them.
  "Poster first, page second" now applies to every stop, not only the first.
- **The gallery no longer moves on its own.** Experience principle 2 and
  Key Interactions describe two synced strips as the page's pulse; the
  gallery is now a paged row the reader drives, with controls at its edges.
  The marquee still carries the motion. `StripTrack` therefore has one
  caller rather than two.
- **The site is no longer one page.** `/art`, `/coop`, `/conditions`,
  `/community` and `/book` exist; the nav is routed links, not anchors, and
  `#art` and `#coop` are gone. The hero's two CTAs point at `/book` and
  `/coop`. Only `#community` survives as an anchor.
- **The nav sits in the document flow**, sticky rather than fixed, and takes
  its height from a token (ADR-0003). The footer now does the same, so the
  closing stop can size itself as the window less both.
- **Component names have moved on:** `GalleryStrip` → `GalleryRow`,
  `CommunityForm` → `InterestListTeaser` plus `InterestListForm`. `Nav`,
  `Footer`, `SnapSection`, `PillLink` and `ReservedSlot` are shared;
  `CONTEXT.md` at the repo root is now the glossary for the domain words.
- **The quote section closes the page** and carries two quotes above the
  stat tiles. The second quote is invented copy, not a real testimonial,
  and is marked as placeholder in the source.
- **The Calendly `TODO(verify)` is retired** — booking CTAs point at
  `/book`, and the provider decision sits behind that page.

### 2026-08-14 (gallery tiles)

- **Gallery tiles are no longer one shape.** "Gallery strip: same single-row
  strip at all widths; image tiles shrink" now reads: a row is two 4:3 tiles
  and one 16:9 at one height, so the wide tile is wider rather than shorter,
  and the wide slot alternates right, left, right down the rows. The shares
  are the ratios normalised — 0.3 : 0.3 : 0.4 — so every row totals the same
  width whatever the order. From `lg` three tiles fill a screenful; below it
  the reader swipes one at a time. See `docs/plans/gallery-aspect-rhythm.md`.
- **Which images are wide is not a content decision yet.** The nine labels are
  example content from the reference template; the aspect tagging is marked
  provisional in `galleryImages.ts` and belongs to the real photography pass.
- **The stops do not fit every window.** Measured at 1536×639 — a 1080p
  display at 125% scaling — the hero, the program cards and the interest list
  are taller than the 555px a stop has, so they start-align instead of
  centring. The snapping was designed against ~782px. Filed as its own issue;
  recorded here because "one screen per section" is a brief-level claim, and
  it is currently false below roughly 780px of usable height.

### 2026-08-15 (the stops fit a 555px screen)

- **"One screen per section" is true again, and the sections were changed to
  make it true.** The page is six stops on a window at least `lg` wide and
  39rem (624px) tall, and an ordinary scrolling page with its section padding
  back on anything smaller. **A stop is 540px**, and every section is built to
  fit that. This replaces the note above, which recorded the claim as false
  below ~780px of usable height.

  The number comes from the machine the site is reviewed on rather than from
  the design: a 1920x1080 display at 125% scaling gives a maximised Chrome a
  639px viewport and no more, so 555px is what a stop actually gets there. An
  earlier attempt at this fixed the overflow by switching the stops off below
  720px, which would have made the whole mechanic invisible on that machine.
  See issue #37 and `docs/plans/stop-height-threshold.md`.

- **What it cost the compositions.** The poster's text column lost 80px of
  padding and 28px of internal margin — invisible above the threshold, because
  the column is centred in a box already a screen tall. The program cards lost
  16px of padding and 22px of line box around a decorative emoji. The interest
  list's form card lost 56px it had only because it was sized to its success
  state rather than to the form. No type sizes changed, and no copy was cut.

- **The `md`–`lg` band no longer snaps.** The cards' two columns are narrow
  enough there that the CTA pills wrap, which padding cannot fix. That band
  swipes and scrolls — the same rule the gallery already follows.

- **The gallery is still the exception.** Its stop's height grows with viewport
  _width_ without limit — 473px at 1536, 559 at 1920, 703 at 2560 — so on a
  short window it overflows above about 1850px wide. "Gallery strip: same
  single-row strip at all widths" is what does it. Issue #40; the fix is the
  `gallery-fit` cap already designed for issue #38.

### 2026-08-17 (the gallery row stays)

- **The paged row is the gallery's final shape, not an interim one.** The owner
  asked for it to be kept as it is. Every previous entry describing the gallery
  did so against a planned static grid that would replace it at `lg`; that grid
  is parked, and the brief no longer treats the row as a stage on the way to
  something else.

- **The grid is parked rather than cancelled.** Its design is kept in full in
  `docs/plans/gallery-aspect-rhythm.md` — the 30/30/40 shares, the 16:9 choice,
  the height-derived cap and the alternatives that were rejected. What changed
  is that it has no scheduled build and no blocker that could clear: a capped
  grid gives a 322px tile against the 417px the row already ships, and parity
  needs a stop about 697px tall on a display whose ceiling is 639.

- **The overflow above is a stated exception now, not a pending fix.** The entry
  above promises "the `gallery-fit` cap already designed for issue #38". That
  promise does not hold: the cap was derived for a second stop carrying rows and
  no heading, and the stop that shipped carries the heading too, so applying it
  needs a measured constant for the heading block. Nothing is scheduled. The
  condition is written into `CONTEXT.md`'s **Stop** entry, and the window it
  needs — wider than about 1836px and short for its width — is one no display
  the site is reviewed on can produce.

- **Issues #38 and #40 are one issue.** #40 folded into #38, which carries both
  halves under `needs-triage`. Of #40's three claims only the width-driven
  overflow survived review; the `md`–`lg` band it described has had no stops
  since 2026-08-15, and the two-up step it called a regression was a deliberate
  choice recorded in the plan before the code was written.

## Out of Scope

- Real photography or a logo — labeled placeholders ship; swapping in real
  images is a later content pass.
- A working form backend — submissions are visual-only until a destination
  (email/sheet/service) is chosen.
- A real booking destination — the CTAs point at `/book`, and which provider
  sits behind that page is a decision that has not been made.
- The conditions tool embed — the reserved slot ships as-is.
- Dark mode, CMS, analytics.
- The template's editorial block and yellow banner — cut, not deferred.
