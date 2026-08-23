# Air at the shore, not at the airport

> **Historical.** Planned 2026-08-18, shipped in PR #82 on 2026-08-18.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

Issue #80. ADR `docs/adr/0010-two-provenances-in-the-air-panel.md` records the
decision this plan reverses.

## The problem, from the reader's point of view

A parent checking La Jolla Shores before driving there is told the air is 81 °F.
At the beach it is 72 °F. Both numbers are real; they were measured nine minutes
apart on 2026-08-18, one at Miramar MCAS ten kilometres inland and one at
Scripps Pier fourteen hundred metres from the sand.

| source                                           | temperature         | wind               |
| ------------------------------------------------ | ------------------- | ------------------ |
| LJAC1, Scripps Pier, 1.38 km                     | 22.0 °C / **72 °F** | 9.2 mph from 310°  |
| KNKX, Miramar, 10.43 km inland — currently bound | 27.2 °C / **81 °F** | 10.3 mph from 280° |

The marine layer is exactly what those ten kilometres cross. This is the failure
the tide join already refuses to make: its `water` class exists because "a bay
tide curve at an ocean beach is a wrong number that looks entirely right", and an
inland air temperature at a coastal beach is the same wrong number wearing the
same disguise.

The panel also leads with visibility, which is the least useful of its four
figures. METAR stops at ten statute miles and San Diego sits at that ceiling most
of the time, so the largest text on the panel usually reads "10 miles or more" —
a constant, rendered as though it were news, describing an airport rather than
the shore.

## Why the join picks Miramar

Two filters stack. Neither is a bug on its own, and the join does exactly what
its own header says it does.

**The candidate pool is the National Weather Service and nothing else.**
`weather-stations.json` was built from `api.weather.gov/gridpoints/<grid>/stations`.
Pulling that list for this beach's gridpoint, SGX 55,22, returns 163 stations and
neither LJAC1 nor LJPC1 is among them. They are NDBC/NOS stations, a network this
repo reads for waves and tides and has never read for air. The pier was not
rejected by the join; it was never a candidate.

**`publishes_visibility` filters before distance.** Only 9 stations county-wide
publish visibility and every one is an airport METAR, so the scarcest field drags
the three abundant ones inland with it:

```
LJAC1 / LJPC1  Scripps Pier      1.38 km   not in the NWS pool at all
D3101          Torrey Pines      4.13 km   no visibility
MSDSD          Mt. Soledad       4.82 km   no visibility
KNKX           Miramar          10.43 km   bound
```

**And the pier was dropped by a filter written nowhere.** `activestations.xml`
lists 19 stations inside `wave-buoys.json`'s own box. The table holds 13 — every
one of type `buoy`. The six omitted are of type `fixed`, including both pier
stations at 32.867, −117.257. `seed-beaches.mjs` only reads the station tables;
nothing generates them, so that criterion exists only in whoever ran the probe.

This is not local to La Jolla Shores. 61 of 72 bound beaches read a station over
5 km away, 28 read one over 10 km away, and KSAN alone serves 36 beaches — against
a tide median of 4.1 km and a wave median of 5.9 km.

## What the panel actually needs

Temperature and wind, measured as near the sand as a real sensor allows, and a
sense of the sky. Not visibility.

Two facts from measuring the alternatives, both on 2026-08-18:

**There are two usable coastal air stations in the county, not a network.**

```
LJAC1  Scripps Pier    10739 rows   WSPD  99%  WDIR 94%  ATMP  68%  WTMP 98%  VIS 0
LJPC1  Scripps Pier     1088 rows   WSPD 100%  WDIR 93%  ATMP   0%            VIS 0
TIXC1  Tijuana River     4401 rows   WSPD 100%  WDIR 82%  ATMP 100%            VIS 0
SDBC1  San Diego Bay   10750 rows   water temperature only — no air, no wind
```

LJAC1 strictly dominates LJPC1 for air. 25 of 72 beaches have a coastal station
closer than their current inland one; 40 have none within 10 km and will keep
reading a land station whatever this plan does.

**Sky cover is airport-only.** The near stations publish real temperature and
wind and no cloud at all:

