# Design Brief: The Conditions Day View

Date: 2026-08-28. Feature slug: `conditions-day-view`.

Covers the conditions section rendered at both `/conditions` and
`/conditions/[slug]`, which are one component and must not drift apart.

**There is no `INFORMATION_ARCHITECTURE.md` in this folder, for the reason the
previous brief gives.** `.design/wild-coast-kids-landing/INFORMATION_ARCHITECTURE.md`
is the site's single canonical URL-structure document, and this work changes no
URL and no navigation. A second document defining structure is the drift this
repo has corrected twice, in PR #28 and PR #43.

**There is no `DESIGN_TOKENS` file either.** The palette is fixed and
art-directed, canonical in `src/app/globals.css` and recorded in
`.design/wild-coast-kids-landing/DESIGN_TOKENS.css`. This work adds a small
number of series colours to it rather than establishing a system.

**This brief supersedes the "week grid" half of
`.design/conditions-page/DESIGN_BRIEF.md`.** That document stands as the dated
record of the page's first redesign; the parts of it describing three cards and
a week of labelled figures describe a page this work replaces.

---

## Problem

A parent leading a co-op outing decides on Thursday where to take eight children
on Tuesday. The page they land on spends its first screen answering a question
they did not ask.

Three large cards sit at the top reporting **this moment** — the tide right now,
the buoy right now, the air right now. Nobody plans around this moment. Below
them, the week finally answers something useful, one figure per product per day:
Tuesday's lowest daylight tide is 3:13 PM at 1.6 ft.

And there it stops. A single figure per day is the whole of what the page knows
how to say about a day that is not today, and it is not enough to plan against:

- **1.6 ft at 3:13 PM does not say what the afternoon does.** Is the tide falling
  all afternoon, or does it turn at four? The difference decides whether you
  arrive at two or at three.
- **A cloud figure does not say when the marine layer burns off.** ADR-0024 has
  already measured this and found it decisive: every one of the next seven days
  at La Jolla is a burn-off, and Sunday's 46% is the average of a 65% morning and
  a 32% afternoon. Its own decision text says the long form "belongs in the day
  view."
- **Nothing on the page says which way the wind will blow.** Wind exists here
  only as a measurement of right now, from a station. A parent asking whether
  Tuesday afternoon will be blown out has nowhere to look.
- **The overnight figures are simply missing.** ADR-0023 dropped them from six
  days of seven and said so on the page, explicitly "until a day view carries
  them." It kept `allDay` on `TideWeekDay` and `WaveWeekDay` in
  `lib/conditions.ts` for exactly this work. That debt is now nine days old.

So the page is redundant at the top and thin in the middle. It reports the
present three times over and the future once, and the future is what anybody
came for.

The redundancy is worse than it looks, because it is about to become literal.
The week grid's three rows — low tide, swell, cloud — summarise precisely the
products a day view would chart. Left alone, the page would state each of them
twice in adjacent regions.

## Solution

The week leads, the day opens beneath it, and the two are one instrument.

**The week stays at the top and gains shape.** Each of the seven days keeps its
date, its daylight window and its selected figure exactly as ADR-0023 left them,
and gains a **sparkline** behind that figure showing the full twenty-four hours
with night shaded and cloud washed across it. The overnight low that ADR-0023
had to drop is visible again — not as a second figure fighting for a 88px cell,
but as the dip in a curve that is obviously at night.

**The week is also the control.** Choosing a day redraws the detail below it. No
second row of tabs, because seven days twice on one screen is the duplication
this design exists to remove.

**Beneath it, the day opens as two halves — when, and where.**

On the left, an **hourly chart** with four tabs: tide, swell, wind,
temperature. Cloud and daylight are not tabs; they are drawn on every one of
them, because they are the conditions the selected variable happens in rather
than variables competing with it. Night is shaded, cloud is a wash, and the
publisher's own words for the sky — "Patchy Fog then Mostly Sunny" — sit above
the plot in the National Weather Service's vocabulary rather than ours.

