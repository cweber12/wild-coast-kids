# 0033 — The map draws a place, not an inventory

Date: 2026-08-30. Status: accepted. Supersedes the first clause of ADR-0030 and
narrows what ADR-0010 asks a picture to do. ADR-0030's other two clauses stand.

## Context

`ShoreMap` shipped in #178 plotting the four places every figure on the page
comes from — the MOP line, the wave buoy, the tide station, the air station —
each at its real distance, with a different shape per source and a provenance
line per shape. That was **ADR-0010 answered by drawing rather than by
writing**: "no figure is ever shown without the reader being able to see where
it came from", made literal.

ADR-0030 then established that the drawn coastline is CDIP's model line rather
than a shoreline — 117 to 930 m offshore, median 644 — and decided the sea wash
must **fade** rather than end. Its reason was specific and was about the
markers:

> The Scripps tide gauge (9410230) and the Scripps Pier air station (LJAC1)
> are at −117.2571 and −117.2570 — both on a pier, both over water, and both
> **landward** of the drawn line. A map that shaded one side as sea and the
> other as land put two instruments that are in the ocean onto the beach.

**Reviewed on the built page, the drawn inventory was the wrong picture.** Four
glyphs in four shapes over a coastline; two of them a few hundred metres apart
wherever a tide gauge is bolted to the pier an air station stands on, so they
overlapped and needed a halo to be told apart at all; and a frame stretched to
hold whichever station happened to be furthest away — `pacific-beach` framed on
one 7.4 km inland, `mission-beach` twenty kilometres tall with its own sand a
fifth of the picture.

And the fade, seen rather than reasoned about, was a **straight-edged gradient
across a coastline that is not straight**: its iso-lines run along one normal
taken from the drawn run's two endpoints, so the water's edge and the shore's
edge visibly disagree.

## Decision

**The map draws where this beach is and which side of it the water is on. It
plots no stations.**

- **No markers.** ADR-0010 is satisfied by the words it always named: a
  provenance line under every group, naming the station and its distance.
  Those are unchanged and are on the page. What is dropped is the _second_,
  drawn answer to the same question, which cost the picture its subject.
- **The wash is one flat tint, and the water's edge is the drawn line.** With
  no instruments on the map there is nothing to be placed on the wrong side of
  that edge, which was the whole of ADR-0030's case for the fade. The residual
  imprecision — the line is a few hundred metres out — is answered where
  ADR-0030's second clause already answers it, in the sentence under the
  picture, and that clause stands.
- **The frame is sized by the beach and the line off it.** A frame sized by
  things that are not drawn is a rule nobody can see from the page. The MOP
  line stays in that arithmetic because it is _where the drawn coastline is_,
  not an instrument standing somewhere: a window without it crops the shoreline
  off the edge.

## What was measured

Framing on the beach alone leaves **14 of 51** beaches with a coast in view.
Framing on the beach and its bound MOP line leaves **25**, against 28 under the
old source-framed window — and the three lost were beaches whose frame had been
stretched so wide it caught a coastline five kilometres away that was not
theirs. `pacific-beach`, whose air station is 7,365 m off, now frames at about
one kilometre.

Contrast on the dial, read from painted pixels over the new solid wash: wind
needle 6.03:1, wind arc 3.52:1, swell needle 5.23:1, swell arc 3.54:1, both
needle labels 16.62:1. The floor is 3:1 for a graphical object and 4.5:1 for
text.

## Alternatives considered

**Keep the markers and fix the glyphs.** The complaint began as "the icons look
tacky and one is misaligned", which sounds like a drawing problem. Rejected:
the misalignment is two instruments genuinely at one place, so no glyph fixes
it, and the deeper cost is that a map of four station positions is not a map of
a beach. The distances are better said than drawn — "about 1.4 km from this
beach" is exact, and a dot 1.4 km away on a 4 km frame is an estimate the
reader has to make.

**Keep the fade and remove only the markers.** Would leave ADR-0030 untouched.
Rejected because the fade's only stated justification was the markers, so
keeping it would be keeping a mechanism whose reason had gone — and it was
visibly wrong on its own terms, a straight gradient boundary across a bending
shore.

**Keep the frame sized by the sources.** No new arithmetic. Rejected: it would
size every map by things no longer on it, which is exactly the invisible rule
this repo refuses.

## Consequences

- **`ShoreMap` is much smaller**, and `shore.ts` no longer resolves a station,
  words a source or rounds a distance. `shoreDistanceKm` goes with it, which
  also retires the "same rule spelled twice" that the day view's plan recorded
  against `MeasuredToday`'s `roundedKm`.
- **The coverage floor fell**, under the second of the two legitimate reasons
  `vitest.config.mts` records: well-covered code was deleted, so the surviving
  denominator tilts toward the 0% entry plumbing. Nothing became untested.
- **The `sea-side` gate's window is now wider than the one the map draws**, and
  says so. That check needs the wave buoy in frame because the buoy is the only
  ground truth for which side the water is on; asked inside the map's narrower
  window it fails at 10 of 15. The property proven is about the polyline rather
  than the frame, and the map's run is a contiguous sub-run of the checked one.
- **ADR-0010's "drawn instead of written" reading is retired.** The requirement
  was always about a reader being able to find a source, and words do that. A
  future map that wants to show distance should say why drawing beats writing
  for the specific question it is answering.
