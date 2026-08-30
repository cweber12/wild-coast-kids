# Design Review: The Conditions Day View

Reviewed against: `.design/conditions-day-view/DESIGN_BRIEF.md`
Philosophy: Coastal pop editorial, with instrument-panel restraint inside the plot
Date: 2026-08-29
Reviewed at: `main` @ `16780b3`, after #175 and #176 merged and #172 closed
Page: `/conditions/la-jolla-shores-beach`, built and served from a cleared `.next/`

`TASKS.md` scheduled this "once PR 2 has merged". PR 2 became 2a and 2b and both
are in, so this is the first time the page has reached the shape the brief
describes. It is run **before** #173 rather than after, because three findings
below land on PR 3's last task — _The row_ — and finding them afterwards would
mean rebuilding it.

**Routing, decided 2026-08-29.** #173 is worked first and these findings are
filed as issues when it merges. None of them is #173's work under CLAUDE.md's
one-issue-per-branch rule, and the map #173 draws closes half of the ragged
right edge on its own. The cost of that order is stated where it applies: from
now until finding 1 is worked, the page runs ADR-0029's permitted duplication
without the attribution clause that licenses it.

## Screenshots captured

Written to the session scratchpad rather than into the repo. They are pictures
of a page that #173 changes next, and `.design/` is committed — a stale PNG of a
superseded layout is worse than no PNG. The findings below carry their own
measurements, which are the durable part.

`…\scratchpad\shots\`

| File                          | Viewport | What it shows                                              |
| ----------------------------- | -------- | ---------------------------------------------------------- |
| `review-1536x639-full.png`    | 1536×639 | The whole page at the review machine's own viewport        |
| `review-1536x639-day.png`     | 1536×639 | The day region alone — chart, cards, the empty right band  |
| `state-swell-tab.png`         | 1536×639 | Swell selected: a 1.5 ft curve above a card reading 3.0 ft |
| `state-temp-tab.png`          | 1536×639 | Temp selected: a 3 °F day drawn as a full-height mountain  |
| `state-wind-tab.png`          | 1536×639 | Wind selected                                              |
| `state-other-day.png`         | 1536×639 | Wed, Sep 2 selected — and #177 visible                     |
| `desktop-1280-full.png`       | 1280×800 | Standard desktop                                           |
| `tablet-768-full.png`, `-day` | 768×1024 | The `lg` stack                                             |
| `mobile-375-full.png`, `-day` | 375×812  | One column, 44px targets                                   |
| `week-cell-1536.png`          | 1536×639 | One week cell, magnified — the sparkline in place          |

## Summary

**The page works, and the brief's hardest bet came off.** The week reads as seven
small multiples over one large one, the tabs are quiet inside a loud frame, every
failure state survived the move, nothing overflows at any width, and every text
pair on the page clears AA when measured from painted pixels.

**The one real defect is attribution.** The day chart draws four series from three
publishers and names none of them. The only provenance line adjacent to the plot
says `Sky, in words · this beach's own grid cell · National Weather Service`,
which is right for two tabs and wrong for the other two — and ADR-0029 already
states, as a load-bearing clause, that "the chart's provenance names the cell."
It does not. This is the same class of defect as the tide-station regression #176
caught by diffing rendered text, and no test can fail on it for the same reason.

Everything else is smaller: a filled area whose baseline is not zero, a heading
rank that flattened when the cards moved, a three-column band holding one slot,
and a day control 15px tall.

---

## Must fix

### 1. The chart's four series carry no provenance line

The day region's reading order at 1536, verbatim from `document.body.innerText`:

```
Today, hour by hour
TONIGHT Partly Cloudy then Patchy Fog
Sky, in words  this beach's own grid cell · National Weather Service, San Diego
               — a forecast, not a reading taken at the beach
TIDE SWELL WIND TEMP
[the plot]
Low 0.2 ft, high 5.3 ft today. Night is shaded; cloud is the band above.
WAVES AND WATER 🏄 3.0 ft …  Measured now  Buoy Scripps Nearshore · NDBC
AIR 💨 75°F …               Temperature and wind  Scripps Pier · about 1.4 km
```

