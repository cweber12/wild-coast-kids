# 0035 — The page has one selected hour, and it starts at now

Date: 2026-08-31. Status: accepted. Supersedes one clause of ADR-0027, **"The
compass may not follow the selected hour"**; the rest of that decision, including
all four of its conditions, is unchanged and still binds. Reverses `ChosenDay`'s
rule that a chosen hour does not survive a day change. Adds the `Selected hour`
entry to `CONTEXT.md`, updated in the same pull request. Corrects one sentence of
ADR-0034, below. ADR-0032 and ADR-0034 are otherwise untouched.

## Context

`HourChart` can be asked which hour a reader is looking at — ADR-0027 built that,
with a prev/next pair clearing ADR-0004's touch floor and a roving tabindex. The
readout in the corner of the shore map does not listen. A reader stepping through
the afternoon watches the chart's figures change while the wind and swell rows
sit on a day aggregate. That is issue #193.

ADR-0027 declined this explicitly, and its reason is not about hover:

> a needle whose meaning changes depending on what was last clicked is a
> different instrument from one showing the day's dominant direction […] Anyone
> building `Compass` in #173 should read that rejection as standing.

**The first design for #193 conceded that objection rather than answering it.**
It proposed a block with two modes — the day's figures on arrival, one hour's
after a click — and argued the wedge disambiguated them: the wedge is the day's
swing, the arrow is this hour read against it. It does not disambiguate. With
nothing selected the arrow sits at the day's resultant, which is inside the
wedge by construction; with 3 PM selected it sits at 3 PM's bearing, also inside
it. **The two modes draw the same picture**, which is precisely the needle
ADR-0027 refuses.

Asked what the map should show, the reviewer's answer was neither half of that
design: the current wind and swell, and then whatever hour the reader moves to.

**With no day mode, there is nothing to change meaning between.** The arrow is
the wind at one hour, before any click and after every one. ADR-0027's real
demand — "two needles that always mean the same thing on all seven days is worth
more than one striking exception" — is met literally instead of argued around,
and it is met by removing the exception rather than by justifying it.

## Decision

**The page holds one selected hour, shared by the hour chart and the map's
readout, and it starts at the current hour.**

- **It is an hour, not an instant.** `selectedMs` is `useState` local to
  `HourChart` today. It lifts into a context mirroring `selectedDay.ts`,
  including that module's deliberate default: rendered outside the provider a
  region shows the default and offers no choice, which is the state a reader
  with a blocked script is in. An hour survives a tab change — which is the
  property `HourChart`'s comment gives for holding an instant in the first place
  — **and** a day change, which an instant cannot.

- **The default is the current clock hour, resolved against whichever day is
  showing.** Six of the seven days have no "now": `DayPanel` sets `nowMs` from
  `day.isToday` and null otherwise. So at 3:40 PM every day defaults to its own
  3 PM. One rule, one meaning on all seven days, and it is how a forecast is
  actually read — what is Thursday like at this time.

- **That hour is computed on the server and passed down.** The page carries
  `revalidate = 900`, so a client reading its own clock would disagree with a
  fifteen-minute-old cache across an hour boundary and hydrate wrong. `nowMs`
  already works this way for the chart's now-line; this needs the Pacific clock
  hour instead, because six days carry no `nowMs`.

- **The chart arrives with that hour marked, and says what it is.** The
  selection's guide and mark are already outside `HourChart`'s `mounted` gate,
  so a default selection renders them on the server for free. Its sentence is
  not, and moves out with them: a marked point with no explanation is worse for
  a reader without JavaScript than either extreme. **The prev/next pair and the
  hour columns stay gated**, which is the half of ADR-0027's rule that was about
  controls being dead rather than about statements being absent. A readout that
  is filled on arrival makes no announcement, because `aria-live` does not
  announce initial content.

- **A chosen hour carries across days.** Reverses `ChosenDay`, which presents
  the opposite as a virtue — "The _hour_ they chose does not survive, and that
  also falls out rather than being arranged." It fell out of holding an instant.
  Reverting a reader's deliberate choice on every day change is the one thing
  they cannot have meant, and comparing one hour across the week is the
  comparison `ChosenDay` itself says the week selector exists for.

