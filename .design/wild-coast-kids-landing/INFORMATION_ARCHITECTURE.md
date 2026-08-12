# Information Architecture: Wild Coast Kids

## Site Map

One page. All navigation is intra-page anchors.

- Home `/`
  - Art Classes `/#art` (anchor: art program card)
  - Tuesday Co-op `/#coop` (anchor: co-op program card)
  - Conditions `/#conditions` (anchor: conditions section)
  - Community `/#community` (anchor: interest-list form)

## Navigation Model

- **Primary navigation**: fixed top bar with four anchor links — Art Classes,
  Tuesday Co-op, Conditions, Community. That is the maximum; no dropdowns.
- **Secondary navigation**: none. In-content CTAs cross-link: hero buttons →
  `#art` / `#coop`, co-op card → `#community`.
- **Utility navigation**: the yellow "Book Now" pill in the nav (→ `#art`).
- **Mobile navigation**: same links, tighter spacing and smaller type ≤768px.
  No hamburger — four short links fit.

## Content Hierarchy

### Home `/` (top to bottom)

1. **Viewport block: Hero + Marquee** — identity and both CTAs in one composed
   window; the marquee pinned at the fold is the visual signature.
2. **Gallery section (header + film strip)** — proof before pitch: kids' actual
   work scrolls by, synced with the marquee it sits beneath.
3. **Programs (prog-grid)** — the two offerings, each with its own CTA. This is
   the conversion core; everything above earns attention for it.
4. **Quote + stats** — social proof and the two facts parents filter on
   (K–8, charter eligible).
5. **Conditions** — differentiator teaser; placeholder until the tool exists.
6. **Community form** — the catch-all conversion for anyone not ready to book.
7. **Footer** — recap and identity close.

Cut from the template: editorial block ("Real kids…") and the yellow
wordmark banner. Decided in the brief; not deferred.

## User Flows

### Book an art class

1. Parent lands on `/`, sees hero + marquee.
2. Clicks "Book Art Class" (hero), "Book Now" (nav), or scrolls to the art card.
3. Arrives at `#art`, reads tags (charter eligible, all levels, outdoors).
4. Clicks "Book a class →" — external booking link (`TODO(verify)`; opens new
   tab once real).

### Join the co-op interest list

1. Parent lands on `/`, clicks "Tuesday Co-op →" (hero or nav) → `#coop`.
2. Reads the activities grid and fall details.
3. Clicks "Join interest list →" → `#community`.
4. Fills name, email, kids' ages, interest checkboxes → submits.
5. Sees the "You're in!" success state (client-side only for now).

## Naming Conventions

| Concept                | Label in UI        | Notes                                       |
| ---------------------- | ------------------ | ------------------------------------------- |
| The art program        | Art Classes        | Never "art program" or "lessons"            |
| The outdoor program    | Tuesday Co-op      | Day is part of the name                     |
| The signup form        | Community          | Nav label; form heading is "Stay in the loop" |
| The surf/tide tool     | Conditions         | Singular section, plural word               |
| Funding note           | Charter eligible   | Exact phrase, used in tags and stats        |
| Age range              | K–8                | En dash, no spaces                          |

## Component Reuse Map

| Component     | Used on                                      | Behavior differences                          |
| ------------- | -------------------------------------------- | --------------------------------------------- |
| Placeholder   | Nav logo, hero photo, card backgrounds, strip | Label size varies; backgrounds drop the border |
| Pill button   | Nav CTA, hero CTAs, card CTAs, form submit   | Yellow/ghost/purple variants                  |
| Looping track | Marquee, GalleryStrip                        | Shared duplicated-track + pause-on-hover mechanic; content and speed derivation differ |
| Section shell | Gallery, quote, conditions, community        | Shared gutter/padding rhythm, varying backgrounds |

## Content Growth Plan

- **Gallery strip**: designed to take any number of images — the strip loops
  whatever list it is given; adding photos is a data change, not a layout one.
- **Programs**: the grid accepts a third card if an offering is added.
- **Conditions**: the dashed box is the reserved slot for the future embed.
- Anything beyond that (blog, schedules, multiple pages) is a new IA exercise.

## URL Strategy

- Pattern: single route `/`; sections addressed as `/#<section-id>`.
- Anchor ids are stable API: `art`, `coop`, `conditions`, `community` — they
  are shared with the template and must not be renamed casually.
- No dynamic segments, no query parameters.
