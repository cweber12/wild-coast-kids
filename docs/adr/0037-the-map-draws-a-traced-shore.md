# 0037 — The map draws a traced shore, and still declares no tide

Date: 2026-08-31. Status: accepted. **Supersedes ADR-0030**, which named this
event in advance. ADR-0033 and ADR-0036 stand; ADR-0034's measured ceiling
moves, and this document carries the new figures.

## Context

ADR-0030 established that the line down `ShoreMap` is CDIP's MOP model line
rather than a shoreline — computed at 10 m depth, so 117 to 930 m offshore of
the sand for the 25 beaches that bind one, median 644. It could not correct
that, and said what would:

> **Find a real shoreline.** No shoreline dataset is committed here, and adding
> one is a data acquisition rather than a layout decision — a new source, a new
> join, a new probe and a new checker. If one ever lands, this decision is what
> it supersedes.

One has. CDFW's **ACE Ecoregion Sections** is a terrestrial ecoregion layer —
ECOMAP/Goudey 2007, dissolved for their Areas of Conservation Emphasis work —
and it carries a coastal edge only as a side effect of what CDFW did to it,
which its own service description states: it was "conformed to Cnty19_1 counties
layer linework … had all bays 'erased', and offshore rocks/stacks detail
removed."

So the edge is county boundary linework.

### What was measured

Distance from each beach's committed coordinates to each line, nearer end:

|                           | model line (drawn before) | traced shore                    |
| ------------------------- | ------------------------- | ------------------------------- |
| median                    | 911 m                     | **3.6 m**                       |
| p90                       | 2,485 m                   | 17 m                            |
| max, excluding the island | 4,911 m                   | 36.7 m                          |
| within 200 m              | 2 / 51                    | **50 / 51**                     |
| vertex spacing, median    | ~98 m                     | 6.7 m published, 50 m committed |

The one beach past 37 m is `mission-bay-vacation-isle` at 416 m. It is an
island, so it is a separate ring of the same feature rather than part of the
mainland arc — and its committed segment has `upper` equal to `lower`, so
`boundsAround` returns null and the page renders an absence. The beach the arc
misses is the beach with no map to miss.

**ADR-0030's own failure case passes.** It rejected a hard sea edge because the
Scripps tide gauge and pier air station sat landward of the drawn line — two
instruments over water, drawn on the beach. Against the traced shore all ten
wave buoys fall on the water side and so do the pier stations. The `sea-side`
gate, re-pointed at the line the map now draws, still reports 15 of 15.

## Decision

**The map draws the traced shore. Everything else about the picture is
unchanged, deliberately.**

- **`coastline()` reads `shoreline.json`.** 5,368 points walked south to north,
  cut by `scripts/probe-coastline.mjs`.
- **The arc is cut from a closed ring, and anchored on committed
  coordinates.** The feature's boundary holds an inland arc as well as a coastal
  one — measured, it reaches longitude −116.72, forty kilometres inland — so
  walking the ring would draw a mountain boundary as shoreline. The coastal arc
  is the one between the vertices nearest `mop-lines.json`'s `D0001` and
  `D1210`, which reuses the county scope this repo already defines rather than
  inventing a box.
- **No tidal datum is claimed.** A California seaward county boundary nominally
  follows mean high tide, but the service does not say so, and this repo's rule
  is that a payload states its own units. The credit under the map says the
  line is where the land is mapped rather than where today's water reaches.
- **`ShorePoint` loses its `id`.** It named the MOP line a point came from, for
  markers ADR-0033 removed. Nothing read it, and a traced shore has no line ids
  to carry.
- **The open-coast test moves to the model line, and the 28/23 split does not
  move at all.** `COAST_REACH_M` asked how far a beach is from "the traced
  coast"; those were one sentence while the traced coast _was_ the model line.
  The traced shore reaches every beach at a median 4 m, so measured against it
  the test always passes. `modelLine()` keeps the question answerable, and the
  partition ADR-0033 and ADR-0036 document is untouched.

**The bays are not in this decision.** The traced shore reaches all 23 of them
and this change deliberately declines to draw it there. Giving them a coast is a
change in what the site claims about a place, and it takes the readout's
placement with it — see _Consequences_. It is its own slice.

