# The inventory is bounded by the stations that can serve it

ADR `docs/adr/0011-inventory-bounded-by-station-networks.md` records the decision
this plan implements. Relates to #86, which this plan's measurement closed as a
no.

## The problem, from the reader's point of view

A parent opens Tijuana River and is told the water is 68 °F. That reading comes
from Point Loma South, 34.2 km up the coast. A parent opens San Onofre State
Beach and is told when low tide is. That curve is Scripps, 56.6 km south. Both
numbers are produced, disclosed with a distance, and wrong in the sense that
matters: nobody reading them would act differently if they were right.

The site currently answers for 73 beaches. It can measure at far fewer. The
difference is being papered over by the join reaching further and further until
it finds something.

Measured over the committed `src/data/beaches.json` on 2026-08-19:

```
variable  bound   p50     p90     max     >5km  >10km  >15km
tide         72   4.1 km  30.6 km 56.6 km   35     27     14
wave         46   5.9 km  27.9 km 34.2 km   23     14      9
air          72   3.5 km   5.4 km  7.4 km   11      0      0
sky          72   7.3 km  13.4 km 16.8 km   61     28      3
```

Air is the one that is already right, and it is right because #80 rebuilt its
candidate set rather than stretching its reach. Tide and waves were never given
that treatment, and their p90s are what happens instead.

## Why the joins stretch

Not a bug in any join. Both networks simply stop.

**There is no open-coast tide station north of Scripps.** `tide-stations.json`
holds nine stations. Two are open-coast and deliver — 9410230 La Jolla (Scripps,
32.867 °N) and 9410120 Imperial Beach (32.578 °N). TWC0405 Point Loma is
open-coast and does not deliver. Everything north of Scripps therefore binds
Scripps, and the county's beaches run to 33.39 °N:

```
san-onofre-state-beach            56.6 km    leucadia                  20.5 km
oceanside-harbor                  40.1 km    moonlight-beach           19.9 km
agua-hedionda-lagoon              39.7 km    swami-s-park              18.6 km
harbor-beach                      39.4 km    encinitas-city-beaches    18.6 km
buccaneer-beach                   35.9 km    san-elijo-state-beach     16.8 km
oceanside-municipal-beach-other   34.5 km    cardiff-state-beach       14.9 km
carlsbad-municipal-beach          33.3 km    seascape-beach-park       12.7 km
carlsbad-state-beach              30.6 km    solana-beach-city-beaches 12.7 km
south-carlsbad-state-beach        24.4 km    san-dieguito-river-beach  12.0 km
```

Their wave bindings are 1.0–4.7 km and their air bindings 0.3–5.1 km. It is tide
alone that fails there, and it fails for all of them at once.

**There is no wave buoy between Scripps Nearshore and Point Loma South.** 46254
sits at 32.868 °N and 46232 at 32.517 °N. Everything from Coronado to the border
crosses that gap:

```
tijana-river                          34.2 km    coronado-central-beach  21.6 km
north-imperial-beach                  28.5 km    coronado-city-beaches   21.2 km
border-field-state-park               28.2 km    coronado-north-beach    20.9 km
silver-strand-state-beach             28.1 km    tide-beach-park         21.8 km
imperial-beach-municipal-beach-other  27.9 km
```

**Two rows carry coordinates that are simply wrong.**

- `imperial-beach-pier-area` has segment endpoints 65.5 km apart — 32.5804,
  −117.5866 and 32.1327, −117.1332, one roughly 40 km offshore and the other
  south of the border. It binds no tide station, no buoy, no air station and no
  sky station. It is already a blank page that costs a route.
- `tide-beach-park` records `nearest_city` "Solana Beach" while its coordinates,
  32.6925, −117.1640, put it 34 km south inside San Diego Bay. It is typed
  `Open Coast` while sitting in a bay, so it reads a buoy 21.8 km away.

**Two more are typed as the wrong kind of water.**

- `fiesta-island` is typed `Open Coast`; 32.7694, −117.2111 is inside Mission
  Bay. It binds a wave buoy 12.1 km away, publishing a surf height for water
  that has none.
- `childrens-pool` is typed `Sound, Bay, or Inlet`; it is an ocean cove in La
  Jolla. The classification sends its tide 7.8 km to Mission Bay Campland when
  Scripps is 2.5 km away.

