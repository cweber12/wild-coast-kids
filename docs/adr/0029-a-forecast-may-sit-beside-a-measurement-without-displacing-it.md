# 0029 — A forecast may sit beside a measurement without displacing it

Date: 2026-08-29. Status: accepted.

Takes the decision ADR-0019 deferred by name, in the direction ADR-0019 was
protecting. Extends ADR-0016 from one product to the general case, and it does
not widen it: the condition ADR-0016 attached to its own precedent — that the
two answer different questions and the page says which — is the condition here
too.

## Context

Three things landed on `/conditions` between 2026-08-28 and today, and together
they created a duplication no document explained.

The day chart gained a **wind** tab and a **temperature** tab, drawn from the
National Weather Service's forecast for this beach's own grid cell — a square
about 2.5 km across, forecast in blocks of one, three or six hours. The chart
draws twenty-four of them.

The three now-cards came off the page, and the two that carried measurements
moved into the day panel as `MeasuredToday`. It states the **air temperature,
the wind and the gust** measured at the shore station this site binds — at La
Jolla Shores, Scripps Pier, 1,381 m away — and the buoy's **wave height, period
and water temperature**.

So the page now carries two winds and two air temperatures for one beach, a few
hundred pixels apart, and a swell curve above a measured wave height. One of
each pair is a model and one is an instrument.

**ADR-0019 named this and declined it.** Its last consequence reads:

> A future modelled product inherits a precedent, and it does not generalise
> for free — the same caution ADR-0016 attached to its own. What makes this
> acceptable is that the model replaces a measurement the site would not have
> published anyway, and that the page says so. **A model displacing a
> measurement the site _would_ have published is a different decision and is
> not made here.**

That is this decision. The wind and the temperature at Scripps Pier are
measurements the site does publish, from a station 1.4 km from the sand that
ADR-0010 went to some trouble to bind — its argument was that requiring one
station for four values let the scarcest of them drag the temperature ten
kilometres inland, where the air read 81 °F against the pier's 72 °F.
ADR-0020 then confirmed the binding survives: "Temperature and wind — p50
3.7 km, max 7.4 km — are untouched, which is what ADR-0010 split the
provenances to protect."

`docs/plans/conditions-day-view.md`'s addendum of 2026-08-29 records the gap
this leaves in the meantime, and this document closes it.

### What the two actually say, measured

Probed 2026-08-29, La Jolla Shores Beach. The station's newest observation was
stamped 18:00 UTC — 11:00 AM Pacific — and the cell's forecast run was issued
at 07:13 UTC the same morning, so the forecast below is about eleven hours
ahead of its issue for the hour the instrument measured.

|                 | Grid cell `SGX/54,21`    | Scripps Pier `LJAC1`, 1.4 km |
| --------------- | ------------------------ | ---------------------------- |
| Air temperature | 24.4 °C — **76 °F**      | 24.3 °C — **76 °F**          |
| Wind speed      | 11.1 km/h — **7 mph**    | 0.5 m/s — **1 mph**          |
| Gust            | 13.0 km/h — **8 mph**    | 1.5 m/s — **3 mph**          |
| Wind direction  | 260° — **from the west** | 280° — **from the west**     |

**The temperature agrees to a fraction of a degree and the wind disagrees by a
factor of six.** On this site's own bands that is not a rounding difference: 7
mph is "a light breeze" and 1.1 mph is "barely any wind", and a reader deciding
whether to bring a windbreak gets a different answer from each.

One instant is not a validation study and nothing here claims it is. What it
establishes is the only thing this decision needs: that the two are capable of
disagreeing enough to matter, at the beach the site opens on, on an ordinary
day.

## Decision

**A forecast may sit beside a measurement on this page. It never replaces one,
and the two are told apart by form before they are told apart by words.**

Concretely, and all four clauses are load-bearing:

- **The measurement keeps its figure.** The station's air temperature is the
  lead figure of the air card and the buoy's height is the lead figure of the
  sea card, whatever the model says. A quiet instrument leads with nothing
  rather than promoting the forecast into the slot a measurement had — which is
  the one thing ADR-0016 already refused outright, held to here for the wind
  and the temperature as well as for the waves.
- **Form carries the distinction, and words confirm it.** The brief's second
  principle: _a model is drawn; a measurement is stated_. The forecast is a
  continuous curve with the publisher's own issued points marked, so its true
  resolution is visible; the measurement is a discrete figure with a station
  name and a distance beneath it. A reader can tell which kind of claim they
  are looking at before reading a word.
- **Each keeps its own attribution, and one never covers both.** ADR-0010's
  rule is unchanged: one `StatGroup` never spans two sources, and the chart's
  provenance names the cell while the card's names the station. The label is by
  **kind** and not by distance — "Measured now" against the chart's forecast —
  which is ADR-0016's finding, and it matters more here than there, because the
  cell is not further away than the station in any useful sense.
