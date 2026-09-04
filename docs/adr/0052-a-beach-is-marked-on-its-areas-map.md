# 0052 — A beach is marked on its area's map

Date: 2026-09-04. Status: superseded by ADR-0053, 2026-09-04. **Amends
ADR-0033**, which says the map
plots nothing but the place. Completes ADR-0051, which gave an area a frame and
deliberately shipped it without marks. Nothing about a beach's own map changes.

## Context

ADR-0051 gave `/conditions/<area>` a square frame built from every member's
coast run. What it draws is a coastline and the water beside it — the same
picture at either scope, only wider — and nothing on it says which of an area's
beaches is where. On La Jolla that is ten beaches inside one shoreline, and the
picture is equally true of any of them.

That is the half of the map that makes it about an **area**. Without it the
frame is a stretch of coast that happens to be wide.

**ADR-0033 appears to forbid it, and the appearance is worth taking
seriously.** That decision is titled "The map draws a place, not an inventory"
and its first clause is "No markers." It was written against a picture carrying
the MOP line, the wave buoy, the tide station and the air station as four glyphs
in four shapes, two of which overlapped wherever a tide gauge is bolted to the
pier an air station stands on.

## Decision

**Each beach an area holds is marked on the area's map, with one mark type.**

**The distinction ADR-0033 was drawing is between an instrument and a
subject.** Every glyph it removed stood for a source the page _reads_ — a
station, a buoy, a model line — and its objection was that drawing them
answered ADR-0010 twice and "cost the picture its subject". A beach is not a
source. On an area map the beaches **are** the subject, and marking them is the
picture having a subject rather than losing one.

The rest of ADR-0033 stands and is untouched: no station, buoy, cell or model
line is drawn, the wash is one flat tint whose edge is the drawn line, and the
frame is sized by coast rather than by anything not on the picture.

**One mark type, not four.** ADR-0033's four glyphs of four shapes needed a halo
to be told apart; these are all the same short line and they mean one thing.

**Marks, never targets, and that is arithmetic rather than taste.** Four of La
Jolla's ten fall within 549 m of one another, so four tap targets at ADR-0004's
44px floor would need the map 2,634px wide against the 472px it has. The list of
beaches above the map is the control; the marks are for orientation.

**The mark sits at the middle of the beach's own drawn run, never at the middle
of its two ends.** Those ends are corners of a bounding extent, and the straight
line between them cuts inside every curve of the shore. Measured over the 50
beaches the traced coast reaches:

|                                            |              |
| ------------------------------------------ | ------------ |
| worst distance off the line, ends-midpoint | **1,562 m**  |
| beaches over 100 m off, ends-midpoint      | **17 of 50** |
| worst distance off the line, run-midpoint  | **0 m**      |

This is `beachStretch`'s rule one scope down — "a run of the polyline, never a
chord" — and it failed the same way when broken: `la-jolla-community-beach`
spans 5,082 m of a bay, and its mark floated in open land on the first draft of
this picture. Found by looking at the rendered map, not by a test.

**The one mark not on the line is `mission-bay-vacation-isle`**, which has no
coast run because the committed mainland ring does not hold its island. It falls
back to its own two ends — one point, that beach's extent being zero — and lands
about 400 m off the traced shore, inside the frame its neighbours build. That is
where the beach is, so it is drawn there rather than snapped onto the mainland
or dropped. It is the only mark on any area map that is not on a coastline.

**Positions cross the boundary, marks do not.** `shore.ts` returns one position
per beach and `ShoreMap` decides length, direction and weight — the split the
module already keeps, the assembler reading and the component drawing. The mark
is perpendicular to the **local** coast, taken from the two drawn points either
side of it, so a tick on a bay shore that turns through a right angle inside one
frame still crosses the line. That is ADR-0041's reading applied to a second
thing: take the direction from the walk, not from a normal computed once for the
whole picture.

**Four plot units long**, which is about 19px at the measured column width and
is fixed on screen rather than in metres. An area is 1.7 km of coast at Ocean
Beach and 8.9 km at San Diego Bay – Central; a mark in metres would be five
times bigger on one than the other.

## Consequences

An area map says which beaches are in the area and roughly where, and the list
above it says which is which. A beach map is unchanged: one subject, drawn as a
heavy run, and no marks at all.

**The crowding is accepted, not solved.** La Jolla's tightest pair sits 1.2
units apart — about 6px — and reads as a cluster of crossing ticks rather than
as four distinguishable marks. That is a true picture: those four beaches are
inside 550 m of each other. What is refused is labelling them there or making
them tappable, both of which the arithmetic above rules out.

**Whether that cluster reads as a cluster rather than a smudge is a human check
and no gate replaces it.** It was looked at on the rendered page at 1536×639
before this landed.

The part most likely to be re-litigated is whether this reopens ADR-0033. It
does not: the test that decision implies is whether the thing drawn is an
instrument the page reads. Every glyph it removed was; a beach is not.
