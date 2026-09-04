# 0053 — A beach on its area's map is pinned, named and clickable

Date: 2026-09-04. Status: accepted. **Supersedes ADR-0052**, which marked each
beach with a tick and ruled that the marks could never be targets. Everything
ADR-0052 established about _where_ a mark goes is kept and restated below;
what changes is what is drawn there and what a reader can do with it.
ADR-0051's square frame, ADR-0041's wash and ADR-0033's "no instruments" are
untouched. A beach's own map is unchanged: one subject, drawn as a heavy run,
no pins at all.

## Context

ADR-0052 shipped. It was reviewed on the rendered page and rejected: the ticks
"look horrible". The request was pins with a beach emoji and a label, clickable,
opening the beach.

**The rejection was on looks and there is a mechanism under it.** A tick took
its direction from the two drawn points either side of the mark, and ADR-0052
recorded that as being perpendicular to the local coast. It is — to a two-vertex
window. Measured against the shore at the scale a reader sees it, a fifteen-
vertex window on the same 5,368-point traced line:

| angle between the mark and the coast | La Jolla's ten marks |
| ------------------------------------ | -------------------- |
| under 45°, i.e. reading as along it  | **4**                |
| the worst of them                    | **10.7°**            |
| over 75°, i.e. reading as across it  | 3                    |

On a shore traced at about 50 m a two-vertex window is noise, so the rule was
answering a question about the wrong thing. Four of ten marks were strokes drawn
along the coastline they were meant to cross, and in the cluster they crossed
each other instead — which is what "scratches" describes.

### What was measured before choosing a replacement

Three variants were prototyped on the real route and shown. All three had a
defect the prototype's own notes call fatal, and on measurement each defect was
in the prototype rather than in the idea: labels everywhere with leader lines
(complete but busiest), numbered pins with a key (**four of ten numbers hidden
behind neighbours**, and `①` rendered as a fallback glyph), labels only where
they fit (**five of ten beaches left anonymous**, and unlabelled pins collapsed
to 1.9px by a negative margin).

**What none of them questioned was ADR-0052's premise**, which reads one area's
arithmetic onto all twelve. Measured on the rendered page, closest pair of marks
per area:

|                   | desktop, 472px map | phone, 342px map |
| ----------------- | -----------------: | ---------------: |
| la-jolla          |          **4.5px** |        **3.3px** |
| mission-bay-north |             31.1px |           22.5px |
| mission-bay-west  |             41.4px |           30.0px |
| the other nine    |     70.7 – 245.4px |   51.2 – 177.5px |

La Jolla is not the general case. It is the only pathological one, and eleven of
the twelve areas have room ADR-0052 spent on none of them.

**The labels are governed by a different measure, and it moves the count.** A
label is a horizontal box on its pin's own row, so two labels collide when their
marks share a row however far apart they are across the frame. By that measure
three areas are crowded, not one — Mission Bay – North and – West have marks
0.28 and 0.38 plot units apart vertically while being 31px and 41px apart on
screen, because they are beaches on opposite shores of the same water at the
same latitude.

| tightest **vertical** gap            |             plot units |
| ------------------------------------ | ---------------------: |
| mission-bay-north / -west / la-jolla | 0.28 / 0.38 / **0.47** |
| the next area after them (coronado)  |               **6.38** |
| the remaining eight                  |            13.1 – 52.2 |

## Decision

**Each beach an area holds is an emoji pin and its name, and the pair is one
link to that beach's own page.**

**Two placements, chosen per area by the geometry.** Where every mark clears one
label row, the name sits beside its pin. Where any two would share a row, every
name in that picture moves out to a column at the frame's edge, joined to a dot
on the coast by a leader line. Nine areas take the first, three the second.

**Per area and never per beach.** A frame with some names beside their beaches
and others carried out to the side is two conventions at once, and a reader has
to work out which applies to the mark in front of them.

**The threshold is one label row on the narrowest map, not on the review
viewport.** A label is about 13px, and the map column is 472px at 1536×639 but
**342px on a 390px phone** — 2.75 plot units of the first and 3.80 of the
second. Taking the desktop figure would let labels overlap on a phone. Rounded
up: **4 units**. The partition it produces has a 13-fold margin — the crowded
areas top out at 0.47 and the next is 6.38 — so any threshold between about 0.5
and 6.3 sorts the twelve the same way. The number earns its place by meaning
something rather than by being tuned.