```
MSDSD  Mt. Soledad, 4.8 km    temp 24.3 °C  wind  7.4 km/h   cloud layers: 0
DMHSD  Del Mar Heights        temp 23.8 °C  wind 14.7 km/h   cloud layers: 0
D3101  Torrey Pines, 4.1 km   (empty on this read)           cloud layers: 0
KNKX   Miramar, 10.4 km       temp 27.8 °C                   cloud layers: 1
```

## The solution

Visibility leaves the panel. Temperature becomes the primary figure, with wind
and sky beneath it. The heading changes from "Wind and visibility" to "Air".

Temperature and wind bind to the nearest **measured** station across both
networks — which is LJAC1 for La Jolla Shores and a mesonet station at 3–5 km for
much of the coast that currently reads an airport at 7–17 km. Sky binds
separately to the nearest station publishing cloud layers, which is always an
airport, and the panel says so.

That is two provenances behind one panel, which reverses a rule this repo
deliberately adopted. ADR 0010 argues it rather than assuming it.

## Implementation decisions

**One station table, with a capability flag per field.** The present table
answers one question — who publishes visibility — and that is why 13 of the
county box's 56 candidates are in it. Replace it with one measured table whose
rows carry `publishes_air_temp`, `publishes_wind` and `publishes_sky`
independently, plus `network` so `upstream.ts` knows which fetcher to use. Two
joins filter the same table differently: air on
`delivers && publishes_air_temp && publishes_wind`, sky on
`delivers && publishes_sky`.

Temperature and wind are required from **one** station. They are the two headline
figures, and blending them across two sites would put two provenances behind one
sentence — which is the thing the sky split is already spending this panel's
credibility on.

**The table becomes generated.** `scripts/probe-observation-stations.mjs` measures
every candidate — the 56 NWS stations in the county box and the NDBC fixed
coastal stations — and writes the table with its flags. Today the tables are
hand-curated: `seed-beaches.mjs --check` re-runs the join and can re-derive
nothing about the candidate set, so a station missing from a table is invisible to
every gate. That is precisely how both pier stations were lost. `delivers` is
already measured rather than inherited; this extends the same standard to
membership.

It also retires a field whose name lies. `wave-buoys.json` marks 46086
`publishes_waves: false` while the buoy publishes WVHT on 27 of 48 rows; the flag
is expressing "outside the corridor", which is a scope decision. Capability flags
state what a station publishes. Scope belongs to the join.

**Per-field freshness for NDBC air.** `parseNdbcRealtime2` reads row 0 and gives
the whole observation one `atMs`. That is right for waves and wrong for air:
`WSPD` is present on ~100% of rows and `ATMP` on ~60%, so row 0 often carries wind
and no temperature. A new `parseNdbcAirObservation` in the same module, reusing
its header, unit and missing-marker pinning, returns each field with its own
timestamp; `upstream.ts` nulls each independently against the existing
`MAX_OBSERVATION_AGE_MINUTES = 180`. No new constant. Simulated across 10,710
reads of the committed payload that yields 100% temperature availability at
median 0, p90 18 and max 114 minutes.

The wave parser is not touched. Its single-timestamp model is correct for waves,
and churning a shipped, tested parser to share a shape with a new one is a
refactor wearing a feature's clothes.

**Failures are independent.** Air and sky fetch separately and fail separately. A
panel that withheld a measured shore temperature because an airport ten
kilometres away missed a minute would be trading the good reading for the
irrelevant one.

## Test seams

All existing. No new seam is introduced, which is the point of putting the work
where it goes.

- `parseNdbcAirObservation`, pure and offline, against a committed
  `src/lib/__fixtures__/ndbc-ljac1-realtime2-*.txt` — including a row where
  `ATMP` is missing and a row where the newest `ATMP` is past the 180-minute cap.
- `bindAirStation` and the sky join, pure, against synthetic station tables — the
  same shape as `bindWaveBuoy` and `bindTideStation` are tested today.
- `scripts/probe-observation-stations.mjs --check`, which re-probes and diffs the
  committed table, so the candidate set is evidence rather than an assertion.
- `seed-beaches.mjs --check` for the join result, unchanged.
- `readLatestAir` against fixed `nowMs`.
- `WindToday` rendered with one provenance and with two.
- `caveats.test.ts` already walks `src/data/*.json` and fails when a file's
  `unresolved` entries are not loaded by `inventoryCaveats()`, so a new table
  cannot skip its caveats silently.

The coverage floor is 88.1 / 88.66 / 92.48 / 88.12 and will need raising.

