# Sky from the grid, and visibility gone

Closes the question ADR-0012 held open. The decision is
[`docs/adr/0020-sky-leaves-the-card-for-the-week.md`](../adr/0020-sky-leaves-the-card-for-the-week.md);
this plan is how it gets built. Issues #95 and #91.

## The problem, from the reader's point of view

A parent opens a beach page to decide whether to take children to the coast
tomorrow. The air card tells them the sky at that beach is "Mostly Cloudy" and
visibility is over ten miles.

Neither statement is about that beach. Both were measured at an airport — a
median of 7.9 km away across all 45 served beaches, and beyond 10 km for 20 of
them. `docs/reference/sensor-representativeness.md` §7 puts ceiling and
visibility alone among the surface variables at **not transferable**, and §12
names transferring aerodrome ceiling and visibility off-field as an
anti-pattern to refuse.

It is also inconsistent between neighbours in a way no disclosure covers.
Measured 2026-08-26, four beaches inside one 2.5 km square were told opposite
things:

| beach                    | sky station     | what it said    |
| ------------------------ | --------------- | --------------- |
| La Jolla Community Beach | KNKX at 11.0 km | "Mostly Cloudy" |
| WindanSea Beach          | KNKX at 13.5 km | "Mostly Cloudy" |
| Bird Rock (NR)           | KSAN at 11.7 km | "Clear"         |
| Tourmaline Surfing Park  | KSAN at 10.3 km | "Clear"         |

Each sentence is individually true, which is why the existing disclosure does
not help.

Afterwards: the week grid carries a cloud-cover forecast for this beach's own
grid cell, saying "fog" on the days fog is forecast, and the card carries
temperature and wind and nothing else.

## The upstream contract, measured rather than remembered

Probed 2026-08-26 against `api.weather.gov` over all 45 served beaches and both
ends of each segment. 89 of 90 ends resolved, into 21 distinct cells, all in
office `SGX`.

**Two requests, not one.** `/points/{lat},{lon}` resolves a coordinate to a
cell. `/gridpoints/{office}/{x},{y}` returns the forecast and the cell's own
polygon and mean elevation. There is no catalog to probe: unlike MOP lines or
observation stations, a cell is derived per beach rather than drawn from a
published table, so **this binding gets no data table of its own.**

| variable        | cells carrying values            |
| --------------- | -------------------------------- |
| `skyCover`      | **21 of 21**, 34–37 entries each |
| `visibility`    | **0 of 21**                      |
| `ceilingHeight` | **0 of 21**                      |

`visibility` and `ceilingHeight` are declared keys with empty `values` arrays at
every cell. `skyCover` is `wmoUnit:percent` on 3- and 6-hour steps across a
`P7DT13H` window.

Fog is in the `weather` product as an occasional phenomenon, not a series: in
three cells read in full, 12 entries each, 6 named a phenomenon — `fog` ×4,
`rain_showers` ×2 — and 4 carried a visibility figure of 1.609 km.

Failure vocabulary to pin:

| condition                       | response                                |
| ------------------------------- | --------------------------------------- |
| coordinate outside the NWS grid | `404` `problems/InvalidPoint`           |
| cell retired or re-gridded      | `404` on `/gridpoints`                  |
| variable this site asks for     | present as a key with an empty `values` |

That last row is the one to be careful about: **a declared key is not a
populated one.** A parser checking `"skyCover" in properties` would pass while
the feed carried nothing.

## The join, measured

Cells are 2,512–2,525 m by 2,501–2,522 m. Beach coordinate to the centre of its
own cell, over 89 ends: min 103 m, p50 999 m, p90 1,615 m, max 2,043 m.

**A beach is a segment and 17 of 45 straddle two cells**, so an end must be
chosen. Distance cannot choose it — every point inside a cell is equally inside
it — so the criterion is the cell whose mean elevation is nearest sea level.
Over all 89 ends the p50 elevation is 2.1 m; five beaches have an end above
50 m, and the criterion fixes two of them:

