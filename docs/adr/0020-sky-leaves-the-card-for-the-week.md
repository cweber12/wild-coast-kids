# 0020 — Sky leaves the card for the week, and visibility leaves entirely

Date: 2026-08-26. Status: accepted.

Supersedes ADR-0012, which held sky and visibility on the now-card pending a
forecast that could replace them **in that slot**. That is not what happens, so
this is a supersession rather than an amendment: ADR-0012's reasoning no longer
matches any decision in force, and editing it would leave a document arguing for
a position nobody holds.

## Context

ADR-0012 kept an airport METAR's sky and visibility on every beach's air card,
knowing the site's own reference forbids it. Its exit condition was #95 — a
gridded National Weather Service forecast, published for the beach's own cell
rather than an aerodrome's runway reference point — and it said in terms that if
#95 stalled, "that justification expires, and the honest consequence is
deletion."

#95's measurement is now done. It changes the shape of the answer.

### What the gridpoint carries

Probed 2026-08-26 against `api.weather.gov` over all 45 served beaches and both
ends of each segment: 89 of 90 ends resolved, into 21 distinct cells, all in
office `SGX`.

| variable        | cells carrying values            |
| --------------- | -------------------------------- |
| `skyCover`      | **21 of 21**, 34–37 entries each |
| `visibility`    | **0 of 21**                      |
| `ceilingHeight` | **0 of 21**                      |

`visibility` and `ceilingHeight` are declared keys with empty `values` arrays at
every cell. `skyCover` is in `wmoUnit:percent` on 3- and 6-hour steps across a
`P7DT13H` window; the run seen was stamped `2026-08-26T18:36:01+00:00`.

Fog survives, but not as a series. The `weather` product carries it as an
occasional phenomenon: in three cells read in full, 12 entries each, 6 named a
phenomenon — `fog` ×4, `rain_showers` ×2 — and 4 carried a visibility figure of
1.609 km. So the beach's own cell does forecast fog, and does not measure
visibility.

**This is why the replacement ADR-0012 imagined does not exist.** It assumed one
product would step into the slot the METAR vacated. Sky can move; visibility
cannot follow it anywhere.

### What the cell is

Cells measure 2,512–2,525 m by 2,501–2,522 m. From a beach's own coordinate to
the centre of the cell answering for it, over 89 ends: min 103 m, p50 999 m,
p90 1,615 m, max 2,043 m. Against the sky station, re-derived over the same 45
beaches: min 1.6 km, p50 7.9 km, p90 13.0 km, max 14.5 km, with 40 of 45 beyond
5 km and 20 of 45 beyond 10 km.

### The defect ADR-0012 did not name

Distance was not the whole fault. Cell `SGX/53,19` holds four beaches, and on the
day of measurement they were told opposite things:

| beach                    | sky station     | what it said    |
| ------------------------ | --------------- | --------------- |
| La Jolla Community Beach | KNKX at 11.0 km | "Mostly Cloudy" |
| WindanSea Beach          | KNKX at 13.5 km | "Mostly Cloudy" |
| Bird Rock (NR)           | KSAN at 11.7 km | "Clear"         |
| Tourmaline Surfing Park  | KSAN at 10.3 km | "Clear"         |

Four beaches inside one 2.5 km square, given contradictory descriptions of the
same sky, decided by which airport a join happened to bind. `SGX/57,9` splits the
same way between KSAN and KSDM. No disclosure addresses this, because each
sentence is individually true.

## The decision

**The gridded cloud-cover forecast fills a row in the week grid. The air card's
sky group is deleted, and visibility is not published anywhere.**

Three parts, and the order matters.

**Sky moves to the week, not to the card.** A forecast in a forecast row is not
standing in an observation's slot, so this needs no new provenance argument — it
is ADR-0016's shipped shape reused. ADR-0012's closing consequence warned that
"putting one in the other's slot without saying so would be a new provenance
problem rather than a fix for this one." Nothing here does that. The card's
lead figure stays a measurement; the week's rows stay forecasts.

**The card's sky group is deleted rather than kept.** This is #91's Option 1,
and it is now available because the objection that defeated it has gone. That
objection was one sentence — "Loses the only cloud information on the site" —
and it is false once the week row exists. The information survives, at a better
provenance, in a slot that admits what it is.

**Visibility is not replaced.** The gridpoint does not carry it, the fog
phenomenon is a different kind of claim on a different cadence, and keeping the
METAR figure alone would leave a single off-field aerodrome reading as the last
survivor of the exact anti-pattern this supersession exists to end. The site
publishes no visibility figure after this.

**The row's statistic is cloud cover, and fog annotates it.** `skyCover` is
populated for every cell and every step, so the row is never ragged; when the
`weather` series names a phenomenon for a day, that day's cell says so. One row,
one question — "what will the sky do" — which keeps ADR-0016's rule that a row's
label names its own statistic. The phenomenon's 1.609 km visibility figure is
**not** printed: it appears in about a third of entries, and a precision the rest
of the row cannot match would read as a measurement.

**The cell is bound by a join, and the end is chosen by elevation.** Every other
binding here is a committed join with recorded provenance (ADR-0009), and a
re-gridded forecast point is already named there as something this repo owns that
rots. Distance cannot choose the end, because every point inside a cell is
equally inside it. The criterion is the cell whose mean elevation is nearest sea
level, which is derived from what a beach is rather than from the answer we
wanted: it moves Del Mar City Beach from a 102 m cell to a 22 m one and La Jolla
Shores Beach from 117 m to 0 m.

