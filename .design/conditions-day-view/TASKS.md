# Build Tasks: The Conditions Day View

Generated from: `.design/conditions-day-view/DESIGN_BRIEF.md`
Date: 2026-08-28

## How this list is organised

**By pull request, then by commit — not by layer.** The skill that generates
this list defaults to Foundation → Core UI → Interactions → Polish. CLAUDE.md
forbids that shape: _"Slices are vertical: each cuts a complete path through
every layer rather than delivering one layer across the whole feature."_ So the
grouping below is three PRs, each of which is a complete path a reader can see,
and each task inside one is a commit.

**The brief's PR 1 has been re-cut.** It proposed "the data" — hourly tide,
gridpoint wind and temperature, series assembly — landing together. That PR
could not be demonstrated: it is parsers with no consumer, which is precisely
the horizontal slice the rule above rejects. PR 1 is now the **tide sparkline,
end to end**. It is vertical, it is visible on the page the day it merges, and
it puts the riskiest visual bet first — whether a sparkline reads at a 125px
cell. If it does not, that is discovered before the chart, the map and the
compass are built on top of it.

**Every task that changes behaviour ships its test in the same commit**, and a
bugfix starts with a regression test that failed first. Each task names its
seam, because agreeing the seams before starting is what decides whether the
work can be verified at all.

**Gates:** `format`, `lint`, `typecheck`, `adr-numbers`, `test`, `build`,
`stylesheet` — one command, `npm run gate`. The coverage floor is real and
ratchets: statements 86.16, branches 87.62, functions 92.62. New code without
tests fails the run.

**ADR numbers are not claimed here.** The `adr-numbers` gate exists because two
decisions shared ADR-0008 for two days, and a number reserved in a plan has gone
stale in this repo before. Take the next free number when the file is written.

---

## PR 1 — The week learns to draw

The sparkline, end to end, on the row the page already has. Merges as a visible
improvement on its own even if nothing after it is ever built.

- [ ] **Hourly tide series.** Add the `interval=h` request contract to
      `coops-predictions.ts` beside the existing `hilo` one, with its parser, and
      `readHourlyTide` in `lib/conditions.ts`. Capture a fixture from station
      9410230 into `src/lib/__fixtures__/` under the existing date-stamped naming.
      _Modifies `coops-predictions.ts` and `conditions.ts`; the `hilo` request is
      untouched and still supplies the extremes._
      **Seam:** the parser, pure and offline like the four beside it.
      **Tests assert:** heights parse to feet against the committed fixture; the
      three pinned facts still hold (`time_zone=gmt`, `units=english`,
      `datum=MLLW`); the `{"error":...}` under HTTP 200 path still raises; a
      malformed row is drift and raises rather than being skipped.

- [ ] **`DaySpark`.** The sparkline: a 24-hour path with night shaded, cloud
      washed across it, and the model's published points marked. Presentational
      and pure — it takes a series and renders it, so every branch is assertable
      without a network. Hand-rolled SVG, no dependency. _New component. Establishes
      the aesthetic direction: thin strokes, no gridlines, no legend, no tooltip —
      the loud register stays in the chrome._
      **Seam:** the component boundary; the series shape it takes.
      **Tests assert:** a path is drawn for a given series; the night band covers
      the hours outside the daylight window; published points are marked and
      interpolated ones are not; an empty series renders a named absence, never a
      flat line at zero — a drawn zero is a stronger lie than a blank figure.

- [ ] **The week grid gains a sparkline slot.** `WeekGrid` accepts a spark per
      day; `WeekPanel` composes it from the hourly tide read alongside the
      daylight and sky reads it already makes. ADR-0023's header window and
      daylight-selected figure are untouched — the spark draws _behind_ the
      figure, and this task is the one that must not be mistaken for reversing
      that decision. _Modifies `WeekGrid` and `WeekPanel`._ **Depends on: hourly
      tide series, `DaySpark`.**
      **Tests assert:** the ADR-0023 figure and window still render unchanged; a
      spark renders for each day the series reaches; a failed tide read costs the
      spark and not the grid, matching the existing rule that columns come from
      the daylight read because it cannot fail.

