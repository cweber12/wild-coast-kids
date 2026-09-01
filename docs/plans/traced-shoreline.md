# A traced shoreline for the shore map

Status: in flight. Started 2026-08-31.

## The problem, from the reader's point of view

The shore map draws a line down the coast and washes one side of it as sea. The
line is not the shore. It is CDIP's MOP model line, computed at 10 m depth, and
ADR-0030 measured how far out that puts it: 117 to 930 m for the beaches that
bind one, median 644.

Two things follow, and a reader sees both.

**The water's edge is drawn in the wrong place.** ADR-0030 could not fix this
and said so; it chose to blur the boundary instead, and ADR-0033 later replaced
the blur with a flat wash whose edge is the drawn line. The imprecision was
never removed, only described, in a sentence under the picture.

**A quarter of the county has no map at all.** `mop-lines.json` traces the open
coast, so the 23 Mission Bay and San Diego Bay beaches are 1.17 km or more from
anything it holds. `shore.ts` declines to draw a coast for them and says so.
That is honest and it is still a blank square on 23 of 51 pages.

ADR-0030 named the thing that would change this:

> **Find a real shoreline.** No shoreline dataset is committed here, and adding
> one is a data acquisition rather than a layout decision — a new source, a new
> join, a new probe and a new checker. If one ever lands, this decision is what
> it supersedes.

One has landed.

## The source

CDFW's **ACE Ecoregion Sections**, `OBJECTID = 2`, "Southern California Coast".

`https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/ACE_Ecoregion_Sections_wm/FeatureServer/0`

**It is not a marine dataset and it is not a tidal one.** It is the terrestrial
ECOMAP/Goudey 2007 ecological sections for California. It has a usable coastal
edge only because of what CDFW did to it, which its own service description
states:

> conformed to Cnty19_1 counties layer linework, the Great Valley section split
> in two, had all bays "erased", and offshore rocks/stacks detail removed.

So the edge is county boundary linework. California's seaward county boundary
nominally follows the mean high tide line, so it lands near MHW by
construction — **but the service never declares a datum, and this plan does not
claim one.** That matters because the obvious next want is a tide-driven
waterline, and this line cannot supply it. See _Out of scope_.

"Bays erased" is why the bays are traced: the bay water was cut out of the
polygon, so the boundary follows the bay shore.

## What was measured

Distance from each beach's committed coordinates in `beaches.json` to each
trace, taking the nearer of the segment's two ends:

| | MOP polyline (drawn today) | ACE mainland arc |
| --- | --- | --- |
| median | 911 m | **4 m** |
| p90 | 2,485 m | 17 m |
| max | 4,911 m | 416 m |
| within 200 m | 2 / 51 | **50 / 51** |
| vertex spacing, median | ~98 m | 6.7 m |

**The one beach past 34 m is `mission-bay-vacation-isle` at 416 m, and it draws
no map anyway.** It is an island, so it is its own ring rather than part of the
mainland arc. Its committed segment has `upper` equal to `lower`, so
`boundsAround` returns null and the page renders an absence — the beach the
mainland arc misses is the beach with no map to miss. The island rings are out
of scope below rather than forgotten.

**ADR-0030's own failure case passes.** It rejected a hard sea edge because the
Scripps tide gauge and the Scripps Pier air station sat landward of the drawn
line — two instruments over water, drawn on the beach. Against the ACE edge all
ten wave buoys in `wave-buoys.json` fall on the water side, and the pier
stations fall on the water side. The published coordinate for tide station
9410230 lands about 11 m the other way, which is rounding in the station table
rather than a fault in the line; under MOP the same instrument was about 310 m
wrong.

## The decisions

**The cut is anchored on committed coordinates, not invented ones.** The ACE
ring is a closed boundary around the whole ecoregion, so it holds an inland arc
as well as a coastal one — measured, the inland arc reaches longitude −116.72.
The coastal run is the arc between the vertex nearest `mop-lines.json`'s
southernmost line (`D0001`) and the vertex nearest its northernmost (`D1210`),
walked in the direction of increasing index, which runs south to north. That
reuses the scope `mop-lines.json` already defines rather than inventing a county
box, and both anchors are values this repo already holds.

**Simplified at 5 m.** The raw arc is 26,999 vertices. Douglas–Peucker at 5 m
leaves 4,631 and moves no beach's distance by more than 2.4 m; at 10 m it leaves
2,850. 5 m is chosen because it is below the source's own 6.7 m median vertex
spacing, so the simplification is not the thing deciding the shape.

**`ShorePoint` loses its `id`.** The field exists to name the MOP line a point
came from, for markers ADR-0033 removed. Nothing reads it — a traced shore has
no line ids to carry, and keeping the field would mean inventing them.

## Test seams

- **`coastalArc()` in the probe** — pure over the fetched ring: given a ring and
  two anchors, return the arc. Testable without the network.
- **`coastline()`** — already the seam `shore.ts` and the checkers read. Its
  source changes; its shape does not, so `nearestOn`, `unbrokenAround`,
  `runAround`, `windowAround` and `sideOf` are exercised by their existing tests
  against new data.
- **A gate row** asserting every beach but `mission-bay-vacation-isle` is within
  a stated distance of the committed shoreline, so the property that makes this
  worth doing cannot rot silently.

## Out of scope

- **The island and lagoon rings.** Vacation Isle, Shelter Island, Harbor Island
  and the San Dieguito lagoon are separate rings. Including them means
  `coastline()` returning explicit runs rather than one flat array whose breaks
  are inferred from distance, which is a change to four functions and their
  tests. It is its own slice.
- **The tide-driven waterline and the sand band.** The want that started this.
  It needs the intertidal, which this line does not carry; NOAA ENC
  `enc_harbour` layer 227 does, and that is a separate slice with its own ADR.
- **PMEP substrate — rock and reef.** Separate slice.
- **Retiring `mop-lines.json`.** It still supplies every beach's swell forecast
  binding and both anchors above. Only its use *as a shape* ends here.

## Rejected

**Keep MOP and shift it inland by the measured offset.** ADR-0030 rejected this
and its reasoning holds: the offset runs 117 to 930 m, so a constant correction
is wrong nearly everywhere, and it manufactures coordinates no publisher issued.

**Use PMEP's Core Zone landward edge as the shoreline.** Measured against the
ACE edge it sits 4 / 20 / 83 m away (p10 / median / p90) — two digitisations of
the same line disagreeing. It is not a better line and it is a much heavier
payload.

**Commit the whole Southern California polygon.** 301,937 vertices, 7.2 MB. The
county arc simplified is 4,631.
