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

| Product                              | Serves                             | Horizon         | Contract facts, measured                                                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CO-OPS predictions                   | tides                              | years           | `time_zone=gmt`, `units=english`, `datum=MLLW`. Returned timestamps carry no offset. Serves `{"error":{...}}` under HTTP 200 — a dead response, not a payload.                                                                                                   |
| NDBC `realtime2`                     | waves, water temp                  | now             | 19-column pinned header. Wave height in metres, `WTMP` in °C. On 46254, `WDIR`, `WSPD`, `GST`, `ATMP`, `VIS` are all `MM` — so wave and water temp yes, **wind and visibility no**. A reading older than 180 minutes is reported unknown.                        |
| NWS `/points` → `/gridpoints`        | wind, visibility, air temp, sky    | 7 d             | Resolve `gridId`/`gridX`/`gridY` once per beach and commit it, so an NWS re-grid appears as a diff. Self-identifying User-Agent required.                                                                                                                        |
| NWS active alerts                    | hazards                            | now             | An empty `features` array is a valid empty response, not a failure.                                                                                                                                                                                              |
| NWS surf zone forecast, SGX          | rip current risk, surf, water temp | ~3 d            | Two zones cover the whole extent: `CAZ043` San Diego County Coastal and `CAZ552` Orange County Coastal. Measured 2026-08-17: rip current risk "Moderate", surf 2 to 4 feet, water temperature "65 to 73 degrees", tides quoted at La Jolla. Already °F and feet. |
| CO-OPS `water_temperature` @ 9410230 | swimmers                           | now             | `&date=latest`. A real station reading where the SRF gives a county range.                                                                                                                                                                                       |
| SCCOOS ERDDAP                        | water science                      | trailing weekly | Columns are `time,Temp,Salinity,Avg_Chloro,Pseudo_nitzschia_seriata_group` — capitalised `Temp`; `temperature` exists on no SCCOOS dataset. A 404 carrying "no matching results" means the query was valid and the window empty.                                 |
| iNaturalist                          | education                          | trailing 14 d   | One request per beach on its own coordinates and radius, never a corridor bbox: the bbox needs ~12 pages and ~144 MB and still misses coastal sites, where per-beach requests total ~142 kB. HTTP 422 is a rejected query, not an empty one.                     |
| CDFW ds582 marine protected areas    | tidepoolers                        | dated snapshot  | Content date 2019-01-01, layer last edit 2024-01-09 — both recorded. `Type` is a join result, never string-matched off the name. Publisher disclaimer: "not intended for navigational use or defining legal boundaries."                                         |
| Beach advisories archive             | water quality                      | historical only | See below.                                                                                                                                                                                                                                                       |
| Daylight                             | all                                | any             | Computed in-repo. There is no sun API here and there should not be.                                                                                                                                                                                              |

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
7. Wind, visibility, air temp and sky from NWS gridpoint. Until this lands, two
   of the four words in "Surf · Tide · Wind · Visibility" have nothing behind
   them.

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
   than render blank elsewhere.
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