- [ ] **Measure the minimum useful width.** The brief's first open
      `TODO(verify)`. A sparkline narrower than roughly one pixel per published
      point is noise, and the cell is 125px at 1280 and 161px at 1536. Measure on
      the rendered page, encode the threshold as a named constant with the
      measurement in its docstring, and render the cell exactly as it is today
      below it. _Needs a human: no gate can assert that a shape reads._
      **Note:** measure on the review machine's own 1536×639 viewport, and measure
      `main` first — a height regression is only this work's if the base branch did
      not already have it.

- [ ] **ADR: the chart carries no dependency.** `DaySpark` is the first
      hand-rolled SVG in the repo, so the decision is due now rather than at the
      chart. Context: three runtime dependencies, guarded; the largest series here
      is 196 points; the plot must render server-side. _One page. Flagged per
      CLAUDE.md's rule that a new library is an architecture decision._

- [ ] **Coverage floor.** Re-run `npm run test:coverage` and move the three
      thresholds in `vitest.config.mts` to the new figures, with a dated comment
      saying which files moved them and why — the convention that file already
      follows at length.

---

## PR 2 — The day opens

The chart, its tabs, the coupling, and the merged measurements. The largest of
the three; split further at a slice boundary if it outgrows review.

- [ ] **Gridpoint wind and temperature.** Extend `nws-gridpoint.ts` to read
      `windSpeed`, `windDirection`, `windGust`, `temperature` and
      `apparentTemperature`, with the same unit pinning and expand-to-hourly
      treatment `skyCover` already gets. **Capture a new fixture** — the committed
      one is trimmed to four keys and cannot exercise this. _Modifies
      `nws-gridpoint.ts`._
      **Tests assert:** units are read from the payload, not assumed — `km_h-1`
      for speed and gust, `degC` for temperature, `degree_(angle)` for direction;
      `assertPublished` still counts entries rather than testing for a key, so a
      declared-but-empty series is a named absence; an offset-less instant is
      still refused; three-hour and six-hour intervals still expand to hourly
      steps without gaps.

- [ ] **The publisher's own sky wording.** Read
      `/gridpoints/{cell}/forecast` — 14 day/night periods, 13 KB — for
      `shortForecast`, and render it above the plot. This discharges ADR-0024's
      deferred read, which its own text said belonged here. A second request means
      a second outage path and a second provenance line; both are required, not
      optional. _New read in `conditions.ts`._
      **Tests assert:** the wording is relayed verbatim, never reworded — ADR-0009
      forbids this site forming a forecaster's judgement; an outage says so rather
      than falling back to a computed word; the day/night period is matched to the
      selected day rather than assumed to be first.

- [ ] **`HourChart`, tide only.** The plot frame: hours across, the value axis,
      night shading, cloud wash, published-point marks, and the "now" line on
      today. One tab, so it is shippable and reviewable before the other three
      exist. _New component. Shares its series shape and its two background layers
      with `DaySpark` — that shared shape is what principle 1 rests on._
      **Depends on: `DaySpark` (PR 1).**
      **Tests assert:** the plot renders the day's full 24 hours, not the daylight
      window — this is what fulfils ADR-0023's overnight debt; the "now" line
      appears on today and on no other day; an unavailable series renders its
      reason, not an empty frame.

- [ ] **The four tabs.** Tide, swell, wind, temperature. Selecting one redraws
      the foreground series; the background layers do not change. Client
      component, with a `noscript` equivalent following `BeachSelector`'s
      precedent. 44px touch targets below `md` via `TOUCH_TARGET`, not
      hand-written padding. _Modifies `HourChart`._
      **Tests assert:** each tab draws its own series and its own units; a tab
      whose feed is quiet says why rather than drawing a flat line; the swell tab
      marks all 8 published points across the day and does not claim hourly
      resolution; keyboard operation reaches every tab and the focus ring is the
      site's own.