`HourChart.tsx` renders no `ProvenanceLine` — confirmed by grep; the name appears
only in a docstring. `DayPanel.tsx` likewise. The four curves are attributed
nowhere in their own region.

**Why this is Must Fix and not a preference.** ADR-0029's third load-bearing
clause reads:

> **Each keeps its own attribution, and one never covers both.** ADR-0010's rule
> is unchanged: one `StatGroup` never spans two sources, and **the chart's
> provenance names the cell** while the card's names the station.

The ADR describes a page that does not exist. The clause is not aspirational — it
is what makes the two-winds duplication defensible, so the duplication is
currently running without the condition that licenses it.

**It is worse than merely missing, on two of four tabs.** The nearest provenance
above the plot names the NWS grid cell. The tide curve is NOAA Tides & Currents;
the swell curve is CDIP's MOP model at 10 m depth. A reader who takes the line
above the plot as the plot's source is misinformed on half the tabs.

**And on the swell tab the nearest line below names a different instrument.** See
`state-swell-tab.png`: the curve tops at 1.5 ft under "Low 0.8 ft, high 1.5 ft
today", and 40px beneath it the sea card leads with **3.0 ft** and
"Measured now Buoy Scripps Nearshore · NDBC". Two figures, one sea, one screen —
and the only source named belongs to the one that is not drawn. ADR-0029 permits
exactly this pair, and permits it _on condition that each is attributed_.

**Wind and temperature are attributed nowhere on the page at all.** The week grid
carries three provenance lines — low tide, biggest swell, cloud cover. There is no
fourth for the gridpoint wind or temperature. The only wind attribution on the
page is the air card's "Temperature and wind · Scripps Pier", which names the
station the curve did **not** come from.

_Fix:_ a `ProvenanceLine` under the plot, keyed to the selected tab, naming that
tab's own publisher — NOAA for tide, CDIP for swell, the grid cell for wind and
temp. `series.ts` already assembles per-series metadata and `mopLine.ts`,
`gridCell.ts` and `tideStation.ts` are three modules of the same shape that
already resolve exactly these three sources. The line changes with the tab, which
is additive under ADR-0027 and takes nothing out from behind a gesture.

---

## Should fix

### 2. The filled area asserts a baseline the axis does not have

`HourChart` scales each series to its own day's min and max, and fills the area
from the curve down to the foot of the frame. Both halves are separately
reasoned in the docstring — the range so "a calm day" is not "a line across the
middle of an empty frame", the fill because "the line alone left the plot reading
as an empty field with a thread across it". Neither argument addresses the other.

On the temperature tab the combination is stark. See `state-temp-tab.png`:

| Tab   | Axis floor | Axis top | What the fill implies        |
| ----- | ---------- | -------- | ---------------------------- |
| Tide  | 0.2 ft     | 5.3 ft   | honest, floor ≈ 0            |
| Swell | 0.8 ft     | 1.5 ft   | mildly overstated            |
| Wind  | 2.3 mph    | 8.1 mph  | overstated                   |
| Temp  | 74.0 °F    | 77.0 °F  | **a 3 °F day as a mountain** |

The fill's stated purpose is "weight, not a second reading" — an explicit claim
that it carries no quantitative meaning. Filled to the frame's foot on a floating
baseline it carries one anyway, and principle 2 makes form the primary channel:
"a reader can tell which kind of claim they are looking at before reading a word."
The words are right — the axis reads 74.0 and the summary says "Low 74.0 °F, high
77.0 °F today" — but the drawing outruns them, and this brief's own rule for
`DaySpark` was that a drawn zero is a stronger lie than a blank figure. This is
that rule on the other axis.

Note the asymmetry that makes it visible: the week's sparklines share one scale
across all seven days (`sharedRange` in `WeekPanel.tsx`) **and carry no fill**.
The fill exists only on the plot whose baseline floats.

