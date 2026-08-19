# 0010 — Two provenances behind the air panel

Date: 2026-08-18. Status: accepted.

## Context

The air panel was built on a rule stated in three places — `weather-join.mjs`,
`weather-stations.json`'s unresolved list, and `WindToday.tsx` — that one station
supplies all four of its values:

> Several stations nearer each beach publish wind and temperature without
> visibility; binding those separately would put two provenances behind one
> heading, which is the thing this site does not do.

The rule is sound and the reason for it is real: two stations behind one heading
lets a reader attribute a number to the wrong place, and the panel's own distance
disclosure becomes ambiguous about which figure it describes.

What the rule cost was never measured until now. Requiring visibility from the
same station means filtering on `publishes_visibility` before distance, and only
9 stations county-wide publish visibility — every one an airport METAR. So the
scarcest field decides the binding for the three abundant ones. At La Jolla
Shores that means Miramar MCAS at 10.43 km rather than Scripps Pier at 1.38 km,
and on 2026-08-18 the two read 81 °F and 72 °F within nine minutes of each other.
Across the inventory, 61 of 72 bound beaches read a station over 5 km away and 28
read one over 10 km away.

The field that forced this is also the least useful one on the panel. METAR stops
at ten statute miles, San Diego sits at that ceiling most of the time, and the
panel's largest text therefore usually renders a constant that describes an
airport.

Two facts about the alternatives, both measured on 2026-08-18. There is no
coastal source for sky: the near stations — MSDSD at 4.8 km, DMHSD, D3101 at
4.1 km — publish real temperature and wind and carry no `textDescription` at all,
because cloud cover is a METAR product and METAR means an airport. The layer
count is not the signal to read here: a clear sky reports zero layers, and KNKX
was observed at zero layers with `textDescription: "Partly Cloudy"` twenty
minutes earlier and `null` on the next probe. And there is no
gridpoint answer either, in the direction that matters: the gridpoint carries sky
but is a model rather than a measurement, and the requirement is the most
accurate real data available.

So the panel can have temperature and wind measured near the sand, or it can have
one provenance. It cannot have both.

## Decision

**The air panel carries two provenances, named separately.** Temperature and wind
bind to the nearest measured station, which may be on either the NWS or the NDBC
network. Sky and visibility bind to the nearest station publishing them, which is
always an airport. Each binding is attributed on the panel with its own distance.

**Visibility is demoted, not removed.** What forced the inland binding was
requiring visibility from the _same_ station as temperature, not visibility
itself. Once the panel admits a second provenance, that requirement is gone and
the field costs nothing to keep: sky and visibility are the same capability —
measured across all nine candidates, METAR stations publish both and mesonet
stations publish neither — so the station bound for sky supplies visibility with
no second fetch and no third provenance.

It moves out of the primary slot regardless. It sits at METAR's ten-mile ceiling
most of the time, and the panel's largest text should not be a near-constant
describing an airport. Temperature takes that slot; visibility joins wind and sky
beneath it.

**Temperature and wind stay bound together.** The rule is narrowed, not
abandoned. Those two are the panel's headline figures and are read as one
statement about the air at the beach; splitting them would put two provenances
behind one sentence rather than behind one panel, which is a different and worse
thing. Sky is separable because it is a different claim about a different part of
the sky.

The plan is `docs/plans/coastal-air-observations.md`.

## Consequences

The reader gets a temperature measured 1.4 km from the sand instead of 10.4 km
inland, and gains a second attribution line to read. That line is the cost of the
decision and it is deliberately not hidden: the panel says which station supplied
which figure and how far away it is, because a reader who cannot tell is worse
off than one who has to read two lines.

**Every beach improves, because the candidate set is rebuilt rather than
extended.** Probing all 56 candidates in the county box on 2026-08-18 found 53
publishing both temperature and wind, against the 13 a visibility-shaped probe
had recorded. Ranking over the full set halves the median binding distance,
from 7.3 km to about 3.5 km, and drops the maximum from 16.8 km to 8.9 km.

Restricting the pool instead — the two NDBC coastal stations with a fallback to
the bound airport — was tried and rejected on measurement: it binds Solana Beach
to a pier 12.68 km away while SOBSD sits 0.89 km from it. Ten of the 25 beaches
it appeared to fix are bound better by the full set. A decision that publishes a
binding the next slice overturns is not a smaller version of this one.

**This fixes the defect it surfaced rather than accepting it.** The station
tables are hand-curated and `--check` can re-derive nothing about their
membership, so a station missing from one is invisible to every gate — which is
how both Scripps Pier stations were lost, dropped by a buoy-versus-fixed
criterion recorded in no code. The table becomes generated by a probe script with
a capability flag per field, which is the larger half of this work and the part
most likely to be underestimated.

**Distance alone is not the ranking.** Mt. Soledad at 102 m overlooks half the
corridor, so pure distance binds 24 beaches to a station above 50 m. The rule is
the one the tide join already uses: `waterClassOf` marks a beach open-coast or
bay, stations carry a hand-written `shore` flag, and an open-coast beach binds a
shore station while a bay beach binds the nearest of any kind. `shore` is a join
input with precedent — `tide-stations.json` defends its hand-written `water`
field on the grounds that no authority publishes the classification and a join
has to be told which stations are candidates for which beaches. An elevation cap
was measured and rejected: it collapses the pool from 55 candidates to 8 and
pushes the median distance up rather than down.

**One panel now reads two networks.** `upstream.ts` acquires an NDBC air fetcher
beside its wave one, and the station table acquires a `network` field to dispatch
on. The failure surface doubles for this panel and the two halves fail
independently: a measured shore temperature is not withheld because an airport
ten kilometres away missed a minute.

What stays true is the thing the original rule was protecting. No figure is ever
shown without the reader being able to see where it came from. The rule said one
provenance because that was the cheapest way to guarantee it; this decision keeps
the guarantee and pays for it explicitly instead.
