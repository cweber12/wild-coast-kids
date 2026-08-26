# A wave forecast in the week, from the model that knows about the islands

Issue #126. The brief in its first comment supersedes the issue body and
corrects three claims in it; this plan is written against the brief and against
the feed, probed again on 2026-08-26 before any code was written.

## The problem, from the reader's point of view

The week grid answers two questions — when the tide is lowest, and whether that
falls in daylight — and then stops. Under it sit three dashed boxes, the first
of which says "A wave forecast is coming." A parent choosing between Thursday
and Saturday has the tide for both days and the waves for neither.

Waves appear on the page once, as a present-moment reading from an NDBC buoy.
That reading is fine and stays. What it cannot do is answer a question about
Thursday: NDBC buoys are observation-only, so there is no arrangement of that
feed that fills the row.

CDIP's MOP model can. It publishes wave estimates at 10 m depth roughly every
100 m alongshore, driven by real buoy directional spectra rather than modelled
winds, and it reaches about seven days ahead.

## The upstream contract, measured rather than remembered

Every figure here comes from a request made on 2026-08-26, not from CDIP's
documentation. The issue body's account of this feed was wrong in three places
and the docs page carries neither the flag semantics, nor the formats, nor the
horizon.

**The forecast, as CSV.** No NetCDF, no dependency, no build step:

```
https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/D0498_forecast.nc
  ?var=waveHs&var=waveTp&var=waveDp&var=waveFlagPrimary&accept=csv
  &time_start=2026-08-26T07:00:00Z&time_end=2026-09-02T07:00:00Z
```

`200 text/plain`, 4,108 bytes, 53 rows. Units are declared per column, the way
`realtime2` declares its own on a second header line:

```
time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],waveHs[unit="meter"],waveTp[unit="second"],waveDp[unit="degreeT"],waveFlagPrimary
2026-08-26T09:00:00Z,D0498,32.855,-117.262,0.19576807,4.7619047,279.16833,1
```

Three-hourly, not hourly. Timestamps carry an explicit `Z`, so this feed does
not have the offset hazard ADR-0009 records. `waveHs` is metres and the page
renders feet, exactly as the NDBC path already converts.

**`waveFlagPrimary` 1 means good and is kept.** The variable's own metadata
says `flag_values: 1 2 3 4 9` against `flag_meanings: good not_evaluated
questionable bad missing`. The issue body read as reject-when-1; implementing
that literally would have emptied the row at every beach and presented as a
dead feed rather than as a bug.

**Failures are distinguishable, which is what the two error types turn on:**

| condition                   | response                                                             |
| --------------------------- | -------------------------------------------------------------------- |
| forecast has not been rerun | `400` `No features are in the requested subset`                      |
| line does not exist         | `404` `FileNotFound: No such file or directory`                      |
| variable renamed upstream   | `400` `Variable: waveNope is not contained in the requested dataset` |

The first is a quiet feed. The last is drift, and drift is a bug to chase.

**The horizon is tight and will sometimes fall short.** The sampled file ran
`2026-08-23T00:00Z` to `2026-09-01T21:00Z` — about three days back and seven
forward, 80 rows, 6 KB for the whole thing. That covers today and the six days
after it, and only just. When a rerun slips, the last column has no cell. The
grid already requires that shape: an absent cell is left out rather than
blanked.

**The line inventory is one request, not 1,210.** This is the part the brief
did not have. `cdip/model/R_CA_coefficients/catalog.xml` names every California
MOP line with its coordinates in the filename:

```
D0498_32.85520-117.26200_ref.nc
```

San Diego has exactly 1,210 D-lines, D0001 at 32.534, −117.129 on the Mexican
border through D1210 at 33.383, −117.602 at the county line. One 3.6 MB
request gives the whole geometry. The alternative was 1,210 requests to build
the same table, or a latitude bisection that would have been wrong at Point
Loma.

## The join, run before it was planned

`segmentDistance` over those 1,210 lines against the committed inventory binds
every one of the 15 open-coast beaches, and none of the other 26:

| beach                 | MOP line | distance | buoy distance today |
| --------------------- | -------- | -------- | ------------------- |
| la-jolla-cove         | D0481    | 117 m    | 1,991 m             |
| la-jolla-shores-beach | D0498    | 325 m    | 1,648 m             |
| mission-beach         | D0365    | 700 m    | 8,366 m             |
| pacific-beach         | D0410    | 910 m    | 7,506 m             |

