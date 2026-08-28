# The conditions day view

Planned 2026-08-28. In flight: #171, #172, #173.

Design record: `.design/conditions-day-view/DESIGN_BRIEF.md` for the problem and
the aesthetic direction, `TASKS.md` for the slices and their test seams. This
file is the decision record — what was decided, and what was considered and
rejected on the way.

## The problem, from a reader's side

A parent leading a co-op outing decides on Thursday where to take eight children
on Tuesday. The page they land on spends its first screen on three large cards
about **this moment** — the tide now, the buoy now, the air now — which is not a
moment anybody is planning for. Below them the week says one figure per product
per day, and stops.

One figure per day is not enough to plan against. "1.6 ft at 3:13 PM" does not
say whether the tide is falling all afternoon or turns at four. Nothing on the
page says which way the wind will blow, ever — wind exists here only as a
measurement of right now. And the overnight extremes are missing from six days
of seven, which ADR-0023 recorded as a debt against a day view that did not
exist yet.

So the page is redundant at the top and thin in the middle. It reports the
present three times and the future once, and the future is what anybody came for.

## The solution

The week leads and keeps its figures; the day opens beneath it; the two are one
instrument at two zoom levels.

Each week cell gains a **sparkline** of the full 24 hours behind the figure
ADR-0023 selected, with night shaded and cloud washed across it. Choosing a day
redraws a **day panel** below: an hourly chart with four tabs — tide, swell,
wind, temperature — where cloud and daylight are drawn on every tab rather than
competing as tabs of their own. Beside it, a **map** of this beach's own coast
carrying a **compass** with two needles, wind and swell. The three cards'
readings move into today's panel, where what was measured sits beside what was
modelled.

## Decisions

**The week grid keeps ADR-0023 intact and this work fulfils it.** ADR-0023
dropped the overnight extremes "until a day view carries them" and deliberately
kept `allDay` on `TideWeekDay` and `WaveWeekDay` in `lib/conditions.ts` so this
work would be cheap. The header window and the daylight-selected figure are
untouched; the sparkline draws the night _behind_ the figure. Anyone reading the
sparkline as a reversal of ADR-0023 has read it backwards, and the ADR written
in #171 must say so in those words.

**Cloud and daylight are layers, not tabs.** They are the conditions the selected
variable happens in, not variables competing with it. This is also what makes the
sparkline and the chart legible as the same instrument: the backgrounds never
change, so only the foreground moves when a tab is chosen.

**A model is drawn; a measurement is stated.** Forecasts are continuous curves
with the model's own published points marked. Measurements are discrete figures
with a station name and a distance. Form carries the distinction before words do,
which is what lets the words be fewer — the previous redesign's honesty layer was
correct and unreadable.

**The swell's coarser cadence is shown, not written.** CDIP publishes every three
hours; tide, wind and cloud are hourly. The curve is drawn smoothly and each
published point is marked, so the model's real resolution is visible without the
day looking artificially blocky.

**The compass sits on the map**, because a bearing is meaningless without a coast.
280 degrees is a number; 280 degrees over a drawn shoreline is "the wind is coming
off the water."

**The map stops being a stand-in.** `mop-lines.json` already traces the county
coast in 1,210 points at about 98 m spacing, and every station file carries
coordinates, so a real map costs no dependency and no upstream request. It draws
this beach's coast, its own segment, and the four sources every figure comes from
at their real distances — ADR-0010's requirement drawn instead of written. The
sighting layer from #121 stays reserved: what is coming is the sightings, not the
map.

**One dial may carry two provenances.** `StatGroup`'s contract is one group, one
source. This breaks it deliberately, following `WeekGrid` — which already holds
NOAA, CDIP and this repo on one grid and resolves it with a provenance line per
row rather than by splitting the component.

**No charting dependency.** Hand-rolled SVG against the three runtime
dependencies this repo guards.

## Test seams

Agreed before starting, and chosen at the highest point each will sit.

- **The parsers stay the seam they already are** — pure, offline, asserted
  against committed payloads with no network. The hourly tide contract and the
  new gridpoint series extend existing files rather than introducing a seam.
- **`DaySpark` and `HourChart` take a series and render it.** Presentational and
  pure, so every branch — including the absent ones — is assertable without a
  network. The series shape is shared between them, which is both the design's
  first principle and the thing that keeps them from drifting.
- **The series assembly lives in `lib/conditions.ts`**, the existing seam, not in
  a component. A component that fetched would be testable only by running the
  whole page.
