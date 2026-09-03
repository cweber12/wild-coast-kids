# Areas over locations

> Planned 2026-09-02. In flight.

`/conditions` serves 51 beaches from one flat chooser. This plan groups them
into **areas** — Del Mar, La Jolla, Pacific Beach, Mission Bay and so on — makes
the area the thing a reader selects, and gives each one its own conditions, its
own hour chart and its own map.

## The problem, from the reader's point of view

A parent deciding where to take children on Saturday does not think in beaches.
They think "La Jolla" and then, once they are there, about which end of it. The
tool inverts that: it asks for a beach first, from a list of 51, grouped into
four bands with names like "Bays, lagoons and inlets" that describe a water
class rather than a place.

The grouping that exists is `region` in `beaches.json` — derived at seed time
from water class and mean latitude (`seed-beaches.mjs`, `regionOf`), documented
as "Display grouping only. Never a join input", and consumed by exactly one
thing: the `optgroup` labels in `BeachSelector`. It puts `Childrens Pool` in
"Bays, lagoons and inlets" alongside `Tijuana Slough National Wildlife Refuge`,
19 km away, because both are bay-class. Nobody looking for the seal beach looks
there.

The second half of the problem is that most of these 51 entries are not places a
reader distinguishes. Ten of them are inside La Jolla. Twenty are inside Mission
Bay. Choosing between `Shell Beach` and `La Jolla Cove` — 79 m and 92 m of
shore, 22 m apart — is a choice the tool demands and the reader has no basis to
make, because the two are served by the same tide station, the same air station
and adjacent CDIP model lines.

## The solution

An **area** is a named stretch of this county's coast holding one or more
locations. It is the thing a reader chooses.

An area publishes the conditions its locations **share**, and omits the ones
they do not. Where a product is omitted, it is published per location instead.
So La Jolla names one tide, one air reading and one rip current risk for the
whole of La Jolla, and a reader who wants the swell at Windansea specifically
picks Windansea and gets it.

The area has a map of its whole coast with each location marked; picking one
zooms the map to it and fills in the products the area could not answer for.

---

## Decisions

### 1. An area is an intersection, not a representative

The area reports only what all its locations share. It never picks one member's
station and calls it the area's.

**Considered and rejected: the area binds its own sources.** One tide station,
one model line and one grid cell joined to the area's centroid, exactly as a
beach binds its own. It is the smaller change — the existing joins would run
against a different point — and it fills every area's page completely.

It was rejected because it publishes a figure for a place no measurement was
taken at, under a name that implies otherwise. `beaches.json` is built entirely
out of joins that are re-runnable and whose refusals are recorded; `_served`
exists to state how far a measurement may be carried from the place it is shown
for, and defends 10 km as WMO-No. 8 §1.1.2's scale for local applications. An
area-centroid join would carry a reading across an area and call the distance
zero. The intersection rule says less and everything it says is true.

### 2. "Shared" means the locations cannot be told apart by anything the page prints

This is the decision the whole feature turns on, so it is the one stated most
carefully.

Two locations share a product when their sources have been **measured** to agree
to the precision `/conditions` renders. Not when they bind the same station —
that is far too strict, and the measurements below show why. Not when they
"look close" — that is a judgement, and this page does not make those.

The tolerance is the page's own printed precision, and that is the argument for
it: **if two sources agree to the number of decimals the page shows, a reader
cannot see a difference either way**, so publishing one figure for the area is
not a claim about the other. It is the same figure. `DayPanel` already fixes the
water's two products at one decimal; temperature prints whole degrees; the sky
prints the publisher's own wording.

| product     | source       | tolerance              |
| ----------- | ------------ | ---------------------- |
| tide        | tide station | 0.1 ft                 |
| swell       | MOP line     | 0.1 ft                 |
| wind        | grid cell    | 1 mph, 1 compass point |
| temperature | grid cell    | 1 °F                   |
| sky         | grid cell    | exact wording match    |

**Why identifier equality is not enough.** Under it, La Jolla's ten locations
share a tide station and an air station and nothing else — nine distinct MOP
lines and four grid cells between them. Its hour chart would have **one of four
tabs**. Mission Bay's twenty locations share nothing at all, and its area page
would carry no conditions whatsoever. But CDIP's lines sit about 100 m apart and
come from one model run, and a grid cell is 2.5 km square: these are not
disagreements, they are the same forecast addressed differently.