**The column's row pitch is a second number, because it measures a second
thing.** The threshold is the height of a _label_; the column stacks whole
_anchors_, which are 24px because they hold the glyph. Deriving the pitch from
the label put the rows 5.5 units apart, which is 26px at the review viewport and
looked right there — and on a phone put a 24px anchor every 18.8px, so **every
pair in every column overlapped by 5.2px**, and by 9px at 320px. So it is taken
at the narrowest map the site supports: WCAG 1.4.10's 320px viewport gives a
272px map, where 24px is 8.8 units. **9.5 units**, which leaves air there and
still seats La Jolla's ten rows.

**The mark's position is ADR-0052's and is unchanged**: the middle of the
beach's own drawn run, never the middle of its two ends. That decision's
measurements stand — the ends-midpoint lands up to 1,562 m off the line and 17
of 50 are over 100 m off, against 0 m for the run's middle — and so does its
consequence: `mission-bay-vacation-isle` has no run, falls back to its own two
ends, and is the one mark on any area map that is not on a coastline. **It now
carries its name**, which is a real improvement rather than a side effect: an
unlabelled stroke in open water read as an error, and "Mission Bay, Vacation
Isle" reads as what it is.

**Identity crosses the boundary with the position, and the URL does not.**
`shore.ts` answers with a slug and a name because it reads `beaches.json`;
`DayPanel` turns the slug into a route because ADR-0047 makes that the page's
question; `ShoreMap` projects and `BeachPins` places, because those are answers
in plot units. That is the same split the module already kept, with one more
thing travelling along it.

**The pins sit outside the frame's own `role="img"`**, as siblings of the SVG
rather than children. Inside, they would be part of one graphic with one label,
and every pin would be a link no screen reader could reach — so the reader who
most needs a beach to be named would be the one who could not get to it.

### The tap-target question, settled rather than implied

ADR-0052 said "marks, never targets, and that is arithmetic rather than taste",
citing a 44px floor. Both halves need correcting.

**ADR-0004's floor is not 44px here.** It is 44×44 _below_ `md` and **24×24 at
`md` and above**. The review viewport is 1536px. Every pin is 24px tall at every
breakpoint, so above `md` it meets that floor unaided.

**Below `md` the floor is 44px and no pin reaches it**, and that is geometry
rather than effort: the map is 342px on a phone, four of La Jolla's beaches sit
within about 25px of one another, and four 44px targets in that cluster would
need a map about 2,600px wide.

**It conforms anyway, under the _Equivalent_ exception**, which both WCAG 2.5.5
(Enhanced, AAA — the standard ADR-0004 adopts below `md`) and 2.5.8 (Minimum,
AA) carry: a target may be undersized where the same function is available
through another control on the same page that does meet the size. That control
exists and was measured, not assumed — **the beach list above the map renders
ten links, every one exactly 44px tall, at both breakpoints.**

**So the list is load-bearing and this ADR says so.** It is not decoration above
the picture; it is what makes the pins conformant. A change that shrinks those
links, or drops one, or moves the list below the map, takes the exception away
and has to answer this decision.

**Where the pins are crowded they are not clickable at all**, and that is the
one place this design refuses the obvious. In the three column areas the marks
sit a few pixels apart — La Jolla's tightest pair about 4.5px — so overlapping
targets there would not merely be small: a click would land on whichever beach
happened to be painted last, silently and unpredictably. The dot on the coast is
`aria-hidden` and inert, and the labelled anchor at the end of its leader line
is the way in. **A mark that does nothing is better than a control that goes
somewhere the reader did not choose**, which is this repo's "nothing fails
silently" applied to a target instead of to a log line.

## Consequences

Every beach on every area map is named and reachable. Nine areas read as a coast
with its beaches labelled on it; three read as a coast with a key beside it, and
in those three the leader line is what ties a name to a place.

**The emoji renders in the visitor's own font.** Any screenshot proves what one
operating system does with `🏖️` and nothing more. That is why the name is beside
it in both placements rather than the glyph carrying the identity — the same
lesson the prototype learned from `①`, which is not an emoji and rendered as a
placeholder box anyway.

**One degradation is known and bounded.** At a 320px viewport — WCAG 1.4.10's
reflow floor — the column's rows clear each other by 1.8px. Nothing overlaps,
but there is no margin left, and an area gaining an eleventh beach would need
this revisited before it renders there.

**What is most likely to be re-litigated is the per-area switch.** Nine pictures
labelled one way and three another is a real inconsistency, and the alternative
— one convention everywhere — was rejected on measurement rather than taste:
labels beside their beaches overlap on three areas, and a column on all twelve
puts leader lines across nine pictures that have room to do without them. The
switch is the price of both halves being right.
