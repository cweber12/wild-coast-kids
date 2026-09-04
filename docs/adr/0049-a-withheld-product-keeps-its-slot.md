# 0049 — A withheld product keeps the slot it would have filled, and is worded there

Date: 2026-09-04. Status: accepted. Applies ADR-0048 to the two forecast
regions. ADR-0015's closed vocabulary is what it is arguing from.

## Context

ADR-0048 settled what an area may report: a product every one of its beaches
binds the same source for, and nothing else. It settled it against the measured
block, where the answer was easy — that block is two cards, one per product, so
a withheld product is a card, and the withheld card takes the glyph, title,
heading id and rank of the card it replaces.

The week and the day chart are not two cards. `WeekPanel` draws three products
as rows of one grid; `DayPanel` draws four tabs off three publishers, sharing
one frame, one night band and one cloud wash. Neither has a card-shaped hole to
put a sentence in, and the question ADR-0048 did not answer is what shape the
hole is.

Measured over the eighteen areas, this is not a rare state. Tide is shared by
16 and sky by 11, so most areas draw most of the week — but La Jolla, the
default area and the largest, shares a tide station and neither a model line
nor a forecast cell. Something has to stand where its swell and its sky would
be, on both regions, and it will be the first thing most readers of an area page
see withheld.

## Decision

**A withheld product is worded in the slot its own panel already uses for a
product it cannot draw.** Not a new element per region, and not silence.

- **In the week, that is no row and a note under the grid.** A beach with no MOP
  line has had no wave row and a sentence beneath the grid since long before
  areas existed; `no-station`, `no-line` and `no-cell` have all pushed into that
  array. An area with no agreement on a product gets the same shape, in its own
  words.
- **In the day chart, that is the tab, kept, with the sentence where the plot
  would be.** `HourSeries.absence` is documented as "what to say instead of a
  plot when `points` is empty", and its own docstring gives the reason the
  sentence differs per product: "a beach with no MOP line will never have a
  swell curve, where a cell that answered without a wind series is a fact about
  one forecast run". An area that shares no model line is a third such reason,
  in the same slot.

**The tab stays. Dropping it was the alternative and it is the wrong one.** Four
tabs are this region's whole vocabulary for its four products, which is
ADR-0015's argument about the reading-card glyph applied to a control: a page
that shows a different set of tabs per area is a different control per area
rather than one control with less in it. La Jolla would have a tab bar one tab
wide, and a reader would never learn that this page has a swell at all — which
is worse than a tab that says why it is empty, because it cannot be asked.

**One wording for all three positions**, in `areaScope.ts`, parameterised by the
product's noun. `ProvenanceLine`'s docstring records what a second call site
usually costs this repo — it printed one station two ways on one card — and
`WORDS` in `DayPanel` already declines to invent a second register for an outage
`WeekPanel` had words for. A reader meeting the same silence in the week and
again in the chart meets the same sentence.

**Per product, never per panel.** A panel gated whole would take La Jolla's tide
away in order to withhold its cloud. The counts are what make that obvious:

| product | shared | absent | mixed |
| ------- | -----: | -----: | ----: |
| tide    |     16 |      0 |     2 |
| sky     |     11 |      0 |     7 |
| swell   |      6 |      7 |     5 |

**Daylight is not gated, and that is measured rather than assumed.** It is
computed from a beach's coordinates rather than bound to a source, so
`areaSources` has nothing to say about it. Across the eighteen areas the widest
internal spread is 9 seconds of sunrise (Mission Bay – North) and 8 of sunset,
against a page that prints both to the nearest minute. `midpointOf` already
makes the same argument one scale up: "sunset differs by a minute across the
entire county". So the week's columns and the chart's night band come from the
member the region reads through, and no area is told a sunrise it could see was
false.

**The map is not in this.** It draws one beach's own stretch of coast; an area
has no such run until the area map lands, with a tick per member and a frame
taking the bbox's own aspect. That is its own slice and its own decision,
because ADR-0033 says the map draws a place and not an inventory and a mark per
beach amends it. Until then the column carries a sentence saying so. Drawing the
first member's coastline under the area's name would be exactly the
representative-beach lie ADR-0048 refuses, one layer down.

The readout goes with the map, and that is the part worth recording. ADR-0034's
surviving clause has the readout rendered on every beach including those with no
coast drawn, so a bearing dial without a shoreline is a shape this page already
permits. It is deferred anyway because `ShoreMap` owns the coupling ADR-0038
settled — one `hasReadout` gating the block and its sources together — and
hoisting it out is a second change to a contract that decision has just finished
drawing. It arrives with the area's own coast, which is the frame that makes a
wind bearing mean anything.

## Consequences

Every region of `/conditions/<area>` now answers for the area. The sentence that
stood in for the week and the day chart is gone.

**An area page can carry the same sentence twice**, once in the week's notes and
once in a chart tab, when a product is withheld in both. That is accepted rather
than solved: they are two regions and each owes its own reader an explanation
where they are standing, and the alternative — one of them silent, pointing at
the other — is the failure `WeekPanel`'s own notes fixed when the tide card they
delegated to was deleted.

**A withheld product costs no request.** Six reads become as few as one on an
area page, which is the same property ADR-0048 gave the measured block.

**`Answered<V>` is new**, in `areaScope.ts`: a product's read or its
withholding, as one value, so nothing composing a chart tab has to assert that
the two line up. `WeekPanel` does not use it and takes plain nulls, because its
reads feed `if` guards that narrow a null on their own; the day chart's feed
object literals, which do not.

**The rip current risk is still beach-scoped**, and is still the exception this
rule does not cover. It is issued for "San Diego County Coastal Areas", a unit
larger than any area here, so an intersection rule designed for point
measurements is a category error against it. It is read through the member the
rest of the region reads through, which gives every area but one the answer the
exception would give it anyway. That exception is real and gets its own
decision.

The part most likely to be re-litigated is the kept tab, on the grounds that a
tab which never has a curve is clutter. The answer is that it is not "never" —
it is "not for this area", the reader is one click from the beach that has it,
and the sentence in the tab is what tells them so.