- **The readout shows that hour, and the wedge stays the day's daylight swing.**
  The arrow is no longer daylight-bound and the wedge still is, so at a night
  hour the arrow may sit outside its own wedge. That is a true statement — that
  hour's wind came from a direction it never came from while the sun was up —
  and `needleSentence` already qualifies the wedge as "in daylight", so the
  accessible form is correct and only the visual is unqualified.

- **A caption names the hour, and it is always present.** Without it the block
  changes its numbers with nothing visible saying what they now mean, which is
  the failure this page is least entitled to ship. Always present rather than
  appearing on click, so the reserved box matches the ink in both states and the
  block never jumps. It also closes a gap that exists today: the block prints
  `11.5 mph` with no visible statement that it is the daylight peak.

- **The swell row is the nearest published step within ninety minutes, whole.**
  Each of CDIP's estimates owns the three hours centred on it, which is the
  bucket `ConditionsNotes` already explains; outside any bucket the row is
  withheld, and takes its provenance line with it under ADR-0032's existing
  rule. Height, period and direction all come off that one step, so the row
  never puts two instants beside each other — which is what `periodS` joining
  `WaveHour` is for.

- **The day's biggest wind moves into the provenance line rather than being
  lost.** See the correction below: the readout is the only place this page
  states that figure. `WaveWeek`'s rule already puts the superlative in the
  provenance label, so the label gains the figure and its hour. The lines sit
  outside the readout's box, so this costs none of the width that is the block's
  whole constraint.

**What this costs is the day-dominant direction, which leaves the map.** That is
the price and it is not disguised. The day survives as the wedge, which is the
reading ADR-0034 built the wedge for: a narrow one is a day that had a direction,
a near-blob is a day that did not.

## ADR-0027's four conditions still bind, and are met

- **Not by hovering.** Selection is by click, tap or key. Unchanged.
- **Only additively.** Nothing drawn or written goes behind a gesture. The one
  figure this design would otherwise have removed — the day's biggest wind — is
  kept, in the provenance line, which is why that clause above exists.
- **With a control that meets the touch floor.** No new control is added, so the
  prev/next pair's guarantee is inherited rather than re-owed.
- **Reachable without a mouse, and announced.** The roving tabindex is unchanged.
  The readout stays the page's one live region for this change: the corner block
  is not `aria-live`, because two live regions firing on one arrow-press means a
  keyboard reader hears the same change twice.

**ADR-0025 is untouched.** The plot still renders complete on the server. What
the server render gains is a marked point and its sentence; what it still refuses
is a button, and ADR-0027's test asserting that is unchanged.

## A correction to ADR-0034

ADR-0034 justifies drawing the readout on all 51 beaches partly on this: the cost
of withholding it "was that nearly half the inventory printed no wind figure
anywhere on the picture — **the same figure the week grid above states for every
one of those beaches**."

**The week grid states no wind figure.** `WeekPanel` declines it deliberately and
says why: temperature and wind "come from the air station rather than an
airport", ADR-0012 records them as among the best-founded readings here, and
"moving those to a forecast is the displacement ADR-0019 declined to decide".
The grid's rows are tides, swell, daylight and sky.

ADR-0034's decision is unaffected — the argument for drawing the block on all 51
beaches stands on its own without that clause, and stands more strongly, because
the figure was not available elsewhere after all. What the error did was hide
this decision's real cost until it was looked for, which is why it is recorded
here rather than left as a stale sentence in a merged document.

## What this does not license

**No readout may form a judgement**, which is ADR-0009's line and unchanged. The
caption names an hour; it does not say whether that hour is good.

**The wedge is not the arrow.** It stays the daylight swing on all seven days and
does not follow the selection. A wedge that meant daylight sometimes and midnight
to midnight at other times would be this decision's own ambiguity, moved from the
arrow to the mark behind it.

**A tooltip is still refused**, and hover still does not exist here.

## Alternatives considered

**Keep ADR-0027's clause and close #193.** Defensible: the clause was recorded
and the chart already tells a reader which hour they chose. Rejected because the
mismatch it leaves is real — the same page states an hour in one region and a day
aggregate in the region beside it, with nothing saying so — and because the
clause's actual demand is satisfiable rather than merely arguable.

**The two-mode block the plan proposed**: day figures on arrival, the hour after
a click. Rejected above — the two modes draw the same picture, so it is the
needle ADR-0027 refuses with an extra step.