## Slices

1. This plan and ADR 0010.
2. Correct the measured record. `wave-buoys.json` states that not one station in
   the box publishes wind, and that the only one with wind is 46086; LJAC1 and
   LJPC1 are in that box and publish wind on ~100% of rows. The slice 6 addendum
   in `conditions-tool.md` concludes from it that wind "can only ever come from
   the National Weather Service", which is false for wind and true for
   visibility. Dated addendum; no behaviour change. Relates to #73.
3. Drop visibility; lead with temperature. No new data — the currently bound
   station already supplies temperature, wind and sky. Delivers the reader-facing
   half immediately.
4. `probe-observation-stations.mjs` generates the station table with per-field
   flags across both networks.
5. Air join and the NDBC air parser: La Jolla Shores reads the pier.
6. Split the sky join from the air join; rename `weather_station` to
   `sky_station`.

Slices 1–3 ship as one PR and 4–6 as a second, split at the dependency boundary
so neither exceeds the reviewable guide. Slice 6 is a rename and stays its own
commit.

## Considered and rejected

**Gridpoint as the base, coastal station as an override.** Every beach reads its
own NWS gridpoint cell for temperature, wind and sky; the 25 coastal beaches
override with measured values. Attractive because it retires the airport
entirely, needs no re-probe, and is spatially honest — the gridpoint for SGX
55,22 read 24.4 °C against the pier's 22.0 °C and Miramar's 27.2 °C, so it is
five degrees better than what ships today. Rejected because it is a model, not a
measurement, and the requirement is the most accurate real data available. It
would also put a forecast product behind a panel of observations without the
reader being able to tell.

**Keep visibility, sourced separately and disclosed.** Held briefly. Rejected on
the grounds that survive restating: visibility sits at its ceiling most of the
time, and an airport's visibility is not a fact about the shore. Dropping it also
removes the filter that produced the whole problem.

**Nearest-wins without re-probing.** Add LJAC1 and TIXC1 to the existing table and
bind whichever is closer than the already-bound airport. No constant, no probe,
47 beaches untouched. Rejected because it only works while `publishes_visibility`
keeps the table small: once visibility goes, ranking on distance across a table
holding 13 of 56 candidates picks the nearest of an arbitrary subset and calls it
the nearest station.

**Elevation-ranked candidates.** Rank on elevation then distance, so Mt. Soledad
at ~250 m loses to a sea-level station. More physically honest than distance
alone. Deferred rather than refused: it needs elevation from station metadata and
a defensible weighting, and the beaches it would help are mostly beaches with no
coastal sensor at any elevation.

**A distance cutoff preferring coastal stations.** "Coastal wins within N km"
requires an N that nothing in the data supports. Nearest-wins across a properly
measured candidate set needs no such constant.

## Out of scope

- LJAC1's water temperature, published on 98% of rows, feeding the wave panel.
  Its own issue.
- Any forecast product, including the forward panel already named in
  `conditions-tool.md`.
- The four non-delivering fixed stations: SDBC1 publishes no air at all, NPQC1
  and TIQC1 serve no `realtime2`, and KF70 returns HTTP 404 while listed.
- Re-litigating which beaches are in the inventory.

## Addendum — 2026-08-18: visibility stays, and the probe leaves

Decided with Cole after the plan above was committed. Two changes, and the
second follows from the first only in scheduling, not in logic.

**Visibility is kept.** The body above removes it and lists "keep visibility,
sourced separately and disclosed" among the rejected options. That rejection is
withdrawn. It rested on an assumption that was never checked: that keeping
visibility meant keeping a second station for it. It does not. Sky and
visibility are the same capability, measured 2026-08-18 across all nine
candidates and the three near mesonet stations:

```
KSAN   textDescription "Clear"          visibility 16093   METAR: both
KNFG   textDescription "Partly Cloudy"  visibility 16090   METAR: both
KCRQ   textDescription "Clear"          visibility 16093   METAR: both
MSDSD  textDescription null             visibility none    mesonet: neither
DMHSD  textDescription null             visibility none    mesonet: neither
D3101  textDescription null             visibility none    mesonet: neither
```

METAR stations publish both; mesonet stations publish neither. The airport
binding this plan already keeps for sky therefore supplies visibility at no
additional cost -- no second station, no second fetch, no third provenance. What
changes in the panel is rank, not membership: temperature takes the primary slot
and visibility joins wind and sky beneath it.