On the right, a **map of this beach's own coast**, drawn from the 1,210
coordinates this repo already holds, carrying a **compass rose** with two
needles: where the wind comes from, and where the swell comes from. A bearing
means nothing on its own — 280° is a number. Over a drawn coastline it becomes
the thing a reader actually wants, which is whether the wind is coming off the
land or off the water. The map also marks the four sources every figure on the
page comes from, at their real distances, which is ADR-0010's requirement drawn
instead of written.

**And the three cards stop being a slab and become part of today.** Their
readings are not redundant — the buoy and the air station are the only
instruments this site reports at all, and everything else here is a model. So
they move into the day panel, where today's version carries what was **measured**
beside what was **modelled**, and the other six days carry the model alone.
Today looks different from Thursday because today is different: it is the only
day anybody took a reading.

Nothing is removed. The page stops saying the same thing in two registers and
starts saying twice as much.

## Experience Principles

1. **One instrument at two zoom levels, never two components that echo each
   other.** The tension is that an overview and a detail view of the same data
   duplicate by nature, and the usual fix — make the overview coarser — throws
   away the comparison the overview exists for. The resolution is that the week's
   sparkline draws the _same variable_ as the chart, with the _same layers_, in
   the _same shape_. Switch to the swell tab and all seven sparklines become
   swell. Seven small multiples above, one large one below. The week gets better
   at comparing days, not worse, and it never repeats a sentence the chart is
   about to say.

2. **A model is drawn; a measurement is stated.** The tension is the one the
   first brief named — honesty against legibility — and the previous answer was
   to write the provenance next to every figure until the page read as fine
   print. The resolution is to let _form_ carry the distinction before words do.
   Forecasts are continuous curves, with the model's own published points marked
   so its true resolution is visible. Measurements are discrete figures with a
   station name and a distance. A reader can tell which kind of claim they are
   looking at before reading a word, which is what lets the words be fewer.

3. **Time on the left, place on the right — and direction belongs to place.**
   The tension is that a compass looks like a chart accessory and is not one. Its
   value is entirely relational: wind from the east is offshore at a west-facing
   beach and onshore at an east-facing one, and no dial floating beside a graph
   can say which. So the compass sits on the map, where a coastline makes the
   relationship visible instead of calculated, and the page divides cleanly into
   the question of _when_ and the question of _where_.

## Aesthetic Direction

- **Philosophy**: **Coastal pop editorial**, inherited unchanged — heavy italic
  Montserrat, electric yellow against deep purple and ocean blue, pill shapes,
  rounded cards, generous glyphs. This work adds no second system.
- **The instrument-panel restraint that survives it.** The loud register belongs
  to headings, tabs, chips and glyphs — the furniture. Inside the plot frame the
  page goes quiet: thin strokes, few gridlines, no legend boxes, no drop shadows
  on data. The energy is in the chrome; the data is drawn like a chart in a
  field guide.
- **Tone**: confident and plain. Never alarming, never reassuring — this page
  relays instruments and models and forms no judgement about whether a day is
  safe (ADR-0009).
- **Reference points**: the small-multiple discipline of Tufte's sparklines; the
  quiet line weights and hand-lettered labels of a NOAA nautical chart; a printed
  tide table's willingness to be dense; the hour rows of Windy or Surfline, at a
  fraction of their loudness.
- **Anti-references**: a dashboard of gauges and dials; a weather app's cartoon
  sun-behind-cloud iconography; the default output of a charting library, with
  its gridlines in every direction, boxed legend and hover tooltip; anything with
  a red band, a warning triangle, or a word like "good" or "poor" attached to a
  condition.

## Existing Patterns

- **Typography**: Montserrat, one family, via `next/font/google` in
  `src/app/layout.tsx`. Weight and italics do the work. Two registers, and
  ADR-0014 governs which outranks which: the **display register**
  (`font-black italic`, a size token, `leading-display`) for the `<h1>` and
  region headings — named once as `REGION_HEADING` in `headingRank.ts` — and the
  **label register** (`text-2xs font-extrabold tracking-widest uppercase`, an
  accent colour) for card headings, day headings, stat labels and provenance
  lines. Sizes run `--text-2xs` 10px through `--text-base` 13px, then
  `--text-stat` 36px and the clamped display tokens. **10px is the floor** and
  ADR-0024 already refused to go under it.
