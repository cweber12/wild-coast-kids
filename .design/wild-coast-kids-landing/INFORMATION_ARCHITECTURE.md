# Information Architecture: Wild Coast Kids

## Site Map

Six static routes and one dynamic segment beneath one of them. The landing page
keeps a teaser for each program area; the routed pages carry the fuller version.

- Home `/`
  - Art Classes `/art`
  - Tuesday Co-op `/coop`
  - Conditions `/conditions`
    - One beach `/conditions/<slug>` — the only dynamic segment on the site
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
2. **Gallery section (header + paged row)** — proof before pitch: kids' actual
   work holds still until the reader moves it, a screenful at a time
   (ADR-0007). The header carries the prev/next pager as well as the heading,
   because a control overlaid on the row covers artwork at some scroll
   position whatever its padding is (ADR-0008). The marquee it sits beneath is
   the only thing on the page that still moves on its own.
3. **Programs (prog-grid)** — the two offerings, each with its own CTA. This is
   the conversion core; everything above earns attention for it.
4. **Conditions** — differentiator teaser; placeholder until the tool exists.
5. **Community form** — the catch-all conversion for anyone not ready to book.
6. **Quote + stats** — social proof and the one fact parents filter on (K–8).
   It was two facts until the charter claim was withdrawn on 2026-08-20 (issue
   #104, `docs/plans/charter-claim-withdrawn.md`). It closes the page by
   decision, not by leftover ordering: it was fourth until the sections became
   snap stops (`docs/plans/section-snapping.md`).

Six items, and they are the six `SnapSection`s of `src/app/page.tsx` in order.

**The footer is not one of them.** It lives in `src/app/layout.tsx`, so it
closes every route rather than the landing page. It still shares the quote's
screen — that stop is `screen-less-footer`, the window less the nav less the
footer — but it is not a stop of its own and nothing above it on this list
applies to it.

Cut from the template: editorial block ("Real kids…") and the yellow
wordmark banner. Decided in the brief; not deferred.

### The routed pages

`/art`, `/coop`, `/conditions`, `/community` and `/book` share one shape: an
eyebrow line, an italic title, a lead paragraph, at most one CTA, then
reserved slots where real content lands. They were structural shells
throughout, by decision in `docs/plans/nav-pages-scaffolding.md`; photos and
the booking scheduler still are. Charter-fund details are not among them: the
claim they would have explained was withdrawn rather than reserved, so there is
no slot standing in for it (issue #104).

**The schedule is no longer among them.** `/art` and `/coop` render their own
program's upcoming sessions in the slot that was reserved for one, read from
Supabase per request — day, hours, title, an optional summary, a map link and,
on `/art`, a price. The slot has not been deleted: it is still what the page
shows when the term has nothing booked yet, and equally when the database
cannot be reached, because a reader can act on neither. See
`docs/plans/session-schedule-from-supabase.md`.

A session belongs to a program and is not a page. There is no `/sessions`
route, no per-session URL and no fifth nav link; the schedule reads inside the
page a parent already came to.

`/community` is the one that differs: below its reserved slots it renders the
interest-list form under its own heading, without the landing page's teaser
column — otherwise the "Meet the community" CTA would sit on the page it
points at.

**`/conditions` has left that shape entirely**, and is the only routed page
that has. It is a tool rather than a page of copy, and its structure is
documented under _Conditions_ below.

### Conditions `/conditions` and `/conditions/<slug>` (#78)

**One section, two addresses.** Both routes render the same conditions section;
the only difference is which beach it is given. That is deliberate and is the
reason the component exists — two routes rendering two copies of a reading
would drift, and a reader should not get a different answer depending on which
URL they arrived at. Both carry the same revalidation interval for the same
reason.

**`/conditions` opens on a named default beach**, not on whichever beach sorts
first. The default is chosen for being central, close to its tide station, and
the beach the National Weather Service means when its surf zone forecast says
"La Jolla". The page asserts the default is still in the inventory at build
time, so a rename upstream stops a build rather than rendering a page about
nothing.

**How a reader reaches a per-beach page.** Only from the conditions page itself.
The nav links to `/conditions` and nothing links to a slug directly. The beach
chooser — a grouped `<select>` in the page header — navigates on change, and a
`<noscript>` list of the same inventory as plain links is the fallback, because
a family checking the tide on a phone with blocked scripts would otherwise get
a control that silently does nothing.

**Reading order, top to bottom:**

1. Eyebrow, title and lead — with the **beach chooser on the same row as the
   title**, right-aligned, because it decides what every figure below it means,
   and the **standing safety notice** above the chooser in that same column:
   instruments rather than a judgement, lifeguards and the posted signs the
   authority on the day. ADR-0009 turns on it sitting around the readings.
2. **The now-band**: today's lowest tide, waves and water, air. Three cards
   across at `lg`, each leading with one figure and carrying its own station
   attribution.
3. **The week grid**: days across, products down; a week of lowest lows is its
   first live row. Transposes to day-rows below `lg` rather than scrolling.
4. **The sighting map slot** — a reserved slot until #121 is built.
5. **The notes block**: the datum, why a buoy reading is not the wave at the
   shore, why visibility is an airport reading, and the caveats and coverage
   disclosures. The safety framing is not here — it is the standing notice in
   item 1, because it is not a note about how to read a figure.

**A slug that does not resolve is a 404.** See _URL Strategy_ for the closed
slug set and for why nothing under `/conditions/` is prerendered.

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

### Check conditions for a beach (#78)

1. Parent lands on `/`, clicks "Learn more →" on the conditions teaser, or
   Conditions in the nav → `/conditions`.
2. The page opens on the named default beach, already showing readings. There
   is no empty state to get past and nothing to choose before an answer
   appears — the default exists so the page always opens on something that can
   answer.
3. Reads the now-band for today, or the week grid for the day they are planning
   for. This is usually a Thursday reading a Tuesday.
4. Picks a different beach from the chooser in the page header → navigates to
   `/conditions/<slug>`, and every panel re-reads for that beach.
5. Compares by repeating step 4. Comparison is sequential rather than
   side-by-side, which is a known limit of this shape and not an oversight —
   there is no multi-beach view.

Without JavaScript, step 4 is the `<noscript>` list of plain links instead of
the chooser, and the flow is otherwise identical.

Dead ends are deliberate and each says which kind it is: a beach the inventory
does not serve is described in prose on the page rather than linked, and a
stale or hand-typed slug 404s rather than rendering a page about a beach that
does not exist.

## Naming Conventions

| Concept             | Label in UI      | Notes                                                 |
| ------------------- | ---------------- | ----------------------------------------------------- |
| The art program     | Art Classes      | Never "art program" or "lessons"                      |
| The outdoor program | Tuesday Co-op    | Day is part of the name                               |
| The signup form     | Community        | Nav label; form heading is "Stay in the loop"         |
| The surf/tide tool  | Conditions       | Singular section, plural word                         |
| Funding note        | Charter eligible | Withdrawn 2026-08-20 (#104); the phrase if it returns |
| Age range           | K–8              | En dash, no spaces                                    |

## Component Reuse Map

| Component     | Used on                                                                                                                                          | Behavior differences                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Placeholder` | Nav logo, hero photo, both program-card backgrounds, the gallery tiles, and the reserved gallery box on each of `/art`, `/coop` and `/community` | Label size varies; backgrounds drop the border                                                                                                                                                                                                                                                                                          |
| Pill shape    | Nav CTA, hero CTAs, card CTAs, teaser CTAs, routed-page CTAs, form submit                                                                        | A shape, not one component: `PillLink` for the link CTAs, `NavLink` for the nav's, a bare `<button type="submit">` for the form's. `rounded-pill` is what all three share. `PillLink`'s tones are `yellow`, `purple`, `ocean`, `outline-light` and `outline-dark`; solid and outline carry different padding so their outer boxes match |
| Looping track | Marquee                                                                                                                                          | `StripTrack`, and the marquee is its only caller — `GalleryRow` does not use it (ADR-0007)                                                                                                                                                                                                                                              |
| Section shell | All six sections of `/`, hero and programs included                                                                                              | `SnapSection` shares a height, a surface tone and `snap-start`; children drop their own vertical padding under it                                                                                                                                                                                                                       |

## Content Growth Plan

- **Gallery row**: photos arrive in composed threes. The row pages a screenful
  at a time, and from `lg` a page is three tiles — two 4:3 and one 16:9, the
  wide one alternating side down the list — so the nine grow by whole pages or
  not at all. `galleryImages.test.ts` asserts all three rules, so a tenth image
  fails the gate rather than quietly leaving a final page holding one tile
  against an empty row. Adding photos is a data change _and_ a composition
  decision; what it is not is a layout one.
- **Programs**: the grid accepts a third card if an offering is added.
- **Conditions**: the teaser's dashed box is the reserved slot for the
  conditions tool, which is built in this repo rather than embedded from
  elsewhere (ADR-0009). `/conditions` has already dropped its own slot for a
  first reading; the teaser keeps its box until a slice has something to put in
  it. `docs/plans/conditions-tool.md` is where that state is recorded, not here.
- **A new program area** is a route beside the existing five, plus a teaser
  section on `/` that links to it. That path is established; adding one
  decides nothing new.
- **Real schedules** arrived, and did not need a new address: they render
  inside the two program pages rather than at one of their own. Adding a
  combined `/schedule` route later would be a genuine IA exercise, and is
  deliberately not one this took.
- **Dynamic routes** arrived in `/conditions/[slug]`, and are now described —
  in _Site Map_, in _The routed pages_, in _User Flows_ and in _URL Strategy_
  (#78). The pattern they establish is narrow on purpose: a dynamic segment is
  warranted where one page answers about **one of many interchangeable
  subjects** the site does not author — the beaches, read from an upstream
  inventory. It is not warranted for content this site writes, which is why
  sessions render inside a program page and have no URL of their own.
- Anything beyond that (a blog, a store, a login) is a new IA exercise.

## URL Strategy

- Pattern: six static routes — `/`, `/art`, `/coop`, `/conditions`,
  `/community`, `/book` — plus one dynamic segment, `/conditions/<slug>`. The
  static slugs are the short ids the sections carried before the routes existed,
  not the labels (`/art`, not `/art-classes`).
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
- **One dynamic segment: `/conditions/<slug>`.** The slug set is **closed** — it
  is exactly the served beaches in `src/data/beaches.json`, and a slug outside
  that set is a 404 rather than a page apologising about a beach that does not
  exist. The chooser cannot produce one; a stale link can. Beaches the inventory
  lists but does not serve are 404s too: they are recorded in the data file's
  `_excluded` block, which is rendered to the reader as prose on `/conditions`,
  not as routes.
- The slug count is deliberately **not written down here.** It is derived from
  the inventory, which a script rewrites from an upstream resource — the same
  reasoning `inventoryReach()` uses for declining to hand-maintain a count of
  somebody else's list.
- **Nothing under `/conditions/` is prerendered at build.** `generateStaticParams`
  returns an empty array on purpose, so upstream is asked about a beach the
  first time a reader actually chooses it, and served from cache afterwards.
  Upstream load follows real readers rather than the size of the inventory.
- No query parameters.
