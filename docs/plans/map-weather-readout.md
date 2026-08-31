# The map's weather: a corner readout, and water and air that move

Planned 2026-08-31. In flight.

> Supersedes, in `docs/plans/conditions-day-view.md`, the decision that "the
> compass sits on the map" and its rejection of needles that follow a scrubbed
> hour. Narrows ADR-0027's clause "the compass may not follow the selected
> hour". Each reversal is argued below and each gets its own ADR, because a
> plan file stops being maintained when it merges and an ADR does not.

## The problem, from the reader's side

The shore map draws this beach's coast and which side of it the water is on, and
a dial with two needles is drawn on top of it. The dial's ring is 30 units in a
100-unit frame — 60 units across, plus labels at radius 34 — and it is anchored
on the beach's own stretch of coast rather than the frame's middle. So it covers
the thing the map exists to show, and on some beaches it overflows the edge.

Reviewed on the built page: it is visually distracting, and the coastline the
needles are meant to be read against is underneath them.

Two further things are true of the map and were not visible until this was
looked at properly.

**Nearly half the inventory has no weather on the map at all.** `anchor` is
`null` wherever no coast is traced, and that withholds the dial _and_ its
provenance. 23 of 51 beaches — Mission Bay and San Diego Bay — therefore print
no wind bearing and no wind figure anywhere on the picture.

**The map states the day while the chart beside it states an hour.** ADR-0027
built hour selection into `HourChart` and explicitly declined to let the compass
follow it. Read again with the redesign in hand, that decision turns out to rest
on an assumption the redesign removes.

## The solution

**A minimal readout in the map's top-left corner, and a picture that moves.**

```
↗ WIND    WNW 281°   12 mph
↗ SWELL   W 270°     3.4 ft · 14s
```

Two rows, tabular figures, laid over the map as HTML rather than drawn in plot
units. Arrows stay geographically true — north-up, pointing the way the weather
travels — so the onshore/offshore reading survives being moved: the map is
north-up and the coast is in the same frame. Behind each arrow, a faint wedge
spanning the day's daylight swing.

Under it, two animated layers. Swell crests perpendicular to the swell bearing,
travelling shoreward along it, clipped to the sea so they vanish under the
shoreline. Wind streams over the whole frame, above everything, crossing the
water's edge onto the land.

And the block follows the hour the chart is showing, falling back to the day's
figures when nothing is selected.

## Decisions

### The readout

**The arrows keep true bearings, and the animation is not a substitute for
them.** The alternative — a corner readout whose arrows are decorative icons,
with the moving field carrying direction — was rejected because the field is
gated off under `prefers-reduced-motion`. A map with no directional information
for a reader who turned motion off is worse than the map that exists today.

**The block is an HTML overlay in a `relative` wrapper**, not SVG in plot units.
Three reasons. Plot-unit type is already at ADR-0024's 10px floor — 3.2 units is
10.5px on the 328px map a phone draws — and this block carries four fields per
row where today's label carries one word. The `<svg>` is one `role="img"`, so
nothing drawn inside it reaches the accessibility tree; an overlay is in the
tree, which is what genuinely retires `CompassSources`' bearing sentence rather
than duplicating it. And an overlay costs zero vertical height, in a column
already stacking map, coast credit, provenance rows and the sightings slot,
reviewed in a 555px-tall stop.

**Fixed top-left on all 51 beaches**, not a corner chosen per beach. A control
that moves as a reader goes from Del Mar to Coronado is a control they have to
find again. Safety is asserted rather than eyeballed: a test walks every beach
through `shoreViewFor`, projects, and fails if the badge's box covers the drawn
segment.

**The ring goes, and the spread becomes a wedge.** The ring is the map's only
piece of chrome and its stated justification is that "an arc with nothing to be
a portion of reads as a stray stroke rather than as a range". At corner size the
arc it justifies can no longer be judged — a 40° arc and a 50° arc on a 9px ring
are the same picture — so both go and a filled cone takes over. The cone reads
at 16px, and a 190° day drawing a blob is correct: that day had no direction.

The wedge was rejected once, and its reason has expired. "A wedge covering a
fifth of the map on a settled day and half of it on an unsettled one would hide
the coast underneath." In a corner badge there is no coast underneath.