**Why a live check is not enough.** Fetching every member's feed per request
multiplies upstream load by up to twenty and — worse — makes the page change
shape with the weather. An area could show a swell tab at 3pm and lose it at 4pm
because one line drifted 0.4 ft. A page whose sections come and go is one nobody
can learn.

So the verdict is **committed, not live**: `scripts/probe-area-agreement.mjs`
measures it offline, writes the surviving products into `areas.json` with the
worst-case disagreement that justified each, and `--check` re-runs it. Drift is
reported as an issue, per ADR-0022. That is how every other binding in this
inventory already works, and the reader is served the committed result.

**The fallback is identifier equality.** Where the measurement fails — the
sources genuinely disagree, or the probe cannot reach them — the area falls back
to publishing only what its members demonstrably bind in common. A stricter rule
that is always available, so no product is ever published on an unmeasured claim.

### 3. Membership is written by hand

No derivation survives the data. Measured:

- **`nearest_city` cannot produce these names.** 43 of 51 beaches carry
  `San Diego`. The rest: Coronado 3, Del Mar 2, Imperial Beach 2, and La Jolla —
  **one**, which is `Childrens Pool`, the single bay-class location in La Jolla.
- **Latitude cannot either.** `Mission Beach` (32.7763, open coast) sits inside
  Mission Bay's band (32.7609–32.7951), 13 bay sites north of it and 6 south.
  Water class does not rescue it: `Fiesta Island` is classed **Open Coast**
  upstream despite being in the middle of Mission Bay. And `Sunset Cliffs`
  (32.7242) sits _below_ `Spanish Landing Park` (32.7284) — opposite sides of
  the Point Loma peninsula in one latitude band.

So `src/data/areas.json` is authored: area slug, display name, ordered member
slugs. The precedent is already here and already argued — `tide-stations.json`
holds "the one field that is written by hand — a station's water class, which no
upstream authority publishes and which the join needs as an input." An area name
is the same kind of fact about San Diego.

**Considered and rejected: a derived rule with hand-tuned bounding boxes.** It
keeps `regionOf`'s shape and needs no new hand-maintained file. It was rejected
because a rule made of boxes drawn around known answers is an authored table
wearing a function's clothes, and it would silently reassign a location when
upstream nudges a coordinate.

**The partition is total and disjoint, and the gate asserts it.** Every beach in
exactly one area; every named slug present in the inventory; every area
non-empty. When `seed-beaches.mjs` picks up a new beach from the state's
resource, the build **fails** until someone names its area. That is the point:
every refusal in this inventory is already recorded with the reason that produced
it, and an unassigned location would be the first silent one.

**Single-member areas are permitted and not special-cased.** A one-member area
trivially agrees with itself and therefore publishes everything — which is
exactly today's beach page, reached with no branch in the code. The degenerate
case is the old behaviour, which is the strongest reason to allow it.

### 4. The surf zone forecast is exempt from the intersection rule

The National Weather Service publishes it for **"San Diego County Coastal
Areas"** — a unit larger than any area here. It is not a point measurement, and
applying a rule designed for point measurements to it is a category error.

Applied strictly it would also cost La Jolla its rip current risk, because
`Childrens Pool` is bay-class and ADR-0043 withholds the bulletin there. That is
the one thing on this page that answers whether to put children in the water.

So: an area with any coastal member carries the bulletin, qualified in the same
voice ADR-0043 already uses to say it does not describe a bay. This is a
deliberate exception to decision 1 and gets its own ADR, because an unrecorded
exception is how a rule quietly becomes a preference.

### 5. Areas nest in the URL, and a location is a panel rather than a page

`/conditions/<area>` and `/conditions/<area>/<location>`.

**A flat namespace is impossible, not merely untidy.** Five of the area names
are _already beach slugs_ serving pages today — `pacific-beach`,
`mission-beach`, `mission-bay`, `ocean-beach`, `san-diego-bay` — and
`beaches.json` documents slug as a "Stable primary key… Never change after first
write."