Every bound line is inside a kilometre. That is the case for this issue stated
as a measurement rather than as an argument — though note that it is the
_forecast_ the row exists for. The brief measured that no beach can currently
disclose a buoy distance, because the inventory bound and the disclosure
threshold in `WavesToday` are the same 10 km, so "a better now reading" is not
a claim this work is allowed to make.

## What is being built

**The row spans all seven columns, today included**, and each cell shows that
day's **maximum** height with the period of the row it came from. The maximum
is a consequential choice rather than a cosmetic one — the brief measured two
of ten sampled days where the day's minimum and maximum fell either side of a
`heightWords` band — so the row's label names it: **"Biggest swell"**, the way
the tide row's "Lowest tide" names its own selection.

**MOP fills the week row only.** It does not replace the NDBC now-reading and
does not sit beside it on the now-card. ADR-0010 permits two provenances behind
one panel and forbids them behind one sentence; two wave heights for the same
instant is the forbidden shape, and a measurement of now beside a forecast for
Thursday is the permitted one. This gets an ADR of its own, in the slice that
makes it true.

**Provenance is rendered once, beneath the grid, not seven times.** `WeekRow`
gains an optional field carrying what `ProvenanceLine` already takes. A feed's
identity is one fact about a feed. The other two reserved products will want
the same field, so it is shaped for them rather than for waves alone.

**The water-class refusal carries over.** MOP lines sit at 10 m depth on the
open coast, and ~100 m spacing makes a spuriously close line _more_ likely at a
bay beach, not less. The 26 beaches that bind no buoy must bind no line, and
Children's Pool — open coast, behind a breakwater — must refuse for the same
structural reason it refuses a buoy.

## Test seams

Agreed before starting, because they decide whether any of this can be
verified.

- **`parseMopForecast(text, lineId)`** — pure, offline, asserted against a
  committed CSV fixture. Pins the column names and the declared units, keeps
  flag 1 and drops 2, 3, 4 and 9, and counts what it dropped. Raises
  `MopDriftError` for a layout or unit change and `MopNoDataError` for a line
  that answered with nothing usable, so drift is chaseable as a bug rather than
  read as a bad day. Existing seam shape: `parseNdbcRealtime2`.
- **`fetchMopForecast(lineId, window)`** in `lib/upstream.ts` — names its own
  `next.revalidate`, never throws, turns every failure above into an
  `unavailable` carrying its reason. Existing seam shape: `fetchLatestWave`.
- **`readWaveWeek(slug, nowMs)`** in `lib/conditions.ts` — `nowMs` injected, so
  day selection is asserted against fixed instants and no clock is read during
  a render. Existing seam shape: `readWeekOfLowestLows`.
- **`bindMopLine(beach, lines)`** in `scripts/mop-join.mjs` — pure, no network,
  called with a table. Existing seam shape: `bindWaveBuoy`.
- **`WaveWeek`** — a cell, not a row, because the grid is day-major. Existing
  seam shape: `TideWeek`.

The probe's HTTP calls are deliberately not behind a seam, for the reason
`probe-observation-stations.mjs` gives about its own: it is not a gate row and
its output is the committed table.

## Slices

Two PRs, split at the binding boundary. Roughly 800 lines together, past what
CLAUDE.md asks a reviewer to hold.

**PR 1 — the binding.**

1. **Share the sheltered-beach criterion between the two wave joins.** A pure
   refactor: the structural fact about Children's Pool is about the beach, not
   about who publishes the number, so it moves out of `wave-join.mjs` into a
   module both joins read. `wave_buoy_null_reason` stays byte-identical, and a
   test asserts that.
2. **Bind each open-coast beach to a MOP line.**
   `scripts/probe-mop-lines.mjs` writes `src/data/mop-lines.json` from the two
   catalogs, with `--check`; `scripts/mop-join.mjs` binds; `seed-beaches.mjs`
   wires it and `beaches.json` gains `mop_line`, `mop_line_distance_m`,
   `mop_line_from_end` and `mop_line_null_reason`; `beaches.ts` gains the type,
   `mopLineFor`, and the new table's caveats.

**PR 2 — the reading and the row.**

3. **Read a MOP forecast for a beach.** Parser and fixture, fetcher, and
   `readWaveWeek` — a complete path from the network to a view model, verified
   without touching the network.
