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

## Addendum, 2026-08-28: what #171 measured

Dated rather than woven in, per this repo's rule that a plan in flight gains
addenda and never has its history rewritten. Nothing below reverses a decision
above; two open questions are answered and one parameter moved.

**The brief's first `TODO(verify)` is answered: the floor is 110px.** The brief
guessed a sparkline stops working "narrower than roughly one pixel per published
point", which at 24 hourly points is 24px. That guess is about the curve and the
answer is about the layers. Rendering the shipped markup down a ladder of widths
on the built page: at 197, 169 and 133px everything reads; at 110px the night
bands are still separable from the cloud wash; at 88px the curve survives and
the bands merge; at 72px the second dip is gone; 56px is noise. What fails first
is being able to see that the dip is _inside_ the night band — which is the
whole figure ADR-0023 dropped — so the floor is where the shading stops reading,
not where the line does.

**It does not bind.** The narrowest cell this grid renders is 158.8px of block
holding a 132.8px shape, at exactly 1280 where seven columns begin. Measured,
and asserted, because ADR-0023 already had to move seven columns from `lg` to
`xl` once when 88px of content proved narrower than the text in it.

**The threshold is a container query, not a constant.** A viewport media query
cannot express it: this grid is one, two, four and seven columns, so a 1024
window gives a _wider_ cell than a 1280 one. `@container` on the day block and
`@max-[134px]:hidden` on the shape. Three things hold it together because none
is sufficient — a test pins the literal Tailwind needs written out, a test pins
that the grid clears the floor, and an `AT_RULES` row in the stylesheet gate
proves the class compiled, since an unregistered variant leaves the class in the
markup where jsdom still finds it and the rule never fires at any width the grid
has anyway.

**The shape is 8:1, not 5:1, after review.** At 5:1 it rendered 34px and read as
a second chart above the figures — which, with #172's day chart coming below the
grid, is the duplication principle 1 exists to prevent. This was raised on the
rendered artifact, which is why #171 is `needs-human`. At 8:1 it renders 21px
and reads as an annotation on the row. The grid goes 288 to 275 at 1536 and 1926
to 1753 at 375, against a `main` baseline of 245.8 measured first so the height
is not misattributed. The cost is vertical resolution — 24 user units of swing
where there were 42 — and it is the trade rather than an oversight: what a
reader takes from seven of these is which day is calmer and whether the dip is
at night.

**One brief figure did not survive checking.** The brief says four interactive
components in `src/` each ship a `noscript` equivalent. The repo has one,
`BeachSelector`. ADR-0025 says one.

**Two things #172 inherits.** The published-point marks are invisible at this
size and correctly so: 24 hourly marks at about 1px radius read as a slight
thickening of the line. The mechanism starts earning its keep at the swell's
3-hourly cadence, eight marks a day, which is #172's to judge. And `SkyWeekDay`
now carries the whole day's hours beside its daylight `thirds`, which is the
read ADR-0024's successor will want.

## Addendum, 2026-08-28: the wash leaves the week cell

Dated rather than woven in, per this repo's rule that a plan in flight gains
addenda and never has its history rewritten. This one **does** change a decision
above, which the 2026-08-28 addendum before it did not, so it is worth being
exact about which half moved.

**Reviewed on the page, the cloud wash on the sparkline read as confusing.**
Asked what the shape at the top of each day was, the first reading was that the
curve _was_ the cloud. Two grey layers of similar weight in a 21px frame have to
be separated before either says anything, and the fact a reader takes from seven
of these — which day is calmer, and whether the dip is at night — is carried
entirely by the curve and the night bands.

**"Cloud and daylight are layers, not tabs" is unchanged.** That decision is
about what _kind_ of thing cloud is, and cloud is still a layer and still not a
tab. What it never settled is at what _size_ a layer earns its place, and the
answer is now: the day chart, not the week cell.

