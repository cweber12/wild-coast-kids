# 0039 — The bays get their own shoreline

Date: 2026-08-31. Status: accepted. Completes ADR-0037, which committed the
geometry and deliberately declined to draw it. Depends on ADR-0038, which is
what makes it possible. Retires the "23 beaches with no traced coast" that
ADR-0033, ADR-0034 and ADR-0036 all refer to.

## Context

23 of 51 beaches are in Mission Bay or San Diego Bay. Until ADR-0037 the drawn
coast came from `mop-lines.json`, which CDIP computes for the open coast only,
so those beaches were 1.17 km or more from anything the repo could draw. They
got a frame with a chord across it — their own two committed ends — and a
sentence saying the traced coast did not reach them.

**ADR-0037 ended that and did not say so.** CDFW's ecoregion polygon has the
bays _erased_ out of it, so its boundary follows the bay shore; measured, the
23 bay beaches sit a median 4 m from the committed line. The shoreline has been
in the repo since that commit and was being withheld by a distance test measured
against the model line rather than against the shore being drawn.

That withholding was deliberate and is recorded in ADR-0037: drawing the bays
removes the readout's corner. A bay shore does not run down one side of a frame,
it surrounds it — `fiesta-island` and `mission-bay-sea-world` had no clear corner
at any box size. ADR-0038 took the readout off the picture, which removes the
only reason to keep withholding.

## Decision

**Every beach the committed shoreline reaches gets it drawn.**

- **`COAST_REACH_M` is measured against the traced shore and falls from 1,000 m
  to 200 m.** It stops separating the open coast from the bays, because the
  traced shore does not make that distinction, and becomes what its name always
  said: the distance past which there is nothing to draw.
- **`modelLine()` is deleted.** ADR-0037 added it so the open-coast test could
  keep its old answer while the drawn line changed underneath. There is no
  open-coast test any more. `mop-lines.json` is unchanged and still binds a
  beach to its swell forecast and still anchors the probe's arc.
- **The bay beaches' stretch becomes a run of the shore rather than a chord.**
  `beachStretch` already preferred a run wherever a coast was drawn; the chord
  was the fallback for having none. `beachStretch`'s argument — that a straight
  stroke at an angle to a drawn shoreline reads as a second, wrong shoreline —
  now applies in the bays too.

### What was measured

|                              | before  | after       |
| ---------------------------- | ------- | ----------- |
| beaches drawing a coast      | 28 / 51 | **50 / 51** |
| beaches with no frame at all | 1       | 1           |

**The one beach left out is left out on purpose.** `mission-bay-vacation-isle`
is on an island, and the committed shoreline holds the mainland ring only, so
its nearest shore is 416 m away across a channel. Admitted, it would frame on
the far bank and draw the heavy "this is your beach" stroke on somebody else's
shoreline. Excluded, it falls back to its own two ends — which are a single
point, so `boundsAround` returns null and the page renders an absence, which is
what that beach has always got.

That is why the threshold is not simply removed. Every other beach is within
36.7 m of the shore and the island is at 416 m; nothing lies between, and 200 m
is the middle of that gap.

## Alternatives considered

**Commit the island and lagoon rings too.** Vacation Isle, Shelter Island,
Harbor Island and the San Dieguito lagoon are separate rings of the same
feature. Including them means `coastline()` returning explicit runs rather than
one flat array whose breaks are inferred from step length, which changes
`nearestOn`, `unbrokenAround`, `runAround` and `windowAround` and their tests.
It is the right eventual answer for one beach and it is not this decision.

**Drop the distance test entirely.** One less constant, and it draws the island
beach a coastline on the wrong side of a channel. Rejected on that beach.

**Keep the chord as well as the run in the bays.** Draw both the shore and the
beach's committed extent. Rejected for the reason `beachStretch` already gives:
two strokes at an angle to each other, one of them heavier, reads as two
shorelines disagreeing.

## Consequences

- **This changes what the site claims about 22 places**, not just how they look.
  A reader of a Mission Bay page now sees the water they are actually standing
  beside. No gate can assert that it reads correctly, so it wants a human look.
- **The `sea-side` gate's window had to be widened again**, 12 km to 16 km, and
  the reason is worth recording because it is not the obvious one. The gate's
  window is centred on the beach and its sources; the map's is centred on the
  run of coast the beach occupies. A bay run wanders, so a _larger_ box does not
  contain a smaller one for free — `mission-bay` frames 5.6 km across and drew 9
  points the 12 km checker had never looked at. Swept: 14 km contains
  everything, and 16 is taken because 14 is the exact edge. The side check still
  passes 15 of 15 at the wider window, so the width is paid for.
- **`ShoreMap`'s `noCoast` prop is now unreachable from the committed
  inventory** and is kept. The component is pure and is handed a coast rather
  than resolving one; an empty coast must render as a sentence rather than as an
  empty square, which on a page about the sea reads as open water.
- **`ShoreMap`'s module docstring still describes the frame as sized partly by
  the bound MOP line**, which ADR-0036 stopped being true and this decision did
  not introduce. It is named here rather than fixed, because it belongs to that
  decision's ground rather than this one's.