**The figures are ones the page already holds.** Swell reuses `WaveReading` —
the three-hour step that carried the largest daylight height, with its own
period — so the map and the week grid cannot print different numbers for
Thursday, and thickness and spacing describe one estimate rather than two
unrelated averages. Wind has no such figure and takes the peak daylight hour,
mirroring that rule so both rows can be worded once: each figure is the largest
thing the daylight window holds, and each arrow is the direction that window
mostly delivered.

**`CompassSources` drops to bare provenance lines**, and the step's timestamp
moves into them: "CDIP MOP D0606, 709 m — estimate for 2 PM". One place says the
numbers, one place says where they came from. It also keeps the badge at
~190px of the 328px map rather than ~240px.

**The block renders on all 51 beaches.** The objection it was withheld under — "a
bearing read against no shoreline is the bare gauge the brief's anti-references
open with" — was about a needle drawn over an empty frame. A labelled readout
with units and a provenance line is not that.

### Following the hour

**The block tracks `HourChart`'s selection, and the wedge does not.** The wedge
stays the day's daylight swing; the arrow is this hour inside it. That pairing is
the whole argument for why ADR-0027's clause can be narrowed — see below — and
it is a better instrument than either half: a reader sees the hour _and_ what the
day did around it.

`selectedMs` is `useState` local to `HourChart` today and lifts into a context
mirroring `selectedDay.ts`, including that module's deliberate default: outside
the provider the chart keeps its own state and offers no choice.

**Not `aria-live`.** `HourChart`'s readout already is. Two live regions firing on
one arrow-press means a keyboard reader hears the change twice.

**The swell steps on CDIP's grid; the wind glides.** `WaveHour.directionDegT` is
`null` on five hours in eight by deliberate policy — "halfway between 350 and 10
is 0, and averaging them as numbers says 180 — due south, the reverse of both".
So the swell row holds the last published estimate and its provenance names the
step's time, while the wind moves every hour. Two feeds visibly running at
different cadences is a true fact about them, and the chart already marks
published points, so it explains itself. `periodS` joins `WaveHour` as
`null`-on-interpolated, mirroring `directionDegT`.

### The animation

**The governing rule: the animation restates, it never states.** Every fact a
layer carries is in the corner block at full contrast. This is the decision that
lets a page this careful about provenance carry an animated layer at all, and it
binds in both directions — the field may sit as faint as looks right, _and_ it
may never show anything the block does not say.

Five things fall out of it rather than needing to be arranged: the layers are
decorative reinforcement and exempt from the 3:1 graphical-object floor that the
arcs were measured against; `prefers-reduced-motion` loses nothing, so freezing
them is honest; the block is already the accessible equivalent; no animated
channel owes a provenance line under ADR-0010; and a beach with no MOP line has
no swell row and therefore no crests, automatically.

**Spatial quantities are drawn true. Temporal ones cannot be.** Crest spacing is
the real deep-water wavelength, `L ≈ 1.56 × T²` metres, converted through the
map's own scale: a 14s swell is ~306 m, about 7.7 plot units on a typical 3.5 km
frame, so ~13 crests cross the picture. A 20s groundswell draws 6 and an 8s
windswell draws 40, and the difference is a fact rather than a constant someone
chose. Speed cannot be true — 10 mph across a 4 km frame is fifteen minutes to
cross — so it is an admitted mapping carrying nothing. Thickness cannot be true
either, since wave height is vertical and this is a plan view; it is a
comparative restatement of a figure printed in the corner.

Deep-water is an approximation at the MOP line's 10 m depth. It is stated, not
assumed.

**Wind is unclipped and swell is clipped, and that asymmetry is the legend.**
One layer stops at the water's edge and one does not, which tells a reader which
substance is which without a boxed legend. It is also the strongest statement of
the thing the whole map is for: a stream entering over the sea wash and
continuing onto the land is visibly onshore wind.

**One translating `<g>` per layer**, holding a doubled tile that loops after
exactly one wavelength — the `animate-strip` trick already in this repo. One
compositor-friendly transform per layer rather than N animated elements, and
freezing it under reduced motion leaves a valid frame rather than a half-drawn
one. Parameters arrive as CSS custom properties so scrubbing the hour does not
remount and restart the animation.

**`ShoreMap` emits the clip and two empty slots; the client island fills them.**
That is the pattern the `compass` slot already uses, and it exists for a measured
reason: seven copies of the map to vary two numbers is 4.5 KB of coordinates a
copy at La Jolla and 200 points at `del-mar-city-beach`.

## Test seams