- **Colors**: one fixed palette in `globals.css`, no dark mode by decision.
  `--color-ocean` #1a4e8a, `--color-purple` #6b5faa, `--color-purple-deep`
  #5a4f99, `--color-yellow` #e8ff00, `--color-pink` #e8a4b8, `--color-cream`
  #faf8f5, `--color-mist` #f0ebf8, `--color-lavender` #e0d8f0, `--color-dark`
  #1a1a2e, `--color-ink` #1a1a00, and `--color-fog` #6b5f7d, which was darkened
  from the template's value specifically to clear 5:1 on mist.
- **Spacing**: `--spacing-gutter` 48px / 24px small, `--spacing-section` 80px /
  60px small. Radii `--radius-tile` 12, `--radius-thumb` 16, `--radius-box` 20,
  `--radius-card` 24, `--radius-pill` 99. One shadow, `--shadow-card`. Motion
  `--duration-fast` 200ms and `--duration-normal` 250ms.
- **Components**: `ReadingCard` (emoji, heading, figure, prose), `StatGroup`
  (labelled figures under **one** provenance — ADR-0010 turns on that rule),
  `ProvenanceLine` (source, network, distance, note — the single owner of how
  "how far away" is worded), `WeekGrid` with `TideWeek` / `WaveWeek` / `SkyWeek`
  / `DaylightWeek`, `ConditionsNotes`, `Caveats`, `BeachSelector`,
  `ReservedSlot`, `PillLink`, and `TOUCH_TARGET` in `ui/touchTarget.ts` — the
  site's 44px floor below `md` per ADR-0004.
- **Conventions that constrain this work**:
  - Server components by default; the four interactive components in `src/` each
    ship a `noscript` equivalent that does the same job with plain markup.
    `BeachSelector` is the model.
  - Components are grouped by subject, not by layer (ADR-0018).
  - Zero runtime dependencies beyond `next`, `react` and `react-dom`.
  - Tailwind runs `source(none)` scanning only `src/` (ADR-0006), so a utility
    named in a document like this one compiles nothing.

## Component Inventory

| Component                                | Status | Notes                                                                                                                       |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `HourChart`                              | New    | The SVG plot: four tabs, night shading, cloud wash, published-point marks, "now" line on today. Hand-rolled, no dependency. |
| `HourSeries` (lib)                       | New    | Assembles the four hourly series plus the two layers for one day, from reads that already exist plus two new ones.          |
| `DaySpark`                               | New    | The week cell's sparkline. Same layers, same variable, no axes. Draws from the same series `HourChart` does.                |
| `DayPanel`                               | New    | The day's region: heading, sky wording, chart, and today's measured block.                                                  |
| `ShoreMap`                               | New    | Coastline from `mop-lines.json`, this beach's segment, its four source markers at real distances. Pure SVG.                 |
| `Compass`                                | New    | Two needles with spread arcs, rendered onto `ShoreMap`. Provenance line per needle.                                         |
| `MeasuredToday`                          | New    | Water temp, buoy wave height, station wind and gust, station air temp — the merged content of the three cards.              |
| `WeekGrid`                               | Modify | Keeps its columns, header, window line and figures. Gains a sparkline slot per cell and becomes the day selector.           |
| `WeekPanel`                              | Modify | Composes the sparkline series alongside the rows it already builds.                                                         |
| `SkyWeek`                                | Modify | Thirds give way to the cloud wash carried on every sparkline. Its phenomenon line survives.                                 |
| `ConditionsSection`                      | Modify | Loses the three-card grid and the standalone reserved slot; gains the week-then-day order and the new row.                  |
| `TidePanel` / `WavePanel` / `WindPanel`  | Modify | Stop being page-level cards. Their reads move behind the day panel; their content becomes `MeasuredToday`.                  |
| `TideToday` / `WavesToday` / `WindToday` | Remove | Absorbed. Their four-state handling (reading / no-station / unavailable / no-reading) must survive the move intact.         |
| `ReservedSlot`                           | Reuse  | Stays for the sighting **layer**, inside the map rather than instead of it.                                                 |
| `ProvenanceLine`                         | Reuse  | Unchanged. Used per needle, per series and per map marker.                                                                  |
| `ConditionsNotes`                        | Reuse  | Stays at the foot of the page, gaining the new sources' general notes.                                                      |