## What decides whether a number may be shown

`docs/reference/sensor-representativeness.md` records the standards position, and
three of its points decide this plan:

1. **No standard reporting radius exists.** WMO-No. 8 §1.1.2 makes
   representativeness a property of the _application_, not of the observation.
   Any threshold here is ours to state and defend; it cannot be cited.
2. **Validity is per variable.** EPA-454/R-99-005 §3.1: excluding one variable
   does not exclude the others from the same station. Wind may fail where
   temperature holds.
3. **An intervening boundary fails at any distance.** A coastline, ridgeline or
   peninsula between the two points invalidates the transfer regardless of how
   short it is.

WMO §1.1.2's stated benchmark — small-scale and local applications concern areas
of **10 km or less** — is the nearest thing to an anchor that exists, and it is
a benchmark rather than a rule. This plan adopts 10 km as the tolerance because
it is the only figure in the literature at the right scale, and states plainly
that it is a choice.

## The solution

**A beach enters the inventory only if the stations it needs can reach it.** Not
a hand-written removal list; a predicate over the join result, re-derivable by
`seed-beaches.mjs --check` like every other binding in this repo.

The predicate, per beach:

- its tide station is within 10 km, **and**
- it is a bay or lagoon, **or** its wave buoy is within 10 km.

Bays are exempted from the wave clause because a bay binding no buoy is the
correct answer already — swell does not propagate into enclosed water, and the
site says so. A bay with no tide station within 10 km is a different thing, and
fails.

Air is not in the predicate. Every bound beach already reads air within 7.4 km
and 61 of 72 within 5 km, so adding the clause would exclude nobody and would
imply a filter that is not doing any work.

Measured outcome:

```
tolerance   kept   cut
   5 km       33    40
   8 km       38    35
  10 km       40    33     <- proposed
  12 km       41    32
  15 km       49    24
  20 km       53    20
```

At 10 km the site answers for **40 beaches**, every one of them with a tide
station within 10 km and, where it is open coast, a buoy within 10 km.

The predicate absorbs every case above without naming any of them. Both
broken-coordinate rows fail it — `imperial-beach-pier-area` binds nothing and
`tide-beach-park` binds a buoy at 21.8 km. Both North County and the South Bay
groups fail it. No curated list, nothing to maintain, and a new beach appearing
upstream is judged by the same rule on the next `--check`.

## Implementation decisions

**The predicate lives in `seed-beaches.mjs`, beside the existing one.** That
script already carries an inclusion predicate — `County San Diego, Status Active,
BeachAccess PUBLIC, CountAsBeach 1` — and documents it as "data rather than
judgement". The new clause is judgement, and the header will say so in the same
breath, the way `tide-stations.json` defends its hand-written `water` field.
What keeps it honest is that its _inputs_ are measured: the distances come from
the join, not from an author.

**Exclusion is recorded, never silent.** `beaches.json` gains an `_excluded`
block: every beach the county lists that this site does not serve, with the
binding distance that disqualified it. A beach that vanishes without a reason is
the failure mode this repo's `unresolved` blocks exist to prevent, and
`caveats.test.ts` already walks `src/data/*.json` for exactly that.

**Water class gets an override table, not an upstream fix.** `fiesta-island` and
`childrens-pool` are wrong in the county's data and we cannot correct it there.
`waterClassOf` grows a small override keyed by slug, with a written reason per
entry — the same standing as `tide-stations.json`'s `water` and
`weather-stations.json`'s `shore`, both hand-written join inputs with a recorded
defence. It ships before the predicate, because Children's Pool's class decides
which tide station it binds and therefore whether it survives.

**Nothing is built to suppress a panel.** Every panel already has its
`no-station` / `no-buoy` state with a reason string — `conditions.ts` defines
them for tide, waves, air and sky. This plan removes beaches; it does not add
per-variable suppression, because per-variable suppression is the map gymnastics
it exists to avoid.

## Test seams

All existing.

- `bindTideStation` / `bindWaveBuoy`, pure, against synthetic tables — where the
  water-class override is asserted.
- A new pure `servesBeach(bindings, tolerance)` in `seed-beaches.mjs`, exported
  and tested directly: kept at the boundary, cut past it, bay exempted from the
  wave clause, a beach binding nothing cut.