- [ ] **The week becomes the selector.** Choosing a day redraws the panel below.
      All seven days ship from the first render, so switching costs no request.
      The selected cell is marked by more than colour. Today is selected on
      arrival. `noscript` renders today's panel and leaves the week grid — which
      is already complete and server-side — as the fallback. _Modifies `WeekGrid`,
      `ConditionsSection`._ **Depends on: `HourChart`.**
      **Tests assert:** activating a day changes the panel's day; the selected
      state is conveyed without colour; `revalidate = 900` and the empty
      `generateStaticParams` are unchanged, because the day never enters the URL.

- [ ] **`MeasuredToday`.** The three cards' content, merged into today's panel:
      water temperature, the buoy's wave height, the station's wind and gust, the
      station's air temperature — each with its station and distance. Today only;
      the other six days say plainly that nothing has been measured about a day
      that has not happened. _New component, absorbing `TideToday`, `WavesToday`
      and `WindToday`._
      **Tests assert:** all four states survive the move intact — reading,
      no-station, unavailable, no-reading — and the two that look alike stay
      distinct; each figure still names the station that supplied it, per
      ADR-0010; the distant-station disclosure still fires past 5,000 m.

- [ ] **Remove the slab and reorder the page.** `ConditionsSection` loses the
      three-card grid and the standalone reserved slot; the order becomes header,
      week, day. `TidePanel`, `WavePanel` and `WindPanel` stop being page-level
      cards and their reads move behind the day panel. `TideToday`, `WavesToday`
      and `WindToday` are deleted. _Modifies `ConditionsSection` and the three
      panels; removes three components._ **Depends on: `MeasuredToday`.**
      **Tests assert:** every reading that was on the page before is still on the
      page after — this is the task where a measurement could silently vanish; the
      three suspense boundaries still fail apart, so one quiet agency does not hold
      up the others.

- [ ] **ADR: a forecast may sit beside a measurement without displacing it.**
      ADR-0019 declined to decide whether wind and temperature could move from the
      air station to the grid cell. Record that this design does not move them —
      today shows both, each attributed — which is the outcome ADR-0019 was
      protecting.

- [ ] **ADR: cloud thirds give way to a curve.** Supersedes ADR-0024's mechanism
      and keeps its finding: one number does not describe a burn-off day, and a
      curve does not reduce to one number. Note that ADR-0024's deferred
      `shortForecast` read is taken in this PR, as it said it should be. _ADR-0024
      warns that "anything that restores a single daylight figure to this row
      reverses this" — a continuous curve is more resolution, not less, and the
      ADR must say so explicitly or it will read as a reversal._

- [ ] **Coverage floor.** As PR 1.

---

## PR 3 — The spatial half

The map and the compass. Two of its four build tasks are independent of PR 2 and
could be worked in parallel with it: the coastline geometry and its checker touch
nothing the chart touches. **`Compass` is not independent** — it needs the
gridpoint wind direction that PR 2's first task adds, so it cannot start until
that has merged. `ShoreMap` can be built and reviewed before it.

- [ ] **Coastline geometry.** A module in `src/lib/` that de-duplicates
      consecutive identical points, windows the polyline around a beach, and
      projects lat/lon to plot coordinates. **The de-duplication is not
      housekeeping**: 123 of the 1,210 MOP lines repeat their neighbour's
      coordinates, and the resulting zero-length segments silently corrupt any
      tangent or side test — they already produced one wrong answer during this
      brief's own probing. _New module. `scripts/geo.mjs` is **not** reused: it is
      a build-side `.mjs` for the joins, and this is runtime TypeScript in `src/`._
      **Tests assert:** the dedupe returns 1,087 distinct points from the committed
      1,210, so the count is pinned against the real file and a future data change
      fails loudly; a zero-length segment is never returned; the projection is
      stable for a fixed window.

- [ ] **Checker: which side is the sea.** With duplicates removed, all 13 wave
      buoys fall on the left of the polyline walked south to north. That rule is
      load-bearing for the map's water shading and too important to assume, so it
      gets a script in the shape ADR-0021 established, plus a row in the gate
      table. _New script and gate row._ **Depends on: coastline geometry.**
      **Tests assert:** the checker fails when a buoy is moved to the wrong side,
      not merely when it errors.

