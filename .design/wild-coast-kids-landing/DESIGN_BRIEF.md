# Design Brief: Wild Coast Kids Landing Page

## Problem

A homeschool parent in San Diego hears about Wild Coast Kids and wants to answer
three questions fast: what is this (art classes and an outdoor co-op), is it for
my kid (K–8, charter-fund eligible), and how do I get in (book a class, join the
interest list). Today there is nothing to point them at — the co-op exists in
conversations and a style template, not on the web.

## Solution

A single high-energy landing page. The first window sells the identity: a bold
purple hero with the marquee strip pinned exactly at the bottom edge of the
viewport, so the page opens as one composed poster. Scrolling reveals proof
(a film strip of kids' work gliding across the screen in sync with the marquee),
then the two offerings as big tactile cards, then social proof, the conditions
teaser, and finally the interest-list form. One page, two calls to action:
book an art class, join the co-op list.

## Experience Principles

1. **Poster first, page second** — the opening viewport is a fixed composition
   (hero + marquee at the fold), not the top of a scroll. Layout decisions that
   break the one-window fit on desktop are wrong.
2. **Motion as identity, never as obstacle** — the two synced strips give the
   page its pulse, but they pause on hover and stop entirely under
   `prefers-reduced-motion`. Energy must never cost legibility or access.
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

| Component      | Status | Notes                                                                                    |
| -------------- | ------ | ---------------------------------------------------------------------------------------- |
| Nav            | New    | Fixed top bar: logo placeholder, anchor links, yellow pill CTA                           |
| HeroViewport   | New    | `min-h-dvh` flex column wrapping Hero + Marquee; marquee sits at the bottom edge         |
| Hero           | New    | Purple split layout, italic 900 headline, two CTAs, photo placeholder (hidden on mobile) |
| Marquee        | New    | Yellow looping text strip, duplicated track, pause on hover                              |
| GallerySection | New    | Header ("What kids make here.") + GalleryStrip                                           |
| GalleryStrip   | New    | Single-row infinite film strip of image placeholders, speed-synced to Marquee            |
| ProgramCards   | New    | Two large cards (Art Classes / Tuesday Co-op) with tags, activities grid, CTAs           |
| QuoteStats     | New    | Parent quote + K–8 / Charter stat tiles                                                  |
| Conditions     | New    | Ocean-blue section with dashed "tool coming soon" embed box                              |
| CommunityForm  | New    | Interest-list form; client-side success state only                                       |
| Footer         | New    | Dark bar, logo, program summary                                                          |
| Placeholder    | New    | Shared labeled dashed-border image placeholder (hero, cards, strip, logo)                |

## Key Interactions

- **Strip motion**: marquee and gallery strip animate leftward continuously via
  duplicated tracks. They share one pixels-per-second speed — the marquee's 20s
  half-track loop defines it; the gallery strip's duration is computed from its
  own track width. Hovering a strip pauses that strip; leaving resumes it.
  `prefers-reduced-motion: reduce` stops both permanently.
- **Nav anchors**: links smooth-scroll to `#art`, `#coop`, `#conditions`,
  `#community`.
- **Card hover**: program cards lift slightly (translateY) on hover.
- **Form submit**: client-side only — the form hides and the success state
  ("You're in!") appears. No data leaves the page; wiring a destination is a
  future slice.

## Responsive Behavior

- **Viewport block**: `min-h-dvh`, hero `flex-1` — exactly one window on
  desktop with the marquee at the fold; allowed to grow taller on small
  screens so nothing clips.
- **Hero**: photo column hidden ≤768px; text column full-width.
- **Gallery strip**: same single-row strip at all widths; image tiles shrink.
- **Program cards**: two columns → one column ≤768px.
- **Quote, conditions, community**: two columns → stacked ≤768px.
- **Nav**: tighter padding and smaller links ≤768px.

## Accessibility Requirements

- Both strips stop under `prefers-reduced-motion: reduce`; pause on hover.
- Image placeholders carry `role="img"` + `aria-label` describing the future
  image, matching the template's pattern.
- Marquee/strip duplicate tracks are `aria-hidden` so screen readers hear the
  content once.
- Form inputs have visible `<label>`s; success state is announced (rendered in
  DOM, not display-toggled invisibly to AT).
- Keyboard: all CTAs and links focusable with visible focus rings; smooth
  scroll respects reduced motion.
- Contrast: yellow `#E8FF00` surfaces use near-black `#1A1A00` text; body text
  on purple/ocean stays at the template's tested opacities or better.

## Addendum — 2026-08-13 (what has changed since)

This brief describes the single-page build of 2026-08-11. Four PRs have
since changed things it still states as current. Recorded here rather than
rewritten, so the original intent stays readable.

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

## Addendum — 2026-08-14 (gallery tiles)

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

## Addendum — 2026-08-15 (the stops fit a 555px screen)

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

## Out of Scope

- Real photography or a logo — labeled placeholders ship; swapping in real
  images is a later content pass.
- A working form backend — submissions are visual-only until a destination
  (email/sheet/service) is chosen.
- A real booking URL — the Calendly link is `TODO(verify)`.
- The conditions tool embed — the dashed placeholder box ships as-is.
- Dark mode, additional pages, CMS, analytics.
- The template's editorial block and yellow banner — cut, not deferred.
