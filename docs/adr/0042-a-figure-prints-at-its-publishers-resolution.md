# 0042 — A figure prints at the resolution its publisher issues

Date: 2026-09-01. Status: accepted. Settles the question #191 was filed to ask.
Changes no decision before it; the tide and the swell print exactly what they
printed.

## Context

The day chart states the forecast cell's wind at two precisions. Four places on
the chart use one decimal — the axis labels, the summary sentence under the
plot, the per-hour readout, and the per-hour label a screen reader lands on —
and a fifth, `gridDescription`, which is the plot's own accessible name, uses
none. On a fractional value those are not two renderings of one number. They are
two numbers, and both reach the same reader in the same gesture: the plot is
named "Wind today, from 2 to 12 mph", and arrowing to the hour it happens at
says `11.5 mph`.

It bites only where the value is not already whole, which is why it went a long
time unseen. Tide and swell agree always, because their descriptions are one
decimal like the chart. Air temperature agrees always too, for a reason worth
being exact about below.

The question underneath is which precision is the true one, and that is not a
matter of taste. It is a fact about what the publishers issue, and it had never
been measured. It has now.

### What each publisher actually issues

| product  | publisher                     | the grid it publishes on                    |
| -------- | ----------------------------- | ------------------------------------------- |
| Tide     | NOAA CO-OPS predictions       | thousandths of a foot                       |
| Swell    | CDIP MOP model                | continuous — eight decimal places of metres |
| Wind     | National Weather Service, SGX | **whole knots**                             |
| Air temp | National Weather Service, SGX | **whole degrees Fahrenheit**                |

The cell's two rows are the finding. The gridpoint endpoint declares
`wmoUnit:km_h-1` and `wmoUnit:degC`, and both are conversions of something
coarser:

- Every published wind speed is an exact multiple of 1.852 km/h, which is one
  knot. Measured over **400 values across six of this coast's cells** — SGX
  54,21 · 53,14 · 54,17 · 55,25 · 57,32 · 58,38, read live on 2026-09-01 — and
  over the 61 values in the committed fixture from 2026-08-28. Not one was off
  the knot.
- Every published temperature converts to a whole degree Fahrenheit. **606
  values over the same six cells**, and the fixture's 60. Not one was off.

So `11.5 mph` is ten knots, twice converted. The tenth is an artefact of
arithmetic this repo performed, not a figure anybody forecast. And the honest
reading of the temperature tab is the reverse of how it looks: it agrees not
because the code is consistent there but because the value happens to arrive
whole, which is a habit upstream rather than a property of this page.

This is specific to the forecast. The same agency's **observations** are a
different grid — hundredths of a metre per second, 2.60 and 0.89 m/s in the two
committed fixtures — so `MeasuredToday` rounding a reading to whole mph is a
coarsening for its own reasons, and not this decision's business.

### Whole miles per hour costs nothing

One knot is 1.15078 mph, which is more than one. So rounding the published grid
to whole mph never collapses two forecasts into one figure: over 0 to 60 knots
there is not a single collision. **Every distinction the forecaster made
survives.** What does not survive is a tenth nobody issued.

The grid shows through as gaps — no whole-knot wind lands on 4, 11, 19, 27, 34,
42, 50, 57 or 65 mph — and that is the forecast's own resolution being visible,
which is the point rather than a defect.

## Decision

**A figure prints at the resolution its publisher issues, and one product has
one precision wherever the page states it — on the axis, in the summary, in the
readout, and in every sentence spoken to a reader who cannot see the plot.**

Concretely:

- The cell's wind and air temperature print **whole units** everywhere.
- The tide and the swell keep **one decimal**, which is a coarsening of sources
  finer than that and stays honest.
- **Precision is declared where the unit is declared.** `HourSeries` already
  carries the unit, the spoken description and the absence sentence together,
  on the stated grounds that they differ per product and have to move as one.
  Precision is the fourth such thing, and it goes in the same object.
- `gridDescription` reads that declaration rather than owning a second rule.
  The defect was never a wrong constant; it was two places entitled to choose.

A product added later declares its precision where it declares its unit, and
the reason it chose that precision belongs beside it.

## Alternatives considered

**One decimal everywhere.** The smallest possible diff: `gridDescription`
changes two characters and the five statements agree. Rejected because it makes
the page consistent about a claim that is false. A tenth of a mile per hour is
finer than anything the National Weather Service issued for this cell, and the
contradiction was the symptom that led to the measurement rather than the
disease.

**Wind only, leaving temperature as it is.** Fixes what a reader can hit today
and nothing else. Rejected because the defect is the two rules and not the one
number: air temperature is governed by the same pair of rules and disagrees only
when the values stop arriving whole. That is an upstream habit, not a guarantee,
and there is no test that could catch the day it changes.

**Print knots.** It is what the forecaster issued, and it is what this coast's
sailors would want. Rejected on audience: the page is for parents deciding
whether to take children to a beach, and it states wind in mph everywhere
including the measured card. Trading a reader's unit for the publisher's would
buy exactness in the one place it costs comprehension.

## Consequences

- The wind figure changes on the page. `11.5 mph` becomes `12 mph` on the axis,
  in the summary, in the readout, in the per-hour label, in the plot's name, and
  in the compass readout and its "Biggest wind in daylight" line — which is the
  whole content of the decision.
- The air temperature loses a trailing zero it was never entitled to: `74.0 °F`
  becomes `74 °F`. No value changes, because none ever had a fractional part.
- The forecast and the measured card now agree on how a wind speed is written.
  They disagreed before — whole on the reading, a tenth on the forecast — and
  nobody had filed it.
- **A test can hold this.** The assertion that catches the next drift compares
  the spoken range against the drawn axis rather than either against a literal,
  because a test pinning `"from 2 to 12 mph"` would pass with the axis still
  saying `11.5`. It needs a fixture whose values are not whole, and the honest
  one is knot-derived: ten knots is 11.508 mph.
- The claim that the cell publishes whole knots is measured, not documented
  upstream. If it ever stops being true the page will print a rounded figure
  rather than a wrong one, which is the failure this decision can afford.
