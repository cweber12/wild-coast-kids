# 0046 — An area is authored, and it partitions the inventory

Date: 2026-09-02. Status: accepted. Replaces `region`, which
`scripts/seed-beaches.mjs` derived and `beaches.json` carried. ADR-0011 is
unchanged: what a beach binds is still a join, and an area is still never one
of its inputs.

## Context

`/conditions` chooses among 51 beaches. They were grouped by **region** — a
field written into `beaches.json` at seed time by `regionOf(waterClass,
meanLat)`, four bands, documented as "Display grouping only. Never a join
input", and read by exactly one thing: the `optgroup` labels in
`BeachSelector`.

**It groups by water class first, and a reader does not.** `Childrens Pool` sat
under "Bays, lagoons and inlets" with `Tijuana Slough National Wildlife Refuge`
19 km away, because both are sheltered water. Nobody looking for the seal beach
looks there. And "Bays, lagoons and inlets" held 25 of the 51 — half the
inventory under one heading naming a water class rather than a place.

**A reader thinks in places: Del Mar, La Jolla, Mission Bay.** No committed
field yields those names, and this was measured before it was asserted:

- **`upstream.nearest_city` is `San Diego` for 43 of 51.** The remainder is
  Coronado 3, Del Mar 2, Imperial Beach 2, and La Jolla — **one**, which is
  `Childrens Pool`, the single sheltered site among La Jolla's ten.
- **Latitude fails at exactly the boundaries that matter.** `Mission Beach`
  (32.7763, open coast) falls inside Mission Bay's band, 32.7609–32.7951, with
  13 bay sites north of it and 6 south. Water class does not rescue it:
  `Fiesta Island` is published as **Open Coast** while sitting in the middle of
  the bay. And `Sunset Cliffs` (32.7242) falls _below_ `Spanish Landing Park`
  (32.7284) — opposite shores of the Point Loma peninsula, one latitude band.

So the grouping cannot be derived. It has to be asserted by a person, which
makes it the second hand-written input in this repo and the first about the
beaches themselves.

## Decision

**An area is written by hand, in `src/data/areas.json`, and the areas partition
the inventory totally and disjointly. `region` is deleted.**

Eighteen areas over 51 beaches: slug, display name, member slugs north to
south.

**Authored, because the alternative is a rule that is a table in disguise.** The
option considered was keeping `regionOf`'s shape and giving it longitude and
tuned bounding boxes. It needs no new hand-maintained file and it re-derives on
every reseed. It was rejected because boxes drawn around known answers are an
authored table wearing a function's clothes, and worse: they reassign a beach
silently when upstream nudges a coordinate, where a table refuses to change at
all. The precedent is one directory over — `tide-stations.json` holds "the one
field that is written by hand — a station's water class, which no upstream
authority publishes and which the join needs as an input." An area name is the
same kind of fact.

**Total and disjoint, asserted by a gate row**, `areas`, running
`scripts/check-areas.mjs` over `areas-partition.mjs`. Every beach in exactly one
area, every named slug in the inventory, no area empty, no slug used twice, and
both orders matching the inventory's own.

**The gate row is the decision, not the file.** `seed-beaches.mjs` rewrites the
inventory from the state's resource; `areas.json` is written by a person. Two
files that move for different reasons drift, and this particular drift is
silent: a new beach arrives, the seed picks it up, it belongs to no area, and it
is simply absent from the chooser. Nothing throws. That is the failure
`_excluded` and every `*_null_reason` field in this inventory already exist to
prevent — a refusal is recorded, never silent — and it is the whole reason the
partition is a gate rather than a convention.

**An area may hold one beach, and four do.** Not a degenerate case to minimise:
an area publishes what its members share, so a lone member shares everything
with itself and its area is the beach page, reached with no branch in the code.
Forbidding it would mean folding a place into a neighbour it has nothing in
common with, which is the outcome the rule is protecting against.

**An area slug may equal a beach slug, and three do** — `pacific-beach`,
`mission-beach`, `ocean-beach`. They are different positions of the route, so
there is no ambiguity to resolve. Five would have collided before the two bays
were split into compass points.

## Consequences

`beachesByRegion` becomes `beachesByArea` in `src/lib/areas.ts`; `regionOf` and
the `region` field leave `seed-beaches.mjs` and all 51 rows of `beaches.json`.
The chooser's `optgroup` labels are the only rendered change, and there are 18
of them where there were 4.

**The word "region" is freed, and it was overloaded.** ADR-0014 uses it for a
_section of a page_ — "The week ahead" is a region — and `beaches.json` used it
for a group of beaches. Only one meaning is left.

**Two tests lost their second operand and are deleted rather than replaced.**
Both compared the committed `region` against the water class resolved at
runtime, which was a genuine cross-check between a frozen artifact and live
code. Nothing remaining can stand in: `surfZoneWithheldReason` _is_
`station.water === "bay"`, so comparing them can only pass, and
`upstream.water_body_type` disagrees with the binding at the two beaches
`tide-join.mjs` deliberately overrides. `Childrens Pool` proves it — upstream
calls it a bay, the tide join binds it an open-coast station, and the mop join
refuses it. The property is still covered by the test asserting the binding
matches upstream except at those two named beaches, and by the surf zone's
withheld count of 25. Recorded here because deleting a test is the kind of thing
that should be argued rather than noticed later.

**A third test is deliberately not carried over.** "Puts bays and inlets in one
group regardless of latitude" asserted the behaviour this decision removes.

**The areas interleave, and the gate says only what is true.** It cannot assert
that flattening the areas reproduces the inventory's order, because it does not:
`mission-bay-north` spans inventory positions 15–22 while `mission-bay-west`
spans 21–32, with `Mission Beach` at 26 inside both. That is the same interleave
that stopped latitude from deriving the groups, showing up again in the check.
So two weaker properties are asserted instead — members sorted within an area,
areas sorted by their northernmost member — and `areas.test.ts` asserts the
interleave itself, so that a later reader finding the flattened order unsorted
does not "fix" the table by moving a beach out of the area it belongs to.

**This decides the grouping and nothing about what an area reports.** That an
area publishes only what all its members share, how "share" is measured, and
what its map draws are separate decisions with their own ADRs to come. See
`docs/plans/areas-over-locations.md`.

The part most likely to be re-litigated is the count: 18 groups for 51 beaches,
four of them holding one beach. The answer is that the alternative to a
single-member area is a wrong one, and that the two bays were split because
20 entries under one heading is the problem this decision started from.