`/conditions/<area>/<location>` renders **one page**: the area's shared
conditions, then the location's panel beneath them. Not a second page. If the
location were its own page showing only the unshared products, a reader arriving
at Windansea from a bookmark would get swell and sky with **no tide** — because
the tide is shared, and therefore lives on the area page they skipped. One page
makes that impossible by construction rather than by remembering to duplicate.

The 51 existing beach URLs redirect permanently into their areas. Nothing in the
repo links to one — `Nav.tsx` and `ConditionsTeaser.tsx` both point at
`/conditions` — and `generateStaticParams` returns `[]`, so nothing is
prerendered.

**Selected day and hour persist across a location change.** ADR-0035's argument
is that keeping the hour is how one hour is compared from day to day; the same
argument holds across locations. Since a location change is a navigation,
`SelectedDayProvider` must be lifted into a `/conditions/layout.tsx`, which does
not exist yet.

### 6. The area map marks each location with a tick

The area map draws the area's coast with a **tick at each location's midpoint**.
The selected location additionally gets its run drawn heavy, at a frame sized to
it. Zoom is two committed frames swapped by the route — not an animation and not
a pan-and-zoom surface.

**Considered and rejected: draw each location's run proportionally**, which is
what the map does today for one beach. Measured on La Jolla, whose area frame is
8,213 m:

| location                 | run     | units of 100 |
| ------------------------ | ------- | ------------ |
| La Jolla Community Beach | 5,082 m | 61.9         |
| La Jolla Shores          | 3,277 m | 39.9         |
| WindanSea                | 1,356 m | 16.5         |
| Whispering Sands         | 1,050 m | 12.8         |
| Bird Rock                | 760 m   | 9.3          |
| Marine Street            | 319 m   | 3.9          |
| South Casa               | 158 m   | 1.9          |
| La Jolla Cove            | 92 m    | 1.1          |
| Shell Beach              | 79 m    | 1.0          |
| Childrens Pool           | 65 m    | 0.8          |

Size is not what kills it: 8 of 10 clear 3px at a 300px map and all 10 do at
806px. **Overlap kills it.** `La Jolla Community Beach` spans 5,082 m and its
extent contains eight of the other nine. Every run is a run of the same
polyline, so nesting redraws rather than stacks — 60% of the area's coast is
covered by one member, 37% by two, 4% by three. Shell Beach is not small on that
picture, it is _underneath_. And `Mission Bay, Vacation Isle` has zero extent
(upper equals lower) and sits 416 m off the traced shore, so `shore.ts` already
returns `null` for it: under proportional runs it is a member of Mission Bay
that cannot be drawn at all.

**Considered and rejected: the map is the location picker.** It cannot be, and
the arithmetic is not close. `South Casa`, `Childrens Pool`, `Shell Beach` and
`La Jolla Cove` fall within 549 m of one another — 6.7 of 100 units. Four tap
targets at ADR-0004's 44px floor would need the map **2,634px wide**; by
midpoints, 3,305px. So the marks are for orientation and the list beside the map
is the control. Hovering or focusing a list item highlights its mark.

**The ticks still crowd**, and that is accepted rather than solved: those four
midpoints span 5.3 units, and `La Jolla Community Beach`'s midpoint sits 2.2
units from `WindanSea`'s. At 806px those are marks 7–13px apart, which reads as
a cluster — and La Jolla's point genuinely _is_ a cluster of four beaches inside
550 m. What is not accepted is labelling them there or making them tap targets,
both of which the arithmetic above already rules out.

**This amends ADR-0033**, which says the map draws a place and not an inventory,
and plots no stations, buoys or model lines. The distinction being drawn is that
a source is an instrument the page _reads_, while a location is the subject the
page is _about_; and that this is one mark type rather than the four glyphs of
four shapes ADR-0033 was reacting to. That argument has to be written down,
because it is the first thing anyone will re-litigate.

**The area frame is not square.** La Jolla's bbox is 8,213 m north–south by
2,773 m east–west; Del Mar's is 9,411 by 1,773. `squareToward` would spend two
thirds to four fifths of the width on slack. The area map takes its bbox's own
aspect; `squareToward` itself is untouched, only its caller.

### 7. `area` replaces `region` outright

