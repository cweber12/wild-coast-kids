# The conditions tool, built in this repo (issue #48)

Date: 2026-08-17.

## Problem, from the reader's point of view

A parent leading a co-op outing decides on Thursday where to take eight children
on Tuesday. They want to know whether the tide will be low enough for the
tidepools, whether the surf is small enough for kids in the water, how cold the
water is, and whether anything is posted at that beach. Today they assemble that
from a surf app, a tide table and a county web app, none of which agree on units
or on how old their numbers are.

`/conditions` and the landing-page teaser both carry a reserved slot promising a
tool. `CONTEXT.md` says it is "built separately and embedded here", and the slot
says _"Drop the URL and it embeds here automatically."_ There is no URL to drop.

The naive fix is to render whatever a weather API returns for a beach name. That
produces plausible-looking wrong numbers, and the audience is people taking
children into the ocean. The upstream discipline in this plan is ported from
`cweber12/socal-coastal-data`, which exists because coastal feeds rot quietly:
NDBC 46235 serves HTTP 200 on its station page and 404 on its data feed, having
stopped publishing on 2026-05-03; asking NOAA CO-OPS for local time and tagging
the result UTC ages every reading by 7–8 hours; the Tijuana River is published in
m³/s by one agency and ft³/s by another.

## Solution

A native conditions view. The reader picks a beach; the page shows what is
actually known about it now, plus a forward panel built only from products that
genuinely forecast. Every figure carries its observation time. Nothing computes a
verdict about safety.

The tool is built **in this repo**, not embedded — see
`docs/adr/0009-conditions-is-native-not-embedded.md`.

## Implementation decisions

### Extent and the location list

**82 beaches**, seeded from an authority rather than typed by hand. The statewide
Beach Detail Information resource names 82 with `County = 'San Diego'`, which the
county's own beach map corroborates as "approximately 80 beaches from Camp
Pendleton to the US/Mexico border". It carries `Beach_Name`, `BeachType`,
`WaterBodyType`, `WaterShedName`, `BeachAccess`, `NearestCityName`,
`AttendanceSummer`, `USEPAID` and `Status`, so the inclusion predicate is data
rather than judgement: public access, active, counted as a beach.

Read it from the CNRA portal, which names the State Water Resources Control
Board as publisher:
`https://data.cnra.ca.gov/dataset/beach-advisories-postings-and-closures-and-beach-water-quality-monitoring`,
resource `cc674e59-036c-45c3-bec2-5d3d294e0e3d`. The data.ca.gov copy
(`fcbc9250-06e3-437d-b0c6-3cc5ddde93fc`) is byte-identical in content and is
recorded as the mirror.

Two things about this source are pinned because they will bite otherwise:

- **A beach is a segment, not a point.** Coordinates arrive as
  `Beach_UpperLat`/`Beach_UpperLon` and `Beach_LowerLat`/`Beach_LowerLon`. Every
  nearest-station join must state which end it joined from, and the marine
  protected area test becomes a segment-versus-polygon question — a beach can
  straddle a boundary, which a point cannot.
- **One field is named `Beach_ UpperLon`, with an embedded space.** That is
  upstream's, reproduced verbatim, and asserted on read.

### Bindings are joined, never hand-populated

Every resolved value comes from a join against an upstream authority and is
committed with enough provenance to re-run it: tide station (carrying the
open-coast versus bay-side role — 9410230 serves the open coast, 9410170 is bay
only, and confusing them yields a wrong tide curve), buoy primary and fallback,
water-quality station with its distance in metres and a suspect flag past 1000 m,
marine protected area with type and CCR section, and the NWS grid and zones. One
re-join script per binding, each exiting nonzero when a match moves.

The one field written by hand is the join's own scope, because no upstream
authority can state which beaches this repo chose to ask about.

### What is fetched, and its contract

