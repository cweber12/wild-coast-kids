# 0028 — The day carries a curve, and the week keeps its thirds

Date: 2026-08-29. Status: accepted.

Extends ADR-0024 to a second zoom level and discharges the read it deferred.
**It supersedes nothing in it.** The row ADR-0024 built is untouched — same
three means, same labels, same em dash for a third the forecast did not reach —
and this document exists partly to say so, because a decision that adds an
hourly cloud band to the same page will otherwise be read as the reversal that
ADR-0024's last line warns about.

## Context

ADR-0024 replaced the week's single daylight cloud mean with three, and it left
two things open on purpose.

The first was the wording. It measured this site banding the daylight mean on
the National Weather Service's own sky-condition scale and disagreeing with the
National Weather Service on three days of six — "we would print Partly cloudy;
its forecast endpoint says Mostly Sunny" — and concluded that the words are the
publisher's to give, on `shortForecast` at `/gridpoints/{cell}/forecast`. It
deferred that read in one sentence: _"A day view is planned that will want that
read anyway, and taking it once, in the shape that view needs, is better than
taking it twice."_

This is that view. It takes that read.

The second was scope. ADR-0024 is a decision about one row of one grid, made
when that row was the only place cloud reached a reader. Two things have moved
since. ADR-0026 took the cloud wash off the week's sparkline, on a review
finding that two greys of similar weight in a 21px frame have to be told apart
before either says anything — which left the thirds row as the only thing the
week says about the sky. And the day panel now draws an hourly cloud band above
its plot, from the same `skyCover` series, at a size that can carry it.

**So the question ADR-0024 never had to answer is now live: when the same
forecast is drawn hour by hour one region down, does the row still earn its
place?** `.design/conditions-day-view/DESIGN_BRIEF.md` said no. It lists
`SkyWeek` as _Modify — "Thirds give way to the cloud wash carried on every
sparkline"_, and the plan's addendum of 2026-08-28 records why that is a
conditional rather than a decision, and why the condition expired: there is no
wash on the week for the thirds to give way to.

## Decision

**The day view carries a continuous curve. The week keeps its three means.
Both, deliberately, from one product.**

- **The row is not reduced, reworded or removed.** ADR-0024's `thirds` still
  render at the same three labels. Nothing about that row is in this decision
  except the finding that a chart below it does not displace it.
- **ADR-0024's deferred read is taken here**, at the zoom level it named, once.
  `readSkyWording` reads `shortForecast` and `SkyWording` prints it above the
  plot, verbatim, with the publisher's own period name and its own provenance
  line — the "second request, second failure mode, second provenance line"
  ADR-0024 costed, paid rather than avoided.
- **No band word is computed at either zoom level, and now there are two
  reasons rather than one.** ADR-0024's measurement stands. Added to it: the
  publisher's own sentence for the day is on the page, a few pixels above the
  chart, so a computed word here would not merely risk contradicting a source —
  it would contradict a sentence the reader can see at the same time. The
  chart's key states `0% / 50% / 100%` against three swatches, which says what a
  shade is worth without saying what the sky is like.
- **This is not the reversal ADR-0024 forbids, and the difference is
  resolution.** That decision's last line is _"anything that restores a single
  daylight figure to this row reverses this"_. Nothing here restores anything to
  that row. What arrives is twenty-four hourly values one region down —
  strictly more resolution than three means, from the same series, with the
  three means still printed. The failure ADR-0024 measured was a burn-off day
  averaging to a number that described neither half of it; a curve is the
  extreme opposite of that number, not a return to it.

## Why one product is drawn twice, which is the objection

The duplication is real, and it is the design rather than an oversight.

**What the band cannot do is put Sunday's morning beside Tuesday's.** It draws
one day, because the region it lives in is one day. Cross-day comparison is the
week's entire job — the same argument that rejected _compress the week to a bare
day strip_ during this brief — and a parent choosing which day to drive out is
asking a question the day chart structurally cannot answer, however good it is
at the day they have already chosen.

**They also answer at different costs.** The row is three numbers a reader takes
in without stopping. The band is a shape that has to be looked at. A grid meant
to be read at a glance and a chart meant to be read closely are not the same
instrument at two sizes; they are the two speeds this page was built to have,
which is the first principle of `docs/plans/conditions-day-view.md`.

## Alternatives considered

**Cut the row, now that the band exists.** The brief's own instruction, and the
version this ADR was originally titled for — "cloud thirds give way to a curve".
Rejected on the condition it rested on: the brief's sentence has the thirds
giving way _to the wash carried on every sparkline_, and ADR-0026 removed that
wash. Cutting the row now would leave the week saying nothing whatever about the
sky, and would do it in the name of a replacement that is not in the week at
all.

**Reduce the row to one figure, since the curve carries the detail.** Tempting
in exactly the way ADR-0024 predicted, because with a chart below it the row
looks like the redundant half. This is the reversal that decision forbids by
name, and the table at the top of it is the argument: the single figure was not
merely thin, it was wrong about all seven days measured. A chart one region down
does not make an average less misleading; it makes it easier to overlook.

**Draw the band in the week cells too, so the two regions match.** Rejected
already, on measurement, by ADR-0026 — two grey layers in a 21px frame, and the
first reader asked took the curve itself for the cloud. Restoring it here for
symmetry would reverse a decision made eight days ago on a review of the
rendered thing.

**Band the curve into words on the chart** — "Mostly sunny" over the band
instead of a percentage key. Rejected on ADR-0024's measurement, and worse here
than there: on the week grid a banded word would have contradicted a source the
reader could not see, and on this chart it would contradict `shortForecast`
printed directly above it.

**Have the week's sparklines follow the selected tab**, so the two regions are
one instrument in a stronger sense and this ADR's duplication question does not
arise. Not rejected here — it was rejected before the tabs were built, on the
tab bar's position and ADR-0023's cell having no room for a label, and the plan's
addendum of 2026-08-28 holds that reasoning. Named because it is the alternative
that would have changed this decision's shape, not because it is open.

## Consequences

- **One forecast is published twice on one page, at two zoom levels, and that
  is now a stated design rather than an accident.** Anything that removes the
  thirds row on the grounds that the day chart already covers it reverses this
  decision, and it will look like removing a duplication.
- **ADR-0024's deferred read is discharged and should not be taken again.**
  `readSkyWording` is the one call; `SkyWeek` still reads numbers from
  `readSkyWeek`, and the two are separate products at separate URLs that fail
  separately, which is why they carry separate provenance lines.
- **ADR-0024's "no band word is computed here" now holds at both zoom levels**,
  and the reason has strengthened rather than merely transferred. Any future
  component that turns `skyCover` into an adjective has to answer both halves.
- **`cloudOpacity`'s floor comes back from ADR-0026's history**, as that
  decision said it would. A cleanly-forecast 0% must not render like an hour the
  forecast never reached: one is a clear sky, the other is silence.
- **The band sits outside the plot frame rather than inside it**, which is the
  third arrangement this layer has had and the first in which no pixel belongs
  to both cloud and night. That is component detail rather than decision, and it
  is recorded in `HourChart`'s own docstring; it is named here because ADR-0026's
  finding was about two layers competing, and this is what answers it at the
  larger size.
- **The week still says nothing about the sky in a shape**, only in figures.
  That is ADR-0026's cost, unchanged, and this decision does not pay it back.
