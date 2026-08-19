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

**Only the coastal beaches improve.** Keeping visibility keeps the existing
airport binding intact, which means the air pool can be the two coastal stations
falling back to that airport — no re-probe, no regenerated table. The cost is
that the 25 beaches with a coastal station gain and the other 47 do not, though
mesonet stations sit at 3–6 km from many of them publishing real temperature and
wind. That work is filed separately rather than folded in.

**A defect this decision surfaced stays unfixed.** The station tables are
hand-curated and `--check` can re-derive nothing about their membership, so a
station missing from one is invisible to every gate — which is how both Scripps
Pier stations were lost. They sit in `activestations.xml` inside the box
`wave-buoys.json` already uses, and were dropped by a buoy-versus-fixed criterion
recorded in no code. Ranking temperature and wind on distance across a properly
measured candidate set is what would fix it, and that is deferred with the
probe — so this ADR is knowingly accepting a binding chosen from a subset, on
the grounds that the subset contains the station that matters most.

**One panel now reads two networks.** `upstream.ts` acquires an NDBC air fetcher
beside its wave one, and the station table acquires a `network` field to dispatch
on. The failure surface doubles for this panel and the two halves fail
independently: a measured shore temperature is not withheld because an airport
ten kilometres away missed a minute.

What stays true is the thing the original rule was protecting. No figure is ever
shown without the reader being able to see where it came from. The rule said one
provenance because that was the cheapest way to guarantee it; this decision keeps
the guarantee and pays for it explicitly instead.