## Key Interactions

**Choosing a day.** Each of the seven day cells is a control. Activating it
redraws the panel below: chart, sky wording, compass and — on today only — the
measured block. The selected cell is marked in a way that does not rely on
colour alone. Today is selected on arrival. No request is made: every feed here
already returns the whole week in one call, so the client holds all seven days
from the first render, and switching is instant.

**Switching tabs.** Four tabs above the plot. Selecting one redraws the
foreground series and every sparkline in the week above, together — that
simultaneity is the whole point of principle 1, and it is what tells the reader
the two regions are one instrument. The background layers do not change.

**Without JavaScript.** The week grid renders complete and server-side, exactly
as it does today: seven days, their windows, their figures, their provenance.
What is lost is the chart and the day switching, not the forecast. The day panel
renders for today. Following `BeachSelector`'s precedent, the day cells fall
back to markup that still communicates the week.

**Today, specifically.** The panel gains a measured block and a "now" line on
the plot. Both are absent on the other six days, and their absence is stated
rather than left as a gap — a day with no measured block should say that nothing
has been measured about a day that has not happened.

**When a feed is quiet.** Every failure mode already worked out for these
sources survives the move. A missing tide station, an unreachable CDIP, a cell
with no cloud forecast: each already has its sentence and each keeps it. A tab
whose series is unavailable is a tab that says why, not a tab that draws a flat
line at zero. A curve is a stronger claim than a figure, so a drawn zero is a
worse lie here than it was on a card.

## Responsive Behavior

**The week grid keeps the column progression ADR-0023 set** — one, two, four at
`lg`, seven at `xl` — and the sparkline rides inside the cell it already has. At
four columns the week is two rows of 4 + 3, which ADR-0023 took knowingly.

**The day row is two columns at `xl`**: the chart at roughly two thirds, the map
with its compass at one third. The chart needs width because it plots
twenty-four hours; the map is square-ish, and so is the compass on it.

**At `lg` the row stacks**: chart full width, map beneath at a reduced height.
Below `lg` everything is one column, in the order chart, map.

**The chart changes behaviour, not just size, on mobile.** Four tabs at 44px
touch targets do not fit one row at 375px, and hover does not exist, so the plot
carries no hover affordance at any width — every value a reader needs is either
marked on the plot or stated as a figure beside it. This is why the compass reads
the day rather than a scrubbed hour: a design that needed hover would be a design
that worked only on a laptop.

**The sparkline degrades before it lies.** At one and two columns the cell is
wide and short; at seven it is 161px at 1536 and 125px at 1280. A sparkline
narrower than roughly one pixel per published point stops being a shape and
starts being noise, so below that it is not drawn and the cell renders exactly as
it does today. **TODO(verify):** the exact threshold is a measurement to take on
the rendered page, not a number to choose here.

## Accessibility Requirements

- **The chart is data, not decoration, and needs a text equivalent.** The week
  grid is already the text equivalent for the week. The day needs its own: the
  plot carries a description naming the variable, the day, the range and the
  shape, and the figures a reader would take from it are also stated as text.
- **The compass gets a spoken bearing, not a picture of an arrow.** Its
  accessible name states both directions in words and in degrees — "wind from
  the west-northwest, 281 degrees; swell from the northwest, 340 degrees" — with
  the spread stated where it is wide.
- **The two needles must differ in more than colour**, since the whole dial is
  one small graphic. Shape and weight carry the distinction; colour reinforces it.
- **Tabs and day cells are keyboard-operable**, with a visible focus ring. The
  site's ring is defined once in `globals.css` `@layer base` using `currentColor`
  so it stays visible on every surface, and these controls must inherit it rather
  than define their own.