**What did change is ADR-0025's "the same two background layers".** One layer is
shared and one is not. Night is drawn at both zoom levels; cloud only where
there is height for it. That is a weaker guarantee than "the sparkline and the
chart are legible as the same instrument because the backgrounds never change",
and the weakening is recorded in ADR-0026 rather than absorbed. What still holds
the two together is the shared `SparkPoint` type and the shared night band.

**#171's width ladder had already found this and it was not read that way.**
Every row of that table from 110px down is a sentence about two grey layers
being hard to tell apart — recorded as a fact about width, and at least as much
a fact about there being two of them. `MIN_USEFUL_SPARK_WIDTH_PX` stays at 110
as a bound rather than a fitted threshold: removing a competing layer cannot make
the remaining one harder to see, and the floor does not bind at a 133px cell
anyway.

**The swell question this raises is not answered here.** Whether the week cell
should show swell as well as tide — as a second shape, as a second line, or by
following the day chart's selected tab — is decided in #172 alongside the tabs,
because two of the three options only exist once the tabs do.

## Addendum, 2026-08-28: what the day chart's review changed

Dated rather than woven in. Three faults were found by rendering the chart
rather than by reasoning about it, and one request reversed a recorded decision.

**Cloud left the plot frame entirely, which is its third arrangement.** ADR-0026
took the wash off the sparkline on the grounds that a 21px cell had no room for
two grey fields. Built as a full-height wash on the day chart it had exactly the
same fault, because the fault was never about height: night and cloud were two
greys of similar weight over the same ground. Rebuilt as a strip inside the top
of the frame it still crossed the night band, since night runs the plot's full
height. Only a band _above_ the frame makes the two independent. It is labelled
to the left and keyed with swatches against percentages — never words, because
ADR-0024 measured a banded word contradicting the National Weather Service on
three days of six, and since this PR the publisher's own wording prints directly
above the chart, so the contradiction would now be visible in one glance.

**Every axis label became markup.** An SVG `<text>` scales with the viewBox: a
label reading 10px at 1536 renders about 4px at 375. Measured, and invisible to
every test in the suite, because jsdom applies no stylesheets. The SVG now holds
only geometry, which also keeps its scaling uniform so a mark stays a circle.

**The chart wears the site's furniture**, which is where the brief says to
answer "plain": the loud register belongs to the chrome and the plot stays
quiet. It reuses the week grid's own today-cell treatment rather than inventing
one. The single addition inside the frame is a fill under the curve, in the
row's own colour — per product and never per value, which is what keeps it clear
of ADR-0009.

**The plot became interactive, and that reverses the brief.** See ADR-0027,
which separates the two objections the original rule had bundled: hover is still
refused, hiding is still refused, and interaction that only adds is now allowed
under four stated conditions. **The rejection of scrubbed compass needles above
still stands** — it survives on its own argument about meaning, not on the hover
one, and #173 should read it as binding.

**Measured on the built page**, 1536×639 and 375×812:

|      | chart     | day region | labels | hour column |
| ---- | --------- | ---------- | ------ | ----------- |
| 1536 | 806 × 246 | 557        | 10px   | 33.6px      |
| 375  | 283 × 87  | 434        | 10px   | 9.9px       |

The chart's width is capped: uncapped it drew 440px tall at 1536, and a single
curve does not want a third of a screen. The space that leaves on the right is
where #173's map goes. **The 87px height at 375 is thin and is recorded rather
than fixed** — one aspect ratio cannot serve 283px and 806px, and the tabs slice
is where mobile behaviour is addressed.

## Addendum, 2026-08-28: the two questions the tabs were waiting on

Dated rather than woven in. Both were left open deliberately — one until the
day chart existed, one until the ADR that binds it came due — and both are
answered here before the tabs are built, because the second one decides how
much of the page the tab state has to reach.

