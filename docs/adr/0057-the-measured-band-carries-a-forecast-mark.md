# 0057 — The measured band carries a forecast mark, named as one

Date: 2026-09-05. Status: accepted. Extends ADR-0015's vocabulary; qualifies
ADR-0020. Plan: `docs/plans/the-measured-band.md` (historical).

## Context

The band's air segment is marked 💨, inherited from the card it replaced. The
glyph is a fixed puff: it is the same on a clear July afternoon and in a
January storm, so it marks the _category_ and says nothing about the day. On a
band whose whole job is to be read at a glance, a mark that never changes is
the one element carrying no information.

**There is no measured sky to mark it with.** ADR-0020 removed sky from this
block and recorded why: the only stations in this county publishing cloud are
airports, at a median of 7.9 km and beyond 10 km for 20 of the 45 beaches, and
`docs/reference/sensor-representativeness.md` §7 holds that ceiling and
visibility do not transfer off an aerodrome at any distance. That has not
changed and this decision does not reopen it — no station binding is added.

What the page does have is the National Weather Service's **gridpoint
forecast**, which it already reads: `skyCover` per hour and `weather` per hour,
drawn as the week grid's cloud row and the day chart's cloud wash. It is a
model for a 2.5 km square, and it is a forecast.

So the choice is a forecast mark or no mark. Not a measured one.

## Decision

**The air segment's glyph is the forecast sky for the current hour, and the
attribution says so.** The band's line gains `sky forecast for this cell`
beside the buoy and the station, worded as a forecast for a cell rather than as
a source with a distance — a cell is a 2.5 km square with the beach somewhere
inside it, so a distance would be a figure about nothing, which is the omission
`WeekPanel`'s cloud row already makes.

**A mark, never a figure.** This is the line the decision draws and it is the
whole of what makes it safe. Every number on the band came off an instrument,
and none may come from this forecast. A cloud percentage printed beside
`73°F · 7 mph` would put a modelled figure inside a block whose claim is that
these were measured — the blur ADR-0009 exists to prevent — and it is the thing
to refuse if this is ever extended.

**The vocabulary grows to seven and stays closed**, which is ADR-0015's rule
rather than an exception to it: ☀️ clear, 🌤️ mostly clear, ⛅ partly cloudy,
☁️ overcast, 🌫️ fog, 🌧️ rain, ⛈️ thunderstorms — beside the existing 🏄 and 💨.
A glyph outside the roster is unavailable to a later caller, and the fallback
is 💨 rather than an eighth.

**The bands are the publisher's**, not this repo's: clear/mostly clear ends at
25%, partly cloudy at 55%, mostly cloudy at 87%. Those are not round numbers
chosen here, which is the point — the same discipline `ConditionsNotes` applies
to every other relayed figure.

**A phenomenon outranks the cloud beneath it.** A 40% sky with fog in it is a
foggy morning, not a bright one, and fog is what a parent plans around — the
same argument `SkyWeekDay.phenomenon` makes for carrying it beside the
percentages. Only the families the service publishes for this corridor are
matched; anything unrecognised falls through to the cloud ladder rather than
picking a wrong picture confidently.

**Night is not a dark version of day.** A sun over a clear night is worse than
no mark, so the ladder splits: the moon takes the clear half, the cloud glyphs
are shared. Daylight is computed from the beach's own coordinates and cannot
fail.

## Consequences

**The measured band now reads one forecast, and the docstrings that said it
reads none are wrong until corrected.** That sentence appears in
`ConditionsSection`, `MeasuredBand` and `MeasuredPanel`, and each is amended in
the same commit. A block described as purely measured while carrying a forecast
mark is exactly the drift `docs/plans/README.md` warns about, one layer down.

**It costs no upstream request.** `fetchGridForecast` is a `next.revalidate`
fetch for a URL the week grid and the day chart already ask for, so the Data
Cache serves the third read and all three share one response and one outage —
the argument `RipLevel` already makes for reading the bulletin beside the
chooser.

**Three absences fall back rather than failing.** A beach with no forecast cell,
a quiet National Weather Service, and an hour the cell did not reach all leave
the segment on 💨 — which is what it showed before this decision and is still
true of a segment about air. Nothing is credited in that case: crediting a
forecast that did not arrive is worse than crediting nothing.

**The mark is not gated on an area's agreement**, unlike every figure beside it.
ADR-0048's rule is about a _figure_ that would be one member's printed as the
area's; this is a mark read for whichever beach the band is keyed on and
credited as a forecast for that cell. Fifteen of the eighteen areas withhold
waves and none withholds air, so on an area page the mark sits beside a shared
air reading and a cell that is one member's. That is the weakest point of this
decision and it is stated rather than hidden: if an area's cells ever disagree
enough for the mark to mislead, the answer is to gate it, not to reword it.

**Emoji are the visitor's operating system font.** This repo ships raw Unicode,
so a screenshot of these seven shows Segoe UI Emoji and nothing else. ⛅ and 🌤️
are the pair most likely to look alike on a platform nobody here has checked,
and the wording beside them does not distinguish them — the figures do not
mention the sky at all. That is a real limit of a glyph-only channel and the
reason the ladder has four cloud steps rather than eight.