- **44px touch targets** below `md` for both day cells and tabs, via
  `TOUCH_TARGET` rather than a hand-written padding (ADR-0004).
- **Every new colour pair gets measured**, not assumed. `--color-fog` exists at
  its current value because the template's original failed AA on mist at 4.06:1.
  Series strokes sit on a plot background and must clear 3:1 as graphical
  objects; any text label on them must clear 4.5:1.
- **Colour is never the only channel** distinguishing one series from another,
  night from day, or a published point from an interpolated one.
- **Motion respects `prefers-reduced-motion`** if any transition is added between
  days or tabs.

## Out of Scope

- **The sighting layer.** #121's octopus, nudibranchs, sea hares and leopard
  sharks. The map is promoted to real; its sighting content is still reserved and
  still says so.
- **Visibility, in any form.** `visibility` and `ceilingHeight` are declared and
  empty at every cell — re-measured live on 2026-08-28 and still zero. ADR-0020
  stands.
- **A rain tab.** Probability tops out at 15% and accumulation at 0.8 mm across
  the eight days measured. Rain appears only as the publisher's own phenomenon
  wording.
- **A water-temperature forecast.** No product publishes one for these beaches.
  Water temp is measured, today only, and says so.
- **Deep-linking a day.** The selected day does not enter the URL. `searchParams`
  would make the route dynamic and cost `revalidate = 900` and the empty
  `generateStaticParams` that keeps upstream load proportional to real readers.
- **The page header.** The `<h1>`, lead paragraph, standing safety notice and
  beach selector are unchanged, including their placement, which was measured
  into position in the previous redesign.
- **The landing-page teaser.** `ConditionsTeaser.tsx` and its reserved slot are
  untouched.
- **Dark mode.** Refused by decision for the whole site.
- **Any judgement about conditions.** No "good day" chips, no rip-current
  scoring, no colour band meaning "unsafe". ADR-0009.

---

## Evidence

Every figure in this brief was measured rather than assumed. Probes run
2026-08-28 against the live feeds, and against committed data at the commit this
brief was written on.

**NWS gridpoint `SGX/54,21`** — 222,984 bytes, `validTimes`
`2026-08-28T02:00:00+00:00/P7DT23H`. Published, gapless, zero nulls, after
expansion to hourly steps: `windDirection` 196h, `windSpeed` 196h, `windGust`
196h, `skyCover` 196h, `probabilityOfPrecipitation` 196h, `temperature` 191h,
`apparentTemperature` 191h, `relativeHumidity` 191h. Ranges over the window:
temperature 69–79°F, wind 0–13.8 mph, gusts to 19.6 mph, wind direction 20°–350°,
sky cover 22–77%, humidity 81–92%, precipitation probability 0–15%, accumulation
0.8 mm total. Declared and empty: `visibility`, `ceilingHeight`, `waveDirection`,
`pressure` and nineteen others.

**NWS forecast `SGX/54,21/forecast`** — 13,211 bytes, 14 day/night periods, each
with `shortForecast`: "Patchy Fog", "Patchy Fog then Mostly Sunny", "Mostly
Sunny". The hourly variant is 163,056 bytes and gives `windDirection` as a
compass _string_ ("W"), which is why the numeric degrees for the needles must
keep coming from the raw gridpoint.

**NOAA CO-OPS hourly tide** — `interval=h` returns clean hourly heights; 1,839
bytes for two days at station 9410230, so roughly 6 KB for a week. The existing
`interval=hilo` request is unchanged and still supplies the extremes.

**CDIP MOP** — 3-hourly, not hourly: the committed fixture
`mop-d0481-forecast-20260826.csv` steps 00, 03, 06, 09 for 56 rows across seven
days. `waveDp` is already requested, unit-pinned and deliberately unrendered —
`mop-forecast.ts` says "the day it is used, it is already pinned." That day is
this one.

**Coastline** — `mop-lines.json` holds 1,210 points from 32.5343°N to 33.3830°N
at about 98 m spacing (measured D0498→D0499). **123 of them duplicate their
neighbour's coordinates**, leaving 1,087 distinct points and 123 zero-length
segments. These must be de-duplicated before any geometry is derived from the
polyline: undetected, they silently break tangents and side tests, which is how
one wave buoy appeared to fall on the wrong side of the coast during this
brief's own probing.

