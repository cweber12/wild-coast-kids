# 0036 — The coast run decides the frame, and the slack is sea

Date: 2026-08-31. Status: accepted. Reverses `boundsAround`'s recorded reason for
having no minimum span, and removes the bound MOP line from the frame's
arithmetic — which is the half of `shoreViewFor`'s docstring that argued for
keeping it. ADR-0033 is unchanged and is why this is needed. ADR-0034's measured
placement table is re-measured in the same pull request, because the projection
it was measured against moves. ADR-0030 is untouched.

## Context

The shore map draws this beach's stretch of coast heavier than the shore either
side of it, with the sea washed in beside it. **Reviewed on the built page, some
beaches show a fragment of shoreline pressed against an edge and running off it,
with the rest of the square empty.** `la-jolla-cove` is the worst and is issue
#199.

Measured, its frame is **200 metres across**, and in the map's 100-unit square:

| what                           | where it lands |
| ------------------------------ | -------------- |
| the bound MOP line (not drawn) | y = 8.3        |
| the beach's own coordinates    | y = 58.8–91.7  |
| the three coastline points     | y = 18, 8, −4  |
| the "this beach" heavy stroke  | y = 8 → −4     |

**That is two faults and only one of them is visible.** The coast is at the top
and runs off it. And the heavy stroke marking the beach is drawn beside the MOP
line, about 400 m from the beach — because `beachStretch` snaps the beach's two
ends to the nearest point _in the windowed coast_, and the window holds three
points, all of them up there. The one mark on the map whose job is to say "this
is your beach" is pointing somewhere else.

Across the inventory, 20 of 49 frames clip their content at an edge and 16 have
an empty edge wider than 40 of 100 units.

### Why it happens

**The frame is sized on a point that is never drawn.** `shoreViewFor` bounds
`[segment.upper, segment.lower, mopLine]`. ADR-0033 took the MOP line out of the
drawing — the map draws a place, not an inventory — and left it in the
arithmetic, with an argument for why that was not the same mistake as framing on
the four stations: the line "is where the drawn coastline _is_". That is true of
its distance offshore and false of its displacement _along_ shore, which is 0.47
km at `south-casa-beach-s-d` and 2.59 km at `la-jolla-community-beach`. Along
that axis it stretches the frame toward nothing.

**There is no minimum span, and the measurement that said none was needed has
expired.** `boundsAround` records: "No minimum span, because none is needed:
measured across all 51 beaches with their four sources, the tightest box is
`shoreline-park` at 1.8 km." The four sources left the frame. The tightest boxes
now are `fiesta-island` at 0.05 km, `childrens-pool` at 0.06 km and
`la-jolla-cove` at 0.20 km, with **23 beaches under 1 km**. The reasoning was
sound when written and describes code that no longer exists.

**And the dependency runs backwards.** The frame decides which coastline is
drawn, so a small frame draws almost none, and `beachStretch` — which reads the
window — then has nothing correct to snap to. A frame too small to show the
coast is also too small to place the beach on it.

## Decision

**The run of coastline this beach occupies decides the frame, rather than the
frame deciding which coastline is drawn.**

- **The beach's run is found against the whole coastline**, not against a
  window. That alone fixes the misplaced stroke: the nearest polyline point to
  each of the beach's ends is now the nearest point that exists, rather than the
  nearest one a too-small box happened to catch.
- **The run is grown outward along the polyline to a minimum length of shore.**
  A beach longer than the minimum keeps its own run; a short one gains context
  either side. This is the minimum span `boundsAround` declined to have, moved
  to where it means something: a length of _shore_, which is what the picture is
  of, rather than a width of _box_, which is an artifact of how the box was
  built.
- **The frame is that run plus the beach's own ends, with the existing margin.**
  The coast is then in view by construction rather than by luck, and the
  property is assertable directly: the run that set the frame is inside it.
- **The bound MOP line leaves the frame's arithmetic.** `coastline()` is built
  from `MOP_LINES`, so the beach's line is a point on the polyline and the run
  already contains it. Nothing is lost and the along-shore stretch goes.

