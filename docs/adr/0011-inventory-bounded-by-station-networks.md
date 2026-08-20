# 0011 — The inventory is bounded by the station networks

Date: 2026-08-19. Status: accepted. Decision amended 2026-08-19; see the
amendment at the foot of this file.

## Context

The site answers for every beach the county lists: 73 of them, from a predicate
over the state's open data that is deliberately free of judgement — County San
Diego, Status Active, BeachAccess PUBLIC, CountAsBeach 1.

Nothing bounded the _other_ end. Each join binds the nearest delivering station
of the right kind, with no ceiling, so a beach the networks cannot reach gets a
number anyway from whatever is furthest away. Measured over the committed
`beaches.json` on 2026-08-19:

```
variable  bound   p50     p90     max     >10km
tide         72   4.1 km  30.6 km 56.6 km    27
wave         46   5.9 km  27.9 km 34.2 km    14
air          72   3.5 km   5.4 km  7.4 km     0
sky          72   7.3 km  13.4 km 16.8 km    28
```

Air is bounded in practice, and it is bounded because #80 rebuilt its candidate
set rather than letting the join reach further. Tide and waves never got that
treatment, and there is nothing further to reach for: `tide-stations.json` holds
two delivering open-coast stations, the northernmost at 32.867 °N against a
county running to 33.39 °N, and no wave buoy sits between 32.868 °N and
32.517 °N. Twenty-six beaches read a tide station over 15 km away because the
network ends, not because the join is wrong.

`docs/reference/sensor-representativeness.md` settles what may be concluded from
a distance. Three points bear:

- **No standard reporting radius exists.** WMO-No. 8 §1.1.2 makes
  representativeness a property of the application, not of the observation. A
  threshold is ours to state and defend; it cannot be cited to an authority.
- **Validity is per variable** (EPA-454/R-99-005 §3.1). Excluding one does not
  exclude the rest from the same station.
- **An intervening boundary fails at any distance.** Distance alone is not the
  criterion, in either direction.

So the choice is not between a right radius and a wrong one. It is between
publishing a number whose provenance we would not defend if asked, and not
listing the beach.

## Decision

**A beach is in the inventory only if the stations it needs reach it within
10 km.** Its tide station is within 10 km, and if a wave buoy is bound at all,
that buoy is within 10 km. A beach fails when a binding it _has_ is too far,
never when a join correctly declined to make one — which is what a bay, or a
cove closed off by a breakwater, does with a buoy. Air is not in the predicate;
every bound beach already reads air within 7.4 km, so the clause would exclude
nobody and imply a filter doing work it is not doing.

Ten kilometres is WMO §1.1.2's stated scale for small-scale and local
applications. It is a benchmark and not a rule, and it is recorded here as a
choice rather than as a citation. It is a named constant precisely so that
changing it is a one-line, reviewable decision.

**The bound is a predicate over the join result, not a list of beaches.** It is
computed by `seed-beaches.mjs` and re-derivable by `--check`, so a beach
appearing or moving upstream is judged by the same rule without anyone
remembering to. A curated list would be invisible to `--check` in exactly the
way the station tables were before #80 — which is how both Scripps Pier stations
were lost.

**Every exclusion is recorded with the distance that caused it**, in an
`_excluded` block in `beaches.json` and in what the site tells a reader. A beach
that disappears without a reason is the silent failure this repo's `unresolved`
blocks exist to prevent.

The plan is `docs/plans/inventory-bounded-by-stations.md`.

## Consequences

**The site answers for 41 beaches instead of 73.** That is the cost and it is
the point: the 32 it drops are the ones whose numbers it could not defend. What
remains, by the region labels the seeding script already assigns: 25 bays,
lagoons and inlets, 14 in La Jolla and Pacific Beach — which by that rule
includes Del Mar City Beach and both Torrey Pines — and 2 in Point Loma and
Ocean Beach, which by the same rule are Pacific Beach and Mission Beach. No
beach survives north of Del Mar, and on the open coast none survives south of
Mission Beach: Ocean Beach, Sunset Cliffs and the whole Coronado and Imperial
Beach run are cut. The bays reach further south than that, to Coronado Cays and
the Tijuana Slough, because they are bound to bay stations that are nearby.
Every surviving beach has a tide station within 10 km, and none is bound to a
buoy further away than that.

**The whole North County coast goes, and its air and wave bindings were the best
on the site** — 0.3–5.1 km and 1.0–4.7 km. Only tide fails there, and it fails
for all fourteen at once because Scripps is the northernmost open-coast station.
This is the sharpest consequence of choosing removal over per-variable
suppression, and it is the thing to revisit first if the decision is revisited:
the machinery to hide one panel already exists, since every panel carries a
`no-station` state with a reason. What was rejected was not the mechanism but
the outcome — a beach page with two panels and a hole answers "should we go
here" worse than no page at all.

**Coverage becomes a measurement rather than an ambition.** "73 beaches" was
never a claim about what the site could measure; it was a claim about what the
county lists. Forty-one is the first number this repo has published about its own
reach that is true.

**Two upstream rows are excluded for being wrong rather than far**, and the
predicate catches them without naming them: `imperial-beach-pier-area`, whose
segment endpoints are 65.5 km apart and which binds nothing at all, and
`tide-beach-park`, recorded 34 km from the city it names. Their coordinates are
not corrected here — this repo is not an authority on where beaches are.

**Two beaches are reclassified rather than excluded**, and one of them needs a
second input to say what its class cannot. `fiesta-island` is typed open coast
inside Mission Bay. `childrens-pool` is typed bay on the open ocean, and is
both open coast for its tide and closed to swell by a breakwater — so a
`sheltered` flag sits beside the class override, read by the wave join alone.
That makes three hand-written join inputs alongside `tide-stations.json`'s
`water` and `weather-stations.json`'s `shore`, which is the point at which the
pattern should be named rather than repeated a fourth time.

**What this does not decide.** Sky and visibility come from an airport METAR at
1.6–16.8 km at every beach, including the best-bound ones, and the reference
above holds that aerodrome observations should not be transferred off-field at
any distance. No tightening of this predicate fixes that, because the problem is
the network rather than the reach. It is left open deliberately and named in the
plan's out-of-scope list.

## Amendment — 2026-08-19

The decision above originally stated the wave clause as "unless the beach is a
bay or lagoon ... a wave buoy within 10 km", and its consequence as 40 beaches
kept against 33 dropped. Measuring the two reclassifications against the real
joins showed that form cuts a beach for lacking a buoy the join was right to
withhold, so the clause is restated above in the form that separates a binding
that is too far from a binding correctly not made. The counts are 41 and 32.

The consequences above originally split the 41 as 13 in La Jolla and Pacific
Beach and 3 in Point Loma and Ocean Beach, and called the total forty in one
sentence and forty-one in another. Measured over the re-joined inventory the
split is 14 and 2: Children's Pool moved out of the bay group when it was
reclassified, and it moved into La Jolla rather than into the band below.
Pacific Beach and Mission Beach are the only two the latitude bands put in
Point Loma and Ocean Beach, and the beach actually named Ocean Beach is cut, so
the claim that nothing survives south of it was misleading as well as
miscounted. Both are restated above.

The argument is unchanged. What changed is that the water class turned out to
answer two questions — which water body's level applies here, and whether ocean
swell reaches this water. They coincide at 71 of 73 beaches and diverge at
Children's Pool, where a breakwater stands between the two answers. The addendum
of the same date in `docs/plans/inventory-bounded-by-stations.md` records the
measurement that found it.