**The cloud row keeps its thirds.** `.design/conditions-day-view/DESIGN_BRIEF.md`
lists `SkyWeek` as _Modify — "Thirds give way to the cloud wash carried on every
sparkline"_, and that is a conditional rather than a decision: **the condition
expired.** ADR-0026 took the wash off the sparkline, so there is no wash on the
week for the thirds to give way to, and cutting the row now would leave the week
saying nothing at all about the sky.

The duplication objection is real and is answered rather than dismissed. Once
the week becomes the selector, the day chart's cloud band covers whichever day
is chosen, so the thirds and the band do describe the same forecast. What the
band cannot do is put Sunday's morning beside Tuesday's: it draws one day. That
is the same argument that rejected **compress the week to a bare day strip**
above — cross-day comparison is the week's entire job — and it is why two
readings of one product at two zoom levels is the design rather than an
oversight.

So the ADR due at the end of this half supersedes **ADR-0024's reach and not its
row**: the day view carries a curve where the week carries three means, and
ADR-0024's own warning — that "anything that restores a single daylight figure
to this row reverses this" — is untouched, because nothing is restored and
nothing is removed.

**The week's sparkline does not follow the selected tab, and that is the
brief's third decision not to survive the page.** _Key Interactions_ says
selecting a tab redraws "the foreground series and every sparkline in the week
above, together — that simultaneity is the whole point of principle 1".

It does not work, and the reason is the tab bar's home. The bar sits in the
chart's own header band, **below** the week. On the wind tab the grid would
draw seven wind curves sitting directly above figures reading `LOW TIDE 3:13 PM
1.6 ft`, with nothing in the cell saying the shape had changed variable — and
ADR-0023 measured that this cell has no room for a label, which is the whole
reason the shape works there at all. `DaySpark` and ADR-0025 both put it in the
same words: the shape draws the hours the figure beside it was selected _out
of_. A shape that stops agreeing with the figures under it is not a second view
of one instrument; it is a fourth product with no label.

**Two alternatives were weighed rather than assumed.** _Move the tab bar above
the week_, so it visibly governs both regions: rejected because the bar is the
chart's own chrome, the week's rows are not tabbed, and it would put a control
for the day panel above the region that selects the day. _Give the week a
second shape for swell_, stacked and labelled by the row it sits over, so a
shape always agrees with a figure: rejected on height — about 30px back onto a
grid ADR-0023 and ADR-0026 each spent a decision shortening, to gain a
comparison the swell row's figures already support.

**What this costs is principle 1, narrowed a third time, and it is worth
stating plainly.** ADR-0025 claimed one series shape and the same two
background layers. ADR-0026 corrected that to one shared background layer and
one not. This narrows it again: **the two plots share a point type, a night
band, and one product.** The week is the tide's shape at a glance; the chart is
four products at reading size. What holds them together is `SparkPoint`,
`dayFrame` and the tide — and that is a smaller claim than the brief made,
recorded here rather than absorbed.

## Addendum, 2026-08-28: what the tabs measured

Dated rather than woven in. Four figures, one of which corrects a figure in the
addendum above.

**The recorded 375 measurement does not reproduce, and it was never this work's
to lose.** The addendum on the day chart's review records the plot as `283 × 87`
at 375. Measured again on the built page — first on this branch, then on the
base commit before any of this landed, with the same script — both give
**237 × 72**. The base was measured first, deliberately: a height regression is
only this work's if the branch it came from did not already have it, and this
one did. The earlier figure is left where it is, as the dated record it is; what
is corrected is the belief that the chart at 375 was 87px, because the decision
this slice was handed rests on that number and 72 is a worse problem than 87.

**One aspect ratio genuinely cannot serve this range, which the plan asserted
and this measured.** The frame is 3.27:1, so its height is whatever its width
divides to:

| viewport | plot      | tab bar          |
| -------- | --------- | ---------------- |
| 1536     | 806 × 246 | 4 × 213px, 1 row |
| 768      | 582 × 178 | 4 × 157px, 1 row |
| 375      | 237 × 72  | 4 × 70px, 1 row  |
| 320      | 182 × 56  | 4 × 57px, 1 row  |