- **The coastline geometry is a new module in `src/lib/`**, and it is new rather
  than reused: `scripts/geo.mjs` is build-side `.mjs` for the joins, and this is
  runtime TypeScript. Sharing across that boundary would be the wrong seam.
- **The sea-side rule gets a checker script and a gate row**, in the shape
  ADR-0021 established, because it is load-bearing and derived.

## Considered and rejected

The part worth keeping, per `docs/plans/README.md`.

### About the three cards

**Delete them outright.** The simplest layout and the biggest loss. The buoy and
the air station are the only instruments this site reports at all — everything
else here is a model — so deleting the cards would make the site model-only and
would need ADR-0016 revisited or revoked. Rejected. They are merged into today's
panel instead, which removes the slab without removing a measurement.

**Keep a slim now-strip above the week.** Removes the bulk and keeps "now" and
"the week" as separate regions. Rejected: it solves the height and not the
duplication, and it leaves the measured readings sitting apart from the day they
describe, which is exactly what makes them look redundant.

### About the week grid

**Keep the three rows unchanged and treat the day panel as a pure drill-down.**
No ADRs disturbed and PR #170's work untouched. Rejected: the rows summarise
precisely the products the chart below plots, so the page would state each of
them twice in adjacent regions. That is a sharper duplication than the one this
work was asked to remove.

**Compress the week to a bare day strip** — date, daylight and the Today chip,
with every figure moved into the day panel. The shortest option. Rejected: it
throws away cross-day comparison, which is the week's entire job and the
Thursday-planning-for-Tuesday question the grid was built for.

**Leave the detail always showing today, with the week read-only.** Simplest
interaction. Rejected: six days of seven then get no chart at all, and those six
days are the planning question.

**Put the day in the URL so it is shareable.** Genuinely useful. Rejected on
cost: `searchParams` makes the route dynamic, which forfeits `revalidate = 900`
and the empty `generateStaticParams` that together keep upstream load
proportional to real readers rather than to builds.

### About the tabs

**A rain tab.** Rejected on measurement rather than taste: probability tops out
at 15% and accumulation at 0.8 mm across the eight days probed, so it would be a
flat line near zero for most of a San Diego year — a tab that reads as a broken
chart. Rain appears as the publisher's own phenomenon wording instead.

**A cloud tab in addition to the cloud wash.** Rejected: cloud is context for
every series rather than a competitor to them, and a variable drawn twice on one
screen is the duplication this work exists to remove.

**Humidity.** Rejected: 81–92% across the window probed. Flat, and nothing a
reader can act on.

### About the swell's cadence

**Draw it as flat three-hour steps**, so the chart never draws a value the model
did not publish. Maximally honest and the most defensible in isolation. Rejected:
it reads as coarse beside three smooth curves and makes the swell look blocky in
a way the sea is not, which trades one wrong impression for another.

**Draw it smooth and state the resolution in prose.** Cleanest visually.
Rejected: it makes the difference between an hourly and a three-hourly forecast
invisible, which is the fact a reader most needs when the two disagree.

### About the compass

**Two separate compasses, one per source.** Safest under `StatGroup`'s
one-group-one-provenance rule and never mixes cadences. Rejected: the insight is
the _relationship_ — wind from the east is offshore at a west-facing beach and
onshore at an east-facing one — and two dials force the reader to do angle
arithmetic in their head. That is the same failure the previous brief diagnosed
when it said the tide time and the wave height "are three screens apart in
reading order and never appear together." The provenance objection is real and is
answered by `WeekGrid`'s precedent rather than dismissed.

**One dial with the seaward arc shaded from a derived shore normal.** This was
the original recommendation and it does not survive the data. Every beach carries
a `segment` with two ends, which gives a shoreline bearing and therefore two
normals — La Jolla Shores runs 11 degrees, normals 101 and 281. Disambiguating
them by the bound MOP line's bearing **fails**: only 7 of 25 agree within 45
degrees, because a beach binds its _nearest_ line measured from one end, so that
bearing is mostly alongshore. 26 of 51 beaches have no MOP line at all, and
`mission-bay-vacation-isle` has an upper equal to its lower and no bearing at any
confidence. **Do not re-attempt this derivation.** Drawing the coast is what
replaced it, and it is strictly better: the reader sees the shore instead of
trusting a computed normal.