| Product                              | Serves                             | Horizon         | Contract facts, measured                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ---------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CO-OPS predictions                   | tides                              | years           | `time_zone=gmt`, `units=english`, `datum=MLLW`. Returned timestamps carry no offset. Serves `{"error":{...}}` under HTTP 200 — a dead response, not a payload.                                                                                                                                                                                                                             |
| NDBC `realtime2`                     | waves, water temp                  | now             | 19-column pinned header. Wave height in metres, `WTMP` in °C. On 46254, `WDIR`, `WSPD`, `GST`, `ATMP`, `VIS` are all `MM` — so wave and water temp yes, **wind and visibility no**. A reading older than 180 minutes is reported unknown.                                                                                                                                                  |
| NWS `/points` → `/gridpoints`        | wind, air temp, sky                | 7 d             | Resolve `gridId`/`gridX`/`gridY` once per beach and commit it, so an NWS re-grid appears as a diff. Self-identifying User-Agent required. **Publishes no visibility**: the key is present and its `values` array is empty at every grid in the county, measured 2026-08-18. `/points` 301-redirects on coordinates finer than four decimals and returns no marine zone.                    |
| NWS `/stations/{id}/observations`    | visibility, wind, air temp, sky    | now             | `wmoUnit:m`, `wmoUnit:degC`, `wmoUnit:km_h-1`, asserted per field. Visibility tops out at ten statute miles, published as 16093.44 m or 16090 m, so the ceiling is a floor. A station that stops publishing serves `{"value": null}` rather than dropping the key. Only 9 of the 56 candidates in the county publish visibility, and the two nearest the default beach are not among them. |
| NWS active alerts                    | hazards                            | now             | An empty `features` array is a valid empty response, not a failure.                                                                                                                                                                                                                                                                                                                        |
| NWS surf zone forecast, SGX          | rip current risk, surf, water temp | ~3 d            | Two zones cover the whole extent: `CAZ043` San Diego County Coastal and `CAZ552` Orange County Coastal. Measured 2026-08-17: rip current risk "Moderate", surf 2 to 4 feet, water temperature "65 to 73 degrees", tides quoted at La Jolla. Already °F and feet.                                                                                                                           |
| CO-OPS `water_temperature` @ 9410230 | swimmers                           | now             | `&date=latest`. A real station reading where the SRF gives a county range.                                                                                                                                                                                                                                                                                                                 |
| SCCOOS ERDDAP                        | water science                      | trailing weekly | Columns are `time,Temp,Salinity,Avg_Chloro,Pseudo_nitzschia_seriata_group` — capitalised `Temp`; `temperature` exists on no SCCOOS dataset. A 404 carrying "no matching results" means the query was valid and the window empty.                                                                                                                                                           |
| iNaturalist                          | education                          | trailing 14 d   | One request per beach on its own coordinates and radius, never a corridor bbox: the bbox needs ~12 pages and ~144 MB and still misses coastal sites, where per-beach requests total ~142 kB. HTTP 422 is a rejected query, not an empty one.                                                                                                                                               |
| CDFW ds582 marine protected areas    | tidepoolers                        | dated snapshot  | Content date 2019-01-01, layer last edit 2024-01-09 — both recorded. `Type` is a join result, never string-matched off the name. Publisher disclaimer: "not intended for navigational use or defining legal boundaries."                                                                                                                                                                   |
| Beach advisories archive             | water quality                      | historical only | See below.                                                                                                                                                                                                                                                                                                                                                                                 |
| Daylight                             | all                                | any             | Computed in-repo. There is no sun API here and there should not be.                                                                                                                                                                                                                                                                                                                        |

**The surf zone forecast is zone-level.** Its values render identically at all 82
beaches, so it is presented as what the county forecast says, never as a reading
at this beach. Zone forecast and station reading are different provenance and are
never blended into one figure.

### There is no live beach advisory feed, and the plan says so

Measured on 2026-08-17, by calling each source:

| Source                                     | State                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Statewide advisories, CNRA and data.ca.gov | Machine-readable, San Diego covered — 4,353 rows, **newest 2026-03-03**                            |
| Statewide bacteria results                 | 385,313 San Diego rows, **newest 2025-09-09**                                                      |
| County open-data portal                    | Three beach assets, data last updated 2020-02-19, 2020-04-09 and 2023-03-23                        |
| County public ArcGIS, `DEH` folder         | One GPServer, **no advisory layer**                                                                |
| `sdbeachinfo`                              | An OutSystems app; internal `screenservices` endpoints, no public API, 403 to programmatic clients |
| EPA BEACON 2.0                             | Oracle APEX app, no documented API, and fed by the state anyway                                    |

Every county in the statewide archive tops out in early March 2026, so the
167-day lag belongs to the dataset rather than to one portal — two independent
portals serving identical rows is the evidence.

So the water-quality panel **states that live advisory status is not available
here, links to the county as the authority, and shows one dated historical fact**:
how often this beach was posted between 2010 and 2026-03-03, with the window
named. A beach posted forty times is not the same place as one posted twice, and
that is a fact about the beach rather than about today.

The two portals serialise the same column differently —
`2026-03-03T00:00:00` on CNRA, `3/3/2026 12:00:00 AM` on data.ca.gov. The format
is pinned per portal and asserted, not assumed.

### Judgements are relayed, never computed

