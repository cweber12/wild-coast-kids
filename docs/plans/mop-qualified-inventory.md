# A modelled wave source may qualify a beach

Planned 2026-08-26 for #146. Slice 2's decision,
[`docs/adr/0019-a-modelled-source-may-qualify-a-beach.md`](../adr/0019-a-modelled-source-may-qualify-a-beach.md),
was accepted on 2026-08-26, so slices 3–5 are unblocked. In flight; not
historical yet.

## The problem, from a reader's point of view

A parent in Imperial Beach opens the conditions page and cannot find their
beach. Nothing on the page tells them why in terms they would recognise: the
disclosure says the site answers for 41 of the county's 73, and the entry for
their beach says a wave buoy is 28 km away. The beach is not closed, not
unlisted, not a bay. It is missing because NDBC's only buoy south of Point Loma
answered 404 in May 2026, so the wave join reached past it to the next one and
the inventory bound refused the result.

Four beaches are in that state and no other: Border Field State Park, Silver
Strand State Beach, north Imperial Beach, and Imperial Beach municipal beach,
other. Each has a tide station within 3.5 km. Each has a CDIP MOP line under
650 m. The site already reads MOP at fifteen beaches for the week grid's wave
row and the now-card's forecast block (ADR-0016). What it has never done is let
that source decide whether a beach exists at all.

So the question is not whether 466 m is close enough. It is whether a beach may
be served when its only wave source is a model. ADR-0011 bounds a beach by its
distance to an _instrument_, and no instrument sits on a MOP line —
`mop-lines.json` says so in its own provenance.

## What was measured

Against `main` at `9af8197`, on 2026-08-26. `seed-beaches.mjs --check` reported
the committed inventory current — 41 beaches, join unchanged — so these figures
are the shipped join's, re-derived rather than recalled. Distances are the
repo's own `segmentDistance`; no new arithmetic was written.

### The four, and what they bind

| Beach                                 | MOP line | MOP   | Buoy  | Buoy    | Tide      | Tide    |
| ------------------------------------- | -------- | ----- | ----- | ------- | --------- | ------- |
| Border Field State Park               | `D0001`  | 466 m | 46232 | 28.2 km | `9410120` | 2,914 m |
| Silver Strand State Beach             | `D0085`  | 478 m | 46254 | 28.1 km | `9410120` | 3,407 m |
| north Imperial Beach                  | `D0085`  | 485 m | 46232 | 28.5 km | `9410120` | 948 m   |
| Imperial Beach municipal beach, other | `D0061`  | 644 m | 46232 | 27.9 km | `9410120` | 1,050 m |

All four sit inside the spread of the fifteen served beaches that already bind a
line — 117 m to 910 m, median 519 m — and two beat that median. Tide was never
the blocker for any of them, which is confirmed by measurement rather than
trusted: the `why` string in `beaches.json` names only the buoy.

The triage brief listed Silver Strand's tide station as `9410135` at 3.4 km.
That is South San Diego Bay, a bay station 3,378 m away. Silver Strand is open
coast, so the tide join matches water class and binds `9410120` Imperial Beach
at 3,407 m. The distance in the brief is right to one decimal; the station is
not, and the two are different water.

### The lines carry rows today

`mop-lines.json` records that CDIP _publishes_ a forecast for a line and says
plainly that this is not the same fact as today's run carrying usable rows —
"which is a per-request fact". So the lines were fetched, over a
2026-08-27 → 2026-09-03 window, with `D0606` (Del Mar, already live) as a
control:

```
line  | HTTP | bytes | rows | flag=1 | Hs range m
D0001 |  200 |  3721 |   48 |     48 | 0.40-0.99
D0061 |  200 |  3741 |   48 |     48 | 0.34-0.90
D0085 |  200 |  3761 |   48 |     48 | 0.43-0.96
D0008 |  200 |  3742 |   48 |     48 | 0.39-0.96
D0606 |  200 |  3760 |   48 |     48 | 0.44-0.88
```