| beach                    | best end                  | worst end                 |
| ------------------------ | ------------------------- | ------------------------- |
| Del Mar City Beach       | upper, `SGX/55,26`, 22 m  | lower, `SGX/55,25`, 102 m |
| La Jolla Shores Beach    | lower, `SGX/54,21`, 0 m   | upper, `SGX/55,22`, 117 m |
| Torrey Pines State Beach | upper, `SGX/55,25`, 102 m | lower, `SGX/55,22`, 117 m |
| Torrey Pines City Beach  | both ends `SGX/55,22`,    | 117 m                     |
| La Jolla Cove            | both ends `SGX/54,20`,    | 106 m                     |

The three that remain are served with the bluff named in the provenance line.
ADR-0020 records why, and records that the elevation proxy is weaker evidence
than ADR-0011's instrument distances.

**Border Field State Park's lower end returns `InvalidPoint`** — it is south of
the border. Its upper end resolves to `SGX/57,7`. The join takes the resolving
end and records that the other had none.

## What is being built

1. A `grid_cell` binding on each beach, with the cell id, the end it was
   measured from, the cell's mean elevation, and a null reason when absent.
2. A parser, a fetcher and a read for the gridded forecast, following the shape
   `mop-forecast.ts` / `fetchMopForecast` / `readWaveWeek` already established.
3. A cloud-cover row in the week grid, replacing the gridded `ReservedRow`.
4. The removal of sky and visibility from the air card, and of the
   `sky_station` binding that fed them.

## The one thing not yet decided

**ADR-0017 says every row leads with the extreme that falls in daylight** —
"Lowest daylight tide", "Biggest daylight swell" — and carries the day's own
extreme beside it.

Cloud cover has no extreme in that sense. It is a field sampled every three
hours, not an event with a peak. "Cloudiest daylight hour" would let a single
90% step make an otherwise clear day read as overcast; "clearest" misleads the
other way.

**Recommendation: the daylight mean, labelled "Cloud by day", with no secondary
figure.** It is the representative value rather than an extreme, which is a
deliberate departure from ADR-0017 on the grounds that ADR-0017's argument is
about _when a thing happens_ — a low tide at 3 AM is unreachable — and cloud
cover does not happen at a time. The fog annotation carries the "when" instead,
since that is the part of the sky a reader plans around.

This wants settling before slice 4. If the answer is instead an extreme, the row
label changes and nothing else does.

## Test seams

Agreed before starting, because they decide whether any of this can be
verified.

- **`parseGridpointForecast(payload, cell)`** — pure, offline, asserted against
  a committed JSON fixture captured from a real response. Pins `skyCover`'s
  `wmoUnit:percent`, the ISO-8601 interval form of `validTime`, and the
  `weather` entry shape. **Asserts that a key present with an empty `values`
  array is treated as absent**, which is the specific trap this feed sets.
  Raises `NwsGridpointDriftError` for a shape or unit change and
  `NwsGridpointNoDataError` for a cell that answered with nothing usable.
  Existing seam shape: `parseMopForecast`, `parseNwsObservation`.
- **`fetchGridForecast(cell)`** in `lib/upstream.ts` — names its own
  `next.revalidate`, never throws, turns every failure above into an
  `unavailable` carrying its reason and URL. Existing seam shape:
  `fetchMopForecast`.
- **`readSkyWeek(slug, nowMs)`** in `lib/conditions.ts` — `nowMs` injected, so
  day selection and the daylight window are asserted against fixed instants and
  no clock is read during a render. Existing seam shape: `readWaveWeek`.
- **`bindGridCell(beach, resolvedEnds)`** in `scripts/grid-cell-join.mjs` —
  pure, no network, called with already-resolved cells so the elevation
  criterion and the `InvalidPoint` case are both asserted offline. Existing
  seam shape: `bindMopLine`.
- **`SkyWeek`** — a cell, not a row, because the grid is day-major. Existing
  seam shape: `WaveWeek`.

The join script's own HTTP calls stay outside a seam, for the reason
`probe-observation-stations.mjs` gives about its own: it is not a gate row and
its output is the committed binding.

