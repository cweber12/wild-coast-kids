# 0012 — Sky and visibility are kept knowingly, until a forecast can replace them

Date: 2026-08-19. Status: accepted.

## Context

Every sky and visibility reading on this site is an airport METAR. Measured over
the 41 beaches in `src/data/beaches.json` on 2026-08-19:

```
station  name                 beaches  distance
KSAN     San Diego Airport         28  1.6-11.7 km
KNKX     Miramar                   12  10.4-14.5 km
KSDM     Brown Field                1  12.9 km

min 1.6 km   p50 7.7 km   p90 13.0 km   max 14.5 km
36 of 41 beaches read it further than 5 km away
16 of 41 read it further than 10 km away
```

`docs/reference/sensor-representativeness.md` is unusually unambiguous about
these two variables, and not in a way any distance fixes. Its §7 puts ceiling and
visibility alone among the surface variables at **not transferable** — ceiling
because it is a point measurement by instrument design, visibility because fog
and convection are localised — and cites `WMO-8` §1.3.3.1 with `ICAO Annex 3`:
an aviation observing station describes conditions specific to the aerodrome
site, tied to runway reference points, and aerodrome observations should never be
transferred off-field. Its §12 lists "transferring aerodrome (METAR)
ceiling/visibility off-field" as an anti-pattern to flag or refuse.

The problem is the network rather than the reach. Only ten stations in this
county publish sky at all and every one is an airport, which
`observation-stations.json`'s `publishes_sky` records as a measurement. KNKX
stands at 146 m and KSDM at 164 m, both inland. Coastal fog is precisely what
differs between there and the sand.

No threshold helps. Tightening to 5 km would keep KSAN's 28 beaches and delete
the other 13, and the 28 would still be wrong for the same reason.

This is being recorded now because ADR 0011 has just removed 32 of 73 beaches
rather than publish a tide reading from beyond 10 km, and the obvious question —
why does that argument not delete this too — deserves an answer in the record
rather than in a conversation.

## Decision

**Sky and visibility stay, unchanged, and this is a hold rather than an
improvement.**

Nothing in the rendering changes. The panel already reads:

> Sky and visibility at Miramar, 14.5 km away. That is an airport reading rather
> than one taken at the shore: cloud and visibility are only published by
> airports, and coastal fog is exactly what changes across that distance.

That names the station, the distance, that it is an airport, and the specific
failure mode. There is no meaningful "disclose it harder" left to do, so choosing
to keep these values is choosing the current behaviour. Recording it as a
decision is the whole of the change, because otherwise the status quo passes for
one without ever having been argued.

**The exit condition is #95** — a gridded NWS forecast, published for the beach's
own cell rather than an aerodrome's runway reference point. That is what would
remove the defect rather than caption it. Issue #91 carries the measurement and
the options; #95 carries the replacement and is named as its blocker.

**If #95 is not taken up, this decision is to be revisited rather than left.** A
hold whose replacement never arrives is a permanent choice that nobody made.

## Consequences

**The site knowingly ships something its own reference flags as an
anti-pattern.** That is the cost, it is stated here, and the disclosure quoted
above is the only thing that makes it defensible. A reader is told where the
number came from, how far away that is, and what it gets wrong.

**This is in tension with ADR 0011, and the tension is real.** That ADR's
argument was that publishing a number whose provenance we would not defend is
worse than not listing the beach, and this keeps a number whose provenance the
reference above will not defend at any distance. Three things distinguish them
and none of them dissolves it:

- ADR 0011's remedy removed a whole beach, because a beach whose tide is wrong
  has no useful page. Here the remedy would remove half of one panel, and the
  other half — temperature and wind, p50 3.7 km and max 7.4 km since #80 — is
  among the best-founded readings on the site.
- ADR 0011's defect was fixable by a threshold, which is what made 10 km a
  decision worth taking. This one is not fixable by any threshold, so there is no
  version of it that is right.
- A replacement is identified here and was not there. There is no forecast
  product that would have rescued San Onofre's tide.

What remains after all three is that this is the weaker position of the two, held
because deleting a feature and rebuilding it within months is churn a reader pays
for twice. **If #95 stalls, that justification expires**, and the honest
consequence is deletion.

**Air temperature and wind are unaffected.** ADR 0010 split the panel's two
provenances precisely so its halves could fail and be judged separately, and
`conditions.ts` keeps them in separate states that fail independently. Whatever
#95 concludes touches the sky half alone.

**A forecast is not an observation.** If #95 proceeds, putting one in the other's
slot without saying so would be a new provenance problem rather than a fix for
this one. ADR 0009's rule — relay and attribute, never judge — governs there, and
#95 records it as undecided rather than assumed.