**Whether a beach is on the traced coast becomes an explicit distance, not a
side effect of box size.** Measured across the inventory: every beach that binds
a MOP line is within **0.93 km** of the traced coastline, and every Mission Bay
and San Diego Bay beach is **1.17 km or more** from it. A 1 km test therefore
reproduces the 28/23 split ADR-0034 already documents — "the 23 beaches with no
traced coast" — rather than inventing a partition. It is the same rule the code
was always applying, said out loud and made measurable.

**Three beaches gain a coastline they do not draw today**: `childrens-pool` at
0.33 km, `tijuana-slough-national-wildlife-refuge` at 0.74 and `coronado-cays-nr`
at 0.83. All three are on the open coast; none binds a MOP line, which is why
their frames were tens of metres across and caught nothing. Their blankness was
an artifact rather than a fact about the place, and ADR-0034's argument for
drawing the readout on all 51 beaches is the same argument.

**The letterbox slack goes to the sea.** `projectionFor` fits a non-square box
into a square and splits the leftover evenly, which puts half the empty space
inland — on a map whose subject is where the water is. The pad goes on the
landward side instead, so the coast sits toward the land edge and the sea wash
fills the remainder. The seaward direction comes from the same normal `seaPath`
already derives; a second derivation could disagree with the wash it is meant to
match.

## What this does not change

**ADR-0033 stands, and this is what it asked for.** The map still draws a place
and not an inventory. Removing the MOP line from the arithmetic finishes that
decision rather than reopening it: a source that is not drawn now also does not
silently decide the frame.

**ADR-0030 stands.** The line drawn is still CDIP's model line rather than a
surveyed shore, and the sentence under the map still says so.

**The overhang stays.** `windowAround` returns one point past each end so the
stroke leaves the frame and the reader's eye continues it. Content crossing the
frame edge is therefore still expected; what is not expected is the _run_ being
cut, and that is what the new assertion distinguishes.

## Alternatives considered

**A minimum span on the existing box.** The smallest change, and it was measured
before being rejected: a 2 km floor moves 25 beaches to 27 showing two or more
coast points, and 3 km reaches 35 only by shrinking every beach that already
works. It also leaves `la-jolla-cove`'s stroke drawn at the MOP line, because a
bigger box does not fix a `beachStretch` that reads the box.

**Drop the MOP line from the frame and change nothing else.** Removes the
along-shore stretch in one line. Measured, it makes things worse: framing on the
beach's own extent alone leaves **7 of 51** beaches showing two or more coast
points, against 25 today, because the frames get smaller rather than larger.

**Raise `SHORE_WINDOW_MARGIN`.** Already rejected where that constant is
defined, on a measurement that still holds: at 0.1 La Jolla Shores fills 83
percent of its map's height, at 0.5 it fills 50 and at 1.0 it fills 33 while
Mission Beach's frame reaches 51 km. A margin is a multiplier on a box that is
already the wrong box.

**Use "binds a MOP line" as the test for being on the open coast.** Free, and
already committed. Rejected on `childrens-pool`, which binds no line, sits 0.33
km from the traced coast, and is plainly on the open coast — the binding is
about which model line supplies a swell forecast, and using it here would answer
a question it was not asked.

**Centre the coast and leave the slack even.** One less rule. Rejected on what
the map is for: half the empty space would be inland, on a picture whose subject
is which side the water is on.

## Consequences

- **`shoreViewFor` gains a real seam.** Finding the run is pure arithmetic over
  the committed polyline and is testable without rendering a map, which is what
  lets the inventory-wide checks assert placement directly rather than by
  screenshot.
- **Every frame moves, so every measured figure about the map is re-measured.**
  ADR-0034's placement table and `corner.ts`'s docstring figures were taken
  against the old projection. They are re-measured in the same pull request, and
  `corner.test.ts` — which asserts a clear corner on every beach — is the check
  that this did not quietly break the readout.
- **The minimum run is a number that will be argued about**, and it should be:
  it decides how much shore every map shows. It is a length of coastline in
  kilometres, stated in one place, and changing it changes every map at once —
  which is the property that makes it reviewable rather than a constant hidden
  in a component.
- **Three beaches stop being blank.** That is a change in what the site claims
  about a place, not only in how it looks, and it is why this decision names
  them.
- **#193 should be measured after this, not before.** That work grows the
  readout's box and re-measures every corner; done first it would measure
  against a projection this decision then moves.