KNKX read `textDescription: null` on one probe and "Partly Cloudy" twenty
minutes earlier. That is a per-observation gap, not a capability gap, and it is
the same class as LJAC1's intermittent `ATMP` -- handled by the per-field
freshness rule already specified above, not by a separate mechanism.

**The probe leaves this plan.** Slice 4 existed because removing visibility
removed the filter that made a 13-station table sufficient. With visibility
kept, the air pool can be the two coastal stations with a fallback to the
airport already bound, which needs no re-probe and no regenerated table.

This is a real reduction in what the reader gets, and it is recorded rather than
glossed: only the 25 beaches with a coastal station improve. The other 47 keep
reading an airport 7-17 km away when mesonet stations sit at 3-6 km publishing
real temperature and wind -- MSDSD reads 24.3 C where Miramar reads 27.8 C. That
work is filed as its own issue rather than dropped, and the audit finding it
answers -- that the station tables are hand-curated and `--check` can re-derive
nothing about their membership -- stands unfixed until it lands.

**Revised slices.** 1 and 2 are unchanged.

3. Lead with temperature; visibility moves from the primary slot to the
   secondary line. Reorder only, no removal, no new data.
4. Air join and the NDBC air parser, with the air pool as the two coastal
   stations falling back to the bound airport: La Jolla Shores reads the pier.

Former slices 4 and 6 are withdrawn -- the probe to its own issue, and the sky
join split as unnecessary, since one binding already supplies sky and visibility
together. Four slices, one PR.

**What this does not change.** The two-provenance decision in ADR 0010 stands:
temperature and wind come from one station, sky and visibility from another, and
both are named on the panel with their distances. The ADR's text is amended in
the same commit as this addendum, because its argument as first written rests on
visibility being removed.

## Addendum — 2026-08-18: the probe comes back, and a claim above is wrong

Decided with Cole after measuring all 56 candidates in the county box rather
than reasoning about them. The addendum above split the probe out to #81 on the
grounds that it helped only the beaches without a coastal station. That was
wrong on two counts, and both were assumptions rather than measurements.

**A claim in the body above is false.** It says:

> There are two usable coastal air stations in the county, not a network.

True of NDBC, false of the county. The NWS mesonet has coastal stations at sea
level, and the body's own framing -- reading a network's listing and concluding
something about the coast -- is the same error this plan criticises in
`wave-buoys.json`:

```
F1327     0.0 m   San Clemente Pier
SOBSD     1.2 m   Solana Beach
E9951     3.6 m   San Diego Shelter Island
E3174     4.9 m   Oceanside
```

**Probed 2026-08-18, all 56 candidates, six observations each.** 56 deliver, 53
publish both temperature and wind, 10 publish sky. So the pool the air join
should rank over is 53 stations and not the 13 a visibility-shaped probe
recorded.

**The restricted pool produces bindings that are simply wrong.** Ranking only
over LJAC1 and TIXC1 with a fallback to the bound airport binds Solana Beach
City Beaches to a pier 12.68 km away while SOBSD sits 0.89 km from it at 1.2 m:

```
Solana Beach City Beaches   LJAC1 12.68 km  ->  SOBSD  0.89 km
Seascape Beach Park         LJAC1 12.68 km  ->  SOBSD  2.79 km
Del Mar City Beach          LJAC1  9.15 km  ->  SOBSD  3.03 km
```

Ten of the 25 beaches the restricted pool "fixes" are bound better by the full
set. Shipping it would mean publishing a binding that the next slice overturns.

**#81 is therefore folded back in and closed.** For the 47 beaches no coastal
NDBC station reaches, the full pool binds a nearer station for 42 of them:
median distance saved 3.5 km, new distance median 3.6 km against a maximum of
16.8 km today. Oceanside Harbor goes 4.3 km to 0.3 km.

### Elevation is decided rather than deferred

The body above defers elevation ranking. The measurement makes it live: pure
distance binds 24 beaches to a station above 50 m, because Mt. Soledad at 102 m
overlooks half the corridor. The trade splits cleanly in the data, which is why
this is not a tuned constant:

