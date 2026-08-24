# Design Brief: The Conditions Page

Date: 2026-08-24. Feature slug: `conditions-page`.

Covers `/conditions` and `/conditions/[slug]`, which render one section and must
not drift apart.

**There is no `INFORMATION_ARCHITECTURE.md` in this folder, on purpose.**
`.design/wild-coast-kids-landing/INFORMATION_ARCHITECTURE.md` is the site's
single canonical URL-structure document despite its folder name, and this work's
IA was written into it rather than beside it — closing the `/conditions/<slug>`
gap filed as #78 in the same pass. A second document defining URL structure is
the exact drift this repo has already corrected twice, in PR #28 and PR #43.

## Problem

A parent leading a co-op outing decides on Thursday where to take eight children
on Tuesday. `/conditions` already knows most of what they need — today's lowest
tide, the swell, the air temperature, the wind, the visibility, and where each
of those was measured. The information is there and it is honest.

They cannot read it.

Everything on the page is a single 520px column pinned to the left edge, so on
an ordinary laptop the page uses about a third of its width and leaves the rest
blank. The numbers that matter are separated from each other by paragraphs of
10px fine print, so nothing can be compared at a glance — the tide time and the
wave height are three screens apart in reading order and never appear together.
The secondary readings are worse off still: wind speed, gust, sky, visibility,
water temperature and swell period are all dissolved into prose sentences, so
learning the wind speed means reading a paragraph. Six real measurements are
invisible because they were written as sentences instead of shown as numbers.

And the page does not look like the site it belongs to. Every other surface
here is loud — electric yellow, deep purple, ocean blue, heavy black italics,
rounded cards, big playful glyphs. This one is grey text on cream, no surface,
no colour, no shape. A parent arriving from the landing page's bright ocean-blue
teaser lands somewhere that reads like a government form.

The result is that a page built on genuinely careful work — every figure
attributed, every station named, every distance disclosed — reads as plain and
secondary, and the honesty that is its whole point reads as clutter.

## Solution

The same information, given the shape it always wanted.

The reader arrives and sees what the page is for and which beach they are
looking at, side by side, at the top. Immediately beneath, **three cards across
the full width** answer the question they came with: the lowest tide today, the
waves and water, the air. Each leads with one big number, says what it means in
plain words, and then shows its supporting measurements **as labelled figures
rather than buried in a sentence** — wind and gust here, sky and visibility
there, each group naming the station that supplied it.

Below that, the page turns from _now_ to _planning_. A **week grid** — days
across, products down — answers the Thursday-planning-for-Tuesday question that
today's single reading cannot. It opens with a week of low tides — the same NOAA
prediction the page already asks for, over a wider window. Rows for the forecasts
that need new upstream work are labelled slots saying what lands there.

Beside the week, a labelled slot for the **sighting map**: what people have
actually found near this beach lately. Specified in full and deferred — the
decisions are recorded in issue #121, and the slot names what is coming.

Finally, in one place rather than repeated three times, the page explains
itself: what mean lower low water is, why a buoy reading is not the wave at the
shore, why visibility comes from an airport, what this site does not cover, and
the standing sentence that none of this is a safety assessment.

Nothing is removed. The honesty layer is not reduced — it is **collected**, so
it can be read rather than skimmed past, and so the numbers it qualifies can be
seen.

## Experience Principles

1. **A reading is data; an explanation is prose. They want different widths.**
   The current page fails because one 520px column serves both, and the prose
   measure — correct for prose — is what constrains the numbers. Resolving this
   is what fills the page: figures get cards and grids that genuinely want full
   width, explanations keep their readable measure. Neither is stretched to fill
   space; both are finally the shape they were.

2. **Attribution beside the figure, explanation in one place.**
   The tension is between honesty and legibility, and this page has been
   resolving it by repeating itself. `TideToday` already argues the right
   answer — _"the acronym is named once, at the bottom, rather than beside every
   figure"_ — and then the page does that three separate times. So: which station
   supplied which number stays visible on the card, because ADR-0010 requires a
   reader be able to tell. Everything general moves to one block. More honest,
   not less: given its own space, the safety framing can actually be read
   instead of being a fragment in 10px type.

3. **Emoji mark categories, never sentences.**
   The site already has this discipline — `ProgramCards` pairs 🎨 🌿 🌊 📓 🔬 with
   text labels, always hidden from assistive technology, never in body copy. The
   tension is that emoji make a page feel alive and also make it feel cheap, and
   the line between is whether they carry information. So they head cards, label
   week-grid rows and, later, mark sightings on the map. They do not decorate the
   `<h1>`, the lead paragraph or the caveats. This also protects the map: a glyph
   means something specific on this page, so a 🐙 on a coastline reads as an
   octopus rather than as ornament.

