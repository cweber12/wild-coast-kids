# 0019 — A modelled wave source may qualify a beach

Date: 2026-08-26. Status: accepted, 2026-08-26, on the argument below rather
than on the measurements — those were never the part in question.

Amends ADR-0011's service predicate. Does not replace it.

_The case against_ is kept in full below. It was not answered, it was outweighed,
and the distinction matters to whoever revisits this: the objection that this
makes "we do not publish a reading taken more than 10 km away" mean something
weaker is **correct**, and the disclosure in `WavesToday` is the whole of what
this decision offers in exchange. If that disclosure is ever removed or
weakened, this decision goes with it.

## Context

ADR-0011 bounds the inventory by distance to a **station**: a beach is served
only if its tide station is within 10 km and, if a wave buoy is bound at all,
that buoy is within 10 km. The bound's own defence is that its inputs are
measurements — "every distance came out of a join" — and that a beach it refuses
is refused with the distance that refused it.

NDBC 46235 Imperial Beach Nearshore answered 404 in May 2026. `wave-buoys.json`
records it as the only buoy south of Point Loma, and records the consequence in
its own `unresolved` block: "every south-county beach reads a buoy well to its
north-west across water of different exposure." Four beaches read one 28 km away
and left the inventory for it. Their tide stations are 948 m to 3,407 m away and
were never in question.

Since #126, the site also reads CDIP's MOP model — a wave estimate at 10 m depth
about every 100 m along this coast, seven days ahead, driven by real buoy
directional spectra and accounting for the island sheltering and refraction that
dominate the Southern California Bight. Fifteen beaches already carry one, at
117 m to 910 m, and it fills the week grid's wave row and a subordinate block on
the now-card.

The four excluded beaches bind lines at 466 m, 478 m, 485 m and 644 m. Measured
2026-08-26, every one of those lines returned 48 forecast rows, all flagged
`good`, indistinguishable in shape from `D0606`, which serves Del Mar today.

**So nothing about the distances is in doubt, and that is precisely why this is
a decision rather than a re-seed.** ADR-0011 bounds a beach by its distance to
an instrument. No instrument sits on a MOP line. `mop-lines.json` says so
without being asked:

> A MOP estimate is model output, not a measurement. It is driven by real buoy
> directional spectra and accounts for island sheltering and refraction, which
> is why it can stand this close to the shore at all — but no instrument sits on
> a MOP line, and nothing in this table says otherwise.

And ADR-0016 admits the model only **beside** a measurement — "it never replaces
the measured reading and never becomes the card's lead figure." At these four
there is no measured reading for it to sit beside. Today the answer is
implicitly no: 26 of the 41 served beaches carry `mop_line: null`, so MOP is a
supplement and has never been a qualifier. Changing that is a change of category,
not of number.

## The decision

**A beach may be served when a modelled wave source is its only wave source,
provided the measurement it replaces is dropped rather than published, and
provided the page says the figure is modelled.**

Concretely, added to the service predicate in `seed-beaches.mjs`:

> When a beach's tide station is within `SERVICE_TOLERANCE_M`, its bound wave
> buoy is **not**, and it binds a MOP line within `MODELLED_SOURCE_TOLERANCE_M`,
> the **buoy binding is dropped** — null, with a reason naming the distance that
> refused it and the line that answers instead. The predicate then sees no buoy
> binding, and the beach is served on its tide alone.

Three things carry the argument.

**The measurement is dropped, not kept.** This is the whole of why the change is
defensible rather than a loophole. Serving the four while they still name a buoy
28 km offshore would put that reading on the page, which is the exact failure
ADR-0011 exists to prevent, and it would be worse than the exclusion because the
number would look like every other number on the site. A beach admitted this way
publishes no measured wave height at all.

**It fires only where the buoy is the sole fault.** A looser form — drop any
out-of-bound buoy wherever a line replaces it — was written first and measured
second. It also fires on seven beaches that stay excluded on tide, rewriting each
one's exclusion reason to drop its wave clause and telling a reader less than
before, for beaches nobody can visit on this site either way. Measured, the
tightened form moves four beaches and changes **no** surviving `_excluded`
entry.