A ratio flat enough to hold 246px at 806 wide gives 72px at 237 wide; a ratio
tall enough to give a phone a chart draws a third of a laptop screen. There is
no third number.

**So the frame changes shape rather than size, which is what the brief asked
for.** Below `sm` it is 2:1 and the drawing stretches to fill it; above `sm`
nothing happens at all, because `h-auto` takes the box's height from the viewBox
and the box's aspect already _is_ the drawing's. Re-measured after the change:
**1536 stays 806 × 246 exactly**, 768 stays 582 × 178, 375 goes to **237 × 119**
and 320 to **182 × 91**. The frame reviewed at 1536 is untouched, which is the
property that made this the version worth building rather than capping the
chart's width — capping would have narrowed the desktop plot by a third now, to
reserve space for a map that has not been built yet.

The cost is `preserveAspectRatio="none"` on the plot, which this component's own
docstring had ruled out on the grounds that a published point should stay a
circle. Below `sm` a mark renders about 2px across and 3.3px tall rather than
2px square, and two pixels is not a shape anybody reads; above `sm` there is no
stretch at all. The 72px frame was the larger loss.

**The brief's mobile sentence is wrong about the tabs, and measurably so.** It
says "four tabs at 44px touch targets do not fit one row at 375px". ADR-0004's
floor is a _height_ — `TOUCH_TARGET` is `min-h-11` and nothing else — and four
tabs render 70 × 44px in one row at 375 with no overflow, 57 × 44px at 320. The
sentence was reasoning about a 44px width nothing in this repo asks for.

**One thing the screenshots found that no measurement would have.** At 375 the
tide's twenty-four published-point marks — a 2px dot inside a 5px white ring,
9.9px apart — read as gaps in the curve rather than as marks on it, and the
curve came out looking dashed. On this plot dashed already means something else:
the "now" rule is dashed exactly so it cannot be mistaken for a series. So a
series with more marks than the width can separate drops them below `sm`, at a
threshold the spacing sets rather than taste.

It is a degrade rather than a loss, and the direction is what makes it one: the
series that trip it are the hourly ones, whose marks say "hourly" — the least
surprising cadence on the page. The swell's eight and a gridpoint block's four
stay under the threshold and keep their marks at every width, so the distinction
a reader actually needs, between an hourly model and a coarser one, is the one
that survives. **This is the third arrangement of the marks and the second time
a review of the rendered thing moved them** — #171 recorded that they are
invisible in a 21px sparkline and correctly so.

## Addendum, 2026-08-29: #172 ships in two pull requests

Dated rather than woven in. **The Sequencing section below says three pull
requests. It is four**, and the fourth is the second half of #172. The issue is
not re-cut and no slice changed; what changed is how much of it arrives at once.

**The measurement that decided it.** At the commit that finished the week
coupling the branch stood 13 commits and 9,559 changed lines against
`origin/main` — 3,461 of source, 3,284 of test, 2,300 of captured fixture and
514 of prose. CLAUDE.md's guide is "~400 changed lines or ~5 slices", at which
point a plan should be split at a dependency boundary rather than shipped whole.
Six of `TASKS.md`'s nine PR 2 tasks were done at that point and no single one of
them overran: the list was scoped past the guide when it was written, which is
worth saying because it means the split is not a slice going wrong.

**Where it is cut.** After _the week becomes the selector_ — the point at which
the region is whole. The day panel draws four series for any of seven days, the
week chooses which, and the page works with nothing further landing.

That boundary is the only one available. Cutting earlier separates the chart
from its tabs, or the tabs from the week that drives them, and neither half
reads as a finished thing alone: `HourChart` with one tab was shippable while it
was all that existed and is not shippable now, because the branch would be
offering a component it has already outgrown.

What is left over is not chart work at all. `MeasuredToday` and the removal of
the slab move three measurements into the day and take three cards off the page
— a change to what the page _is_, rather than to what the day panel can draw,
and reviewable on its own terms by somebody who has already accepted the first.

