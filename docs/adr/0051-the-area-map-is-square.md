# 0051 — The area map takes a square frame, not the area's own aspect

Date: 2026-09-04. Status: accepted. Gives `/conditions/<area>` a map, which
ADR-0049 recorded as missing. **Reverses `docs/plans/areas-over-locations.md`
§6's frame decision**, on a measurement §6 did not make. ADR-0036, ADR-0037,
ADR-0039 and ADR-0041 are untouched — the frame is built and the sea drawn
exactly as they say.

## Context

An area page had readings, a chooser and a list of its beaches, and no picture
of the place any of it was about. A beach page had a map. That inverts the whole
argument for making the area the thing a reader picks.

ADR-0049 recorded the map as deferred and gave the reason: an area has no single
coast run, and drawing the first member's coastline under the area's name would
be the representative-beach lie ADR-0048 refuses, one layer down from a reading.
What was needed was a frame built from every member.

**The plan already specified that frame, and specified it wrongly.** §6 says
"The area frame is not square", rejecting `squareToward` because "La Jolla's
bbox is 8,213 m north–south by 2,773 m east–west; Del Mar's is 9,411 by 1,773.
`squareToward` would spend two thirds to four fifths of the width on slack."

### What was measured

The map column is **472px wide** at the review viewport (1536×639, measured in
the browser, not derived from the breakpoints). Only the twelve areas holding
more than one beach draw an area map; the other six show their single beach's.
Taking each area's own bbox aspect, at that width:

|                | bbox aspect (§6) | square | capped 1.5:1 |
| -------------- | ---------------: | -----: | -----------: |
| tallest frame  |      **1,908px** |  472px |        708px |
| shortest frame |            199px |  472px |        199px |
| worst tick gap |           11.4px |  5.5px |        7.9px |

Seven of the twelve exceed 1,000px under §6's rule. Imperial Beach is 1,908px —
three screens for one picture in a 639px window — and Coronado is a 199px
letterbox. The swing between areas is ten-fold, so the map would not be one
thing a reader learns to read.

**What that height buys is an axis §6 had already conceded.** The tightest pair
of marks goes from 5.5px to 11.4px, and §6 itself says of that cluster: "The
ticks still crowd, and that is accepted rather than solved… La Jolla's point
genuinely _is_ a cluster of four beaches inside 550 m." Both figures are far
below any separation that would make the four readable as four, so the choice is
between two illegible clusters — and only one of them costs three screens.

**The slack is not empty.** §6's objection assumes the extra width is waste.
ADR-0041 has the wash close on the frame, so it renders as sea. On Coronado —
the widest area, 0.42:1 — the square frame is what shows the whole peninsula
with the bay behind it, which its own aspect would have cropped to a strip.

**§6's figures no longer reproduce either.** It gives Del Mar as 9,411 m by
1,773 m, an aspect of 5.31:1; measured today from the traced coast runs it is
4,191 by 2,798, or 1.50:1. §6 predates ADR-0039's traced shoreline, so it was
measuring a different geometry. The direction of its argument survived that; the
numbers did not.

## Decision

**`shoreViewForArea(area)` builds one square frame from every member's coast
run**, and `ShoreMap` draws it exactly as it draws a beach's.

- **The box is built from the members' runs, never from their sand**, which is
  the rule `shoreViewFor` already states one scope down: what the box is built
  from should be what the box shows.
- **`squareToward` is reused, not re-derived.** No new constant, no new rule,
  and the frame is the one the page already has.
- **The seaward direction is read off the coastline's own walk order**, by
  windowing the county line to the draft box first. Members are ordered north to
  south, so joining their runs end to end makes a walk that doubles back — and
  `seawardFrom` takes a run's two ends, so it would answer about a chord across
  the doubling rather than about the coast. This is the one place the area case
  is not simply the beach case with more points.
- **Nothing is drawn heavy.** `segment` is null: no one beach is the subject of
  an area map, and picking one out would be the lie ADR-0048 refuses, drawn
  instead of stated.
- **A member the traced coast does not reach contributes nothing to the box.**
  That is `mission-bay-vacation-isle`, whose island the committed mainland ring
  does not hold, and whose frame is its neighbours'.

**The zoom §6 describes needs no mechanism.** `/conditions/<area>` gets this
frame and `/conditions/<area>/<beach>` gets `shoreViewFor`'s, with that beach's
run heavy. They are two committed frames and the route swaps between them,
which is exactly what §6 asked for and is now true by construction.

**The readout arrives with the map, and only where there is a bearing to
state.** ADR-0049 said it would. An area reports a wind bearing only where its
beaches share a forecast cell and a swell bearing only where they share a model
line, so an area sharing neither has no needle on any hour — and `DayCompass`
renders null in that state while `ShoreMap` would still draw the box around it.
That put an empty labelled block under La Jolla's coast. The caller now answers
`ShoreMap`'s one `hasReadout` question honestly. A beach page never reached this:
every beach in the inventory binds a forecast cell, so there is always a wind
arrow.

## Consequences

Every area page has a map of its own coast. Mission Bay – West and the other
areas that share a forecast cell get their wind readout on it; La Jolla and
Coronado get the coast alone.

**§6's remaining half stands**: a tick per member, which is the next slice and
amends ADR-0033. This decision deliberately ships the frame without the marks,
because a frame that is wrong is worth finding before ten marks are drawn on it.

**The plan is not repaired, and that is the split `docs/plans/README.md`
draws.** A plan is a dated record of what was decided; this ADR is the thing
kept current. The plan gets an addendum saying its frame decision was reversed
and where to read why.

The part most likely to be re-litigated is the slack on a long thin area —
Imperial Beach's coast runs 5,734 m north to south and 1,419 m across, so a
square frame is three quarters water. The answer is that it is water, drawn as
water, and that the alternative is 1,908 pixels of picture in a 639-pixel
window.