## The bluff cells, and the limit of the evidence

After end selection, three beaches still read a cell averaging far above sea
level: Torrey Pines State Beach (102 m), Torrey Pines City Beach (117 m) and
La Jolla Cove (106 m). Across all 89 ends the p50 is 2.1 m, so these are the
exception rather than the rule.

**They are served, and the provenance line says the cell spans the shore and the
bluff above it.**

The honest reason to serve rather than withhold is that the evidence is weaker
than it looks. Cell elevation is the grid's **terrain** figure. It is not a
demonstrated forecast error, and these fields are built by forecasters who know
the terrain — a 117 m cell is not a 117 m forecast. That is a materially weaker
proxy than ADR-0011's distances, every one of which measured a real separation
between an instrument and a beach. Blanking three of the most-visited beaches on
this coast, on a proxy, once the card's sky group is already gone, would cost a
reader more than the caveat does.

**The counter-argument, which is not silly:** a marine layer sitting on the sand
while the clifftop is in sun is precisely the Torrey Pines failure mode, and a
cell containing both is where a reader would most want the site to decline. If
that turns out to be right, the remedy is a terrain bound sibling to
`MODELLED_SOURCE_TOLERANCE_M`, and it is a smaller change than this one.

## Alternatives considered

**Replace the card's sky with the gridded value.** The literal reading of
ADR-0012's exit condition. Rejected: the gridpoint has no observation in it — its
earliest entry is the 3-hour block containing now — so this puts a forecast in a
slot a reader currently reads as measured, which is the "different kind of wrong"
#91's Option 3 named and ADR-0019 explicitly declined to decide ("a model
displacing a measurement the site would have published is a different decision
and is not made here"). Moving sky to the week costs nothing this would have
bought and asks for none of the argument.

**Fill the week row and leave the card's sky alone.** The smallest change that
discharges the reserved slot. Rejected: it leaves the off-field METAR on the card
with ADR-0012's exit condition spent and #95 closed, so the hold becomes
permanent by attrition — the exact failure #95 was filed to prevent, one level up.
It also leaves the site saying two things about one sky, one of them from an
airport 14.5 km away.

**Keep visibility on the card alone.** Sky moves, visibility stays. Rejected: it
preserves a single aerodrome visibility reading as the last instance of the
anti-pattern, in a stat group with one provenance and no company, and the
sentence explaining it would have to say the site knows better and does it anyway.

**Two rows, cloud cover and present weather.** Strictest reading of ADR-0016's
label rule. Rejected on the measurement: most steps name no phenomenon at all, so
the present-weather row is empty on most days, and a blank row in a seven-column
grid reads as a fault rather than as "nothing forecast".

**Cloud cover only, no fog relay.** Smallest, most uniform row. Rejected: it
deletes the METAR visibility and puts no fog signal anywhere, on a coast where
fog is the thing a parent is actually deciding about, while the fog forecast for
the beach's own cell sits unread.

**Read a neighbouring sea-level cell at the three bluff beaches.** Named only so
it stays rejected: it reintroduces the off-site transfer this supersession exists
to end, and the row's claim is the beach's _own_ cell.

**Make the hold permanent and defend it.** Amend ADR-0012 to drop the exit
condition and argue the disclosure is enough. Rejected: it is a coherent position
and it was weighed, but it commits the site permanently to something its own
reference lists under §12 anti-patterns, at the moment a better source has been
measured and found to work.

## Consequences

- **The site publishes no current sky reading and no visibility at all.** A
  reader gets today's cloud-cover forecast for this beach's cell, not what the
  sky is doing this minute. That is a real loss of immediacy, accepted because
  the thing lost was an aerodrome's sky at a median 7.9 km, and 20 of 45 beaches
  read it from beyond 10 km.
- **The air card keeps its name and loses two stats.** It is titled "Air" rather
  than "Sky", so nothing has to be renamed. Temperature and wind — p50 3.7 km,
  max 7.4 km — are untouched, which is what ADR-0010 split the provenances to
  protect.
- **`sky_station` leaves the inventory, and `publishes_sky` does not.** The
  binding is a join result and goes with the join that made it; the flag is a
  measurement of the network — 10 of 62 stations, every one an airport — and it
  is the evidence this ADR and ADR-0012 both rest on. Deleting it would delete
  the basis of the argument.
- **`ConditionsNotes` keeps a sky entry and rewrites it.** A reader who wonders
  where the sky reading went is owed the answer, and "no station near this shore
  publishes it" is the answer.
- **One beach has an end outside the grid.** Border Field State Park's lower end
  returns `InvalidPoint`; its upper end resolves. The join takes the resolving
  end and records that the other had none, rather than silently preferring one.
- **17 of 45 beaches straddle two cells**, so `grid_cell_from_end` is not
  decoration — it is the whole of how the binding is decided, and a re-join that
  ignores it would move beaches between cells silently.
- **A second NWS product enters the page,** from a host already spoken to for
  observations, so the user-agent convention, the failure vocabulary and the
  caching approach are all the existing ones.
- **If the bluff-cell judgement is wrong,** the fix is a terrain tolerance beside
  `MODELLED_SOURCE_TOLERANCE_M` and it withholds three cells. Nothing else in
  this decision depends on it.