**Ruled 2026-08-29: fade the fill toward the floor.** A gradient from the curve
down to transparent — keeping the body the fill was added for, and removing the
hard edge at the foot that is what reads as a quantity.

The two alternatives were weighed and rejected. _Drop the fill wherever the floor
is not near zero_ would leave tide filled and the other three as bare lines, so
four tabs would look like two chart styles — which cuts against principle 1's
"same layers, same shape". _Label the floor as a floor_ answers a form problem
with words, which is the thing principle 2 exists to avoid.

### 3. The measured cards' heading rank flattened when they moved

The outline at 1536:

```
H1  Check conditions first.
H2    The week ahead
H3      Aug 29 Today … Fri, Sep 4
H2    Today, hour by hour
H2      Waves and water     ← inside the day region
H2      Air                 ← inside the day region
H2    How to read these numbers
```

`ReadingCard.tsx:107` hardcodes `<h2>`. That was correct while the cards were
page-level regions. #176 moved them inside the day region without moving the rank,
so two card headings are now siblings-in-outline of the region heading that
contains them.

ADR-0014 described the outline it was fixing as "a card `<h2>` and the day `<h3>`
inside its **sibling** grid" — cards as siblings of regions is the arrangement the
ADR was written against, and it no longer holds. The visual rank is fine
(`REGION_HEADING` at 34px against the label register at 10px); it is the semantic
one that flattened.

_Fix:_ give `ReadingCard` a heading-level prop, as `WeekGrid` already effectively
has for its `<h3>` day headings, and pass `h3` from `MeasuredToday`.

### 4. The week's reserved band is a three-column grid holding one slot

`WeekGrid.tsx:677` lays the reserved rows out as `grid gap-3 lg:grid-cols-3`, with
a comment explaining the choice against **three** slots side by side.
`WeekPanel.tsx:104` now holds exactly **one**. At 1536 that renders a 472px dashed
box in a 1440px band with 968px empty to its right, directly under a full-width
seven-column grid. See `review-1536x639-full.png`.

This is not a taste call — the container no longer matches its contents. It is
also the half of the page's ragged right edge that #173's map does **not** fix.

_Fix:_ let the band size to its content — full width at one slot, three across when
there are three — or drop to `lg:grid-cols-3` only when `reserved.length > 1`.

### 5. The day control is a 15px strip inside a 275px cell

The brief: "Each of the seven day cells is a control." Built, the control is the
day _heading_ only. Measured at 1536:

| Day         | Button    | Cell    |
| ----------- | --------- | ------- |
| Aug 29      | 49×**15** | 195×275 |
| Sun, Aug 30 | 86×**15** | 195×275 |
| Wed, Sep 2  | 79×**15** | 195×275 |

At 375 the same buttons are 44px tall via `TOUCH_TARGET`, so ADR-0004's floor is
met where it applies and this is a pointer-comfort issue above `md`, not an
accessibility failure. Selection state is sound: `aria-current="date"` moves to
the picked day, the underline moves with it, and today keeps its own TODAY chip
independently — verified by clicking Sep 2.

**The obvious fix is the wrong one.** Wrapping the cell in a `<button>` would make
its figures presentational and hide them from the accessibility tree — the trap
this repo has already recorded. _Fix:_ grow the control within the cell instead —
full cell width and the header band's height — leaving the figures outside it.

---

## The question the handoff asked: is the ragged right edge tolerable?

Measured at 1536, content column 1440px wide from x=48 to x=1488:

| Block                       | Width   | Right edge |
| --------------------------- | ------- | ---------- |
| Week grid                   | 1440    | 1488       |
| **Week's reserved band**    | **472** | **520**    |
| Chart card (`max-w-4xl`)    | 896     | 944        |
| Measured cards (two)        | 1440    | 1488       |
| Sighting reserved slot      | 1440    | 1488       |
| "How to read these numbers" | 1440    | 1488       |