Rip current risk is a forecaster's published judgement, quoted verbatim and
attributed. "Safe for kids today" would be this site's judgement, and the only
numbers available to found it on are author estimates: the source repo's swell
ceiling is one uncalibrated figure standing in for reefs of differing exposure.
Facts are described in plain language; the sole computed value is the low-tide
window, whose input is an astronomical prediction rather than an estimate.

### Presentation

Tide **timing first, height second**, with the datum explained once in plain
words — a minus sign in front of a tide height reads as an error to a reader who
has not met MLLW. Feet, °F, mph, 12-hour local time. The dropdown groups the 82
beaches by region rather than listing them flat.

An unavailable reading gets one plain sentence for the reader and the exact
upstream reason behind a disclosure. Three states stay visibly distinct: a fresh
reading, a station that has gone quiet, and no station covering this beach at
all — which will be the common case, and which must never render as a blank a
reader can read as calm.

Above the readings, a standing notice: these are readings from public
instruments, not a safety assessment, and lifeguards and posted signs on the day
are the authority.

### The landing page is a teaser, not the tool

A stop is 540px and content that does not fit is a bug in the section. The
teaser keeps its heading, its copy and its pill to `/conditions`, and gains at
most the beach selector and a headline reading. The tool lives on its own page.

### Caveats reach the reader, enforced

Data files carry an `unresolved` array and a gate row fails when an entry has no
path to a reader. This is what lets the list be comprehensive and honest at the
same time: a beach whose water-quality station is unresolved can still ship,
because the page says it is unresolved.

## Test seams

- **Parsers are pure and offline.** One per upstream product, taking bytes and a
  request contract, returning typed values or raising. Tested against captured
  payloads committed as fixtures — evidence, not source. This is the seam that
  makes unit strings, timezone labels and column headers assertable without a
  network.
- **Fetching, caching and failure policy sit in one module** above the parsers,
  so a parser cannot know about retries and a component cannot make a request.
- **Joins are scripts with committed outputs**, so the seam is a diff: perturb a
  match and the re-join exits nonzero.
- **The zone-versus-station provenance distinction is a type**, not a convention,
  so blending a county forecast into a station reading fails to compile.
- Rendering is asserted the way this repo already asserts it: the reading is
  reachable and labelled, and an unavailable reading renders its sentence rather
  than an empty node.

## Slices

In order, with dependencies. Grouped into pull requests at dependency
boundaries, because five slices or ~400 lines is the reviewable limit.

