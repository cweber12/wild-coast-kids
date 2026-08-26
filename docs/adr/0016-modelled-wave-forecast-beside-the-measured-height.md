# 0016 — A modelled wave forecast beside the measured height

Date: 2026-08-26. Status: accepted.

## Context

The conditions page shows one wave number: the newest significant wave height
from an NDBC buoy, on its own card, with the buoy named and its network stated.
That number is a measurement. It is also observation-only — there is no
arrangement of NDBC's feed that answers "what will Thursday be like", and the
week grid below the card held a reserved slot saying a wave forecast was coming.

CDIP's MOP model can answer it. The model publishes wave estimates at 10 m depth
about every 100 m along this coast, driven by the directional spectra real buoys
report and accounting for the island sheltering and refraction that dominate wave
height variability in the Southern California Bight. It reaches about seven days
ahead. Every one of this site's fifteen open-coast beaches binds a MOP line
between 117 m and 910 m away, against 1.6 km to 8.4 km for its buoy.

Filling the row therefore puts a second wave height on the page — and on today's
column, a second wave height for the same beach on the same day. One measured
fifteen minutes ago at a buoy kilometres out; one modelled for a point a few
hundred metres out, for a day that has not finished.

That is uncomfortably close to something this repo has already refused twice.
ADR-0009 argues against presenting a computed figure beside a published one when
both would read as the same kind of number with the same confidence — the reason
runup and total water level are out of scope for this work. ADR-0010 permits two
provenances behind one _panel_ and is explicit that what it does not permit is
two behind one _sentence_.

## Decision

**MOP fills the week grid's wave row, and appears a second time on the now-card
as a subordinate block beside the measurement. It never replaces the measured
reading and never becomes the card's lead figure.**

The two numbers are separated by what they are _about_, not by styling. The
measurement answers "what is it doing at the buoy this minute"; the forecast
answers "when does today's biggest swell reach this shore, and how big". That is
two questions, not two answers to one, which is what keeps this the permitted
shape under ADR-0010 rather than the forbidden one. Two wave heights presented as
the same reading of the same instant would be the forbidden one, and nothing here
does that.

Putting the forecast on the card as well as in the row was a later decision than
the rest of this document and reverses what the triage brief settled. The
argument that changed it: a parent checking one beach reads the now-band and
often stops there, so a forecast that lives only below the fold is a forecast
most readers never meet. The cost is that the collision moves from "one column of
a grid" to "one card", where the two figures are eighty pixels apart.

Four things make the distinction legible rather than merely true:

- **Each source has its own stat group and its own attribution, and one
  `StatGroup` never spans both.** This is the air panel's arrangement (ADR-0010)
  and it is doing more work here: the air card's two groups carry different
  quantities, and these two carry the same quantity in the same unit.
- **The two attributions are labelled by kind, not by distance.** "Measured now"
  against "Forecast today". Which source is nearer is not the distinction a
  reader has to make; which is an instrument and which is a model is.
- **Every attribution names the model in full** — the MOP line, CDIP and the
  Scripps Institution of Oceanography, the distance, and the clause "a model of
  the swell at 10 m depth, not a measurement". The wording lives in one module
  so the card and the grid cannot drift apart on it.
- **`ConditionsNotes` carries the model-versus-measurement distinction** as an
  entry of its own, in the block a reader goes to when they want to know what a
  number on this page means.

**The row's label names its own statistic** — "Biggest swell", the way the tide
row says "Lowest tide" — and the card's group repeats the selection in its stat
labels. A day has fifty-six estimates behind it and both places show one.

## Alternatives considered

**Replace the buoy reading with MOP's nowcast.** One wave number, one
provenance, no awkwardness — and MOP's point is nearer the sand than any buoy, so
the number would arguably describe the beach better. Rejected: it removes the
only measurement of the actual sea from the page in favour of model output, and
it changes the provenance line on a card that has already shipped. The forecast
is what this work is for; a better reading of _now_ is a separate claim, and the
measured case for it does not currently hold — no beach in this inventory can
even disclose a buoy distance, because the inventory bound and `WavesToday`'s
disclosure threshold are the same 10 km.

**Show both on the now-card as one set of figures.** Two wave heights for the
same instant behind one heading, in one stat group. This is precisely the shape
ADR-0010 forbids, and nothing about MOP makes it safer. What ships instead is
two groups with two attributions, which is the arrangement ADR-0010 permits and
the air panel already uses.

**Lead the card with the forecast when the buoy is quiet.** It would keep the
card's largest text from ever being empty. Rejected: the lead figure is where a
reader's eye lands first and is the one place on the card with no attribution
beside it, so a modelled number there would be read as measured. A quiet buoy
leads with nothing, which is what `ReadingCard` already does for a station that
cannot answer.

**Leave the row reserved until the two can be told apart some other way.** The
slot has been open since the grid was built and says a wave forecast is coming.
Keeping it open indefinitely because the page would then have two wave numbers
means the page never gets the forecast, which is the more useful of the two for
the reader this site is for — a parent choosing which day to go.

**Start the wave row tomorrow, so today has only the measured height.** It
removes the collision entirely and costs the grid its comparison: "is Thursday
better than today" needs today inside the comparison, which is the argument
`weekOfDays` already makes about the tide row repeating the tide card. A row that
skips its first column would also have to explain why.

## Consequences

- The measured height and the modelled one sit eighty pixels apart on the card
  and one above the other in today's column, and they will disagree — by more
  than rounding. Measured at La Jolla
  Shores on 2026-08-26 within one hour: the buoy 1.6 km offshore reported 0.6 m
  at 13 s, MOP's nowcast for the line 325 m out gave 0.33 m at 6.3 s, and the
  forecast product this page reads gave 0.20 m at 4.8 s. On the page that is
  "2.0 ft" above and "0.8 ft" below. Two things account for it and both are the
  model working: Point La Jolla refracts the 13 s southern swell away from this
  shore, which is the island-and-headland sheltering MOP exists to compute, and
  the forecast product's own back-fill is a model run rather than the nowcast's
  assimilation of real buoy spectra. The page has to keep saying which is which.
  Any change that removes the row's provenance line, or moves it into the day
  blocks, breaks this decision.
- The row reads `_forecast` for every column including today, rather than
  splicing the nowcast into today's cell. The nowcast is the better estimate of
  now and is a second request, a second product, and a row whose first column
  came from somewhere the other six did not — which is a harder thing to
  attribute than the disagreement above.
- The page now carries a second publisher. CDIP is credited on the page from the
  day the row ships; the data is public and no credentials are involved. CDIP
  asks to be contacted about MOP access, which is a separate task and not a
  blocker on the build.
- A future product that wants to put a modelled number beside a measured one has
  a precedent here, and it does not generalise for free: what makes this
  acceptable is that the two answer different questions and the page says which.
  Runup and total water level do not clear that bar, which is why they remain out
  of scope.
- The wave `ReservedRow` is gone. Two reserved slots remain, and the reasoning
  about what a reserved slot promises is unchanged.
- The now-card is taller, and it now sets the height of the three-across band
  where the air card used to. Measured at 1536×639: the wave card's content goes
  127px to 209px, and the band goes 283px to 301px — so 64px of the 82px was
  already being held open by `items-stretch` for the air card's two groups and
  two attributions. Eighteen pixels of the first screen is the real cost, and it
  was accepted because a forecast only in the grid is one most readers never
  scroll to.
- `WavePanel` and `WeekPanel` now make the same CDIP read. They build the same
  window, so Next dedupes on the URL and the page reaches CDIP once per beach.
  A change that makes either window differ would silently double the request.