Every row flagged `waveFlagPrimary=1`, which this feed's own metadata declares
as `good`. Identical in shape to the line already serving the live site.

### The model's spacing gives the bound, and it was not chosen to fit

Of the county's 73 beaches, 45 bind a MOP line at all. Their distances:

```
117 m … 930 m     43 beaches    la-jolla-cove 117 -> coronado-central 930
      2,594 m      tide-beach-park
      6,395 m      tijana-river
```

Forty-three inside a kilometre, then an order of magnitude of empty space, then
two. The two are exactly the beaches ADR-0011 already records as having
coordinates that do not put them where their name says: `tide-beach-park`,
"recorded 34 km from the city it names", and `tijana-river`, published 6–7 km
inland up the river rather than on the shoreline.

That is what makes a one-kilometre bound on a modelled source a measurement
rather than a tuned constant. MOP publishes about every 100 m alongshore. A line
kilometres from a beach does not mean the model is imprecise there; it means the
nearest open coast is kilometres away, and the segment is not on it. The bound
tests whether the beach is on this shoreline at all, which is the only thing
distance to a model can honestly test.

## The design

**One rule, added to the service predicate, and it fires only where the buoy is
the sole fault.**

A beach whose tide station is in bound, whose bound wave buoy is out of bound,
and which binds a MOP line within `MODELLED_SOURCE_TOLERANCE_M`, has its **buoy
binding dropped** — set null, with a reason naming the distance that refused it
and the line that answers instead. The service predicate then sees no buoy
binding at all, and the beach passes on its tide alone, the way every bay
already does.

Dropping the binding is not tidiness. Without it the four would be served while
still naming a buoy 28 km offshore, and the page would publish that reading —
which is worse than the exclusion it replaces, and is the exact thing ADR-0011
exists to prevent.

**Why "sole fault" and not "wherever a line replaces it."** The looser form was
written first and measured second. It also fires on seven beaches that stay
excluded on tide — Carlsbad Municipal, Ocean Beach, Dog Beach O.B., Sunset
Cliffs, and the three Coronado entries — rewriting each one's `_excluded` reason
to drop its wave clause. Those beaches are not served either way, so the whole
effect is that their exclusion record tells a reader less than it did. The
tightened form touches four beaches and nothing else; measured, `_excluded` goes
32 → 28 with **zero** `why` strings changed on a beach that stays out.

**What it does to the file**, measured by simulating the predicate over a live
upstream fetch:

- served 41 → 45; the four arrive, nothing departs
- `_excluded` 32 → 28, no surviving entry reworded
- `tijana-river` untouched, still excluded on its 34.2 km buoy — its line is
  6,395 m and does not qualify
- `tide-beach-park` untouched, still naming both distances — its line is 2,594 m
- the chooser grows a fourth region group, "South County coast", after "Bays,
  lagoons and inlets"

**What it does to an invariant.** Today every served beach with a buoy has a
line and every beach with a line has a buoy, and `beaches.test.ts` pins that.
The change breaks it deliberately: four beaches will carry a line and no buoy.
What survives, and is worth pinning in its place, is the asymmetric half —
**no served beach has a buoy without a line** — plus the two bounds, each
against its own tolerance.

## Test seams

Agreed before starting, and all three already exist:

- **`serviceFault` / the replacement rule**, pure functions over a built beach
  in `seed-beaches.mjs`, tested in `seed-beaches.test.mjs` against fixtures. The
  new rule goes beside `serviceFault` at the same altitude, not inside a join —
  a join binds the nearest candidate and has no opinion about whether the site
  will publish it, which is the split `wave-join.mjs` and `serviceFault` already
  keep.
- **`allBeaches()` and `inventoryReach()`**, over the shipped `beaches.json`, in
  `src/lib/beaches.test.ts`. This is where the count and the bindings are
  asserted against the file that ships rather than against a fixture, which is
  what makes them evidence.
- **`WavesToday`**, rendered directly in `WavesToday.test.tsx` with a
  hand-built view. The `no-buoy` state and the forecast block are already
  covered there; the new case is the two together.

No new seam is needed and none is proposed.