## What this costs, and the one thing that moved

**ADR-0034's ceiling fell from 50.5 units to 46.7, and the beach that sets it
changed.** The adaptive corner exists because the readout must not cover the
coast. `mission-bay-visitor-s-center` set the old ceiling with two drawn points;
the traced shore gives `tijuana-slough-national-wildlife-refuge` 436, and one of
them stands in every corner a 50-wide box reaches at its full height.
`READOUT_BOX` is now 46 wide.

**"The height is free" stopped being true**, which is the more useful half:

| band depth     | widest readout | worst beach                    |
| -------------- | -------------- | ------------------------------ |
| 14, 20, 30, 35 | 50.46          | `mission-bay-visitor-s-center` |
| 40             | **46.77**      | `tijuana-slough…`              |
| 50             | 26.26          | `tijuana-slough…`              |

The readout is 40 deep, so the middle row binds it. A model line is nearly
straight and meets a deeper band at nearly the same place; a traced shore bends,
so a deeper band reaches bends a shallower one cleared. `corner.test.ts` pins
the whole table rather than one number, because a single number is what went
stale last time.

`tijuana-slough` is one of the three beaches ADR-0036 named as gaining a
coastline they did not draw. This is that decision's bill arriving, not a new
fault.

## Alternatives considered

**Keep the model line and shift it inland by the measured offset.** ADR-0030
rejected it and the reasoning holds: 117 to 930 m is not a constant, so the
correction would be wrong nearly everywhere, and it manufactures coordinates no
publisher issued.

**Use PMEP's nearshore Core Zone landward edge instead.** Measured against the
ACE edge it sits 4 / 20 / 83 m away (p10 / median / p90) — two digitisations of
the same line disagreeing, not a better line. Its payload is also far heavier:
the layer is dissolved into one multipart feature per class, so a single small
query around La Jolla returns 65 MB.

**Draw the bays in the same change.** Rejected on reviewability. It would have
merged an accuracy change every gate can check with a claim change no gate can,
and it removes the readout's corner entirely on two beaches — `fiesta-island`
and `mission-bay-sea-world` have zero clear corner at any box size, because a
bay shore surrounds the frame. That is a design decision and it deserves its
own document.

**Simplify to 5 m and commit that.** Measured and rejected mid-flight, which is
worth recording because it nearly shipped. Douglas–Peucker removes every vertex
on a straight coast, so a 5 m tolerance left 62 steps over 500 m and one of
1,834 m — all of them ordinary open beach. `COAST_GAP_M` reads a step over 500 m
as water not to be crossed, so every straight stretch would have cut a beach's
run. The probe now restores published vertices to a 200 m cap, and the nine
steps that still exceed 500 m are all chords across the two bay entrances, which
is what that rule is for.

## Consequences

- **`mop-lines.json` keeps both of its jobs and loses one.** It still binds a
  beach to a swell forecast, and it still anchors the arc and decides which
  beaches are on the open coast. It is no longer read as a shape to draw.
- **The `sea-side` gate now checks the line that is drawn.** It read
  `mop-lines.json`; that would have proven which side of a line the water is on
  that nothing renders. Re-pointed, it still passes 15 of 15.
- **Two assertions were found to have been passing vacuously**, and both are
  fixed here rather than noted. `sea-side.test.mjs` keyed its containment check
  on `point.id`, so every key became `undefined` the moment the field went and
  nothing could ever be missing. `shoreViewFor` returned an empty coast for bay
  beaches because the polyline it windowed had nothing near a bay — an accident
  of the source, not a decision, and now a condition.
- **The line has no tide datum and the next want needs one.** A water's edge
  that moves with the tide cannot be drawn against this line. NOAA ENC
  `enc_harbour` layer 227 publishes the intertidal as a polygon — 193 of them on
  this coast, `DRVAL1 = −1.5 m` on chart datum, against a measured MLLW-to-MHHW
  range of 1.62 m at 9410230 — and that is where that work starts. It covers 46
  of 51 beaches; the five it misses are north of La Jolla.
- **`shoreline.json` is 224 KB**, against `mop-lines.json`'s 112. The whole
  Southern California polygon is 7.2 MB and 301,937 vertices; the county arc
  before thinning is 26,999.