**A fixture-fed test only fails if it reads real data.** The parser fixture is a
captured payload rather than a hand-written one, and the empty-`values` case is
asserted from the real thing, because that is the assertion most likely to be
written to pass rather than to check.

## Slices

Three PRs, split at the binding boundary and again at the deletion. **The
ordering constraint is load-bearing: the deletion must not merge before the row
exists**, or the site ships an interval with no cloud information at all. The
reverse overlap — both the row and the card's sky live for a while — is
acceptable and is the "beside" arrangement ADR-0016 already permits.

**PR 1 — the binding.**

1. **Bind each beach to its grid cell.** `scripts/grid-cell-join.mjs` resolves
   both ends, chooses by cell elevation and records the choice;
   `seed-beaches.mjs` wires it; `beaches.json` gains `grid_cell`,
   `grid_cell_from_end`, `grid_cell_elevation_m` and `grid_cell_null_reason`;
   `beaches.ts` gains the type and `gridCellFor`.

**PR 2 — the reading and the row.**

2. **Read a gridded forecast for a beach.** Parser and fixture, fetcher, and
   `readSkyWeek` — a complete path from the network to a view model, verified
   without touching the network.
3. **Put cloud cover in the week grid.** `SkyWeek` renders a cell; `WeekPanel`
   composes the row and drops the gridded `ReservedRow` in the same change; the
   provenance line names the office, the cell and — at the three bluff beaches —
   that the cell spans the shore and the bluff above it.

**PR 3 — the deletion.**

4. **Take sky and visibility off the air card.** `skyStats`, the sky
   `StatGroup`, its `ProvenanceLine`, `SkyState` and `readSkyHalf` all go;
   `ConditionsNotes`' "Sky and visibility" entry is rewritten to say why the
   site publishes neither.
5. **Retire the sky binding.** `sky_station`, `sky_station_distance_m`,
   `sky_station_from_end` and `sky_station_null_reason` leave `beaches.json`;
   `sky-join.mjs` and its test go; `skyStationFor` goes; the parser's `sky`,
   `visibilityMi` and `visibilityAtCeiling` fields go. **`publishes_sky` stays**
   — it is a measurement of the network, not a join result, and it is the
   evidence ADR-0020 rests on. `CONTEXT.md` retires the "Sky station" term in
   this slice, because this is where it stops being true.

Slice 2 depends on 1. Slice 3 depends on 2. Slices 4 and 5 depend on 3, and 5
depends on 4.

## Considered and rejected

Recorded in full in ADR-0020: replacing the card's sky with the gridded value;
filling the row and leaving the card alone; keeping visibility on the card
alone; two rows rather than one; cloud cover with no fog relay; reading a
neighbouring sea-level cell at the bluff beaches; and making ADR-0012's hold
permanent.

One rejection belongs here rather than there, because it is about build order:

**Deleting the card's sky first, then adding the row.** Smaller PRs and the
anti-pattern goes sooner. Rejected: it leaves an interval with no cloud
information anywhere on the site, which is the churn ADR-0012 warned costs a
reader twice.

## Out of scope

- **Temperature and wind.** They come from the air station at p50 3.7 km and
  max 7.4 km. ADR-0012 records them as among the best-founded readings here and
  ADR-0019 declined to decide whether a model may displace a published
  measurement. Nothing in this plan touches them.
- **The surf zone forecast**, which is the other reserved row.
- **The 10 km inventory bound** (ADR-0011) and the modelled-source tolerance
  (ADR-0019). No beach enters or leaves the inventory here.
- **A terrain tolerance for the bluff cells.** ADR-0020 records it as the remedy
  if the judgement to serve them turns out wrong. It is not built now.
- **The row's glyph.** The gridded `ReservedRow` carries 💨 under ADR-0015
  because it was once about wind. Whether a cloud row wants a different glyph is
  a design decision in that ADR's vocabulary, and it is settled in slice 3 with
  a human looking at it rather than assumed here.