```
WindanSea Beach        MSDSD 3.8 km @102 m   vs LJAC1 4.1 km @0 m   (+0.2 km)
Torrey Pines State     D3101 2.8 km @105 m   vs LJAC1 3.2 km @0 m   (+0.4 km)
Moonlight Beach        E9978 3.9 km @ 86 m   vs SOBSD 4.3 km @1 m   (+0.4 km)
Mission Beach          MSDSD 2.7 km @102 m   vs E9951 5.6 km @4 m   (+2.9 km)
Mission Bay, Fanuel    MSDSD 2.7 km @102 m   vs KSAN  7.9 km @4 m   (+5.3 km)
```

The cases costing under a kilometre are all open coast; the cases costing two to
five kilometres are all Mission Bay. A blanket elevation cap gets this wrong in
both directions -- it collapses the pool from 55 candidates to 8 and pushes the
median distance up from 3.1 km to 4.3 km.

**The rule is the one the tide join already uses.** `waterClassOf` classifies a
beach as open-coast or bay; stations carry a hand-written `shore` flag. An
open-coast beach binds a shore station; a bay or lagoon beach binds the nearest
station of any kind, because a marine layer is not what a station overlooking
Mission Bay gets wrong.

`shore` is a join input, not a measurement, and it has precedent in this repo:
`tide-stations.json` defends its hand-written `water` field on the grounds that
no authority publishes the classification and a join has to be told which
stations are candidates for which beaches. Elevation is recorded beside it as
measured metadata, because it is what the classification is read from.

Measured outcome across all 72 bound beaches:

```
open coast   46 beaches   distance median 3.5 km  max 8.9 km  all shore stations
bay/lagoon   26 beaches   distance median 3.9 km  max 6.3 km
today                     distance median 7.3 km  max 16.8 km  all airports
```

### Revised slices

1 and 2 unchanged.

3. Lead with temperature; visibility moves to the secondary line. Reorder only.
4. `probe-observation-stations.mjs` generates the station table across both
   networks, with a capability flag per field, measured elevation and the
   hand-written `shore` input.
5. Air join over the full pool, with the shore preference: temperature and wind
   to the nearest station that publishes both and suits the beach's water class.
6. NDBC air parser and the two-network fetch, so an NDBC station can win the
   join -- La Jolla Shores reads the pier.

Six slices, split into two PRs at the 4/5 boundary.

### What this costs

The work roughly doubles against the addendum above. It buys a binding that is
correct on the evidence rather than one built from a candidate set assembled to
answer a different question, and it fixes the audit finding -- station tables
whose membership no gate can re-derive -- rather than recording it as accepted.

## Addendum — 2026-08-18: the PR boundary moves, and slice 4 owns the rename

Decided with Cole while implementing. The slice list and its order are
unchanged; what moves is which PR each slice ships in, and one consequence of
"replace the table" that the addendum above left implicit.

**Slice 3 moves to the second PR.** The addendum above re-split six slices into
two PRs at the 4/5 boundary and left slice 3 in the first one, where the
addendum before it had slice 3 shipping alongside the join. That is not a
neutral rearrangement. Slice 3 promotes the temperature to the panel's primary
slot while the bound station is still the airport, so between the two merges the
largest text on the panel would read 81 °F at a beach reading 72 °F.

The demotion it performs is an improvement and the promotion is not, yet, and
the two cannot be separated: something has to hold the primary slot. Leading
with a near-constant that describes an airport is useless; leading with a
temperature that describes an airport is wrong, and this plan exists because
that number is wrong. So slice 3 waits for slice 5 and the two land together.

PR one is slices 2 and 4. PR two is slices 3, 5 and 6.

**Slice 4 replaces `weather-stations.json`, and that forces the sky join's
filter to move with it.** The implementation decisions above say "replace it
with one measured table" carrying `publishes_sky`. The live join filters on
`publishes_visibility`, so the moment the file is replaced that filter names a
field the table no longer has. Writing a second table beside the old one was
considered and rejected: it would leave two station tables, two sets of caveats
to load and a second retirement to remember, in exchange for deferring a rename
by one PR.

So slice 4 carries the rename. `bindWeatherStation` filters on `delivers &&
publishes_sky` — the same rule under a measured name, since sky and visibility
are one capability by the measurement recorded in the first addendum — and
`beaches.json` is re-seeded against the new table. Ten stations publish sky
against the nine that were recorded as publishing visibility, so a binding may
move; the diff is read and reported rather than assumed to be empty.