**PR A — the decision record (this issue, #48)**

1. This plan file, as its own first commit.
2. ADR 0009 and the `CONTEXT.md` amendment: the glossary stops describing an
   embed. The reserved slots are not touched — they come out when there is
   something to put in their place.

**PR B — the tracer bullet**

3. One beach, one reading, end to end: a locations file with a single entry, the
   CO-OPS parser, the fetch module, and `/conditions` showing today's low-tide
   time. This slice is where Next 16.3's caching API is read out of
   `node_modules/next/dist/docs/` and pinned; until then, every revalidate
   figure in this plan is `TODO(verify)`.
4. The full inventory and a chooser: 82 beaches seeded with provenance, tide
   station joined, region-grouped selector.
5. Caveats reach the reader, with its gate row. Lands here because slice 4 is
   where the first unresolved binding appears.

**PR C — the readings the site already promises**

6. Waves and water temp from NDBC: buoy binding with fallback, the 180-minute
   limit, substitution disclosed, and the "no water temp at this buoy" state,
   which is measured rather than hypothetical.
7. Split after measurement; see the 2026-08-18 addendum.
   - **7a.** Visibility, wind, air temp and sky from the NWS **observation
     station**, joined on measured delivery. Until this lands, two of the four
     words in "Surf · Tide · Wind · Visibility" have nothing behind them.
   - **7b.** The gridpoint's wind, air temp and sky, which are a forecast and
     therefore belong with the forward panel in slice 8 rather than beside a
     reading.

**PR D — planning and safety**

8. The forward panel: tide predictions, NWS forecast and daylight, labelled
   forecast, with observed-only products absent rather than blank.
9. Safety layer: active alerts, the surf zone forecast relayed verbatim and
   attributed, and the standing notice.

**PR E–G — the rest**

10. Water quality: the statement, the link, and the historical posting count.
11. Marine protected area rules with the CDFW disclaimer attached, then
    iNaturalist sightings, text only.
12. The weekly probe, the re-join scripts, and the dead/revived registry.
13. The landing-page teaser inside its stop budget.

Each data-integrity rule lands in `CLAUDE.md`'s project invariants **in the slice
that earns it**, with what it cost, rather than as a documentation slice at the
end that nobody reads.

## Considered and rejected

**Embedding an externally hosted tool**, as the reserved slots describe. Rejected
in ADR 0009; the short form is that an iframe cannot inherit the stop budget or
the tokens, and the safety notice has to live in the page rather than inside the
frame.

**Embedding `socal-coastal-data` itself.** Cheapest path to something on the
page. It renders a different corridor against a tidepool-and-surf framing, and it
ships the computed verdicts this audience is the reason to avoid.

**A computed verdict per audience** — a green, amber or red badge for tidepooling
or swimming. The best user experience by a distance, and the thing a parent
actually wants. It would make an uncalibrated author estimate into a green light
for children in the water at 82 beaches nobody here has stood at. If this is ever
wanted, calibration comes first and the thresholds come after.

**Scraping `sdbeachinfo` for live advisory status.** The only route to a live
posting. Undocumented POST endpoints on a low-code platform that already refuses
generic clients, with no stability contract, on a public-health datum where a
plausible-looking wrong answer is the worst available failure.

**Hand-typing the location list from a map.** Faster than a seeded join, and the
error bar and origin of every coordinate would then be unknown and untraceable.

**A Google Sheet or a CMS for the locations.** The friendliest editing surface,
and it puts values that upstream authorities own somewhere with no join, no
diff, no check and no provenance.

**Hiding unavailable sections** for a cleaner page. A missing section reads as
nothing-to-report, which turns "no water-quality data for this beach" into
"water quality is fine".

## Out of scope

- Any beach outside San Diego County. Crossing the county line changes the health
  agency, and eventually the NWS office.
- Computed safety verdicts, per above.
- iNaturalist photos: per-image licensing, revisited after the text layer ships.
- The tidepool floor elevations and the calibration pipeline from the source
  repo. Those rest on lidar work with no counterpart here.
- Accounts, saved beaches, notifications.
- Replacing the reserved slots, which belongs to the slices that fill them.

## Verification

Verification means calling the endpoint. For each product: capture the real
payload as a committed fixture, parse it offline in a test, and record the
measured freshness, the unit strings and the timezone label. For each binding:
run the join, commit the result with its distance and flags, and confirm the
re-join exits nonzero when a match is perturbed. Per-station coverage is measured
rather than assumed — 46254's empty wind and visibility columns were found by
reading a captured row, and the same check applies to every buoy bound to any of
the 82 beaches.

## Open questions

1. **Which buoys serve the northern county and the bays, and which of them
   populate wave height?** The source repo's inventory ends at Oceanside
   Offshore, and its southern spots already fall back roughly 15 miles across
   differing exposure because 46235 is dead.
2. **What tide station serves the lagoons and Mission Bay?** 9410230 is open
   coast, 9410170 is bay only, and the lagoons are neither.
3. **Does SCCOOS still cover anything in San Diego County beyond Scripps Pier?**
   If not, the water-science panel is one location's data and must say so rather
   than render blank elsewhere. **Answered — no. See the 2026-08-18 slice 7a
   addendum.**
4. **Next 16.3's caching API.** Every revalidate interval here is provisional
   until slice 3 reads the shipped documentation. **Answered — see the addendum.**

## Addenda

### 2026-08-17 — what slice 3 settled, and what it changed

**Open question 4 is closed.** `next.config.ts` does not set
`cacheComponents`, so the previous caching model applies and `next: { revalidate }`
is the right mechanism after all. Three facts came out of the shipped docs that
the plan had wrong or unstated:

- **`fetch` is not cached by default in Next 16**, a change from earlier
  versions. Every request must opt in explicitly or it reaches upstream on every
  render. The plan's revalidate table was written as though caching were the
  default and opting out were the exception; it is the other way round.
- **A route-segment `revalidate` must be statically analyzable** — `900`, never
  `15 * 60`.
- **Enabling Cache Components is its own decision, not a side effect of this
  work.** It would make Partial Prerendering the default for every route and
  switch client navigation to React's `<Activity>`, preserving component state
  across the gallery and the nav. That belongs in an ADR of its own if it is ever
  wanted.

**A new constraint the plan did not anticipate: the clock cannot be read during
render.** `react-hooks/purity` rejects `Date.now()` in a component, and it is
right — a value that changes between renders makes the render unstable. Since
"which day is today" is exactly a clock read, this reshapes the fetch layer: the
clock is resolved in the data layer beside the fetch, `nowMs` is injectable, and
what reaches a component is a settled value model with no clock in it. The
benefit is that the day-selection rule is now tested against fixed instants
instead of a faked system clock. Every later slice that needs "now" — the
180-minute freshness limit on buoy readings especially — inherits this shape.

**How "today" stays current, and the error that remains.** Predictions are cached
six hours; the page revalidates every fifteen minutes, for the calendar rather
than the tide. The residual error is a window of up to fifteen minutes after local
midnight in which the page still names the previous day. Forcing the route dynamic
would close it and would also, in this version of Next, override every fetch to
`no-store` and reach NOAA on every request. The bounded error is the better trade,
and it is stated in the code rather than left for someone to find.

**`server-only` is not installed, so the enforcement the plan claimed does not
exist yet.** Importing it throws when resolved under jsdom, which would take the
test suite with it until vitest is configured with the `react-server` resolve
condition. Today the guarantee that no upstream request reaches a browser rests on
the module having no client-side importer, which nothing checks. Recorded in
`beaches.json`'s `unresolved` array.

**Scope: slice 3 shipped on its own**, not with slices 4 and 5 as PR B intended.
It came to ~1,500 lines with its tests, which is past the reviewable limit this
repo sets, so the dependency boundary moved: slices 4 and 5 are the next pull
request.

**One thing outside the plan came with it.** Adding seven test files pushed an
existing assertion in `scripts/gate-scope.test.mjs` past vitest's 5-second
default: it constructed a fresh `ESLint` per assertion, and that construction is
CPU-bound. `main` at 30 test files is green; 37 turns it red. Fixed as its own
commit and its own issue rather than folded into the feature, because the number
was never about the assertion.

### 2026-08-18 — open question 2 is answered, and slice 4 ships without slice 5

**Open question 2 is closed, and the plan underestimated it.** It asked what tide
station serves the lagoons and Mission Bay, assuming the two stations the source
repo used. NOAA publishes **nine** tide-prediction stations in the corridor. Eight
deliver; `TWC0405` Point Loma answers HTTP 200 carrying an error object, which is
the failure this stack pins its parser against — a join built from the published
station list without measuring delivery would have bound the middle of the open
coast to a station that never answers.

Station choice is not cosmetic: for the same low tide on 2026-08-18 the eight
working stations predicted between 1.442 and 1.700 ft, across 13 minutes.

**The join rule, decided with Cole.** The nearest _delivering_ station whose water
class matches the beach's, measured from whichever end of the segment is closer.
The water class of a station is hand-written, because NOAA publishes no such
field; it has the standing of a join input rather than a joined value, and it is
what stops an ocean-facing beach near the bay mouth reading a bay tide curve.

**A fourth state exists now, and it is not an outage.** `no-station` is a
permanent fact about a place; `unavailable` is a transient fact about a feed.
Telling a reader to try again later about the first would be telling them to wait
for something that will never arrive.

**Upstream publishes at least one row with transposed coordinates.** "Imperial
Beach pier area" gives an upper longitude of −117.5866 and a lower latitude of
32.1327, against neighbouring rows at 32.5866/−117.1327 — a fifty-kilometre
"beach" running from well offshore to inside Baja California. It is detected and
refused rather than corrected, because correcting it would be inventing a
location. Two checks are needed: a bounding box alone misses an endpoint that
lands in the ocean at a plausible latitude.

**73 beaches, not 82.** The inclusion predicate — Active, PUBLIC, CountAsBeach —
is a filter over published fields rather than a judgement, and it takes the 82
San Diego rows down to 73.

**Slice 4 ships without slice 5**, for the same reason slice 3 shipped alone: size.
`inventoryCaveats()` exists and is tested, and nothing renders it yet — that is
slice 5, together with the gate row that fails when a caveat reaches no reader.

### 2026-08-18 — slice 5 lands, and the "gate row" is two tests

Slice 5 said a gate row that fails when an `unresolved` entry has no path to a
reader. It is **two tests under the existing `test` row** instead, and the
distinction is worth stating because it is a deviation from the plan.

Half the check has to render React to know whether a caveat reached a reader, and
the test runner already does that. A separate row would have had to stand up its
own renderer to assert the same thing, so the row would have been a second way of
running the suite rather than a second check. `test` is a gate row; the guarantee
is unchanged.

The two halves are deliberately in different files, because they guard different
seams:

- `src/lib/caveats.test.ts` walks `src/data/` and asserts nothing is dropped
  between the **files and the loader**. It walks rather than reading a list, so a
  data file added later is discovered instead of forgotten.
- `src/components/ConditionsSection.test.tsx` asserts nothing is dropped between
  the **loader and the reader**.

Both are two-sided. The walk asserts it found files and entries at all, since a
discovery that found nothing would satisfy every other assertion while checking
nothing; and the loader is asserted to show nothing the data files do not carry,
so a caveat cannot be invented in code.

**Demonstrated rather than assumed.** A `src/data/probe-unwired.json` carrying one
caveat and imported by nothing was added; the suite failed with
`probe-unwired.json carries a caveat that nothing loads, so no reader will ever
see it`. Removing the file returned it to green. A check that has never failed is
not yet evidence.

Seven caveats render on `/conditions` today, from two data files.

**This completes the plan's slices 3 to 5.** Slices 6 onwards — waves and water
temp, wind and visibility, the forward panel, the safety layer, water quality,
the education layer, the weekly probe, and the landing-page teaser — are
unstarted.

### 2026-08-18 — slice 6, and wind stops being optional

**Ten delivering wave buoys**, measured one at a time against `realtime2` rather
than read off `activestations.xml`, which lists nineteen stations in the box.
Every delivering one publishes `WVHT`, `DPD`, `MWD` **and `WTMP`**, so waves and
water temperature arrive in a single fetch.

**No nearshore buoy publishes wind or visibility — none of the ten.** Slice 3 saw
this on 46254 and recorded it as one station's quirk; across the corridor it is
categorical. The only station in the box with wind, 46086, is twenty-seven
nautical miles offshore and publishes no waves. So slice 7 is not an enhancement:
two of the four words in the site's own "Surf · Tide · Wind · Visibility" can only
ever come from the National Weather Service gridpoint forecast.

> Corrected 2026-08-18 by the slice 7a addendum below, on two counts. The
> gridpoint publishes no visibility anywhere in the county, so visibility comes
> from an observation station rather than the gridpoint; and 46086 does publish
> waves, on 27 of 48 rows — see #70. Neither changes what slice 6 shipped.

> Corrected again 2026-08-18 by the #73 addendum below, on the count 7a left
> standing. The scope is wrong for wind: 46086 is not the only station in the
> box with wind, and three of the six stations this table's buoy-only filter
> dropped publish it on 82–100% of their rows. Right for visibility, which no
> station in the box publishes at all.

**Two more listed-but-dead stations.** 46273 Torrey Pines Inner and 46235 Imperial
Beach both 404 while listed active — 46235 independently confirming what
`socal-coastal-data` recorded. That is the third time the pattern has appeared,
after `TWC0405` in the tide join, and it is why every station table in this repo
carries a measured `delivers` rather than an inherited one.

**Bay beaches get no wave reading at all**, decided with Cole. The wave join is
deliberately asymmetric with the tide join: the tide has two classes and binds to
the matching one, while every wave buoy is open-coast, so a bay, lagoon or inlet
binds to nothing. 27 of the 73 beaches have no wave height, and their pages say
why. Their water temperature is missing for the same reason and waits for the
surf zone forecast's county-wide range in slice 9.

**The geometry moved out of the tide join first**, into `scripts/geo.mjs`, as its
own commit. Two joins need great-circle distance now, and geometry filed under
either would be found by whoever was not looking for it.

**The parser reads its own units.** Unusually, `realtime2` states them on its
second header line, so `m` and `degC` are asserted rather than assumed — an
upstream switch to feet would otherwise be invisible and would read as a very
calm day.

**Coverage rose to 86.14 / 86.87 / 90.9 / 86.06** and the floor was raised to
match. The new fetch policy is tested by stubbing `fetch` rather than left as
plumbing: what a 404 means, when a reading is too old to be called current, and
which failures are drift are rules, not wiring, and none of them can be asserted
against a live buoy that is having a good day.

### 2026-08-18 — slice 7a, and the gridpoint that has no visibility

**The plan was wrong about where visibility comes from, and slice 6's addendum
repeated it.** Both said wind and visibility "can only ever come from the
National Weather Service gridpoint forecast". Measured by calling
`/gridpoints/SGX/{x},{y}` at four widely separated points, the gridpoint
publishes **no visibility at all** — the key is present, its `values` array is
empty, and it carries no `uom`:

```
Oceanside      SGX/52,36  vis=0  wind=56  temp=74  sky=35
La Jolla       SGX/55,22  vis=0  wind=63  temp=92  sky=34
Mission Beach  SGX/54,17  vis=0  wind=65  temp=91  sky=36
Imperial Beach SGX/57,8   vis=0  wind=58  temp=85  sky=36
```

Visibility is an **observation**, served by `/stations/{id}/observations/latest`.
That reclassifies the work: the gridpoint is a seven-day forecast, and PR C is
where the site's promised _readings_ live. So slice 7 split. 7a is this slice —
the observed reading. 7b is the gridpoint, folded into slice 8's forward panel,
where forecast provenance is already the frame and the plan's rule against
blending a forecast into a reading is already enforced by a type.

**The listed-but-dead trap, a fourth and fifth time.** Of 163 candidate stations
across the 35 distinct grids the 73 beaches resolve to, 159 answered and **only
24 published a visibility value** — every one an airport METAR. Inside the county
box: 56 candidates, **9 publish visibility**, 46 answer perfectly without it, and
`KF70` 404s while listed. The two stations nearest the default beach, `D3101` and
`MSDSD`, are both in the 46. A nearest-station join would therefore have bound
this site's visibility promise to a station that has never published one, which
is why the join filters on measured `publishes_visibility` rather than on
distance alone. It also means one station supplies all four values, so the panel
never blends two provenances.

The join produces KSAN 36, KNKX 14, KCRQ 11, KOKB 5, KSDM 5, KNFG 1, and no
station for the one beach whose coordinates upstream publishes transposed —
the same beach the tide and wave joins already refuse. Median distance 7.3 km,
farthest 16.8 km.

**This join is deliberately not asymmetric the way the wave join is.** Every
beach binds a station, bays and lagoons included: ocean swell does not propagate
into enclosed water, and air does. Making the two joins symmetric out of a sense
of tidiness would silently strip wind and visibility from twenty-six beaches, so
`weather-join.test.mjs` asserts a bay beach binds.

**Ten miles is a ceiling, not a measurement**, decided with Cole. METAR stops
there, and the nine stations publish it as either 16093.44 m or 16090 m, so an
equality test against one spelling would let the other render as a measurement.
The parser carries `visibilityAtCeiling` out as a flag rather than leaving the
view to rediscover it from a magic number, and the view renders "10 miles or
more".

**Open question 3 is answered: no.** SCCOOS ERDDAP lists 35 datasets, four inside
the county box, and only the Scripps Pier pair still delivers:

```
HABs-ScrippsPier   32.867  -117.257    newest 2026-07-13  ALIVE (Temp 21.9)
SPATT-ScrippsPier  32.867  -117.257    (Scripps Pier)
delmar_salinity    32.93   -117.32     newest 2022-05-18  DEAD, no temperature column
pH-AHL             33.1425 -117.3275   newest 2021-01-06  DEAD
```

`delmar_salinity` carries no temperature column at all, and `pH-AHL` — a SeapHOx
in Agua Hedionda Lagoon, which would have been the one instrument inside any of
the lagoons — stopped in January 2021. The water-science panel is one location's
data and must say so rather than render blank elsewhere, exactly as the question
anticipated. `HABs-ScrippsPier`'s newest sample is 35 days old against a trailing
weekly product, which is its own thing to watch.

**One thing outside this slice came with it.** `wave-buoys.json` records that
46086 "delivers wind and water temp but no waves". Measured twice, it publishes
`WVHT` on 27 of 48 rows and the newest row carried 1.6 m; the buoy reports on a
shorter cycle than it measures waves, and a single read lands on an `MM` row
about a third of the time. Nothing renders it — 46086 is bound to no beach — but
the sentence reaches a reader through the caveats gate. Filed as #70 rather than
folded into this diff.

**Coverage rose to 88.1 / 88.66 / 92.48 / 88.12** and the floor was raised to
match. Raising it surfaced a real gap rather than a bookkeeping one: `document()`
was only ever exercised with a single beach, so its `reduce` and `sort`
callbacks never ran and "the farthest beach from its station" was asserted by
nothing. That test now builds two.

### 2026-08-18 — #70, and the field that outlived its reason

**46086 publishes waves.** The claim that it does not was measured a third time
against `https://www.ndbc.noaa.gov/data/realtime2/46086.txt`, the endpoint this
site reads, over the whole file rather than a window:

```
rows          : 6482 (newest 2026 08 18 06 00 UTC)
WVHT present  : 27 / 48 newest      3567 / 6482 whole file (55%)
WSPD present  : 48 / 48             6446 / 6482
WTMP present  : 47 / 48             6281 / 6482
VIS  present  :  0 / 48                0 / 6482
```

The gap is a cadence, not an absence. `WVHT` lands on exactly two rows in three —
the rows at `:00` and `:30` are `MM` — and the values repeat in pairs, so a
slower wave cycle is being carried on ten-minute met rows. A single read has
about a one-in-three chance of landing on an `MM` row, which is how "no waves"
was arrived at honestly and recorded wrongly.

Everything else in the entry survived the re-measurement: 46086 does publish wind
and water temperature, publishes **no** visibility anywhere in 6,482 rows, sits
twenty-seven nautical miles offshore, and is bound to no beach.

**The false clause was in six places, not one.** `_what_was_measured` and
`unresolved[2]` in `wave-buoys.json`; the `publishes_waves: false` datum itself;
and three code comments — `wave-join.mjs`, `wave-join.test.mjs` and
`beaches.ts` — each restating "carries no wave height at all" as the reason the
field exists. Correcting the caveat alone would have left five copies of the
thing the caveat was corrected for.

**`publishes_waves` was invented for a belief that turned out false.** The field
exists to give the join a second filter beside `delivers`, and the only station
it was ever meant to exclude was 46086. With the measurement corrected, no
station in the table fails it on its own terms: `delivers && publishes_waves`
became equivalent to `delivers`, and 46086's exclusion needed a reason it did not
have.

**Decided with Cole: redefine the field, do not change the join.** The
`_schema` entry now says what the join actually uses the field for — whether the
station's wave height is one a beach may bind to — and 46086 carries `false` with
its real reason, distance, alongside the measured `WVHT` ratio so the number and
the exclusion are never again the same sentence.

Two alternatives were rejected:

- **Flip the field to `true` and change nothing else.** Verified against all 73
  beaches: no binding changes today, because every open-coast beach has a
  nearshore buoy closer than twenty-seven nautical miles. But it makes 46086 an
  eligible wave source held out by distance alone, and 46235 and 46273 have
  already died. If 46232 Point Loma South follows them, a south-county beach
  reaches twenty-seven miles offshore for a height that describes different
  water, and nothing in the repo would say so.
- **Flip the field to `true` and add an eligibility rule** — an explicit
  out-of-corridor flag as a second condition in the join's filter. The honest
  shape, and where this goes if a second out-of-corridor station ever appears.
  Rejected now because it changes the join to express something one station
  needs, and the issue that raised this put the join out of scope. The
  redefinition leaves that door open: the field's meaning is already
  "bindable", so the rename is all that would be left to do.

**What the regression test can and cannot do.** It asserts the caveat's sentence
through `inventoryCaveats()`, the seam the caveats gate already walks — the claim
cannot silently revert. It does not assert the ocean: a gate must not fetch NDBC,
so nothing in CI notices if NOAA changes what 46086 publishes. The measurement
above is the evidence for the sentence; the test only holds the sentence still.

### 2026-08-18 — #73, and the wind that never had to come from a forecast

**The sentence 7a corrected was false a second way, and this is the count that
mattered.** Slice 6's addendum concluded:

> two of the four words in the site's own "Surf · Tide · Wind · Visibility" can
> only ever come from the National Weather Service gridpoint forecast

7a corrected the _source_ — an observation station, not the gridpoint — and left
the _scope_ standing. The scope is right for visibility and wrong for wind.

**The premise was a claim about ten buoys, read as a claim about the box.**
`wave-buoys.json` said "NOT ONE publishes WDIR, WSPD or VIS" and named 46086 as
the only station in the box with wind. `activestations.xml` lists **nineteen**
stations in that box; the table holds the **thirteen** of type `buoy`. The six
omitted are of type `fixed`, two of them at Scripps Pier, and the criterion that
dropped them is recorded in no code — nothing generates the station tables, so
`--check` re-runs the join and can re-derive nothing about their membership.

Measured 2026-08-18 against `realtime2`, the endpoint the table's own provenance
names:

```
LJAC1  Scripps Pier   10739 rows   WSPD 10673 (99%)   WDIR 10089 (94%)   VIS 0
LJPC1  Scripps Pier    1088 rows   WSPD  1088 (100%)  WDIR  1008 (93%)   VIS 0
TIXC1  Tijuana River   4401 rows   WSPD  4401 (100%)  WDIR  3610 (82%)   VIS 0
```

Wind is therefore available from this network, at the shore. Visibility is not,
anywhere in it: 0 of 15,228 rows across the three and 0 of 6,482 on 46086. That
is the half of the original clause that has survived every re-measurement.

**What the false half cost.** It is why the air panel reads an airport.
`weather-stations.json` filters on `publishes_visibility` before distance because
one station was required to supply all four values, and "wind can only come from
the weather service" is what made that requirement look free rather than
expensive. At La Jolla Shores it binds KNKX Miramar at 10.43 km while LJAC1 sits
1.38 km from the sand; on 2026-08-18 the two read 81 °F and 72 °F nine minutes
apart.

**This slice changes no behaviour.** It corrects `wave-buoys.json`'s
`_what_was_measured`, the caveat in its `unresolved` list that a reader actually
sees, and this document. The binding itself is #80, whose plan is
`docs/plans/coastal-air-observations.md` and whose ADR 0010 records the
two-provenance decision the measurement above makes possible.

The regression test asserts the corrected caveat through `inventoryCaveats()`,
the seam the caveats gate already walks. As with #70 it holds the sentence still
and not the ocean: a gate must not fetch `realtime2`, so nothing in CI notices if
NDBC changes what these stations publish. The measurement above is the evidence;
the test only stops the claim reverting silently.