Agreed before starting, each at the highest point it will sit.

- **`shoreViewFor`** — already pure, already the seam. The badge-collision check
  walks all 51 beaches through it and projects, rather than asserting anything
  about one beach that happened to look right.
- **A pure geometry module** turning `(bearing, heightFt, periodS,
metresPerUnit)` into `{crestAngle, strokeWidth, spacing, duration, travel}`,
  exported the way `NEEDLE_TRACKS` is so tests read it rather than repeat it.
  Named so it cannot collide case-only with its component: `Compass.tsx` and
  `compass.ts` are one file on Windows, and Linux CI would pass the pair.
- **The governing rule as a rendered invariant** — the set of animated layers on
  a day is a subset of the rows in the corner block. This is the ADR held by the
  gate rather than by prose, which is this repo's stated preference.
- **The `stylesheet` gate** for the keyframes and the `motion-reduce` utility.
  Tailwind's source detection is opt-in here (ADR-0006), so a class in the built
  CSS is evidence a component uses it.
- **`selectedDay.ts`'s existing shape** for the hour context, so the two
  selections work the same way and have the same out-of-provider default.

## Out of scope

- **CDFW MarineBIOS Shoreline Types [ds3115].** It traces the real shoreline for
  the whole county including both bays, and would let the animation reach the 23
  beaches this plan leaves it off. It is separate work and larger than it looks:
  `seaPath` closes the sea polygon from one normal taken from the drawn run's
  two endpoints, which assumes a monotone open run — around a bay the first and
  last points land near each other, the length collapses toward zero, and the
  wash floods an arbitrary half of the frame. So it is a rewrite of the sea wash
  (ADR-0033) and the `sea-side` gate row, not a data swap. It is additive rather
  than a replacement: `mop-lines.json` stays, because it carries the wave
  forecast and not just a line. Open `TODO(verify)`: its licence and required
  attribution, its download format and endpoint, its file size against the
  115 KB `mop-lines.json` precedent, and whether its line direction is
  consistent enough for `sideOf` to be asked.
- **Shoreline type as content.** That dataset separates Rocky Shores, Tidal
  Flats, Coastal Marsh and Beaches. The sightings slot on this very map promises
  "octopus, nudibranchs, sea hares and leopard sharks", which live on rocky shore
  and tidal flat rather than on sand. That is a larger idea than this plan and is
  noted, not started.
- **A third, measured needle on today.** Still rejected, on the reason
  `conditions-day-view.md` gives.
- **A verdict of any kind.** ADR-0009's line is easiest to cross with a picture,
  and a moving one more so. Nothing here says whether the water is good.

## Interaction with #191

Issue #191 reports the wind figure stated at two precisions across five places —
`11.5 mph` in four and `12 mph` in the fifth. The corner block adds a sixth
statement of that figure. It must adopt the same precision rule, or #191 lands
first.

## Considered and rejected

**A pure readout, with the animation carrying direction.** Cheapest corner
design. Rejected: the field is gated off under `prefers-reduced-motion`, so the
map would say nothing directional to a reader who turned motion off — and
directional is the one thing the map is for.

**Holding both layers to the 3:1 non-text contrast floor**, as the arcs are.
Maximally defensible on accessibility grounds and directly contrary to the
request for something that does not distract. Rejected once "restates, never
states" made the exemption principled rather than convenient: the information is
available elsewhere at full contrast, which is the condition the floor exists
under.

**Clamping crest spacing to a legible band.** Guarantees the picture always
reads. Rejected: it is "don't fix a symptom with a constant" with two constants
instead of one, and it lies silently at both ends of the range. If 40 crests read
as noise on an 8s day, the answer is to change what is drawn per crest — thinner,
fainter — not to misreport the wavelength. This is a look-at-the-page decision
and belongs to the review of the third slice.

**Fixed spacing, with period nowhere.** Keeps the corner rows to three fields.
Rejected: the difference between a 20s groundswell and 8s wind chop is the most
interesting thing in the swell data, it is free to draw correctly, and hiding it
costs a magic number in the geometry module.

**Interpolating the swell's period and height between CDIP's points** so the
field glides rather than steps. Rejected: it draws two figures between points the
model published, which is precisely what the `published` flag exists to keep
visible.

**Only the wind following the hour.** Smallest change, no `WaveHour` field, no
stale timestamps. Rejected: two rows obeying different rules with nothing saying
so, and a reader scrubbing sees one arrow move and one not, and reads the still
one as broken.