- **They answer different questions, and that is what makes the pair honest
  rather than merely tolerated.** The measurement answers "what is it doing".
  The forecast answers "what will it do for the rest of the day, and what will
  Thursday be like". Neither can answer the other's question: a reading of now
  says nothing about six hours from now, and a cell average says nothing about
  the air at the pier this minute.

**And the converse is decided at the same time: a forecast may _not_ sit beside
a forecast.** The rule above buys a duplication with a distinction. Two model
outputs of the same product have no such distinction to buy it with — they are
one claim printed twice, which is the redundancy this whole redesign exists to
remove. That is why the tide card and the wave card's MOP block came off the
page in the same pull request as this document: the tide card's lowest daylight
low is NOAA's prediction, already in the week grid's first column and drawn in
full by the chart, and the MOP block is CDIP's model, drawn in full by the swell
tab. Neither was a measurement, so neither had this decision's protection.

**ADR-0019's disclosure is a condition of this decision as well as of that
one.** At the ten beaches admitted under ADR-0019 there is no measured wave
height at all, and the sea card says so before it says anything else. In the
move it stopped pointing at a forecast block beneath it — that block no longer
exists — and now names the chart and the week where the modelled heights are,
unconditionally rather than only when CDIP answered. Weakened, it takes
ADR-0019 with it; this states that it was not.

## Alternatives considered

**Let the cell answer for wind and temperature, and drop the station.** One
wind, one temperature, one provenance, and the figures would come from the same
source as the rest of the chart. Rejected on the measurement above and on
ADR-0010: 7 mph against 1 mph is the model describing a 2.5 km square and the
instrument describing the pier, and the instrument is 1.4 km from the sand. It
is also displacement in the exact sense ADR-0019 refused to authorise — a model
replacing a measurement the site does publish — and taking that step by
omission, in a layout slice, would be the worst way to take it.

**Drop the wind and temperature tabs, and let the station answer.** The mirror
image, and cheaper: two fewer tabs and no duplication. Rejected because the
tabs are the only thing on the page that answers "what will it do", which is
what the brief says a parent came for. A measurement of eleven o'clock cannot
be redrawn as four o'clock, and a chart of one point is not a chart.

**Splice the measurement into the curve as its "now" point,** so there is one
line and the instrument anchors it. Tempting, and it is precisely the shape
ADR-0010 forbids: two provenances behind one sentence, here behind one stroke.
The measured wind would be a kink in a forecast curve with nothing saying the
kink came from somewhere else, and on the figures above the kink would be the
size of the whole day's variation. `WeekPanel` already declined the same move
for the wave row — "a row whose first column came from somewhere the other six
did not is a harder thing to attribute than the disagreement".

**Label the pair by distance rather than by kind** — "1.4 km" against "this
2.5 km cell" — and let a reader prefer the nearer one. Rejected on ADR-0016's
own reasoning: which is nearer is not the distinction a reader has to make.
It is worse here than it was there, because the cell contains the beach, so
"nearer" is not even well defined.

**Reconcile them, and show one number with an uncertainty.** Rejected under
ADR-0009: combining a model and a measurement into a single figure is forming a
forecaster's judgement, which is the line this site does not cross. It would
also be inventing a statistic no publisher issues.

**Say nothing and let the page carry both.** What has actually been happening
since the wind and temperature tabs landed, and the reason this document is due
rather than optional. The duplication is defensible, and undocumented it looks
like an oversight — the next person to notice two winds on one page will remove
one, and the argument for keeping both will have to be rebuilt from scratch.

## Consequences

- **The page publishes two winds and two air temperatures for one beach, on
  purpose, and this is now the document that says so.** Anything that removes
  one of them on the grounds that the page says it twice reverses this
  decision, and it will look like removing a duplication.
- **The forecast may never take the lead figure.** `ReadingCard`'s empty-figure
  rule and this clause are the same rule seen twice: a quiet instrument renders
  no figure rather than a modelled one. A change that fills that slot from the
  grid cell is this decision reversed, whatever it is called.
- **A forecast beside a forecast has no defence here and should be cut.** The
  test is not "is it duplicated" but "is one of them an instrument". Applying
  it removed two blocks in this pull request and would remove any successor
  that reprints a modelled figure the chart already draws.
- **Water temperature has no counterpart and is not owed one.** No product this
  site reads forecasts it, which is recorded in the brief's out-of-scope list.
  It sits in the measured block as a measurement with no model beside it, and
  that asymmetry is a fact about the feeds rather than a gap to fill.
- **ADR-0019's deferred question is closed in the direction it leaned.** That
  decision's protection — a model does not displace a measurement the site
  would publish — is now stated affirmatively rather than left as a boundary on
  what its own precedent covers. Its four-turned-ten beaches are unaffected:
  there the model does not displace a measurement, because there is none.
- **The comparison in this document is one instant, and the next person who
  wants a stronger claim has to measure again.** `scripts/` already runs weekly
  probes in the shape ADR-0021 established; a probe comparing bound stations
  against their cells would turn the table above into a series. It is not
  written here, and this decision does not depend on it — it depends only on
  the two being able to disagree, which one measurement is enough to show.