- `seed-beaches.mjs --check` for the join and the exclusion list together, so
  the cut set is evidence rather than an assertion.
- `caveats.test.ts`, already walking `src/data/*.json`, extended to the
  `_excluded` block.
- `BeachSelector` and the `/conditions/[slug]` route against the smaller
  inventory; a slug that was cut must 404 rather than render empty.

The coverage floor will need raising after slice 3.

## Slices

1. This plan, ADR 0011, and `docs/reference/sensor-representativeness.md` as the
   cited source. No behaviour change.
2. Water-class override for `fiesta-island` and `childrens-pool`, with its
   reason per entry. Re-joins; two beaches change station. Ships on its own
   because it is a correctness fix that stands whether or not slice 3 lands.
3. The served-inventory predicate: `servesBeach`, the `_excluded` block, the
   regenerated `beaches.json`, and the route and selector reading the smaller
   set. 73 beaches become 40.
4. The exclusion is disclosed to readers: `Caveats` states how many beaches the
   county lists, how many this site serves, and why the others are not here.

Slices 1–2 and 3–4 are two PRs, split at the point where the inventory actually
changes.

## Considered and rejected

**Per-variable panel suppression instead of removal.** Keep all 73 and hide the
tide panel where no station is within 10 km. Attractive because the machinery
exists — every panel has a `no-station` state — and because North County's wave
and air bindings are the best on the site: 1.0–4.7 km and 0.3–5.1 km. Rejected
on the stated preference for fewer locations over more locations with weaker
readings, and because a beach page carrying two panels and a hole is a worse
answer to "should we go here" than not listing the beach. **This is the decision
most worth revisiting**, and it is the one an addendum would amend: it is the
difference between serving 40 beaches and serving 73 with 33 partial pages.

**A curated removal list.** Name the 33 and drop them. Rejected because it does
not survive contact with upstream: the county's dataset moves, and a hand-written
list is invisible to `--check` in exactly the way the station tables were before
#80 — which is how both Scripps Pier stations were lost.

**Raising the tolerance to 15 km to keep the Del Mar–Encinitas run.** Keeps 49
and rescues nine beaches whose tide is 12.0–14.9 km away. Rejected because 15 km
has nothing behind it; 10 km at least matches WMO's stated local-application
scale. If the count matters more than the anchor, this is the knob to turn, and
turning it is a one-line change to a named constant.

**Fixing the two broken coordinate rows by hand.** `imperial-beach-pier-area`
and `tide-beach-park` could be re-geocoded. Rejected: their coordinates are
upstream's, correcting them silently makes this repo a source of beach locations
it has no authority to be, and the predicate already excludes them for a reason
that is true regardless.

## Out of scope

- **Sky and visibility, which no removal fixes.** Every sky reading on this site
  is an airport METAR at 1.6–16.8 km, and the reference above is unambiguous:
  ceiling and visibility are point measurements by instrument design, ICAO ties
  aerodrome observations to runway reference points, and they should not be
  transferred off-field at any distance. That indicts the panel at all 73
  beaches including the best-bound ones. It is a bigger accuracy gain than this
  plan and it belongs to its own issue.