`region` comes out of `beaches.json`, `regionOf` out of `seed-beaches.mjs`, and
`beachesByRegion` out of `beaches.ts`. Keeping both would leave two groupings of
one inventory and force `CONTEXT.md` to explain when to use which, a question
with no good answer. It also frees the word for its other meaning here —
ADR-0014's _region heading_, a section of a page — which is currently overloaded.

---

## The areas

Thirteen, covering 51 of 51. `shared` below is what identifier equality yields
today; the probe in slice 4 is expected to widen most rows.

| area            | n   | shared under the fallback |
| --------------- | --- | ------------------------- |
| Del Mar         | 1   | all five                  |
| Torrey Pines    | 2   | tide, MOP, air            |
| La Jolla        | 10  | tide, air                 |
| Pacific Beach   | 2   | tide, buoy, MOP, air      |
| Mission Beach   | 1   | all five                  |
| Mission Bay     | 20  | none                      |
| Ocean Beach     | 2   | tide, air                 |
| Point Loma      | 1   | tide, MOP, grid, air      |
| San Diego Bay   | 4   | none                      |
| Coronado        | 3   | tide, air                 |
| Silver Strand   | 1   | tide, MOP, grid, air      |
| Imperial Beach  | 2   | tide, grid, air           |
| Tijuana Estuary | 2   | grid, air                 |

Two membership calls worth naming, because both are judgements rather than
readings. **`Coronado Cays` goes to San Diego Bay**, not Coronado: it is a
bay-class site behind the strand, and in Coronado it costs that area every
shared product. **`Fiesta Island` and `Tecolote Shores` go to Mission Bay**,
which for Fiesta Island contradicts its upstream `Open Coast` classification —
recorded here rather than corrected upstream.

**Mission Bay is the open question.** Twenty members, two tide gauges in
different basins, four grid cells, three air stations. If the probe finds its
members do not agree by value either, Mission Bay wants splitting — and that is
a membership change, not a rule change, which is what the authored table exists
to make cheap.

> **Addendum, 2026-09-02. Both bays are split, and the table is eighteen areas
> rather than thirteen.** The paragraph above deferred Mission Bay to what the
> probe would find. It is settled ahead of the probe instead, because twenty
> entries under one heading is unusable in the chooser whatever the feeds say,
> and because a split that survives the strict fallback survives anything the
> probe could add.
>
> **Mission Bay becomes four**, and the four are not arbitrary — they cut along
> the three axes its bindings actually split on. Tide splits north from south,
> the two gauges being `9410196` "Mission Bay, Campland" at the north end and
> `TWC0413` "Quivira Basin" at the entrance. Air splits three ways: Mt. Soledad
> serves the north and west, Shelter Island the entrance basins, and **San Diego
> Airport serves Tecolote Shores and Fiesta Island alone** — which is why an
> east area has to exist at all, since folding those two anywhere else costs
> that area its air reading. Grid cells split east from west at about
> −117.228.
>
> | area                | n   | reports                  |
> | ------------------- | --- | ------------------------ |
> | Mission Bay – North | 7   | tide, air                |
> | Mission Bay – West  | 8   | tide, sky/wind/temp, air |
> | Mission Bay – East  | 2   | sky/wind/temp, air       |
> | Mission Bay – South | 3   | tide, air                |
>
> Five partitions were measured. A plain east/west split leaves **both** halves
> with nothing; a plain north/south split by gauge leaves each with one product.
> This one leaves every area with at least two of the three a bay can ever
> report — a bay binds no MOP line and no buoy, and ADR-0043 withholds the surf
> zone, so tide, the grid cell's products and the air station are the whole
> field.
>
> **`Mission Bay, Sea World` sits in _West_ rather than _South_**, which is the
> one member placed by its bindings rather than by the map. It binds the west
> cell and Mt. Soledad; in South it would drop that area from two products to
> one. Recorded because it is the placement most likely to read wrong to
> somebody who knows the bay.
>
> **San Diego Bay becomes three**, and this one costs nothing: all three report
> everything. Its four members were never one place — `Coronado Cays` is 12.2 km
> from `Shoreline Park` and binds a different gauge, a different cell and a
> different air station.
>
> | area                    | n   | reports   |
> | ----------------------- | --- | --------- |
> | San Diego Bay – North   | 1   | all three |
> | San Diego Bay – Central | 2   | all three |
> | Coronado Cays           | 1   | all three |
>
> **The names are compass points because a compass point is what the committed
> coordinates support.** Whether people say "Sail Bay", "Crown Point", "Quivira"
> or "Fiesta Island" is local usage this plan cannot verify, and substituting a
> better name later is a one-line edit to an authored table.
>
> **Area slugs may collide with beach slugs, and four do** — `pacific-beach`,
> `mission-beach`, `ocean-beach`, `coronado-cays`. They sit in different
> positions of the nested route decided in §5, so `/conditions/pacific-beach` is
> the area and `/conditions/pacific-beach/pacific-beach` the location, with no
> ambiguity to resolve. The consequence is that those four beaches' old URLs
> cannot redirect to their locations, because the old URL _is_ the new area URL;
> a reader with that bookmark lands on the area containing the beach they saved,
> which is the right place rather than a broken one.