**The modelled bound is derived from the model, not fitted to the outcome.** Of
the county's 73 beaches, 45 bind a line: forty-three between 117 m and 930 m,
then `tide-beach-park` at 2,594 m and `tijana-river` at 6,395 m. Those two are
exactly the beaches ADR-0011 already records as published where their names are
not — one "recorded 34 km from the city it names", the other 6–7 km inland up a
river. At ~100 m alongshore spacing, a line kilometres away does not mean the
model is coarse there; it means the nearest open coast is kilometres away and
the segment is not on it. `MODELLED_SOURCE_TOLERANCE_M = 1_000` tests whether
the beach is on this shoreline at all, which is the only question a distance to
a model can honestly answer. It is a second constant rather than a reuse of
`SERVICE_TOLERANCE_M` because the two ask different questions, and at 10 km the
river reach would qualify.

**The disclosure is part of the decision, not a follow-up.** `WavesToday`'s
`no-buoy` state currently reads "We cannot give a wave height here, and that is
what we expect rather than a fault. Every wave buoy sits out on the open coast."
That sentence was written for a bay. On an open-coast beach admitted under this
ADR it is **false**, and it would be the page's explanation for the absence of
the only measurement. A beach may not be admitted under this decision until the
card says instead that no buoy reaches this stretch of coast and that the height
shown is modelled. That is a condition of the decision, and it is the half no
gate can assert.

## The case against, stated as strongly as it deserves

**"We do not publish a reading taken more than 10 km away" becomes weaker than
it sounds.** A model is not taken anywhere. After this, a reader who understands
the sentence exactly still cannot infer that some beaches are answered by
something that was never measured at all. The bound stops being one rule and
becomes two with a joint in the middle.

**It is per-variable suppression, which ADR-0011 examined and refused.** That
refusal was explicit and it was not about mechanism: "the machinery to hide one
panel already exists... What was rejected was not the mechanism but the outcome —
a beach page with two panels and a hole answers 'should we go here' worse than no
page at all." This decision reopens it. The answer offered here is that there is
no hole — MOP fills the suppressed variable, so the page has three panels and
three answers, one of which is modelled and says so. Whether that distinction
holds is the judgement, and it is genuinely arguable: ADR-0011 might reply that a
page whose wave figure is modelled _is_ the hole, wearing a number.

**ADR-0016's shape is not this shape.** Its whole argument is a modelled forecast
sitting beside a measured height, distinguishable because "the two answer
different questions and the page says which". Remove the measurement and the
distinction has nothing to be a distinction from. The precedent it set was
explicitly said not to generalise for free.

**The reader most likely to be misled is the one this site is for.** A parent
reading "1.5 ft" before taking children into the water is not weighing model
against instrument. If the modelled figure is wrong at the shore — and ADR-0016
records the two disagreeing by 2.0 ft against 0.8 ft at La Jolla Shores on
2026-08-26 — the disclosure is what stands between them and a confident wrong
number.

**And the case for, in one sentence:** the alternative is that one instrument's
failure silently deletes a stretch of public coastline from a site whose reach
is meant to be a measurement of the networks rather than an artifact of one
station's uptime, and the deletion is invisible to the reader it affects.

## Alternatives considered

**Raise `SERVICE_TOLERANCE_M`.** The change #146's body implies. Rejected: the
four are 28 km from a buoy, so any tolerance admitting them admits a reading
taken most of the way to the next county, and it would readmit beaches excluded
on tide that nothing here argues for. The problem is not that the threshold is
in the wrong place.

**Put the ceiling in `wave-join.mjs`,** so the join declines a buoy beyond 10 km
and the predicate never sees one. Smaller diff, same four beaches. Rejected: it
erases the distinction ADR-0011 turns on — a beach fails on a binding it _has_,
never on one a join correctly declined — and it makes the readmission invisible,
because `_excluded` would simply stop mentioning a buoy with no record that one
was refused. A join that silently withholds a candidate for a reason belonging to
the publisher is the shape that lost both Scripps Pier stations before #80.

**Retire the wave clause entirely,** dropping any out-of-bound buoy everywhere.
More uniform and more literally faithful to the sentence about 10 km. Rejected:
it is per-variable suppression across the whole inventory rather than at four
beaches with a replacement, and it readmits `tijana-river` as a beach with no
wave source at all — deciding by side effect a question that deserves its own
argument.

