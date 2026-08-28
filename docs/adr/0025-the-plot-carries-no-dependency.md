# 0025 — The plot carries no dependency, and it fulfils ADR-0023

Date: 2026-08-28. Status: accepted.

## Context

The conditions page has started drawing. `DaySpark` puts a twenty-four hour
tide curve behind each day of the week grid, with night shaded and cloud washed
across it, and the day view planned in `docs/plans/conditions-day-view.md` adds
an hourly chart with four tabs, a coastline map and a two-needle compass. That
is four plots, and none of them existed when the page's dependency budget was
last argued about.

This repo runs on three runtime dependencies — `next`, `react`, `react-dom` —
and guards that number deliberately. A chart is the classic reason to break
such a budget, so the decision is taken now, at the first and smallest plot,
rather than at the third one where the answer is already implied by two
existing call sites.

Three facts about this particular plotting problem:

- **The largest series in the whole design is 196 points.** Measured against
  the live gridpoint `SGX/54,21` on 2026-08-28: `windSpeed`, `windDirection`,
  `windGust` and `skyCover` each cover 196 hours gapless after expansion. The
  tide series this PR draws is 240 rows for ten days, of which one day — 24
  points — is drawn at a time. Nothing here is a dataset.
- **The plot must render on the server.** `/conditions` and
  `/conditions/[slug]` are static with `revalidate = 900`, and the week grid is
  the page's text equivalent for itself. A chart that needs a client to appear
  would put the page's primary content behind JavaScript. `BeachSelector` is
  this page's one client component and it ships a `noscript` equivalent that
  does the same job in plain markup; a plot that could not do likewise would be
  the first thing on `/conditions` that is simply not there without a script.
- **The geometry is arithmetic.** Two linear maps, instant to x and value to y,
  and a path string. `DaySpark` is about thirty lines of it.

## Decision

**Every plot in this design is hand-rolled SVG. No charting dependency is
added, now or for the day chart, the map or the compass.**

And, because a reviewer will reach for it first: **this fulfils ADR-0023 rather
than reversing it.**

ADR-0023 moved the daylight window into the day header and left the rows
carrying only the figures inside it, dropping the day's own overnight extreme
from six cells of seven. It did that on a measurement — the label such a figure
needs, "Lowest daylight tide", renders 170px against 125px of cell — and it
said in as many words that the figure was gone "until a day view carries them".
It kept `allDay` on `TideWeekDay` and `WaveWeekDay` in `lib/conditions.ts` for
exactly that, so this work would be cheap.

So the sparkline is that debt being paid, and the direction matters:

- **The header window is untouched.** Still stated once, above the figures.
- **The daylight-selected figure is untouched.** Still the extreme between
  sunrise and sunset, still selected by `readWeekOfLowestLows` from the turning
  points — never read off the hourly series, which would round 3:13 PM to 3:00
  PM and the height with it.
- **No second figure enters the cell.** That is the whole of what ADR-0023
  measured as not fitting. A drawn overnight low needs no label, which is why
  it fits where a number did not.
- **The sentence beneath the grid stays.** ADR-0023 made the drop conditional
  on saying so on the page, and the shape appearing does not discharge that:
  today's overnight figures are still on the cards above, and the grid still
  says where they went.

Anything that puts an "all day" **figure** back in a week cell still reverses
ADR-0023. Drawing the hours that figure was selected out of does not.

## Alternatives considered

**A charting library** — Recharts, Victory, Chart.js, or similar. The obvious
answer and the reason this document exists. Rejected on three counts, any one
of which would be enough here: it is tens to hundreds of kilobytes against a
196-point ceiling; the React charting libraries are built around client-side
measurement of a container and do not render meaningfully on a server; and the
plots this design needs — a night band, a cloud wash, published-point marks, a
coastline, a two-needle compass — are not what any of them ship. Most of the
work would be fighting a default axis, a default legend and a default tooltip
back out again, all of which the brief's aesthetic direction lists under
anti-references.

**A small sparkline library.** Cheaper than the above and still a dependency:
something to audit, update, and discover unmaintained. It would also draw only
the curve, and the curve is the part that was already thirty lines — the night
band and the cloud wash, which are the parts that make this shape mean
something, would be hand-rolled beside it anyway.

**D3, for its scales alone.** `d3-scale` is small and good. Rejected because
two linear interpolations are not a reason to take a dependency, and taking one
module of D3 is how a project ends up with six.

**Canvas.** Rejected: nothing in a canvas is in the DOM, so it has no
accessible content, cannot be asserted by a test without pixel comparison, and
does not render on the server at all. Every branch of `DaySpark` — including
the empty series — is assertable today precisely because the output is markup.

**A pre-rendered image, generated at build.** Rejected: it would need a build
step, could not take the reader's own daylight window, and would carry its
meaning in pixels rather than in an accessible name.

## Consequences

- **Every plot is ours to write and ours to get wrong.** There is no library to
  blame for an axis and none to fix it either. The mitigation is that the
  geometry is small enough to test directly: `DaySpark`'s tests assert the path
  data, the band positions and the mark count, which a library would have
  hidden behind a component boundary.

- **One series shape, shared.** `DaySpark` and the day chart to come take the
  same points and draw the same two background layers. That sharing is the
  design's first principle — one instrument at two zoom levels — and hand-rolling
  is what makes it enforceable rather than aspirational: there is no library
  contract in between for the two to satisfy differently.

- **Thresholds are measured, not configured.** A library would have offered a
  `responsive` prop; instead the width below which the shape stops reading was
  measured on the built page and encoded as `MIN_USEFUL_SPARK_WIDTH_PX`, with
  the ladder of widths in its docstring and a container query enforcing it. That
  is more work and a better record.

- **The budget stays three.** `next`, `react`, `react-dom`. The next document
  that wants to change that number now has this one to argue with.

- **This is revisited if the problem changes shape.** The trigger is stated so
  it is not a matter of taste later: a series that runs to thousands of points,
  a plot that needs interactive zoom or brushing, or a projection more involved
  than the linear one the shore map needs. None of those is in
  `docs/plans/conditions-day-view.md`, and if one arrives, this decision is
  where to start rather than a rule to work around.