**Today shows now; the other six days show the daylight peak.** Reads well, and
matches what a reader plausibly wants from each. Rejected: the figures change
meaning when a reader steps from today to Friday, with no click on the map. That
is the two-mode failure moved from the click to the day selector, where it is
harder to notice.

**The first daylight hour on all seven days**, so nothing depends on a wall
clock and the page renders identically whenever it is built. Trivially testable
and cache-stable. Rejected: it is not the current wind, which is the thing asked
for on the day a reader is standing in.

**The context defaults to null and the readout resolves null as "now".** Leaves
`HourChart`'s arrival state exactly as shipped. Rejected: nothing in the chart
then points at the hour the map is showing, on the six days that have no
now-line, so a reader cannot see where the figures came from.

**A chosen hour resets on a day change**, keeping `ChosenDay`'s docstring true.
Rejected: the default already resolves per day, so the shared value is an hour
either way, and reverting a deliberate choice buys nothing but a sentence.

**Widen the wedge to the whole day** so the arrow is always inside it. The more
consistent rule, and it costs the thing the wedge is for: `needles.ts` records
that the committed run swings across north in its first three hours — 340, 20,
150 — so a wedge measured end to end draws a near-blob on a day that was settled
from sunrise onward. It also narrows the daylight rule ADR-0023, `WaveWeek` and
the week grid all hold, for one mark.

**The swell row holds the last published step at or before the hour**, which is
what the plan wrote. Rejected on measurement: it is up to three hours stale where
the nearest is at most ninety minutes, and it has no answer at all at 00:00 and
01:00, because `hourlyWaveHeights` interpolates only forward and
`waveHoursByDate` buckets the previous day's 23:00 publication to the previous
date. Those hours were unreachable while the block was daylight-bound.

**Withhold the swell row on every unpublished hour**, so it appears only where
CDIP spoke. Maximally honest. Rejected: the row would blink on and off five
times in eight as a reader steps hour by hour, and a reader landing on an
unpublished hour sees a map that looks broken rather than reticent.

**Mark the daylight peak on the wind curve** instead of stating it in the
provenance. Keeps the readout pure. Rejected: a fifth mark on a plot already
carrying a now-line, night bands, a cloud band, published-point marks and the
selection guide — and it would need a rule for the other three tabs.

## Consequences

- **A second client fact joins `selectedDay`**, with the same shape and the same
  out-of-provider default, so the two are read the same way. That is now a
  pattern rather than a one-off, and a third would have somewhere to look.
- **`ChosenDay`'s docstring is wrong until it is updated**, and it is updated in
  the same pull request. Its argument for why the chart is not keyed on the day
  survives; only its claim about the hour does not.
- **`needles.ts` keeps its daylight half and gains an hourly one.** The wedge
  still needs `gridWindReadings`, and `peakInDaylight` still feeds the day figure
  that moved into the provenance line — so nothing there is deleted.
- **The map and the week grid may print different swell numbers for one day**,
  and `DayPanel` currently records the opposite as an invariant. The grid states
  the day's biggest daylight step and the map states the hour a reader is looking
  at. Each is labelled by its own caption and its own provenance line, which is
  the condition ADR-0010 and ADR-0029 set rather than an exception to them.
- **`READOUT_BOX` grows from 35 to 40 units** to hold the caption, which
  `corner.ts` measured as moving three beaches to a different corner:
  `pacific-beach`, `mission-bay-de-anza-cove` and `mission-bay-sea-world`.
- **This decision ships in two pull requests.** The context, the lift and the
  chart's arrival state land with this document; the readout's caption, its
  per-hour rows, the box growing and `periodS` land in the next one, and #194's
  animated field is blocked on that rather than on this. The decision is one
  decision and is written once; splitting it to match the branches would leave
  neither half able to state the argument.
- **`HourChart`'s hour arithmetic is wrong on the two DST days a year**, and this
  decision inherits it rather than fixing or worsening it. The hour is derived as
  `Math.round((point.atMs - startMs) / HOUR_MS)`, which is an index into the day,
  and `hourLabel` reads it as a clock hour — but `localMidnightOf` resolves the
  zone offset twice, so a fall-back day is 25 hours long and index 24 renders
  "12 PM", colliding with noon. The shared hour uses that same index convention
  and the caption prints through that same `hourLabel`, so the chart and the map
  can never disagree about what to call an hour, correct or not, and the fix
  stays a single-site one.