## Aesthetic Direction

- **Philosophy**: **Coastal pop editorial**, inherited unchanged from the landing
  page — heavy italic Montserrat up to weight 900, electric yellow against deep
  purple and ocean blue, pill shapes, rounded cards, generous glyphs. Kid-brand
  energy with print-zine discipline. This page has never expressed it; the work
  is bringing it into the system, not creating a second one.
- **The instrument-panel restraint that has to survive it.** This page reports
  measurements to people taking children into the ocean. Loud is right for
  chrome — headers, surfaces, glyphs, the week grid's rhythm. It is wrong for
  the figures themselves, which stay factual and unembellished. Nothing on this
  page may look like a verdict, a rating or a recommendation, because ADR-0009
  forbids the site from making one. **A green card would be a lie told in CSS.**
- **Tone**: Confident and useful. Warm at the edges, exact in the middle. The
  voice of a local who knows the coast and tells you what the instruments say,
  including when they say nothing.
- **Reference points**: The site's own `ProgramCards` — big glyph, bold heading,
  labelled badges, a real surface. Tide tables and almanacs for the week grid's
  density. Field-guide plates for the eventual sighting map.
- **Anti-references**: Surf-report apps, which lead with a computed verdict this
  site refuses to make. Weather dashboards with gauge widgets and animated
  gradients. Government data portals — which is what this page currently
  resembles, and the specific thing being fixed. Anything beige, and anything
  that implies a rating.

## Existing Patterns

The design system exists and is canonical. This brief extends it and defines no
new system.

- **Typography**: Montserrat via `next/font/google`, weights 400–900 with
  italics, loaded once in the root layout as `--font-montserrat`. One family;
  weight and italics carry all hierarchy. Sizes are tokens: `--text-2xs` 10px
  through `--text-base` 13px, plus `--text-stat` 36px and the fluid `--text-title`
  / `--text-card` clamps. Sub-16px body sizes are the template's editorial voice
  and are kept on purpose.
- **Colors**: One fixed art-directed palette, no dark mode, by decision. Purple,
  ocean, pink, yellow, cream, dark, ink, lavender, mist, fog. `--color-fog` is
  already darkened from the template to clear 5:1 contrast. `--color-pink` and
  `bg-lavender` have zero uses anywhere in the codebase. **This page does not
  claim pink.** It was raised as available and the answer was no for now — the
  colour may be given a role later, by direction rather than by whichever page
  reaches for it first. An unused palette entry is not an unclaimed one.
- **Spacing**: `--spacing-gutter` 48px / `--spacing-gutter-sm` 24px,
  `--spacing-section` 80px / `--spacing-section-sm` 60px. Radii `--radius-tile`
  12px through `--radius-pill` 99px. `--shadow-card` exists and is barely used.
- **Components**: `ReservedSlot` (dashed frame, emoji, "coming soon" copy — the
  standing idiom for decided-but-unbuilt), `PillLink` (five tones, closed list),
  `Caveats`, `BeachSelector`, the three `*Today` presentational components and
  their three thin `*Panel` seams.
- **Conventions that constrain this work**:
  - **Stops do not apply.** `/conditions` is a routed page; it scrolls normally
    and has no 540px budget. Only the landing page snaps.
  - **`TOUCH_TARGET` is `min-h-11`**, 44px below `md` per ADR-0004. Every
    interactive element composes it.
  - **Small screens swipe, large screens grid** — stated in `globals.css` and
    already how the gallery row behaves. The week grid follows it.
  - **Tailwind source detection is opt-in and scoped to `src/`** (ADR-0006), so
    a class named in this file compiles nothing. That is deliberate.
  - **Nothing throws; failures degrade with their reason** (ADR-0013, and the
    conditions upstream module). Four states stay visibly distinct.

## Component Inventory