**A resultant vector magnitude for the wind**, which is the physically correct
partner of a resultant bearing. Rejected on the case that matters: a genuinely
windy day that swung 190° has a resultant near zero, so the map would print
"1 mph" to somebody standing in it.

**An adaptive corner**, chosen per beach to avoid the coast. Cannot collide, by
construction. Rejected: the same control jumps corners between beaches, and it
becomes untestable in the useful direction — you can assert it moved, not that it
landed somewhere good.

**A translucent panel behind the badge.** Legible over anything. Rejected: a
bordered panel floating on a map is the boxed legend the brief lists as an
anti-reference, and `Compass` already rejected exactly this once at
`strokeWidth` 2.5, where the label halo "read as a chip stuck on the map".

**The block above the map rather than on it.** No overlay wrapper, no collision,
no contrast question. Rejected: it costs vertical height in a column already
stacking four blocks and reviewed at 555px, and it is not what was asked for.

**Wind fading over land** rather than crossing it at full strength. Rejected:
that is close to the straight-edged gradient across a curved coastline ADR-0033
removed for visibly disagreeing with the shore's own edge.

**A visual-regression gate.** Catches what unit tests cannot, including whether
the thing is distracting. Rejected: a dependency this repo guards, a display the
gate table would have to declare skipped by default, and animation makes the
screenshot nondeterministic unless it is frozen first.

**One PR for all of it.** Rejected on CLAUDE.md's own guide — the work touches
`ShoreMap`, `Compass`, `DayCompass`, `DayPanel`, `HourChart` (1,199 lines) and
its test file (1,135), `ChosenDay`, `conditions.ts`, two new modules and three
ADRs. Split at the two dependency boundaries below.

## The reversals, and why each survives

**"The compass sits on the map, because a bearing is meaningless without a
coast."** It still is, and the block is still in the same frame as the coast,
north-up, a few centimetres from it. What moves is that the picture is no longer
covered by the instrument reading it. The animated field then restores the
geographic reading more directly than an arrow ever did — a stream crossing the
water's edge onto the sand _is_ onshore wind, with no angle arithmetic asked of
anybody.

**ADR-0027: "The compass may not follow the selected hour."** Its surviving
argument is that "a needle whose meaning changes depending on what was last
clicked is a different instrument from one showing the day's dominant
direction". That assumed one instrument. The block carries two facts: the wedge
is the day's swing and means the same thing on all seven days, and the arrow is
this hour read against it. The day-dominant reading the clause protects is not
removed — it becomes the thing the hour is measured against.

ADR-0027's four conditions still bind and are met. Selection is by click, tap or
key and never by hover. The change is additive: the day figure is present before
anything is touched, and nothing drawn or written goes behind a gesture. No new
control is added, so the 44px floor is inherited rather than re-owed. And the
readout forms no judgement, which is ADR-0009's line.

**That an animated layer may exist here at all** is new rather than a reversal,
and is the third ADR.

## Slices, in order

Three PRs, split at the two real dependency boundaries. Each is demonstrable on
the built page on its own, and each needs a human look, because whether a thing
reads correctly to a person is not something a gate can assert.

**PR 1 — the readout (#192).**

1. This plan file, as its own first commit.
2. ADR: the dial leaves the map for a corner readout. Then the corner block
   replaces the dial — arrow, wedge, label, bearing — with the ring, `anchor`
   and the needle-track geometry removed.
3. Magnitudes join the rows; the step's timestamp moves to the provenance line;
   `CompassSources` drops to bare provenance.
4. The block extends to all 51 beaches. The 23 bay beaches gain a wind figure.

**PR 2 — it follows the hour (#193).** Blocked on #192.

5. ADR narrowing ADR-0027's clause. `selectedMs` lifts into a context; the block
   follows the selected hour and falls back to the day's figures; the wedge does
   not move.
6. `periodS` joins `WaveHour` as `null`-on-interpolated; the swell steps on
   CDIP's grid and its provenance names the step.

**PR 3 — the field (#194).** Blocked on #193, so the layers are built once
against hour parameters rather than twice.

7. ADR: the animation restates, it never states. Then the clip and the two slots
   in `ShoreMap`, the geometry module, the swell crest layer at true projected
   wavelength, and the reduced-motion freeze.
8. The wind layer, unclipped, over the frame, reusing the geometry module.
