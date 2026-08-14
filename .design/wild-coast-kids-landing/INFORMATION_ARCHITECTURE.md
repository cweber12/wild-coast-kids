# Information Architecture: Wild Coast Kids

## Site Map

Six routes. The landing page keeps a teaser for each program area; the routed
pages carry the fuller version.

- Home `/`
  - Art Classes `/art`
  - Tuesday Co-op `/coop`
  - Conditions `/conditions`
  - Community `/community`
  - Book Now `/book` (utility; not in the nav's link row)

One anchor survives: `/#community`, the interest-list section on the landing
page. See _URL Strategy_ for the anchors that were retired.

## Navigation Model

- **Primary navigation**: sticky top bar — in the document flow, not fixed
  (ADR-0003) — with four routed links: Art Classes `/art`, Tuesday Co-op
  `/coop`, Conditions `/conditions`, Community `/community`. That is the
  maximum; no dropdowns. The link for the current route carries
  `aria-current="page"`.
- **Secondary navigation**: none. In-content CTAs cross-link — hero → `/book`
  and `/coop`; art card → `/book` and `/art`; co-op card → `#community` and
  `/coop`; conditions teaser → `/conditions`; interest-list teaser →
  `/community`. Back the other way, `/art` → `/book`, and `/book` and `/coop`
  → `/#community`.
- **Utility navigation**: the yellow "Book Now" pill in the nav (→ `/book`).
- **Mobile navigation**: same links, no hamburger. Below `md` the bar wraps to
  two rows — logo and Book Now pill above, the four links spread beneath —
  because the four links plus the pill do not fit one 375px row.

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

### The routed pages

`/art`, `/coop`, `/conditions`, `/community` and `/book` share one shape: an
eyebrow line, an italic title, a lead paragraph, at most one CTA, then
reserved slots where real content lands. They are structural shells — the
schedule, pricing, photos, booking scheduler and conditions tool are all
labeled placeholders, by decision in `docs/plans/nav-pages-scaffolding.md`.

`/community` is the one that differs: below its reserved slots it renders the
interest-list form under its own heading, without the landing page's teaser
column — otherwise the "Meet the community" CTA would sit on the page it
points at.

## User Flows

### Book an art class

1. Parent lands on `/`, sees hero + marquee.
2. Clicks "Book Art Class" (hero), "Book Now" (nav), or "Book a class →" on
   the art card.
3. Arrives at `/book`. No booking provider is chosen yet, so the page says so
   in a reserved slot and offers the interest list instead.
4. Clicks "Join the interest list →" → `/#community`.

Longer way round: "Learn more →" on the art card, or Art Classes in the nav,
lands on `/art` first; that page's CTA is "Book a class →" → `/book`.

### Join the co-op interest list

1. Parent lands on `/`, clicks "Tuesday Co-op →" (hero) or Tuesday Co-op
   (nav) → `/coop`.
2. Reads the fall details and the lead paragraph.
3. Clicks "Join the interest list →" → `/#community`, the interest-list
   section back on the landing page. The co-op card on `/` reaches the same
   place with the same-page `#community`.
4. Fills name, email, kids' ages, interest checkboxes → submits.
5. Sees the "You're in!" success state (client-side only for now).

## Naming Conventions

| Concept             | Label in UI      | Notes                                         |
| ------------------- | ---------------- | --------------------------------------------- |
| The art program     | Art Classes      | Never "art program" or "lessons"              |
| The outdoor program | Tuesday Co-op    | Day is part of the name                       |
| The signup form     | Community        | Nav label; form heading is "Stay in the loop" |
| The surf/tide tool  | Conditions       | Singular section, plural word                 |
| Funding note        | Charter eligible | Exact phrase, used in tags and stats          |
| Age range           | K–8              | En dash, no spaces                            |

## Component Reuse Map

| Component     | Used on                                       | Behavior differences                                                                   |
| ------------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Placeholder   | Nav logo, hero photo, card backgrounds, strip | Label size varies; backgrounds drop the border                                         |
| Pill button   | Nav CTA, hero CTAs, card CTAs, form submit    | Yellow/ghost/purple variants                                                           |
| Looping track | Marquee, GalleryStrip                         | Shared duplicated-track + pause-on-hover mechanic; content and speed derivation differ |
| Section shell | Gallery, quote, conditions, community         | Shared gutter/padding rhythm, varying backgrounds                                      |

## Content Growth Plan

- **Gallery strip**: designed to take any number of images — the strip loops
  whatever list it is given; adding photos is a data change, not a layout one.
- **Programs**: the grid accepts a third card if an offering is added.
- **Conditions**: the dashed box is the reserved slot for the future embed.
- Anything beyond that (blog, schedules, multiple pages) is a new IA exercise.

## URL Strategy

- Pattern: six static routes — `/`, `/art`, `/coop`, `/conditions`,
  `/community`, `/book`. The slugs are the short ids the sections carried
  before the routes existed, not the labels (`/art`, not `/art-classes`).
- **One anchor id remains, and it is stable API**: `community`, on the
  `SnapSection` wrapping the interest-list teaser on `/`. Three things point
  at it — the co-op card as `#community`, and `/book` and `/coop` as
  `/#community` — so it must not be renamed casually.
- **`art`, `coop` and `conditions` are retired.** `#art` and `#coop` went when
  the landing page became snap sections: both cards share one snap stop, so
  the two anchors were the same screen, and an anchor onto an element inside a
  section lands at a non-snap position. `#conditions` followed. No `id` for
  any of the three survives in `src/`, so a leftover `/#art`, `/#coop` or
  `/#conditions` link now resolves to the top of the landing page. Use the
  route instead.
- Anchor targets clear the sticky nav via `scroll-pt-nav-sm md:scroll-pt-nav`
  on `html`, which subtracts the same tokens the nav sets its height from.
- No dynamic segments, no query parameters.