4. **Put the wave forecast in the week grid.** `WeekRow` gains provenance;
   `WaveWeek` renders a cell; `WeekPanel` composes the row and drops the wave
   `ReservedRow` in the same change; `ConditionsNotes` gains the
   model-versus-measurement distinction and credits CDIP / Scripps Institution
   of Oceanography; the ADR lands.

Slice 2 depends on 1. Slice 3 depends on neither. Slice 4 depends on 2 and 3.

## Considered and rejected

**A NetCDF dependency, or a build-time conversion step.** The issue framed this
as the central decision and said an ADR was owed either way. THREDDS NCSS
serves the same datasets as CSV with units declared per column. The dependency
budget is untouched, no ADR is owed, and the parser is the same shape as the
two already in `src/lib/`.

**Probing 1,210 lines to build the table.** Correct and rude. The refraction
coefficient catalog carries the same coordinates in one request, and cross
referencing the alongshore catalog says which lines publish a forecast at all.

**Replacing the NDBC reading with MOP's nowcast.** It would remove the
awkwardness of a measured number above a modelled one. It also removes the only
measurement of the actual sea on the page and changes the provenance line on a
shipped card, and the brief settled it: MOP fills the week row only.

**Recording the flag rejection rate as a monitored signal.** Worth having — a
spike means a driving buoy is down and that period's values are unusable rather
than merely noisy. It belongs with the weekly probe work rather than here, so
the parser counts rejections and the count goes no further than the failure
message for now.

**A per-day provenance line.** Seven copies of one fact, which is the thing
`WeekGrid`'s `notes` prop already exists to avoid.

**`_nowcast`, `_hindcast` and `_ecmwf_fc`.** The nowcast is hourly but reaches
only backwards; `_forecast` reaches three days back and seven forward, which
covers the whole grid in one request. The hindcast is 155 MB.

## Out of scope

- **Restoring the five south-county beaches.** MOP would satisfy the wave half
  of the inventory bound for Silver Strand, North Imperial Beach, Imperial
  Beach Municipal, Tijuana River and Border Field, all excluded on wave-buoy
  distance alone since Imperial Beach Nearshore died on 2026-05-03. That needs
  a re-seed and an amendment to ADR-0011, and is #146.
- **Runup and total water level**, for the reason the issue gives: the
  Stockdon parameterization was calibrated on sandy beaches, and a total-water-
  level figure beside a tide height would read as the same kind of number with
  the same confidence.
- **Contacting CDIP.** The data is public and no credentials appear anywhere in
  the probe. The maintainer is writing to `www@cdip.ucsd.edu` in parallel; the
  build does not wait on it, and the credit ships from day one.

## Addendum, 2026-08-26: the row leads with a time, and the card carries it too

Two changes asked for after the row shipped to a branch, recorded here rather
than folded into the text above, which is what was decided before the work
began.

**The wave row leads with the time of the day's biggest swell.** The first draft
led with the height, on the argument that a swell is a decision about whether to
go rather than when. Seen in the grid that was wrong about what the grid is:
every other row opens with a time — the lowest low, sunrise — so a reader
scanning down one day reads "when, when, when", and a fourth row opening with a
number broke the column. The cell now takes `TideWeek`'s shape: the time in bold,
the height and period beneath it.

That time is a three-hour step rather than a peak located to the minute, because
that is MOP's resolution. `ConditionsNotes` now says so, since it sits directly
under a tide time that _is_ a turning point.

**The now-card carries today's peak beside the measurement**, which reverses
decision 1 of the triage brief and the first version of ADR-0016. The reasoning
is in that ADR, which was rewritten rather than amended because it had not
merged. What made the ADR's earlier reasoning survivable is that the mitigation
was already built: two stat groups, two labelled attributions, one group never
spanning two sources. Moving the collision onto one card made that machinery
load-bearing rather than precautionary.

**The wording for how a MOP line is named moved into `src/components/mopLine.ts`
before the second consumer existed**, rather than after the two had drifted.
`ProvenanceLine`'s docstring records what the alternative looks like.

**Measured rather than reasoned about**, which the original plan could not do
because no browser was available in the checkout: at 1536×639 the seven day
cells come out at exactly 225px each, two lines in the wave cell, no day
wrapping where its neighbours do not. On a 375px viewport the wave cell stays
one line, the break being scoped to `lg`.