**Serve the four with the wave panel suppressed and no forecast** — the honest
minimum, admitting the beach on its tide and saying plainly that no wave source
reaches it. Rejected because it is strictly worse than what is proposed and
better than nothing: a MOP line at 466 m exists, delivers, and is already trusted
for the week grid at fifteen other beaches. Declining to read it would be a
choice to know less than the site can.

**Keep them out.** No new category, no amendment, one rule that still means what
it says, and the exclusion is already recorded with its distance so nothing is
silent. This was the real alternative rather than a foil — it is defensible, and
it was rejected for what it costs rather than for being wrong: four beaches on a
coast this site covers, removed by one station's uptime, invisible to the reader
it affects.

## Consequences

- **The site answers for 45 beaches instead of 41**, and `_excluded` falls from
  32 to 28 with no surviving entry reworded. The chooser grows a fourth region
  group, "South County coast", and ADR-0014's region headings apply to it
  unchanged.
- **Four beaches publish no measured wave height.** Their `wave_buoy` is null
  and carries the distance that refused it, so the exclusion of the
  _measurement_ is recorded on the beach the way the exclusion of a _beach_ is
  recorded in `_excluded`.
- **An invariant is broken deliberately.** `beaches.test.ts` currently pins that
  a served beach has a buoy exactly when it has a line. Four will have a line and
  no buoy. What replaces it is the asymmetric half — no served beach has a buoy
  without a line — plus each binding against its own tolerance. A test that
  merely relaxed to accept both nulls and both non-nulls would assert nothing.
- **`SERVICE_TOLERANCE_M` acquires a sibling**, and the two must not be confused:
  one bounds how far a reading may travel, the other whether a beach is on the
  coast a model describes. They are separate constants for that reason and each
  is defended where it is declared.
- **A future modelled product inherits a precedent, and it does not generalise
  for free** — the same caution ADR-0016 attached to its own. What makes this
  acceptable is that the model replaces a measurement the site would not have
  published anyway, and that the page says so. A model displacing a measurement
  the site _would_ have published is a different decision and is not made here.
- **Tijana River is not admitted by this**, and not by name: its line is 6,395 m
  and fails the modelled bound like any other. Whether it should be served with
  no wave source at all — the treatment
  `tijuana-slough-national-wildlife-refuge` already has — is left open
  deliberately. Note for anyone who follows: the slug `tijana-river` and the name
  "Tijana River" are upstream's own spelling, not a typo introduced here, and
  correcting them silently breaks the join.
- **If this is not accepted**, `docs/plans/mop-qualified-inventory.md` is marked
  historical, the four beaches stay out, and #146 closes with the measurement
  recorded — which is worth something on its own, because the next person to ask
  will otherwise re-measure it.

### Note added 2026-08-27: the modelled-only population is four no longer

**Every figure above is left exactly as it was measured on 2026-08-26.** They are
what motivated this decision and rewriting them would rewrite history. This note
is what stops the stated consequences drifting from the code instead.

`TWC0405` Point Loma was recorded as not delivering when those figures were
taken. It began answering again, and the change was measured on 2026-08-27 —
nine days in which nothing in the repo noticed. Six beaches around Point Loma
and Coronado came inside `SERVICE_TOLERANCE_M` as a result, and every one of
them reaches its waves from a MOP line rather than a buoy, because the buoy that
would serve them is the one this ADR already refused. So, as of that date:

- the site answers for **51** beaches, not 45, and `_excluded` holds **22**, not
  28;
- **ten** beaches publish no measured wave height under this rule, not four.

**The decision itself is unchanged, and this is an argument for it rather than
against it.** The case for was stated here as:

> one instrument's failure silently deletes a stretch of public coastline from a
> site whose reach is meant to be a measurement of the networks rather than an
> artifact of one station's uptime

This is that same sentence a second time, running the other way: a station's
uptime moved and six beaches appeared, under rules that did not move.
`dropReplacedBuoy`, `SERVICE_TOLERANCE_M` and `MODELLED_SOURCE_TOLERANCE_M` are
all untouched — the six qualify under this ADR exactly as written, which is the
finding rather than a workaround.

The uptime is now watched rather than assumed: `scripts/probe-tide-stations.mjs`
(ADR-0021) re-measures every tide station's delivery against what the table
records. See issues #159 and #161.
