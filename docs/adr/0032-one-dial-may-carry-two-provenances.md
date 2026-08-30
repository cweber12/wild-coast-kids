# 0032 — One dial may carry two provenances

Date: 2026-08-30. Status: accepted. Extends ADR-0010's rule to a component that
is not a `StatGroup`, and adds the `Dial` entry to `CONTEXT.md`, which is
updated in the same pull request.

## Context

ADR-0010 settled how this site attributes a figure, and the rule it produced is
narrow on purpose: **one `StatGroup` never spans two sources.** A group of
figures carries one provenance line, and a reader who wants to know where a
number came from reads the line under the group it is in. Two sources meant two
groups.

That rule has held because every consumer of it was a list of figures. The
compass is not. It is one drawing, sixty units across, carrying two needles —
where the wind comes from, and where the swell comes from — and those come from
two publishers that share nothing: the National Weather Service's forecast cell
for this beach, and CDIP's MOP model line a few hundred metres offshore.

**Splitting it is available and is the wrong answer**, and the plan file already
argued why before the component existed:

> the insight is the _relationship_ — wind from the east is offshore at a
> west-facing beach and onshore at an east-facing one — and two dials force the
> reader to do angle arithmetic in their head.

Two dials side by side would each satisfy ADR-0010 exactly and would destroy the
thing the component is for. The whole design brief's third principle rests on
the two needles being readable against each other and against one coastline.

There is also precedent that the rule was already narrower than it read.
`WeekGrid` holds NOAA's tides, CDIP's swell and this repo's own daylight
arithmetic on one grid, and resolves it with a provenance line per **row**
rather than by becoming three grids.

## Decision

**A component may carry more than one publisher when the reader's insight is
the relationship between them, on condition that every figure it draws is
attributed individually and adjacently.**

For the compass that means, concretely:

- **A provenance line per needle**, not per dial. The wind's names the grid
  cell and the National Weather Service; the swell's names the MOP line and
  CDIP. Both are `ProvenanceLine`, so the wording of "how far away" and "who
  published it" stays owned by the one component that owns it everywhere else.
- **Each line sits with its own reading.** The bearing in words and degrees is
  printed immediately above the line that attributes it, so the pair reads as
  one row. A block of two bearings followed by a block of two sources would
  make the reader match them up, which is the work attribution exists to avoid.
- **Beside the picture, not on it.** The map is one `role="img"`, so nothing
  drawn inside it reaches the accessibility tree. The rows below are the dial's
  text equivalent as well as its attribution, which is `ShoreMap`'s existing
  rule for its markers rather than a new one.

**ADR-0010 is unchanged for `StatGroup`.** This does not license a group of
figures spanning two sources; it says that a _drawing_ whose subject is a
relationship may, when each mark inside it is attributed.

## The test this has to pass

A rule that permits duplication is only worth having if it is checkable. The
condition is: **for every mark the component draws, a reader can find that
mark's publisher without leaving the component.** Two needles, two lines, in
the same order. When a needle is withheld — 26 of 51 beaches bind no MOP line,
and a cell can publish no wind direction — its line goes with it, so the block
never names a source for something that is not drawn.

## Alternatives considered

**Two dials, one per source.** Satisfies ADR-0010 with nothing to decide.
Rejected on the plan's own argument above: the insight is the angle between the
two needles and the coast, and two dials make the reader compute it. It is the
same failure the previous brief named when it said the tide time and the wave
height "are three screens apart in reading order and never appear together."

**One provenance line for the dial, naming both publishers.** Half the text and
no rule to write. Rejected because it puts the matching back on the reader in a
smaller space: "National Weather Service and CDIP" under two needles does not
say which is which, and the moment one needle is withheld the line is wrong.

**Attribute the needles in the map's own accessible description.** Tempting,
since the dial is drawn inside the map's `<svg>`. Rejected because that
description is built once for a picture that is the same on all seven days,
where the needles change with the day a reader picks — so the attribution would
have to become per-day, and with it the whole map.

**Drop the compass and state the two bearings as figures in a card.** Would need
no new rule at all. Rejected: `StatGroup` would then hold two sources anyway, or
there would be two cards, and a bearing stated as a figure is the number the
brief opens by saying means nothing on its own.

## Consequences

- **`Compass` is the second component to hold more than one publisher**, after
  `WeekGrid`, and the two now answer it the same way. That is a pattern rather
  than an exception, and the next component that needs it has somewhere to look.
- **A needle and its provenance line are one unit.** Anything that withholds a
  needle has to withhold its line, and the reverse. That is asserted rather than
  documented: `ShoreMap` renders neither where the traced coast does not reach
  the beach, and a beach with no MOP line draws one needle and one line.
- **The duplication ADR-0029 permits now has a third instance on this page.**
  The grid cell is named by the cloud row, by the sky wording and by the wind
  needle. Each attributes its own figure and none covers another's, which is the
  condition ADR-0029 sets — but three lines naming one publisher within one
  screen is worth watching, and the day chart is about to add a fourth.
