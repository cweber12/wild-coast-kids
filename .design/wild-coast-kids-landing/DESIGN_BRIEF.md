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

| Component      | Status | Notes                                                                                   |
| -------------- | ------ | --------------------------------------------------------------------------------------- |
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

## Out of Scope

- Real photography or a logo — labeled placeholders ship; swapping in real
  images is a later content pass.
- A working form backend — submissions are visual-only until a destination
  (email/sheet/service) is chosen.
- A real booking URL — the Calendly link is `TODO(verify)`.
- The conditions tool embed — the dashed placeholder box ships as-is.
- Dark mode, additional pages, CMS, analytics.
- The template's editorial block and yellow banner — cut, not deferred.