**Which ADR goes with which half, and it is not an even split.**

_The day carries a curve, and the week keeps its thirds_ goes with the first
half. Everything it records is built there: the chart's cloud band, and
ADR-0024's deferred `shortForecast` read, which the sky-wording slice took.
Holding it back would ship the discharge of a deferred decision with nothing in
`docs/adr/` saying it had been discharged.

_A forecast may sit beside a measurement without displacing it_ goes with the
second. It records a decision `MeasuredToday` takes, and written before that
component exists it would be an ADR about code nobody can read.

**That leaves a gap in the first half, named here rather than found later.**
From the moment the wind and temperature tabs land, the page carries two winds
and two air temperatures — the cell's forecast in the day panel, the station's
measurement in the third card — and no ADR explains why both. That is exactly
the duplication ADR-0019 deferred, and the decision is genuinely not taken until
something is built that could have displaced one of them. It is recorded here
and in the first PR's body until then.

**The second half does not start until the first merges.** CLAUDE.md: "Do not
start an issue whose blocker has not merged." The first half's code is the
ground the remaining slices stand on — `MeasuredToday` has to fit the seven-day
`DayView` this half introduced, not the today-only region `TASKS.md` was written
against — and rebasing half-finished work onto a moved blocker is how a verified
slice quietly stops being verified.

## Addendum, 2026-08-29: what the measurements found on the way in

Dated rather than woven in. This is the second half of #172 — `MeasuredToday`,
the slab's removal, ADR-0029 and the floor — and it settled four things the
addendum above left open, turned up one regression, and noticed one defect it
did not fix.

**The measured block is two cards, and that follows from ADR-0010 rather than
being a layout preference.** One card was the obvious shape and it does not
work: two provenances behind one _panel_ is what ADR-0010 permits and two
behind one _sentence_ is what it refuses, so merging the buoy's "about waist
high" with the station's "Warm, with a gentle breeze" into one plain-words line
is the forbidden shape exactly. Once each source keeps its own sentence it also
needs its own lead figure, and `ReadingCard` has one slot for one. So the sea
keeps 🏄 and its height and the air keeps 💨 and its temperature, two across
from `sm`, and every state and every sentence of the two cards they came from
survives verbatim.

**They stay on `bg-dark`.** The surface was a real decision and the brief did
not specify one. `CARD_PROSE` and `CARD_MUTED` are measured against that
surface and against nothing else — white at 55% on the page's cream ground is
1.03:1, the bug #175's last commit fixed in three places — so keeping the card
keeps those figures true without a new role. It also carries principle 2 in
form: a dark block of stated figures beside a light drawn curve, which is what
"a model is drawn; a measurement is stated" looks like at a glance. Measured on
the built page at 1536×639 with the painted pixels rather than the CSS tree:
provenance in the card **5.96:1**, card prose **10.02:1**, stat label
**5.96:1**, and the absence sentence on the page ground **5.57:1**. The first
two reproduce `cardText.ts`'s own documented figures exactly, which is what says
the method was right.

The alternative — the block on the page ground — would have needed a new
`PAGE_PROSE` role measured and added to `cardText.test.ts`, and it would have
left `ReadingCard`, `CARD_PROSE` and `CARD_MUTED` with no callers at all.

**Only what was measured moved in.** `TASKS.md` said `MeasuredToday` absorbs
three cards; the brief's own inventory row for it says "water temp, buoy wave
height, station wind and gust, station air temp" and names no tide. The second
reading is the one that ships. The tide card's lowest daylight low is NOAA's
prediction and prints in the week grid's today column; the wave card's MOP
block is CDIP's model and the swell tab draws the whole of it. A predicted
figure inside a block whose entire claim is that these numbers came off an
instrument would say the opposite of what the block is for — which ADR-0029
then states as a rule, and it is the rule that licensed deleting both.