What slice 4 still does not do is change the _rule_. The air pool, the shore
preference and the second network all arrive in slices 5 and 6, as before.

## Addendum — 2026-08-19: slices 5 and 6 swap, because neither order was free

Measured while starting slice 5, and it changes the order rather than the work.

**The problem.** Slice 6 is described as making it so "an NDBC station can win the
join", which implies slice 5 binds over the National Weather Service alone and
slice 6 widens the pool. Simulated over all 72 bound beaches against the table
slice 4 committed, an NWS-only pool is not a smaller version of the answer. It is
a worse one than what ships today:

```
                     median   max      farther than today
today                7.3 km  16.8 km   --
NWS-only  (slice 5)  4.4 km  22.9 km   15 beaches
both      (slice 6)  3.5 km   7.4 km    3 beaches
```

Tijuana River binds KSAN 22.9 km away and Border Field E9951 at 20.2 km, because
south county's nearest shore station is TIXC1 and the pool cannot see it. La
Jolla Shores goes from KNKX at 10.43 km to SOBSD at 13.9 km -- a better exposure
at a worse distance, and still not the pier 1.38 km away.

That is the case the addendum above already refused once, in the same words: a
decision that publishes a binding the next slice overturns is not a smaller
version of this one. Fifteen beaches would move twice, the second time to undo
the first.

**The alternative was worse.** Binding over the full pool in slice 5, before
anything can fetch an NDBC station, leaves the 21 beaches that bind LJAC1 or
TIXC1 rendering "we could not get a weather reading just now" until slice 6 lands.
A slice is supposed to leave the repo working.

**So the two swap.** The parser and the second fetcher land first, and the join
lands second:

5. `parseNdbcAirObservation`, its committed fixture, and the NDBC air fetch in
   `upstream.ts`. Nothing binds an NDBC station yet, so no behaviour changes at
   all; the slice is verified by its own tests against a real committed payload,
   which is the seam this plan already named for it.
6. The air join over the full pool with the shore preference, the re-seed, and
   the panel's second provenance. Every beach reaches its final binding in one
   commit, La Jolla Shores included.

This makes slice 5 a capability slice with no reader-facing half, which the
repo's own rule warns about. The warning is accepted here with its eyes open:
the alternative orders either ship a binding to be retracted or ship a broken
panel, and slice 6 is what demonstrates both.

**Nothing else moves.** Same six slices, same content, same two PRs. Only the
order inside the second one changes.

## Addendum — 2026-08-19: what shipped, measured

All six slices are merged or in review. This records the outcome against the
numbers above, because several of those were simulated from a proxy this plan
then rejected, and they should not be read as what the site does.

**The binding, across all 72 bound beaches.**

```
                        median    max     stations above 50 m
today, before this      7.3 km   16.8 km  every one an airport
predicted, elev<=20m    3.5 km    8.9 km  0
SHIPPED                 3.5 km    7.4 km  0
```

The shipped shore rule is exposure rather than elevation, and it beat the proxy
on the maximum because the proxy excluded CBDSD and KNFG at 22 m -- both on the
coastal plain with nothing between them and the sea -- while including nothing
the exposure rule does not. Twenty-one beaches read an NDBC station, fifty-one
an NWS one, and not one sky binding moved.

**La Jolla Shores reads LJAC1 at 1.38 km** for temperature and wind, and KNKX at
10.43 km for sky and visibility. Both are named on the panel with their
distances, which is ADR 0010's cost paid in the open.

**Three claims in the body above are superseded**, all of them by measurement
rather than by argument, and all already corrected in the addenda: there are
more than two usable coastal air stations; the air pool is 56 stations rather
than 13; and the NWS-only intermediate the slice order implied is worse than
what ships today rather than a step toward it.

**What is not done, and is filed rather than forgotten.**

- `weather-stations.json` is named for the sky station while holding both
  networks and serving two joins. Its `unresolved` list says so. The rename
  waits for `beaches.json`'s `weather_station` field to be renamed with it.
- `seed-beaches.mjs` stamps `generated` in UTC, so an evening run records
  tomorrow. `probe-observation-stations.mjs` does not; the fix for the older
  script is its own slice.
- LJAC1's water temperature, published on 98% of rows, still does not reach the
  wave panel. Out of scope from the start and still out of it.