- **Water temperature from LJAC1 (#86).** Measured 2026-08-18/19 and closed as a
  no: a distance rule applied consistently removes it from 23 beaches and adds it
  to 3, and no threshold improves coverage and provenance together. This plan
  removes most of the affected beaches anyway.
- **Elevation-weighted air ranking**, deferred by
  `docs/plans/coastal-air-observations.md` and still deferred.
- **Re-litigating the upstream inclusion predicate.** County, Active, PUBLIC,
  CountAsBeach stays exactly as it is.

## Addendum — 2026-08-19: the water class answers two questions, and they diverge

Found while measuring slice 2 against the real joins, before writing any of it.
The slice as specified above cannot be implemented correctly, and the reason
generalises past the two beaches it names.

**One of the two overrides is clean.** `fiesta-island` improves on every variable
at once, which is what a single wrong classification looks like when corrected:

```
fiesta-island   as open-coast   tide 9410230 11.66 km   wave 46254 12.14 km   air KSAN 4.72 km
                as bay          tide TWC0413  2.10 km   wave none             air KSAN 4.72 km
```

**The other has no correct value.** Neither class is right for
`childrens-pool`, and each is wrong about a different panel:

```
childrens-pool  as open-coast   tide 9410230  2.93 km   wave 46254  2.50 km   air LJAC1 2.94 km
                as bay          tide 9410196  7.84 km   wave none             air LJAC1 2.94 km
```

As open coast it gets the tide right — Scripps at 2.93 km is the ocean level
that actually applies inside the pool — and then publishes an open-coast swell
height at a walled wading cove. That is the failure `wave-join.mjs` was written
to prevent, in its own words: "a parent reading three feet before a paddle with
children would be told something false about the place they are going." At the
beach named Children's Pool. As bay it withholds the buoy correctly and reads
Mission Bay's tide curve, 7.84 km away, for a cove in La Jolla.

**The cause is that one field answers two questions.** `waterClassOf` is read by
the tide join as _which water body's level applies here_ and by the wave join as
_does ocean swell reach this water_. Those coincide at 71 of 73 beaches, which is
why the conflation survived three joins. Children's Pool is where a breakwater
separates them. `docs/reference/sensor-representativeness.md` §5.5 and §12 name
this directly: validity is per variable, and validating a source wholesale is an
anti-pattern.

### Revision

**A `sheltered` input joins `water` and `shore`.** Hand-written, keyed by slug,
with a reason per entry, and read only by the wave join: a sheltered beach binds
no buoy whatever its water class. `childrens-pool` becomes open coast **and**
sheltered — Scripps tide at 2.93 km, no wave height, air unchanged.
`fiesta-island` needs only the class override.

The criterion is written down so the flag is checkable rather than a taste:
**a fixed constructed structure — breakwater, seawall, jetty — stands between
the beach and the open ocean.** Not "the waves feel smaller here", which is
unfalsifiable and would spread. Children's Pool has one. Natural coves do not,
however sheltered they feel.

`TODO(verify)`: the criterion has been established for `childrens-pool` only.
Fifteen other open-coast beaches survive the predicate and each must be checked
against it before slice 3 lands — `bird-rock-nr`, `del-mar-city-beach`,
`la-jolla-community-beach`, `la-jolla-cove`, `la-jolla-shores-beach`,
`marine-street-beach`, `mission-beach`, `pacific-beach`, `shell-beach`,
`south-casa-beach-s-d`, `torrey-pines-city-beach`, `torrey-pines-state-beach`,
`tourmaline-surfing-park`, `whispering-sands-nicholson-pt`, `windansea-beach`.
The other 25 survivors are bays and bind no buoy by construction.

**The predicate's wave clause is reformulated.** As written above it reads "tide
within 10 km, and unless the beach is a bay, a buoy within 10 km" — which would
cut a sheltered beach for lacking the buoy the join was right to withhold. It
becomes:

- its tide station is within 10 km, **and**
- **if** a wave buoy is bound at all, it is within 10 km.

This subsumes the bay exemption rather than special-casing beside it, and states
the actual rule: a beach fails when a binding it _has_ is too far, never when a
join correctly declined to make one. Measured effect: **41 kept, 32 cut**, up one
from 40. Children's Pool survives; no other beach moves.

ADR 0011's decision paragraph is amended in the same commit, because it states
the superseded form of the predicate and its count.

### Considered and rejected

**Drop `childrens-pool` from the inventory.** One beach, keeps the count at 40,
and introduces no third join input. Rejected because the beach is well served —
tide 2.93 km, air 2.94 km, both among the best on the site — and would be removed
only to avoid naming a distinction that is real and already load-bearing
elsewhere. Removing a beach the networks _do_ reach is the opposite of what this
plan is for.

**Split the class into two fields**, `tide_water` and `swell_reaches`, and retire
the conflation. Conceptually the honest fix, and what the divergence argues for.
Rejected as premature: the two would hold identical values at 72 of 73 beaches,
and a three-join refactor to express one exception buys nothing today. This is
the thing to do if a second divergent beach appears — at which point it is its
own slice, not an addendum.

### Revised slices

1. Unchanged: this plan, ADR 0011, the reference doc.
2. The class override **and** the `sheltered` input, with the criterion recorded
   beside the table. Two beaches change binding.
3. The predicate in its reformulated shape, the `_excluded` block, the
   regenerated `beaches.json`, routes and selector. 73 beaches become 41.
4. Unchanged: the exclusion is disclosed to readers by `Caveats`.
