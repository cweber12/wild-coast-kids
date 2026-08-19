# Air at the shore, not at the airport

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
