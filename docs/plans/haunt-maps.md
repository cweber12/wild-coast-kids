# Haunt maps: a detailed map for the places worth the walk

Planned 2026-09-19. In flight.

> A programme plan, not a slice plan. It fixes the direction, the order and what
> was rejected for six sub-projects. **It deliberately prescribes no figures for
> work that has not started** — frame sizes, payload budgets, contour steps and
> ADR numbers are re-derived when each sub-project begins, because a value
> written months ahead of its code is stale by the time anyone reads it. Each
> sub-project gets its own issue, and its own plan file only if it turns on a
> choice someone will question later.
>
> Touches `docs/plans/map-weather-readout.md`, which is also in flight: its
> unbuilt third part (#194, the animated field) is deferred behind this work
> rather than cancelled. Rewrites what #121 promises. Neither file is edited
> here.

## The problem, from the reader's side

Reviewed by Cole on 2026-09-19. Three complaints about the shore map:

1. **It is hard to connect the picture to the real place.** The map is a traced
   line and a flat tint. Nothing on it is named — no pier, no street, no stairs
   — and nothing on the page leads from it to the actual beach.
2. **It does not show enough.** A 272–472px square in the day panel's side
   column cannot carry more than it does.
3. **The wind and swell readings are too small and easy to miss** under the
   picture. If the map grows, they belong inside it.

And four things a homeschool family going tidepooling, to the beach or
snorkelling wants that the map does not show: where the tidepools are, where the
water's edge is at a given hour, which animals turn up, and where taking things
is prohibited.

## The solution

**Two maps with two jobs.**

**The shore map stays small and becomes an honest locator.** It gains authored
landmarks, a county inset showing where this frame sits, an "Open in Maps" link,
and a larger readout — still under the picture, because ADR-0034's measurements
still hold at that size. ADR-0033, ADR-0038 and ADR-0051 stand for it unchanged.

**A new page per _haunt_ carries the detail.** A haunt is an authored, named
place inside a beach that is worth the walk — a tidepool bench, a snorkel cove,
a stretch of sand. Its page is a full-width map framed tightly on it, at
`/conditions/<area>/<beach>/<haunt>`, under the existing conditions layout so
the selected hour (ADR-0035) reaches it for free. On that map:

- **the land is an aerial photograph and the sea is drawn.** The photograph
  makes the place recognisable; the existing sea wash, more opaque, covers the
  photograph's water. See _What was probed_ for why the photograph's sea cannot
  be shown;
- authored landmarks and access points, as HTML outside the `role="img"`;
- the wind and swell readout **inside** the map, over the drawn sea, in a corner
  the haunt's own entry names;
- then, one sub-project at a time: marine protected areas, substrate, what lives
  here and when, and — if its spike passes — a water line that follows the
  selected hour.

The beach page lists its haunts. A beach with none has no haunt page.

## What was probed, 2026-09-19

Read-only requests from a scratch directory; nothing was committed. Every figure
below is a reading on that date, not a constant.

**Beach segments are the wrong frame for imagery.** End-to-end length from
`beaches.json`: 17 of 51 at or under 500 m, 27 at or under 1 km, 14 over 2 km —
and the long ones are most of the tidepool coast (`sunset-cliffs-park` 2.5 km,
`la-jolla-shores-beach` 3.3 km, `la-jolla-community-beach` 5.1 km,
`torrey-pines-state-beach` 6.0 km). This is the measurement that makes the haunt
necessary.

**NAIP aerial imagery works, with three defects.** USGS
`imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage`
returned a 944px JPEG of about 160 KB for an arbitrary `bbox` in EPSG:4326, no
key. Public domain (`TODO(verify)` the exact credit line USGS asks for).
`projectionFor` is linear in each axis, so a `bbox` requested at the frame's
own aspect registers with the SVG by construction — no reprojection.

- At a 0.7 km frame the place is unmistakable. At 2.2 km, on a 342px phone map,
  it is texture. Imagery pays only at a haunt's scale.
- The photograph's sea is unusable: a hard flight-line mosaic seam runs across
  the water, and it was flown at an arbitrary tide with surf over the reef. So
  the drawing supplies the sea. This also means a drawn water line can never
  contradict a photographed one.
- **Not yet measured:** how far `shoreline.json`'s edge sits from the
  photograph's. `traced-shoreline.md` measured tens of metres against another
  source, and 20 m is about 13px on a 0.7 km frame. Spike 1.

A low-tide photograph would serve a tidepool haunt far better. No public-domain
source is known. `TODO(verify)`; not designed around.

**iNaturalist: the past week is empty and the long record is rich.** Within
500 m of La Jolla Cove — the best case in the county — 34,431 observations all
time, 79 in the last 14 days, and **0 molluscs** in the last 14 days against
1,242 all time. 14 observations carry taxon-obscured coordinates. By licence:
2,765 allow commercial use, 24,884 are non-commercial, 6,673 reserve all rights.
An `obscured=true` filter returned the unfiltered total, so that parameter is
not honoured and nothing was learned from it.

**A water line has a published datum chain and a resolution problem.** CO-OPS
`mdapi/.../stations/9410230/datums.json` gives MLLW 4.37 ft and NAVD88 4.56 ft
on one station scale (epoch 1983–2001), so a prediction in MLLW converts to
NAVD88 by subtraction. NOAA NCEI's `DEM_mosaics/DEM_all` ImageServer holds, at
the Cove, a 2012 "San Diego" DEM at one-third arc-second (about 10 m) stating
NAVD 88. On a transect off Scripps Park the whole 1.6 m tide range was crossed
between two samples 26 m apart: on a steep cove the line would move two pixels.
A flat bench would show it, coarsely. Finer coastal lidar is believed to exist
as a bulk download needing offline GDAL. `TODO(verify)`. Spike 2.

## Decisions

**A haunt is authored, like an area (ADR-0046).** `haunts.json`, hand-written by
Cole and Lena: name, slug, parent beach, centre, frame, kind, its landmarks, and
the corner with open water for the readout. A gate row checks every parent
exists and every frame holds its centre. The parent beach supplies every
reading; a haunt binds no station of its own. "Haunt" because `CONTEXT.md`
already spends _site_, _spot_ and _location_ as words to avoid for Beach.

**Labels are authored too.** A dozen-odd haunts and 18 areas can each name their
own few landmarks. No OpenStreetMap extract, so no ODbL share-alike obligation
and no extraction pipeline — and the labels are the ones a local would say.

**The photograph is committed, not fetched.** A script writes one image per
haunt from the haunt's own frame; the page serves a file. The map still reads no
feed and still renders on the server. ADR-0025 stands: no library is added.

**Marine protected areas are worded so that absence is not permission.** State
marine reserves prohibit all take; conservation areas allow some; and collecting
in tidepools is restricted along the whole coast regardless
(`TODO(verify)` against CDFW's regulations before any copy is written). A map
that shades "no taking here" says "taking is fine there". The page says _look,
don't take_ everywhere, and names the reserve where there is one. The reserve's
type comes from a join against CDFW ds582, never from its name
(`conditions-tool.md`). Every beach gets the sentence before any haunt gets the
polygon.

**Substrate draws the rock; the haunt names the pool.** Substrate is not
tidepools — riprap is rock. CDFW ds3115 is the named candidate
(`TODO(verify)`: endpoint, licence, size, as `map-weather-readout.md` already
lists).

**Sightings answer "what lives here, and when", not "where in the frame".** A
committed per-haunt snapshot: species of interest, all-time counts, a
twelve-month strip. Refreshed by the weekly probe (ADR-0022). Worded as ADR-0031
already requires — reported by naturalists, not surveyed. One conditional line,
"seen in the last 14 days", appears only when it has something to say. Counts
are facts and need no licence; **photographs are out of scope** until it is
settled whether this site is commercial, since 8% of records would survive if
it is.

**The water line is drawn only on rock, and only if Spike 2 is honest.** Sand
moves metres with the season and wave run-up is not in a tide prediction.
Substrate therefore gates where a line may be drawn, which is why it comes
first.

## Test seams

Agreed per sub-project when it starts. The ones visible from here:

- `haunts.json` is checked by a gate row, as `areas.json` is by
  `scripts/check-areas.mjs`.
- Frame and registration arithmetic stays in `src/lib/coastline.ts` and
  `shore.ts`, pure and callable without rendering — the seam `corner.test.ts`
  used.
- Each layer is a pure function from committed data and a frame to plot-unit
  geometry, asserted without the DOM; the component only draws.
- Every layer has a text equivalent outside the `role="img"`, asserted by role
  and name as `BeachPins` is.
- **The gate renders no dynamic route** (`generateStaticParams` returns `[]`).
  Nothing local proves a haunt page renders. Sub-project 2 must say how it is
  proven, not assume the build does it.

## Spikes, before anything is built

Throwaway. Nothing merges. Each ends in a recommendation.

1. **Registration.** Does the traced shoreline land on the photograph's edge?
   Three haunts, measured in pixels at the narrowest map width. If it does not,
   sub-project 2 needs a better edge for haunt frames before it needs anything
   else.
2. **Water line.** One flat bench. Contour the 10 m DEM and the finer lidar at
   the same tide heights, lay both on the photograph, and look.

## Sub-projects, in order

Each is one or more pull requests, each end to end.

| #   | Sub-project                | Ships                                                                                                       | Needs      |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | The shore map as a locator | Open in Maps; authored landmarks; county inset; a larger readout. `CONTEXT.md`'s stale entries, separately. | —          |
| 2   | One haunt, end to end      | `haunts.json` with one verified haunt, its gate row, the route, the beach page's list, the photograph map.  | Spike 1    |
| 3   | Marine protected areas     | The sentence on every beach page, then the boundary on haunt maps.                                          | 2          |
| 4   | Substrate                  | The ds3115 probe, then rock, sand and flat on haunt maps.                                                   | 2          |
| 5   | What lives here            | The snapshot, the month strip, the conditional recent line. Replaces the reserved slot; rewrites #121.      | 2          |
| 6   | The water line             | Committed contours per rocky haunt; the selected hour picks one.                                            | 4, Spike 2 |

1 and 2 are independent. 3, 4 and 5 are independent of each other. That is the
test `CLAUDE.md` sets for splitting into issues, and it passes.

ADRs sub-project 2 will need: the haunt as a concept; a photograph under the
drawing (for the haunt map only — ADR-0033 stands for the shore map); the
readout inside the haunt map (ADR-0038 stands for the shore map). Sub-project 3:
the wording rule. Sub-project 5: an amendment to ADR-0031. Sub-project 6: the
datum chain.

## Out of scope

- **Cabrillo.** The county's best-known tidepools are not in an inventory bound
  by water-quality monitoring (ADR-0011). Whether to add a beach for them is its
  own question.
- **The spatial sightings layer.** Phone GPS is 5–50 m; at a haunt's scale a
  heat map mostly draws the stairs. Revisit once sub-project 5 shows which
  haunts hold hundreds of records.
- **The animated field (#194).** A haunt map has the room the shore map lacked.
  Revisit after sub-project 2.
- **Negative-tide marks on the week grid** for beaches with a tidepool haunt.
- **Sighting photographs**, pending the commercial question.
- **`probe-coastline.mjs` is absent from the weekly probe registry.** Noticed,
  not fixed here.

## Considered and rejected

**A tile library (MapLibre, Leaflet).** Gives pan and zoom, which is what "not
enough detail" usually asks for. Rejected by Cole's own reading of the failure:
nothing is named, it does not look like the place, and nothing leads to the real
one — none of which is "it does not behave like a map". Every argument ADR-0025
records against a charting library applies, and it is the costliest choice to
leave, because every later layer would be written against its API.

**Growing the shore map inside the day panel.** One page, one map. Rejected: it
reopens ADR-0038, ADR-0051 and every measurement taken in a 555px stop, and
makes every reader who came for the tide pay for a photograph.

**Layer toggles in the existing square.** The smallest change. Rejected: four
layers in 342px is one layer's worth of legibility.

**One detailed map per beach, framed on its segment.** No new concept. Rejected
by the segment lengths above.

**Long beaches cut into computed panels.** Nothing authored, full coverage.
Rejected: the cuts are arbitrary, a reef can straddle two, and nothing says
which panel is the good part — which is what the reader came for.

**An OpenStreetMap extract for labels.** Rejected above: a licence obligation
and a pipeline to label a few dozen places two people already know by name.

**Showing the photograph's sea.** Rejected by the probe: a mosaic seam and an
arbitrary tide.

**A "seen this week" sightings map, as #121 and the reserved slot promise.**
Rejected by the probe: zero molluscs in fourteen days at the best haunt in the
county. It survives as one conditional line.

## Draft haunt candidates — unverified

**Drafted by an agent from general knowledge on 2026-09-19 and confirmed by
nobody.** Every name, every "where" and every parent is `TODO(verify)` until
Cole or Lena has corrected it. Parents were checked only by comparing an
approximate latitude against the segment ends in `beaches.json`. No reserve
membership is claimed here on purpose: that is a join result. This list is
scaffolding for `haunts.json`, which is the record; corrections go there, not
here.

| Candidate                       | Kind     | Where, roughly                                       | Parent beach (by latitude)             |
| ------------------------------- | -------- | ---------------------------------------------------- | -------------------------------------- |
| Flat Rock                       | tidepool | foot of the Beach Trail, south Torrey Pines          | `torrey-pines-state-beach`             |
| Dike Rock                       | tidepool | north of Scripps Pier                                | `la-jolla-shores-beach`                |
| La Jolla Shores, Kellogg Park   | sand     | the main lifeguard tower and lawn                    | `la-jolla-shores-beach`                |
| The Marine Room shallows        | snorkel  | south end of the Shores; leopard sharks, late summer | `la-jolla-shores-beach`                |
| La Jolla Cove                   | snorkel  | the cove itself                                      | `la-jolla-cove`                        |
| Shell Beach pools               | tidepool | below the south end of Scripps Park                  | `shell-beach`                          |
| South Casa / Wipeout pools      | tidepool | south of the Children's Pool wall                    | `south-casa-beach-s-d`                 |
| Hospitals Reef                  | tidepool | off Coast Blvd, south of Wipeout                     | `whispering-sands-nicholson-pt`        |
| Windansea                       | sand     | the shack, foot of Nautilus St                       | `windansea-beach`                      |
| Bird Rock                       | tidepool | foot of Bird Rock Ave                                | `bird-rock-nr`                         |
| False Point / Tourmaline pools  | tidepool | north end of Tourmaline                              | `tourmaline-surfing-park`              |
| Ocean Beach Pier pools          | tidepool | foot of the pier, south side                         | `ocean-beach`                          |
| Ladera Street pools             | tidepool | foot of the Ladera St stairs                         | `sunset-cliffs-park`                   |
| Coronado, in front of the Hotel | sand     | Central Beach                                        | `coronado-central-beach`               |
| Imperial Beach Pier             | sand     | foot of the pier                                     | `imperial-beach-municipal-beach-other` |

Open for Cole and Lena: whether the Children's Pool belongs as a fourth kind
(seal watching, with its seasonal closure); whether any Mission Bay or San Diego
Bay beach holds a haunt at all; and which of these you would actually send a
family to.

## Addendum — 2026-09-19: one map that zooms, and no drawn sea over a photograph

Two things changed the same day the plan was written, before any code. Both are
recorded here rather than by rewriting the sections above, which stay as the
record of what was first decided and why.

### What Spike 1 found (#261)

Three 700 m frames — La Jolla Cove, Bird Rock, La Jolla Shores — with
`shoreline.json` projected over a NAIP export of the same box.

**Registration holds.** A box square in metres, longitude carrying the cosine of
the mid-latitude, requested in EPSG:4326 at a square pixel size, puts the traced
line on the photographed coast's shape in all three frames with no reprojection.

**"The land is a photograph and the sea is drawn" does not hold.** The traced
shoreline is a terrestrial boundary, as it has always said of itself: at Bird
Rock it runs along the back of the bench, 40–60 m from the photographed water;
at the Shores it runs through the middle of the dry sand, 60–80 m from the
swash; at the Cove it is mostly within 5–15 m and steps 20–30 m over open water
at the point. A wash closed on it would paint the Bird Rock bench — the
tidepools — as sea. Figures read from the overlays' scale bars; the spike's
automatic edge detector misfired and its numbers are not to be quoted.

**And the rejection of the photographed sea was wrong at this scale.** The
mosaic seam was in a 2.2 km frame; none of the three 700 m frames has one, and
the photographed water is the most informative part of the Bird Rock picture.
A seam is a per-haunt check when the photograph is cut.

### What Cole asked next, and what the probe said

"What if, instead of haunts, users can just zoom in?" A haunt does two jobs:
it frames tightly enough for a photograph to pay, and it curates — names the
good part of a long beach and gives the sightings, substrate and water-line data
something to be keyed by. Zoom replaces the first job and not the second.

Probed the same day:

- USGS `basemap.nationalmap.gov/.../USGSImageryOnly/MapServer` serves 256px
  Web Mercator tiles, public domain, no key, `max-age=86400`, 40–100 ms each —
  **and stops at level 16**, about 2 m per pixel here. Levels 17–19 return 404
  although the service advertises lods to 23. At 2 m the Bird Rock bench is 25
  pixels wide and, in that vintage, under glare: a neighbourhood, not a
  tidepool.
- The NAIP ImageServer that does reach 0.3 m renders on request: five tile-sized
  exports took 0.5, 0.6, 0.9, 6.3 and 8.9 s. Unusable live.

Cole's reasons for asking were that the authored list felt heavy and that people
will expect to pinch a map. Not that detail is wanted everywhere — which would
have meant paid tiles and was not chosen.

### Decisions, superseding the ones above where they conflict

**One map that pans and zooms, used at three scales.** An area page opens it on
the area, a beach page on the beach, a haunt page on the haunt: one component,
three initial views, different words beside it. The shore map in the day panel
is untouched by this and is still sub-project 1's locator; it links in.

**Free USGS tiles are the ground, to their ceiling.** The map page now reads a
feed from the reader's browser, which the shore map never did. If tiles fail the
pins and layers still draw, and the page says the imagery is unavailable rather
than showing a grey square in silence.

**A haunt supplies the detail the tiles cannot.** Its photograph is cut ahead of
time at fine resolution in Web Mercator, committed, and laid into the same map
as a georeferenced overlay, so zooming in on a haunt sharpens and zooming in
anywhere else stops at the tiles' ceiling.

**A haunt slims to a line**: name, point, kind, parent beach. Its frame defaults
to a square about the point and may be overridden. Landmarks and a readout
corner leave the haunt's entry — the first because the tiles show the streets,
the second because of the next decision.

**No sea wash and no traced shoreline on this map.** Spike 1's finding, made
moot as well as decided: a tile map has neither.

**The readout is a fixed corner panel inside the map.** ADR-0034 rejected a
fixed corner because it covered the coast; a reader who can pan is not held to
what a corner covers. It needs a ground behind it over imagery, measured from
painted pixels.

**Leaflet carries the panning and zooming.** 1.9.4, BSD-2-Clause, no
dependencies of its own, 42.7 KB of script and 3.5 KB of styles gzipped
(measured), loaded only on map pages. This needs an ADR, and the ADR's argument
is that ADR-0025's reasons are about plots: "the largest thing drawn is a few
hundred points" is no longer true of this map; panning cannot happen on the
server whoever writes it; Leaflet draws DOM — image tiles, SVG, focusable
markers — not the canvas ADR-0025 objects to; and it is one package, not the
first module of six. **ADR-0025 stands for every chart and for the shore map.**
The new rule is narrow: a map that pans and zooms may carry a library.

**Leaflet is kept at the edge.** Every layer is a pure function from committed
data to shapes in longitude and latitude, asserted without Leaflet or the DOM.
One component touches the library. Leaving it means rewriting that component.

### Considered and rejected, in this addendum

**Hand-rolled panning and zooming.** The repo's habit. Rejected: gesture code —
the pinch centre, one-finger pan against page scroll, momentum — works at a desk
and fails on a phone, and no gate row can see it. It would be a small map
library maintained here.

**Zoom by buttons that are links**, every view drawn on the server. No library.
Rejected: the reason for zooming at all was that people expect to pinch.

**Paid tiles to full depth everywhere.** What a reader expects of a map, and
what "detail everywhere" would need. Not chosen: an account, a key, a provider's
terms, and every layer drawn at every scale. Reopen it if the 2 m ceiling
between haunts turns out to be the complaint.

**Zoom instead of haunts.** Rejected by the tile ceiling and by the second job.

### What this does to the order

Sub-project 2 becomes "one zoomable map and one haunt, end to end" and is no
longer blocked by Spike 1, which is done. Sub-projects 3–6 draw into the same
map and their data is positioned in longitude and latitude rather than into a
fixed frame. Marine protected areas, a dozen small polygons county-wide, need no
haunt to be drawn; substrate, sightings and the water line are still cut and
keyed per haunt. Sub-project 1 is unchanged except that its link leads here.

## Addendum — 2026-09-19 (second): the map first, haunts and sightings last

Cole, once the issues were open: haunts and species sightings come last.

That is a change of order and not of design, and it is possible only because of
the first addendum. With a fixed-frame haunt page the haunt _was_ the map; with
one map that pans and zooms, the map stands without any haunt in it.

### The order now

| #   | Sub-project                 | Needs                                          |
| --- | --------------------------- | ---------------------------------------------- |
| 1   | The shore map as a locator  | —                                              |
| 2   | The map that pans and zooms | —                                              |
| 3   | Marine protected areas      | 2, for the boundary; nothing, for the sentence |
| 4   | Substrate                   | 2                                              |
| 5   | The water line              | 4 and Spike 2 — and see below                  |
| 6   | Haunts in the map           | 2                                              |
| 7   | What lives here, and when   | 6                                              |

Sub-project 2 splits in two: the map is 2 and the haunts are 6. The tracer
bullet is now "one beach opens in a map that pans and zooms", with beaches as its
pins.

### What this costs, said plainly

**Until sub-project 6 the map stops at the free tiles' ceiling — about 2 m a
pixel, a neighbourhood and not a tidepool.** Of Cole's three complaints, "hard
to connect to the real place" is answered by sub-projects 1 and 2; "does not
show enough" is answered only in part until the haunts bring their fine
photographs. That is the trade being made, knowingly: the map, the reserves and
the rock arrive sooner, and the detail arrives last.

**Substrate can no longer be cut to haunt frames**, because there are none when
it is built. It is cut to a corridor along the inventory's coast instead, and
its size is a question for its own probe. Drawn at 2 m a pixel it is a
classified shoreline rather than a shaded bench; it sharpens for free when the
haunts arrive.

**Whether the water line can come before the haunts is for Spike 2 to say.** On
a wide bench the line moves tens of metres — 5 to 25 pixels at the tiles'
ceiling — which may be legible; on a steep shore it will not be. If the spike
finds it only reads over a haunt's fine photograph, sub-project 5 moves behind
6 and this table is amended again. It is not decided here.

**Sightings stay keyed by haunt**, which is why they are last and not merely
late. The alternative — keying them by beach so they could come earlier — blends
Hospitals and Bird Rock into one list along a 5 km "beach", which is the thing
the haunt exists to prevent.

Nothing in _Decisions_ or in the first addendum is withdrawn.