**A committed probe is deliberately not part of this.** The brief suggested one,
on the pattern of `probe-mop-lines.mjs`. Every join figure above is already
re-derivable by `seed-beaches.mjs --check`, and the one figure that is not — the
distance distribution justifying the modelled bound — belongs as an assertion
over the shipped file in `beaches.test.ts`, where it runs on every gate rather
than when someone remembers to run a script. A third probe would be a fourth
copy of a fetch that two scripts already make.

## Slices

1. **This plan file.** Its own commit.
2. **ADR-0019.** The decision, both designs, both sides. Written before any code
   because 3–5 are only defensible if it lands. **The work stops here for a
   human.**
3. **The predicate admits a qualifying line, and the inventory is re-seeded.**
   One slice, not two: a predicate with no re-seed is a layer nothing
   demonstrates. Carries the rule, its unit tests, the regenerated
   `beaches.json`, the `_served` and `_schema` prose that describes it, and the
   four assertions in `beaches.test.ts` and `page.test.tsx` that the new count
   and the broken invariant fail.
4. **The card stops claiming no buoy reaches here, and says the figure is
   modelled.** `needs-human`: no gate can assert how a page reads.
5. **Tijana River.** Served with waves null and the reason stated, or left
   excluded. Its own decision, and small either way.

3 depends on 2 landing. 4 depends on 3. 5 depends on 3 and is otherwise
independent of 4.

## Considered and rejected

**Relax the 10 km tolerance.** The simplest change, and it answers the wrong
question. The four are 28 km from a buoy; a tolerance that admitted them would
admit a reading taken most of the way to the next county, and would also readmit
beaches excluded on tide, which nothing here argues for. #146's own body frames
the problem as a threshold; it is not one.

**Put the ceiling in `wave-join.mjs`,** so the join declines to bind a buoy
beyond 10 km and the predicate never sees one. It readmits the same four with a
smaller diff. Rejected because it erases the distinction ADR-0011 turns on — "a
beach fails when a binding it _has_ is too far, never when a join correctly
declined to make one" — and it makes the readmission invisible: `_excluded`
would simply stop mentioning a buoy, with no record that one had been refused. A
join that silently withholds a candidate for a reason belonging to the publisher
is the shape that lost both Scripps Pier stations before #80.

**Retire the wave clause entirely** and drop any out-of-bound buoy binding
everywhere. More uniform, and more literally faithful to "we do not publish a
reading taken more than 10 km away". Rejected: it is per-variable suppression
across the whole inventory, which ADR-0011 considered at length and refused —
"a beach page with two panels and a hole answers 'should we go here' worse than
no page at all" — and it would readmit `tijana-river` as a beach with no wave
source at all, pre-empting slice 5's decision by accident rather than by
argument.

**Reuse `SERVICE_TOLERANCE_M` for the modelled source.** One number instead of
two, and no new constant to defend. Rejected on measurement: at 10 km
`tijana-river` qualifies on a line 6,395 m away and 6–7 km up a river, which is
the one outcome the brief and this plan both refuse. The two numbers answer
different questions — how far a _reading_ may travel, against whether the beach
is on the coast the _model_ describes — and collapsing them makes the second
unanswerable.

**Hand-write an exclusion for Tijana River,** the way `sheltered.mjs` hand-writes
Children's Pool. Rejected: ADR-0011 already flags that this repo is at three
hand-written join inputs and that a fourth is the point to name the pattern
instead. The measured bound handles Tijana River as a consequence of the rule,
which is strictly better than handling it by name.

## Out of scope

- The eight beaches excluded for wave _and_ tide distance. MOP answers only the
  wave half; nothing here admits them, and their exclusion records are
  deliberately left byte-identical.
- Reviving 46235 or finding a replacement buoy. It is a gap in what NDBC
  publishes.
- The 10.0 km figure itself.
- Whether the now-card should ever lead with a modelled figure. ADR-0016 says it
  must not; slice 4 works within that and does not reopen it.
- Runup and total water level, still out under ADR-0009 and ADR-0016.