**Yes for the chart, no for the reserved band.** They are two different problems
that look like one.

The chart's 544px of empty ground is a **reservation** — the plan's addendum of
2026-08-28 records that an uncapped chart drew 440px tall, and #173's map goes in
exactly that space. Widening it now means drawing a taller chart, reviewing it,
and narrowing it again one PR later. Leave it; #173 is next and closes it.

The reserved band's 968px is **finding 4**, has no map coming, and predates this
work's last two PRs only in the sense that it used to hold three slots. It should
be fixed regardless of #173 and is a one-line change.

**What this means for PR 3's _The row_ task:** the two-thirds/one-third split at
`xl` is sound as specified, and 896 + gap + ~500 lands the pair on the 1440 edge
the cards below already sit on. No change to that task.

---

## Could improve

- **Two "…is coming" slots on one page**, ~1,000px apart, in the same dashed
  treatment. #173 moves the second inside the map, which halves this on its own.
- **#177 is visible and worth doing soon.** On Wed, Sep 2 the plot reads "Low 8.1
  mph, high 13.8 mph **today**" under a heading reading "Wed, Sep 2, hour by hour"
  and four lines above "Nothing has been measured for Wed, Sep 2: the day has not
  happened." See `state-other-day.png`. Already filed; not this review's to fix.
- **The cloud legend inside the plot** ("Cloud cover 0% 50% 100%") is the only
  legend on the page. It is unboxed and in the label register, so it clears the
  brief's "no boxed legend" anti-reference — but it is the one element inside the
  frame that is chrome rather than data.

---

## Checked, and deliberately not findings

Recorded so the next reviewer does not re-raise them.

- **The week's sparklines do not follow the selected tab.** This contradicts the
  brief's principle 1 and _Key Interactions_ — and it is a **recorded decision**,
  argued at `docs/plans/conditions-day-view.md:442–475` with two alternatives
  weighed and rejected on measurement. Verified built: 0 of 14 sparkline paths
  changed when Swell was picked. Not a defect.
- **Two winds and two air temperatures** — ADR-0029, on purpose.
- **A swell curve above a measured wave height** — ADR-0016, ADR-0019, ADR-0029.
- **The week keeps cloud thirds** — ADR-0028; the curve is more resolution, not a
  reversal.
- **No `noscript` under the tabs** — ADR-0027; there is nothing to fall back to.
- **The compass does not follow the selected hour** — ADR-0027's "what this does
  not license", still standing for #173.

## Verified and passing

- **Contrast, from painted pixels, not the CSS tree.** Both documented controls
  reproduced exactly — provenance in `ReadingCard` **5.96:1**, card prose
  **10.02:1** — which is what says the method was right. Everything new clears AA:
  unselected tab on ocean **5.53:1**, selected tab **8.40:1**, chart summary
  **5.76:1**, hour readout **8.20:1**, cloud legend **5.76:1**, Earlier/Later
  **8.40:1**, sky provenance **5.57:1**, reserved headline **5.76:1**.
- **No horizontal overflow** at 375, 768, 1280 or 1536 — `scrollWidth` equals
  `clientWidth` at all four.
- **Touch targets** — every real control is ≥44px tall at 375. The per-hour columns
  are 10×119 there, which ADR-0027 declares an enhancement guarded by the 44px
  prev/next pair.
- **Keyboard and announcement** — `role="tablist"` labelled "What to plot for this
  day", roving tabindex (0 / −1), one `aria-live="polite"` readout, focus ring
  inherited from `globals.css` (`outline: 2px solid currentColor`) and redefined
  nowhere in the day components.
- **Colour is never the only channel** — published points are marked and
  interpolated ones are not (shape); night is shaded _and_ stated in the summary
  line; the selected day is underlined _and_ carries `aria-current`.
- **`prefers-reduced-motion`** — not engaged; no transitions were added.
- **Every failure state survived the move**, and the absence sentence names its
  day: "Nothing has been measured for Wed, Sep 2: the day has not happened."
