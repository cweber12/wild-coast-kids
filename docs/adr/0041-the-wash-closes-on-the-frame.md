# 0041 — The sea wash closes on the frame, not on the coast

Date: 2026-09-01. Status: accepted. Replaces the closure ADR-0033 introduced
and ADR-0036 described; both of those decisions otherwise stand, and this
changes nothing about what is drawn — only about where the drawing stops.

## Context

ADR-0033 replaced ADR-0030's gradient with one flat tint and made the water's
edge the drawn line. The polygon that carried the tint was closed from a single
normal taken across the drawn run's two ends, extended off the frame in both
directions. `ShoreMap` recorded the reason:

> Taken from the run's two ends rather than segment by segment: the polygon
> only has to close on the right side of the frame, and a per-segment normal
> would fold on itself at a bend.

Both halves of that were true, and the conclusion no longer follows from them.
A single normal is exact on a straight shore and approximate on a bent one, and
what the shore is has changed twice since: ADR-0037 traced a real shoreline,
and ADR-0039 stopped withholding it from the bays. **A bay shore turns through
more than a right angle inside one frame.** The approximation was asked to
describe both arms of a turn with one direction, and could not.

Measured on the 50 beaches with a coast to draw, sampling each frame on a
61-by-61 grid and comparing against the side the coastline itself gives:

- **834 of 121,794 samples were shaded on the wrong side of their own shore**,
  spread over ten beaches. Worst: `coronado-city-beaches` at 25.4 percent of
  its frame, `coronado-cays-nr` at 11.3, `north-imperial-beach` at 5.0.
- **Ten closing edges reached inside a frame**, across eight beaches —
  `childrens-pool`, `south-casa-beach-s-d`, `mission-bay-crown-point-shores`,
  `coronado-city-beaches`, `coronado-cays-nr`, `silver-strand-state-beach`,
  `north-imperial-beach` and `border-field-state-park`. A straight edge between
  water and land, inside the picture, at an angle to the shore beside it.
- Asked one segment at a time — is the point a hair to this segment's left
  shaded, and the point a hair to its right not? — **32 drawn segments failed**,
  on `coronado-city-beaches` and `north-imperial-beach`.

The closing edges are the part that was not predicted. The old construction
offsets its two closing corners from the _coast's_ two ends, and a coast can be
drawn well outside the box it is framed in — `windowAround` returns a point past
each end on purpose, and on a bay run that point is a long way off. Offset from
a point that is already off the picture, the closure comes back onto it.

## Decision

**The wash is closed by walking the frame's own edges, and reads which side is
water from the walk rather than from a direction.**

- **A box that holds the frame and everything drawn**, with a tenth of its
  larger span to spare. The frame is in that arithmetic as well as the coast,
  which is what the old closure was missing.
- **The shore is carried straight off both ends to that box**, along the line
  its own end segment was on.
- **The box's edge is then walked whichever way holds the water**, decided by
  the sign of the closed ring's area. The coast divides the box in two and the
  two ways round give those two halves, so the sign is what tells them apart.
- **Nothing in it approximates the coast by a line.** The coast _is_ the
  boundary; the only invented geometry is off the picture. Exact for any shape
  the shore takes, including one that turns back on itself.

`seaWash` lives in `src/components/conditions/wash.ts`, beside its component
the way `needles.ts` sits beside `Compass.tsx`: plot-space geometry, handed a
projected coast and a box, knowing nothing about latitude or beaches.

**The map now derives no seaward direction at all.** `shoreViewFor` still
computes one, because `squareToward` has to know which way to grow the box, and
that is a different question — which way the frame should lean overall, not
which side of a bend a pixel is on. The two can no longer disagree because only
one of them exists.

## What the check is, and what it cannot be

#200 proposed the verification directly: sample each frame on a grid and
compare against `sideOf`, the ground truth the `sea-side` gate row already
uses, so the two rows check one rule at two scales. **That check fails on
correct output, and the reason is worth writing down.**

`sideOf` takes the side of the single _nearest segment_. Far from shore that
choice is decided by millimetres between segments pointing opposite ways. At
`torrey-pines-state-beach` a 20 m reversed spur in the county's linework beats
its own neighbour by 0.01 m from 5.9 km away, and flips the verdict for a
quarter of the frame. The wash is right there and the ground truth is wrong.

So the sweep asks only what this geometry can answer:

- **within 500 m of the drawn shore**, and
- **only where every segment within one percent of the nearest agrees.**

That leaves 121,794 of 185,928 samples, spread over all 50 beaches, and under
it the new construction is wrong on none of them. The per-segment sweep beside
it declines a probe the segment does not own, for the same reason and by the
same rule: 593 of 5,533 probes are declined, and the 4,940 that stand pass.

**A tolerance was the alternative and was rejected.** The ten beaches the old
construction fails under this sweep fail at 0.1, 0.4, 0.5, 1.0, 1.0, 1.2, 5.0,
11.3 and 25.4 percent of their samples — there is no gap for a threshold to sit
in, so any figure loose enough to absorb the near-misses also absorbs a quarter
of a frame. And the construction is exact, so zero is reachable: a tolerance
would be a constant standing in for an understanding, which is the thing the
two filters above are instead.

## Alternatives considered

**Share one seaward direction between the frame and the wash.** #200's own
smaller option: `shoreViewFor` already decides which way the sea lies for
`squareToward`, so pass it through `ShoreView` instead of re-deriving it. It is
smaller, and **measured, it makes the picture worse**: 1,670 drawn segments
wash the wrong side against the old construction's 32, on eight beaches rather
than two. The run it is taken over is longer than the drawn window and bends
more, so as a half-plane it is a worse fit than the chord's normal — and the
inconsistency it was meant to remove is a symptom of using a direction at all.

**Keep the normal and take it per segment.** The objection ADR-0033 recorded
still holds: per-segment half-planes fold on themselves at a bend, and the
union of them is not the region wanted.

**Clip the polygon to the frame instead of closing outside it.** Would put the
frame's edges in the emitted path and give the same picture. Rejected: the
outer `<svg>` already clips to its viewport, so the clipping is free and the
path stays readable as "the shore, then off the edge".

## Consequences

- **`ShoreMap` gets smaller and stops doing geometry.** `seaPath` goes, along
  with `OFF_FRAME` and the two fields it returned that nothing had read since
  ADR-0038 took the readout off the picture.
- **The wash covers the bays properly for the first time.** `silver-strand-state-beach`
  is the clearest: it is a sand spit with the ocean on one side and San Diego
  Bay on the other, and the bay was white. Swept without the two filters above —
  every in-frame sample counted, so a looser reading than the one the check
  makes — 15.7 percent of that frame was shaded on the wrong side, against 0.1
  percent now.
- **`border-field-state-park` is the one beach where the wash draws a boundary
  inside the frame that the source did not give.** The committed shoreline
  begins there, at the Mexican border, so the shore runs out mid-picture and the
  wash continues along the line it was on. The alternative is a wedge of
  unshaded water, which is the defect this replaces.
- **The `sea-side` gate row is unchanged and still needed.** It proves the
  premise this construction reads — that walked south to north, this coast has
  the sea on its left — against the wave buoys. Nothing here re-proves it; the
  sweeps in `wash.test.ts` assume it and check the drawing.
