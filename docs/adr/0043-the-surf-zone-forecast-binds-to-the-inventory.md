# 0043 — The surf zone forecast binds to the inventory, and only where there is a surf zone

Date: 2026-09-02. Status: accepted. Narrows ADR-0011's rule that a binding is
joined per beach, and declines to follow the readout precedent set in ADR-0034.

## Context

ADR-0009 decided the conditions tool is built here rather than embedded, and
named the surf zone forecast as the product its "published judgements are
relayed, inferred ones are not computed" rule was written about. The National
Weather Service publishes rip current risk for San Diego County Coastal as a
forecaster's judgement, and this site quotes it verbatim and attributes it.

That decision also set a second rule, which this one narrows:

> **Resolved values come from joins, never from typing.** Beach coordinates,
> tide station, buoy, water-quality station and marine protected area are joined
> against upstream authorities and committed with enough provenance to re-run,
> with one re-join script per binding that exits nonzero when a match moves.

Every binding in `beaches.json` follows it — `tide_station`, `wave_buoy`,
`mop_line`, `grid_cell`, `air_station`, each with a distance and the segment end
it was joined from. The obvious way to add the surf zone forecast was a `zone`
column and a `srf-join.mjs` beside the other five.

**It was tried and it does not work.** Resolving
`api.weather.gov/zones?point=<lat>,<lon>&type=public` for both ends of all 51
beaches on 2026-09-02:

| Result                | Beaches |
| --------------------- | ------- |
| `CAZ043` at both ends | 27      |
| `CAZ043` at one end   | 14      |
| no zone at either end | 10      |

The ten that resolve to nothing are every Coronado beach, Border Field State
Park, Whispering Sands, Marine Street Beach and the inner-bay sites. **None of
that is a fact about those beaches.** All 51 are inside San Diego County, which
is the filter `beaches.json`'s `_inclusion` records the inventory being seeded
under, and the product's own section is titled "San Diego County Coastal Areas".

`CAZ043` is a **land** polygon. A beach coordinate on the water side of the
mapped shoreline falls outside it, and this repo has met that edge before —
ADR-0030 records the Scripps tide gauge and air station sitting _landward_ of
CDIP's model line, both bolted to a pier over water. The difference is what the
failure looks like: every other join here is **nearest-feature**, which degrades
to a larger distance, and this one is **containment**, which degrades to an
empty result indistinguishable from "not covered".

A second question arrived with the first. The bulletin is issued for _coastal
areas_, and 25 of the 51 beaches in this inventory are bays, lagoons and inlets.
Two precedents point opposite ways:

- **The wave join withholds.** Those same 25 beaches carry
  `wave_buoy_null_reason`: "every wave buoy sits on the open coast, and ocean
  swell does not reach into a bay or lagoon, so no buoy describes the water
  here."
- **The readout does not.** ADR-0034 draws it on all 51, including the 23 the
  traced coast does not reach, because withholding "left nearly half the
  inventory with no wind figure anywhere on the picture".

## Decision

**The zone binds to the inventory, not to the beach.** There is no `zone` column
in `beaches.json` and no re-join script. `SURF_ZONE_ID` is a constant in
`nws-surf-zone.ts` carrying the measurement above, and it follows from the
inventory's own `County = 'San Diego'` definition rather than from any beach's
coordinates. ADR-0009's rule is satisfied — the value is still derived from an
upstream authority rather than typed off a map — but the join is county-to-zone,
done once, rather than beach-to-zone with a distance beside it.

**The forecast is withheld at the 25 sheltered beaches**, with a stated reason
in the `wave_buoy_null_reason` voice, and the request is not made at all rather
than made and discarded. The wave precedent governs and ADR-0034's does not: the
readout is drawn everywhere because **wind blows on a bay**, so a wind figure
there is true. A surf zone forecast describes water that does not exist at Sail
Bay.

**The classification is read off the tide station's water class**, not off the
region. Both classify the inventory identically — 51 of 51, asserted in
`beaches.test.ts` — but the region is a grouping for a dropdown while the water
class is a joined fact the tide join already had to establish in order to bind
an open-coast beach to an open-coast station.

## Consequences

The product reaches **26 of 51 beaches**. The other 25 get one sentence naming
what is true of their water, which is what they already get for having no wave
buoy.

**A judgement printed at the wrong beach is worse than no judgement.** "Rip
Current Risk: High" over Mission Bay would alarm about a hazard that is not
there, and would teach a reader that this line is not about the beach they
selected — which costs it on the 26 beaches where it is the most important thing
on the page. That asymmetry is why this withholding is not the coin-flip the two
precedents make it look like.

**`docs/plans/conditions-tool.md` is wrong about this and stays wrong.** It says
the sheltered beaches' missing water temperature "waits for the surf zone
forecast's county-wide range in slice 9". The product cannot describe bay water,
so it does not fill that gap and those beaches keep it. That plan is historical
and `docs/plans/README.md` forbids correcting it; this ADR is where the
correction lives, which is the division that README describes.

**Nothing notices if NWS re-draws the zone.** A per-beach join with a re-join
script would fail loudly when a match moved; a constant cannot. The compensating
guard is in the parser rather than in the data: `CAZ043`'s absence from a
bulletin is a failed read that says so, never a fall-through to the other county
in the same text. That is a weaker signal than a nonzero exit from a join
script, and it is the price of a binding that has nothing to re-join.

**If the inventory ever leaves San Diego County, this decision expires.** The
bulletin already carries `CAZ552` Orange County, and the parser already takes
the zone as a parameter, so the code is ready — but the constant would become a
lie and the binding would have to move to the beach after all. The measurement
above would need re-running first, because it would still fail at the water's
edge.