| Component                             | Status        | Notes                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConditionsSection`                   | **Modify**    | The whole restructure lands here: header row, now-band, week grid, map slot, explanation block                                                                                                                                                                                    |
| `BeachSelector`                       | **Modify**    | Moves into the header row, right-aligned; label promoted from a whisper; pill shape and `noscript` fallback both kept                                                                                                                                                             |
| `ReadingCard`                         | **New**       | Shared shell for the three now-cards — emoji header, lead figure, plain-language line, stat groups, attribution. Shared rather than three call sites, for the reason `ReservedSlot`'s docstring already gives: the shape is what drifted when six call sites each wrote their own |
| `StatGroup`                           | **New**       | Labelled figure pairs as a `<dl>`. **Groups by provenance**, so values from two stations can never render as one set                                                                                                                                                              |
| `ProvenanceLine`                      | **New**       | The one visible attribution line: station · network · distance                                                                                                                                                                                                                    |
| `TideToday`                           | **Modify**    | Adopts `ReadingCard`; keeps all four states and the height sentence                                                                                                                                                                                                               |
| `WavesToday`                          | **Modify**    | Adopts `ReadingCard`; period and water temp become stats; keeps `heightWords`                                                                                                                                                                                                     |
| `WindToday`                           | **Modify**    | Adopts `ReadingCard`; wind/gust and sky/visibility become **two** stat groups with **two** attributions, per ADR-0010                                                                                                                                                             |
| `TidePanel`, `WavePanel`, `WindPanel` | **Unchanged** | Deliberately the thinnest things in the tree: read, render                                                                                                                                                                                                                        |
| `WeekGrid`                            | **New**       | Days across, products down. Tolerates ragged row lengths; a product with no forecast is absent, not blank                                                                                                                                                                         |
| `TideWeek`                            | **New**       | The first live row: a week of lowest lows                                                                                                                                                                                                                                         |
| `ConditionsNotes`                     | **New**       | The consolidated explanation block — datum, buoy distance, airport visibility, the standing safety sentence                                                                                                                                                                       |
| `Caveats`                             | **Modify**    | Moves inside `ConditionsNotes`; disclosures and the gate-enforced `unresolved` rendering unchanged                                                                                                                                                                                |
| `ReservedSlot`                        | **Reused**    | Map slot and forecast-row slots. No change to the component                                                                                                                                                                                                                       |
| `PillLink`                            | **Reused**    | Links out to authorities in the notes block                                                                                                                                                                                                                                       |

**Library work**: `lib/conditions.ts` gains a read returning a week of lowest
lows. This **widens the existing CO-OPS request** — today's call asks for
`nowMs − 1 day` to `nowMs + 1 day`, a three-day window sized so "today" survives
the timezone boundary, so a week is not already in hand. Same endpoint, same
parser, same six-hour cache, `endDate` moved out. The day read and the week read
**share that one request**: separate ranges would mean separate URLs, which Next
would not dedupe, so the page would make two NOAA calls where it makes one
today. No new upstream product and no new dependency.

## Key Interactions

**Choosing a beach.** The reader picks from the selector in the header. The
route changes to `/conditions/<slug>`, and every panel re-reads for that beach.
Each panel has its own suspense boundary and its own fallback sentence, so a
slow buoy never holds up the tide time — three agencies, three failure modes.
The `noscript` list of plain links remains the fallback; a phone with blocked
scripts must not get a control that silently does nothing.

**Reading a card.** Static. The lead figure, the plain-language line and the
stat groups are all present without interaction. Nothing important is behind a
hover, a tooltip or a tap.

**Opening a disclosure.** Failure detail, the reasons a station is missing, the
excluded-beach list and the unresolved-data list stay in `<details>`. That is
the existing compromise that lets the caveat list be comprehensive without
burying the reading, and it does not change.

**A missing reading.** Renders its sentence, never a blank and never a zero.
The four states stay distinct: a reading, a gap in our request, no station will
ever exist here, and the station could not be reached just now. The middle two
look alike and are the two most worth separating.

**Reading the week on a phone.** The grid **transposes rather than scrolls**. At
`lg` and up each day is a column, seven across. Below that each day is a row,
seven down. The DOM is **day-major** and identical at every width; only
`grid-template-columns` changes, so ADR-0005's render-twice rule is not invoked
and does not need to be.

This deliberately departs from the _"small screens swipe and large screens
grid"_ line in `globals.css`, and the departure is reasoned rather than
accidental. That convention was written about the **gallery** — images, where
swiping is natural — and about the 768–1023 band where the program cards' pills
wrap. It is not a site-wide law about every grid. A seven-day forecast is a
**comparison task with few items**, and hidden content is the specific cost that
matters: a parent planning Tuesday must be able to _see_ Tuesday, not discover
a scroll affordance concealing it. This is also why weather products
conventionally scroll hourly data horizontally and list daily data vertically.

Day-major order is additionally the correct screen-reader sequence — _"Monday,
low tide 6:42 am. Tuesday, low tide 7:20 am"_ — which product-major order would
not give.

## Responsive Behavior

| Band  | Header row                                         | Now-band         | Week grid                     |
| ----- | -------------------------------------------------- | ---------------- | ----------------------------- |
| base  | stacked: `h1`, then lead, then selector full-width | one card per row | seven day-rows, stacked       |
| `sm`  | stacked                                            | two cards        | seven day-rows                |
| `md`  | `h1` left, selector right                          | two cards        | seven day-rows                |
| `lg`+ | `h1` left, selector right                          | three across     | seven day-columns, full width |

Prose blocks — the lead paragraph and the notes block — hold `max-w-130` at
every width. That cap is correct for reading and is not what was wrong; it was
wrong only where it constrained figures.

The first screen is designed against a **555px** budget: a 1536×639 viewport at
125% scaling, less the 84px nav, which is the review machine this repo is
actually checked on. Moving the selector into the header row reclaims roughly
103px, which is what puts the now-band above that fold instead of below it. The
budget is a target for the composition, not a gate — the page scrolls, and
content that does not fit is arranged, never removed.

## Accessibility Requirements

- **Contrast**: every text/surface pair clears **WCAG AA**, 4.5:1 for body and
  3:1 for large text. `--color-fog` is already tuned for this and clears 5:1 on
  mist. Any new surface — including a pink or lavender accent — is checked
  before it ships, not after.
- **Emoji are never the only carrier of meaning.** Every glyph is
  `aria-hidden="true"` with a real text label beside it. A screen reader hears
  "Waves and water," never "wave emoji."
- **Stat pairs are a description list.** `<dl>`/`<dt>`/`<dd>`, so the
  label-to-value relationship is structural rather than visual. This is what
  makes the two-provenance grouping survive for a non-visual reader, which is
  precisely what ADR-0010 is protecting.
- **Headings stay a real outline**: one `<h1>`, an `<h2>` per card and per
  region, nothing skipped. Each card region keeps its `aria-labelledby`.
- **Keyboard**: the selector is a native `<select>` and stays one. The week grid
  transposes rather than scrolls, so it introduces no scroll container and needs
  no focus stop of its own — one of the reasons that decision is the better one.
  Nothing on this page is reachable only by pointer.
- **The caveats chain is already asserted end to end**, and the restructure must
  keep it green rather than add to it: `lib/caveats.test.ts` binds every
  `unresolved` entry in every data file to `inventoryCaveats()` in both
  directions, and `ConditionsSection.test.tsx` asserts every entry it returns
  reaches the rendered page. Moving `Caveats` inside `ConditionsNotes` is safe
  because the second test would fail if any caveat stopped rendering.
- **Touch targets**: `TOUCH_TARGET` on every interactive element below `md`, per
  ADR-0004. The enlarged selector is the main one.
- **Motion**: none added. No animated gauges, no counting-up numbers, no
  transitions carrying meaning.
- **The `noscript` beach list survives the redesign.** It is not decoration; it
  is the whole control for a reader without JavaScript.

## Out of Scope

- **The sighting map itself.** Fully specified in **issue #121** and deliberately
  deferred at the author's request; a `ReservedSlot` ships in its place. This
  brief covers the slot and the space it occupies, not the map.
- **Forecast rows needing new upstream work** — gridded NWS temperature, wind and
  sky (issue #95), and the surf zone forecast. The week grid ships with the tide
  row live and labelled slots for these. Building them is separate work.
- **Any computed verdict**: no safety rating, no "good tidepooling today," no
  best-beach ranking, no colour that encodes a judgement. ADR-0009 governs.
- **New upstream products, new dependencies, and any map library.** The week's
  tide row widens a request this page already makes, to the same endpoint with
  the same parser and the same cache.
- **The landing-page conditions teaser.** It sits in a 540px stop with its own
  budget and its own reserved slot. _Noted while working here, not fixed here:_
  that slot's copy says "Surf, wind and visibility are still to come," which
  shipped before waves and air did and is now stale.
- **Dark mode.** One fixed art-directed palette, by decision.
- **Water quality, marine protected areas, active alerts** — later slices of
  `docs/plans/conditions-tool.md`.
- **The `/conditions/[slug]` information-architecture gap** (issue #78). The IA
  phase that follows this brief may close it; this brief does not.
- **Changing what any reading means.** No thresholds move, no wording of a
  measurement changes, no station binding is touched. This is a presentation
  change over a data layer that is already correct.