**Needles that follow a hovered or scrubbed hour.** One tightly-linked
instrument, and tempting. Rejected: hover does not exist on touch, the audience
is parents on phones, and a slider is a great deal of machinery for a secondary
reading. The needles show the day's dominant direction with an arc for the range
it swings through — a bare needle would overstate, and the arc is the honesty.

**A third, measured needle on today only.** Model against instrument on one dial,
which is the most compelling thing this page could show. Rejected for now: it
gives today's dial a third needle whose meaning changes depending on which day
was clicked, and two needles that always mean the same thing on all seven days is
worth more than one striking exception. Today's measured wind is stated beside
the dial instead.

### About the layout

**Three columns: chart, compass, map.** Keeps the row short. Rejected — the
compass in a column of its own is wasteful, and it belongs on the map because a
bearing needs a coast.

**Two columns as "when" and "where", with the compass stacked above the map.**
Conceptually the cleanest split. Rejected on measurement: two stacked blocks in
the right column drive the row to roughly 600px, which forces the chart to be far
taller than a chart wants to be. Putting the compass _on_ the map collapses the
problem instead of arranging around it.

### About the process

**A charting library.** Rejected: this repo runs on `next`, `react` and
`react-dom` and guards that budget; the largest series here is 196 points; and
the plot must render server-side.

**Cut PR 1 as "the data"** — hourly tide, gridpoint wind and temperature, series
assembly. This is what the brief originally proposed. Rejected while writing the
task list: it is parsers with no consumer, which is the horizontal slice CLAUDE.md
forbids, it cannot be demonstrated on merge, and it defers the riskiest question
in the design — whether a sparkline reads in a 125px cell — until after the chart,
the map and the compass have been built on top of it. PR 1 is the tide sparkline
end to end instead.

**Defer `shortForecast` again.** ADR-0024 deferred the publisher's own sky wording
and said a day view "is planned that will want that read anyway, and taking it
once, in the shape that view needs, is better than taking it twice." This is that
view. Deferring a second time would be the promise going stale rather than being
kept.

**Write an information-architecture document, and generate a tokens file.** Both
rejected before the brief was written.
`.design/wild-coast-kids-landing/INFORMATION_ARCHITECTURE.md` is the canonical
structure document and this work changes no URL and no navigation; a second
document defining structure is the drift PR #28 and PR #43 already corrected. The
palette is fixed, art-directed and canonical in `globals.css`, so this work adds
a few series colours rather than establishing a system.

## Findings that outlive this plan

**`mop-lines.json` contains 123 duplicate coordinate pairs.** 1,210 lines,
1,087 distinct points, 123 consecutive zero-length segments. Nothing reads that
file geometrically today so nothing is broken, but any polyline drawn from it
must de-duplicate first: a zero-length segment silently corrupts tangents and
side tests, and it already produced one wrong answer during this plan's own
probing. Pinned by a test against the committed count so a data change fails
loudly.

**With duplicates removed, all 13 wave buoys fall on the left of the coastline
walked south to north.** Strong enough to shade water on the map, too
load-bearing to assume — hence the checker.

**The NWS gridpoint publishes far more than this site reads.** Probed live
2026-08-28 at `SGX/54,21`: `windSpeed`, `windDirection`, `windGust` and
`skyCover` each cover 196 hours gapless with zero nulls; `temperature` and
`apparentTemperature` cover 191. `visibility` and `ceilingHeight` remain declared
and empty, so ADR-0020 stands unchanged.

**The committed gridpoint fixture is trimmed to four keys** and cannot exercise
the new series. #172 has to capture a new one.

## Out of scope

The sighting layer (#121). Visibility, in any form. A rain tab. A
water-temperature forecast, which no product publishes for these beaches.
Deep-linking a day. The page header, lead paragraph, safety notice and beach
selector, all of which were measured into position in the previous redesign. The
landing-page teaser. Dark mode. Any judgement about whether conditions are safe.

## Sequencing

Three pull requests, cut at dependency boundaries, each leaving the page working
and the gates green.

1. **#171 — the week learns to draw.** The tide sparkline, end to end.
2. **#172 — the day opens.** The chart, its tabs, the coupling, the merged
   measurements, and the removal of the slab. Blocked on #171.
3. **#173 — the spatial half.** The shore map and the compass. Its coastline
   geometry and checker are not blocked and can run in parallel with #172; the
   compass is blocked on #172's gridpoint wind read.

All three are `needs-human`: each produces an artifact whose success criterion is
that it reads to a person, and no gate asserts that.