## Test seams

Agreed before starting, and chosen from what exists rather than invented.

- **`areas.ts`, beside `beaches.ts`.** Pure, reads committed JSON, fetches
  nothing — so the partition invariants, the lookup and the shared-product
  resolution are all unit-testable with no network and no DOM. This is the
  highest seam the work has and most of it sits here.
- **`scripts/probe-area-agreement.mjs`, beside the four existing probes.**
  Registered in `probes.mjs`, run by `run-probes.mjs`, not by the gate — the
  same separation ADR-0022 already draws for anything that touches a publisher.
  Its comparison function is exported and tested against fixtures.
- **A gate row for the partition**, in `gates.mjs`'s table. Total, disjoint,
  every slug real, every area non-empty.
- **`ShoreMap` stays presentational and pure.** It is handed bounds, ticks and
  an optional heavy run; it resolves nothing. The tick geometry is computed in
  `shore.ts` and tested there, which is where `beachStretch` already lives.
- **Route tests** at `src/app/conditions/`, following the existing
  `page.test.tsx` pattern, asserting that an area page omits an unshared product
  and that the location panel supplies it.

Prose about the ticks is not a seam. That four marks 7–13px apart read as a
cluster rather than as a smudge is a human check at the review viewport, the same
compromise ADR-0004 and ADR-0014 both record.

## Slices

Vertical; each leaves the repo working and is committed on its own.

**PR 1 — areas replace regions**

1. Authored `areas.json`, `areas.ts`, the partition gate row, and the selector
   grouping by area. `region` deleted end to end. _ADR: the authored total
   partition._

**PR 2 — the area route**

2. `/conditions/<area>` renders the area's shared conditions, with `shared`
   resolved by identifier equality. Honest and shippable before any probe
   exists. _ADR: nested area URLs._
3. `/conditions/<area>/<location>` fills the location panel; the 51 beach URLs
   redirect; `SelectedDayProvider` lifts to a layout.

**PR 3 — the measurement**

4. `probe-area-agreement.mjs`, and committed `shared` verdicts replacing
   identifier equality. _ADRs: equivalence at printed precision; the surf zone
   exemption._

**PR 4 — the map**

5. The area map: a bbox-aspect frame at area scale, no member marks yet.
6. Member ticks, the selected location's heavy run, and zoom on selection.
   _ADR: the tick, amending ADR-0033._

Dependencies: 1 → 2 → 3 → 4, and 5 → 6 after slice 3. ADRs land with the slice
that implements them rather than up front, so their numbers are taken at write
time and they never describe code that does not exist yet.

## Out of scope

- **Re-joining anything.** Every station, buoy, line and cell binding stays
  exactly as `seed-beaches.mjs` produced it. Areas group locations; they do not
  re-measure them.
- **Renaming a beach or changing a slug.** Slug is a stable primary key. The
  five collisions are resolved by nesting the URL, not by renaming.
- **A pan-and-zoom map.** Zoom is two committed frames. A continuous surface
  would need client state and probably a dependency, against ADR-0025.
- **Making the map a tap target.** Measured impossible above.
- **Splitting Mission Bay.** Deliberately deferred to what the probe finds,
  rather than guessed at now.
- **Anything outside `/conditions`.** The teaser and the landing page keep
  pointing at `/conditions`, which keeps working.