- [ ] **`ShoreMap`.** This beach's coast drawn from the windowed polyline, its own
      segment marked, the sea shaded, and the four sources plotted at their real
      distances — the MOP line, the wave buoy, the tide station, the air station.
      Distances come from `beaches.json`, which already holds them; nothing is
      recomputed at runtime. This is ADR-0010's requirement drawn instead of
      written. _New component._ **Depends on: coastline geometry.**
      **Tests assert:** a beach with no MOP line — 26 of 51 — renders a map without
      that marker and says so rather than plotting nothing silently; each marker
      names its source; the map draws no judgement, no depth and no hazard.

- [ ] **`Compass`.** Two needles on the map: wind from, and swell from, each with
      a translucent arc for the range it swings through during daylight. A
      provenance line per needle, following `WeekGrid`'s resolution rather than
      `StatGroup`'s contract. _New component, rendered onto `ShoreMap`._
      **Depends on: `ShoreMap`, and gridpoint wind from PR 2's first task.**
      **Tests assert:** the accessible name states both bearings in words and
      degrees; the two needles differ in shape and weight, not only colour; the
      arc widens with the day's spread; `mission-bay-vacation-isle`, whose segment
      has an upper equal to its lower, renders without a shore reference and says
      why rather than drawing a confident wrong dial.

- [ ] **The sighting layer stays reserved.** `ReservedSlot` moves inside the map:
      the frame is real content now, and what is coming is the sightings drawn on
      it. The copy names what lands there and carries no issue number, per the
      standing rule. _Reuses `ReservedSlot`._

- [ ] **ADR: the map becomes real and reserves a layer.** Amends what a reserved
      slot is in this repo — a stand-in for content, which may now sit inside real
      content rather than instead of it. CONTEXT.md's `Reserved slot` entry is
      updated in the same PR, since it is the glossary that defines the term.

- [ ] **The row.** Chart and map side by side at `xl` at roughly two thirds and
      one third; stacked at `lg` with the map at reduced height; one column below
      that, chart then map. _Modifies `ConditionsSection`._ **Depends on:
      `HourChart` (PR 2), `ShoreMap`.**

- [ ] **Coverage floor.** As PR 1.

---

## Across all three

- [ ] **Accessibility pass.** Per PR, not saved to the end. Text equivalents for
      the chart and the compass; every new colour pair measured rather than
      assumed — series strokes clear 3:1 as graphical objects and any text on them
      clears 4.5:1; colour never the only channel separating two series, night from
      day, or a published point from an interpolated one; 44px touch targets below
      `md`; the site's `currentColor` focus ring inherited, never redefined;
      `prefers-reduced-motion` respected if any transition is added.

- [ ] **Domain language.** CONTEXT.md gains the terms this work introduces and
      picks one word for each — the sparkline, the day panel, the dial, the shore
      map. The glossary is the thing kept current; a term used in three components
      under two names is the drift it exists to prevent.

- [ ] **Plan file.** `docs/plans/conditions-day-view.md`, committed as its own
      first commit before PR 1's first slice. Required here rather than optional:
      this will not finish in one sitting, and it turns on choices someone will
      re-litigate — the compass's home, the fate of the cards, the cadence
      treatment. Marked historical in the PR that merges the last of the work.

## Review

- [ ] **Design review.** Run `/design-review` against the brief once PR 2 has
      merged and there is something to look at. Capture at 1536×639 as well as the
      standard breakpoints — that is the viewport this is reviewed on, and a
      layout that only works taller is not finished.

---

## Build notes

**Clear `.next/` before believing anything about the built stylesheet.** The
`stylesheet` gate reads what the build emitted, and Next's cache will happily
serve a stylesheet from before a Tailwind source change.

**Tailwind's source detection is opt-in** and scans `src/` only (ADR-0006). A
utility named in this file or the brief compiles nothing, which is what makes
"the class is in the built CSS" evidence that a component uses it.

**Do not start a task whose blocker has not merged.** Rebasing half-finished work
onto a moved blocker is how a verified slice quietly stops being verified.

**Noticing is not filing.** The duplicate-coordinate finding goes in the PR body
for the coastline slice, not into the tracker as a separate row.