**Which side is the sea** — with duplicates removed, all 13 wave buoys in
`wave-buoys.json` fall on the left of the polyline walked south to north. That is
strong enough to shade water on the map and too load-bearing to assume:
**TODO(verify)** — it wants a checker script in the shape ADR-0021 established,
not a constant.

**Shore facing is not derivable the way it first appeared.** Every beach carries
a `segment` with two ends, which gives a shoreline bearing and therefore two
normals — La Jolla Shores runs 11°, normals 101° and 281°. Choosing between them
by the bound MOP line's bearing **fails**: only 7 of 25 agree within 45°, because
a beach binds its _nearest_ line measured from one end, so that bearing is mostly
alongshore. And 26 of 51 beaches have no MOP line at all. `mission-bay-vacation-isle`
has an upper equal to its lower and has no bearing at any confidence. This is why
the compass sits on a drawn coast rather than over a derived seaward arc — the
map shows the reader what no single computed bearing reliably can.

**Station geometry** — `tide-stations.json` (9), `wave-buoys.json` (13) and
`observation-stations.json` (62) all carry `lat`/`lon`, and `beaches.json` carries
each binding with its distance in metres. La Jolla Shores: MOP line D0498 at
325 m, buoy 46254 at 1,648 m, tide station 9410230 at 1,369 m, air station LJAC1
at 1,381 m.

## Decisions this work must record

Five, in `docs/adr/`. Numbers are not claimed here — the next free number is
taken at the time, because an ADR number reserved in a plan has gone stale in
this repo before.

1. **The chart carries no dependency.** Hand-rolled SVG against `next`, `react`
   and `react-dom`. Flagged per CLAUDE.md's rule that a new library is an
   architecture decision, and rejected: the largest series here is 196 points,
   the plot must render server-side, and the repo's three runtime dependencies
   are a guarded budget.
2. **A forecast may sit beside a measurement without displacing it.** ADR-0019
   declined to decide whether wind and temperature could move from the air
   station to the grid cell. This design does not move them: today's panel shows
   both, each attributed, which is the version ADR-0019 was protecting.
3. **One dial may carry two provenances.** `StatGroup`'s contract is one group,
   one source, and this breaks it deliberately — following `WeekGrid`, which
   already holds NOAA, CDIP and this repo on one grid and resolves it with a
   provenance line per row rather than by splitting the component.
4. **The sighting map becomes a real map with a reserved layer.** Amends what a
   reserved slot is: the frame is real content now, and what is "coming" is the
   sightings drawn on it rather than the map itself.
5. **The cloud row's thirds give way to a continuous curve.** Supersedes
   ADR-0024's mechanism while keeping its finding — one number does not describe
   a burn-off day, and a curve does not reduce to one number. ADR-0024's deferred
   `shortForecast` read is taken here, as it said it should be.

**ADR-0023 is fulfilled, not superseded.** It said the overnight extremes were
gone "until a day view carries them" and kept `allDay` in `lib/conditions.ts` so
that this work would be cheap. The week grid keeps its header window and its
daylight-selected figure exactly as ADR-0023 set them; the sparkline draws the
night behind the figure rather than replacing it.

## Build sequencing

Three pull requests, cut at dependency boundaries, each leaving the page working
and the gates green. CLAUDE.md's reviewability guide — roughly 400 changed lines
or five slices — is what makes this more than one.

1. **The data.** Hourly tide contract, gridpoint wind and temperature, the
   `shortForecast` read, and the series assembly in `lib/conditions.ts`.
2. **The day panel.** `HourChart`, its tabs and layers, the sparkline row, the
   selector coupling, `MeasuredToday`, and the removal of the three-card slab.
3. **The spatial half.** `ShoreMap` and `Compass`.

A plan file goes in `docs/plans/` before slice one, per CLAUDE.md: this will not
finish in one sitting, and it turns on choices — the compass's home, the fate of
the cards, the cadence treatment — that someone will re-litigate later.
