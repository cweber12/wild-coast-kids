# The measured band

> Planned 2026-09-04. In flight.

The two dark cards at the top of `/conditions` become one line. It says what was
measured, when it was measured, and what time it is now — and it says nothing
else, because everything a card said about an absence moves to the panel that
draws the model standing in for it.

## The problem, from the reader's point of view

A parent opens `/conditions` on a phone or a laptop to decide whether to drive
to the beach. The first 340px of the page is a headline, a liability notice and
a list of beach links. Under that sit two dark cards, roughly 180px tall, and
under those the week and the day — the two regions that actually answer "which
day should we go".

At the review viewport (1536×639 CSS pixels; see `docs/plans/section-snapping.md`
and issue #37 for why that is the number) the cards straddle the fold. Nothing
below them is visible without scrolling. The cards hold eight figures, and the
reader who came to compare Saturday against Sunday has to scroll past all eight
to reach anything that mentions Saturday.

The second half of the problem is worse and is not about layout at all.

**The page says "Measured now" over readings up to three hours old.**
`MAX_WAVE_AGE_MINUTES` and `MAX_OBSERVATION_AGE_MINUTES` are both 180. A buoy
publishing every thirty minutes can miss five cycles and the card still prints
its height under a provenance line reading `Measured now`, with nothing to say
otherwise. The observation's own timestamp is computed in `lib/upstream.ts`,
used to enforce the limit, and then thrown away before the view model is built.
Nothing downstream of `lib/conditions.ts` knows when anything was measured.

`CONTEXT.md`'s **Conditions** entry has always said the tool shows readings
"attributed and timestamped". Half of that has never been true.

## What the reader gets instead

One band, full width, directly under the page header, in every state:

```
🏄 3.0 ft · 72°F water — about waist high.
💨 70°F · 7 mph from the west — Mild, with a light breeze.
   2:26 PM, Thu Sep 4 · nothing older than 1:48 PM
   Waves from Buoy Scripps Nearshore (NDBC) · air from Scripps Pier, 2.5 km
```

At 13px that is about 148 characters for the three segments — roughly 1005px,
so one line at 1536 with the attribution on a second. At the 342px phone width
it wraps to about five lines, against roughly 360px for the two stacked cards
it replaces.

## Measurements only, and why that decides the shape

**Only 15 of the 51 beaches have a wave buoy at all.** All 51 have an air
station. Applying ADR-0048's intersection rule over the eighteen areas, waves
are `shared` in 3, `mixed` in 2 and `absent` in 13 — so the wave half of this
block is a figure on:

- 15 of 51 beach pages,
- 3 of 18 area pages.

**18 of 69 routes, about 26%.** On the other 74% the wave half of the card today
is a paragraph explaining an absence, plus a `<details>` carrying the join's own
reason. Designing a compact band around two figures would be designing for the
minority case.

So the band carries **what was measured and nothing else**, and every sentence
explaining a missing wave measurement moves to the day chart's wave tab and the
week's wave row — beside the modelled heights that stand in for it. That is
already where ADR-0019's disclosure most belongs: the risk that decision names
is a reader trusting a modelled height as an instrument reading, and the
modelled heights are drawn in those two places, not here.

## The two clocks, and why they come from different places

The route sets `revalidate = 900`. A "now" rendered on the server is the render
time and can be a quarter of an hour behind the reader. On a page whose whole
discipline is refusing to print a confident wrong number, a clock that is
quietly fourteen minutes slow is the worst figure available to add.

The asymmetry that resolves it: **an observation time is a fact about the past
and survives caching intact; "now" does not.** So:

- the observation bound is rendered on the server as an absolute local time,
- "now" is a client component behind `useHydrated()`, ticking each minute.

It renders **Pacific time**, not the browser's locale. A reader in New York
would otherwise see 5:26 PM beside a reading taken at 2:26 PM at a San Diego
beach, and the gap between the two numbers is the whole point of showing both.

Without JavaScript the reader gets the observation bound and no "now", which is
honest: nothing false is shown, and `hydrated.ts` records that this is the
site's established answer (ADR-0027).

### One bound, worded as a bound

There are up to **three** observation times behind five figures. Probed live on
2026-09-04 at 21:26 UTC, for Shell Beach — buoy `46254` and station `LJAC1`:

| value           | newest row | local   |
| --------------- | ---------- | ------- |
| wave height     | 21:26 UTC  | 2:26 PM |
| wind            | 21:00 UTC  | 2:00 PM |
| air temperature | 20:48 UTC  | 1:48 PM |

The buoy publishes every thirty minutes. `LJAC1` publishes every six, but its
`ATMP` column was already `MM` on the newest row, so temperature sat four rows
behind wind. Three times spanning 38 minutes, in the ordinary case, on the beach
the design was drawn against.

The band prints **one** value: the oldest contributing row, worded as a bound —
`nothing older than 1:48 PM`, never `readings from 1:48 PM`. The distinction is
load-bearing twice over. It is true, where the second form is false. And a bound
over a set is not a provenance claim about any figure, so it does not put two
networks behind one attribution — which is what ADR-0010 refuses.

The cost is accepted knowingly: a five-minute-old wave height reads as
38 minutes old. Understating freshness is the safe direction for this site, and
one line is worth it.

## Decisions

**Two provenances stay behind one panel, and behind two sentences.**
`ReadingCard`'s `gloss` docstring anticipates this exact change — "the
temptation once the cards are being compressed is to merge them; that decision
refuses two provenances behind one sentence, and this is that sentence." The
band keeps two glyph-anchored groups with their own plain-words lines. `about
waist high, mild with a light breeze` is the merge ADR-0010 forbids and is not
built.

**Period and gust are dropped.** They need the words "period" and "gusting" to
mean anything to a parent, which costs about 25 characters, and they are the two
most surfer-specific figures on the block. Both values leave the site: nothing
else on the page carries a measured period or gust. This is the one deliberate
loss of published data in the plan.

**The attribution stays visible, one line, under the band.** Moving it into
`ConditionsNotes` was considered and rejected — see below.

**No third glyph.** ADR-0015 makes the emoji vocabulary closed. 🏄 and 💨 come
across; the clock segment carries no glyph.

**One `role="region"` with an `aria-label`, no visible heading.** The two card
`<h2>`s leave the outline, which becomes `h1` → region `h2` → day `h3` with no
card level between. The label goes on `aria-label` rather than a hidden heading:
`ReadingCard` records the accessible-name algorithm joining adjacent inline text
nodes with no separator, and this repo does not use `sr-only` anywhere.

**The band is called a band.** `badge` is taken by the program-card pill,
`readout` by the map corner block, and `strip` by the marquee — all three in
`CONTEXT.md`. `band` is unclaimed and is already the informal word for this
block in `ConditionsSection` and `MeasuredToday`.

## Slices

Three pull requests. Each is vertical, leaves the page working, and is
revertible on its own.

### PR 1 — A reading states when it was taken

`observedAtMs` plumbed from `lib/upstream.ts` through `lib/conditions.ts` into
`WavesView` and `AirView`, as the oldest contributing row per source. Printed on
the **existing cards**, replacing `Measured now`.

This ships alone because it fixes a defect alone: a three-hour-old reading stops
being labelled as current. No layout moves.

ADR: _A reading states when it was taken, and "now" comes from the client._

### PR 2 — Wave absences are worded where the model is drawn

The ADR-0019 modelled-source disclosure, the bay sentence, the `unavailable`
sentence and ADR-0049's withheld-product wording move out of the wave card and
into the day chart's wave tab and the week's wave row. The card keeps a short
marker in its slot.

Nothing is deleted here and nothing is hidden; the sentences change position.
After this PR the explanation of a missing wave height sits beside the modelled
height that answers in its place, which is where a reader who might be misled by
that height actually is.

ADR: _Wave absences are worded where the model is drawn_ — extends ADR-0019 and
ADR-0049.

### PR 3 — The measured band

The band replaces both cards. `MeasuredToday`, `ReadingCard` and `StatGroup` are
deleted with their tests — about 2,100 lines, and `ReadingCard` and `StatGroup`
have exactly one caller each. `MeasuredPanel` survives as the fetch seam.
`CONTEXT.md` gains a **Measured band** entry.

ADR: _The measured block is one band, not two cards._

## Test seams

Agreed before any code, because they decide whether this is verifiable at all.

- **`observedAtMs` in `lib/upstream.ts`.** Fixture-fed, asserting the oldest
  contributing row — including the NDBC per-field case, where temperature and
  wind come off different rows and the older one has to win.
- **A pure `measuredBand.ts`.** Takes the view models and returns the band's
  text segments. Every state is assertable with no network and no DOM: both
  readings, waves absent, waves withheld, air unavailable, air drifted, a
  partial air reading with a null temperature or a null wind.
- **The clock as a client component behind `useHydrated()`.** Fake timers,
  asserting nothing renders before hydration and Pacific time after — not the
  test runner's locale.
- **The existing wording functions are not touched.** `heightWords`,
  `warmthWord`, `windWords`, `plainWords` and `compassWords` keep their current
  tests and move into the band unchanged.

Two things the gate cannot do, stated so they are not assumed:

- **`generateStaticParams` returns `[]`,** so `npm run gate` compiles these
  routes and renders none of them. The band is checked by curling the dev
  server, not by `build`.
- **The height saving is an estimate from tokens.** It is measured with
  Playwright at 1536×639, 390×844 and 320×640 before the layout is accepted.
  Every layout figure in this file above was derived from the narrowest width
  the site supports and then checked at the widest, not the other way round.

## Considered and rejected

**A summary badge with the cards left in place** — the `RipLevel` pattern, which
this repo already runs: a compact readout beside the chooser summarising a fuller
block further down. Nothing would be lost and no ADR would move. Rejected
because it _adds_ height at the top of the page instead of removing it, which is
the opposite of the ask, and duplicates every figure six inches apart.

**The band inside the chooser column, beside the dropdown.** Literally what was
asked for. The column is `md:w-72` — 288px — and the content is six stacked
lines there, about 130px, so the header row grows from ~100px to ~246px and the
net saving falls to about 70px. A 288px column cannot hold a badge, only a
narrow card: it is the cards, rotated. A third column beside the chooser does
not fit until `xl`, because at `md` the title is already compressed below its
`max-w-130`.

**One timestamp per source, two lines.** More honest per figure — the printed
time would never understate by more than the gap inside a single source. Costs a
line, and the gap inside `LJAC1` alone was 12 minutes on the day this was
measured, so the second line does not buy as much as it looks like it does.

**Moving the attribution into `ConditionsNotes`.** That component is `<details>`,
closed by default, at the page bottom, and its API is `{ entries, reach }` —
inventory-wide constants with no per-beach data. The move would need a new
per-beach parameter on a component built for the opposite, and would put "which
buoy is this?" one click and one page-scroll away. ADR-0010's guarantee is that
no figure is shown without the reader being able to see where it came from; one
visible line under the band costs about 20px and keeps it intact.

**Showing the modelled height in the band on the 36 beaches with no buoy.**
Every route would get two figures. Rejected outright: the band's entire claim is
that this is what was measured, and ADR-0019 records the model and the buoy
disagreeing 2.0 ft against 0.8 ft at La Jolla Shores on 2026-08-26.

**Dropping `revalidate` to 60s so the server can print "now".** No client island
and no hydration question, at fifteen times the origin renders — and the clock
would still be up to a minute stale, with a CDN free to serve a
stale-while-revalidate copy older than that. A real bill for a smaller lie.

## Out of scope

- The rip current line. It stays where it is, under the chooser, outside the
  band. ADR-0009 forbids a relayed judgement _inside_ a block claiming to be
  measurements; adjacency is already the shipped layout and is not the problem.
- `MAX_WAVE_AGE_MINUTES` and `MAX_OBSERVATION_AGE_MINUTES`. Tightening the
  acceptance window would make one bound honest by construction, but it changes
  what the page shows rather than how it labels it, on every beach. If the
  timestamps make the 180-minute window look wrong once they are visible, that
  is its own decision with its own evidence.
- The week grid and the day chart, except for the sentences PR 2 moves into
  them. Their own figures, tabs and rows are untouched.
- Issues. This plan is three strictly sequential pull requests on one branch
  each; two people could not pick up two of them without colliding, which is the
  test `CLAUDE.md` sets for whether splitting earns its keep.