`readTodaysLowestLow` went with the tide card, its only caller.

**Two figures left the page as figures, deliberately.** The tide's "Lowest all
day" — the 3 AM lower low — and CDIP's "Biggest all day" are now the dip in a
curve the chart draws across all twenty-four hours with night shaded. That is
what this brief asked the day view to be for and what ADR-0023 was promised
when it dropped them from the grid. Three pieces of rendered copy pointed at
the cards for those figures and had to name the chart instead rather than be
left pointing at nothing.

**`DayView` gained `measured` and not `isToday`.** The handoff for this half
proposed an explicit `isToday`, on the argument that `nowMs !== null` is a
coincidence of construction rather than a stated contract — which is true. It
turned out not to be needed: following the `wording` field's precedent means
`DayPanel` decides on the server, where `day.isToday` is already in hand from
the daylight read, and hands `ChosenDay` a finished node. Nothing downstream
asks. A field no consumer reads would have been the speculative flexibility
CLAUDE.md rules out, so the honest version of that advice is the one taken.

**Three Suspense boundaries became one, inside the day region.** The buoy and
the air station used to paint independently in the band at the top of the page.
They are one block now and appear together, so the slower feed sets when both
arrive. What is bought is that the block is a block; what is kept is that
neither read throws — each returns its own state — so one going quiet costs its
own card and can only delay the other, never empty it. `MeasuredPanel` holds
that boundary rather than joining `DayPanel`'s five reads, because those five
draw the chart and these two do not.

### The regression, and how it was found

**Taking the tide card off the page took the only attribution the tide had.**
Seven tide cells in the grid and the day chart's entire tide curve were
suddenly published by nobody, which is the one thing ADR-0010 ends by
forbidding. The wave and cloud rows have always carried their own lines; the
tide row delegated to the card, which read the same station through the same
request, and the delegation had nothing left to point at.

**No test failed and none could have.** The card's own suite asserted the
attribution and was deleted with the card. It was found by building `main` and
the branch, rendering both at 1536×639 and diffing `document.body.innerText`:
"La Jolla (Scripps Institution Wharf) · NOAA Tides & Currents" was on one page
and on no part of the other. That diff is worth repeating on any slice that
removes a region — every other line it turned up was accounted for by the two
cards, one live buoy figure that moved between the two captures, and the copy
this work deliberately reworded.

`tideStation.ts` is the fix: the third module of the shape `mopLine.ts` and
`gridCell.ts` already have, so the grid's three rows are attributed from three
places that read alike. It carries the 5 km disclosure threshold that came off
the card with everything else.

### Noticed and not fixed

**`HourChart` prints "today" on every day.** The line under the plot reads
`Low 1.0 ft, high 5.4 ft today.` beneath a heading reading `Mon, Aug 31`. It
arrived with the chart in #175 and is the exact failure the `WORDS`/`when`
discipline exists to prevent — `HourChart` takes no day name, so the sentence
has nowhere to get one. It is more visible now, because the measured block's
absence sentence names the day correctly four lines below it. Not fixed here:
it belongs to a different branch, and it needs a decision about whether the
component takes a `when` or the sentence moves up to `DayPanel`.

**The measured block is wider than the chart above it.** The chart is capped at
944px of a 1440px column — deliberately, per the addendum above, because the
space on its right is where #173's map goes — and the two cards run the full
width. At `xl` after #173 the chart and the map together will fill that width
and the cards will line up under them. Recorded rather than fixed, and it is
the first thing the design review should look at if that reading is wrong.

### The floor moved twice

Both moves are in `vitest.config.mts` with their arithmetic. The deletion is
reason 2 — covered code removed, numerator falling by no more than the
denominator on all four — and it had to land in the same commit as the deletion,
because a slice that lowers coverage cannot leave the gate green otherwise.
The regression fix then moved all four back up. `TASKS.md`'s separate "coverage
floor" task for this half is therefore done inside two other slices rather than
in one of its own.

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
