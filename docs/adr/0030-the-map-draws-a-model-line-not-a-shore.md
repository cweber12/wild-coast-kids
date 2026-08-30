# 0030 — The map draws a model line, not a shore, and says so

Date: 2026-08-30. Status: accepted. Extends ADR-0010 from a sentence to a
picture, and adds a condition to it.

## Context

`ShoreMap` draws this beach's coast, its own stretch of it, and the four places
every figure on the page comes from, each at its real distance. That is
ADR-0010's requirement — "no figure is ever shown without the reader being able
to see where it came from" — answered by drawing instead of by writing.

The only geometry this repo holds for the county's coast is
`src/data/mop-lines.json`: 1,210 CDIP model lines at about 98 m spacing,
committed by `scripts/probe-mop-lines.mjs`. Nothing had ever read that file as
a shape before; `beaches.ts` reads it one key at a time to answer which line a
beach binds.

**Read as a shape, it turns out not to be a shoreline.** CDIP computes MOP
lines at 10 m depth, and their published positions sit offshore of the sand.

### What was measured

Across the 25 beaches that bind a MOP line, `mop_line_distance_m` runs:

| min   | p25   | median | p75   | max   |
| ----- | ----- | ------ | ----- | ----- |
| 117 m | 466 m | 644 m  | 776 m | 930 m |

At La Jolla Shores, directly: at latitude 32.8665 the MOP lines sit at
longitude −117.2609 to −117.2587, and the beach's own committed coordinate at
that latitude is −117.2592. The bound line D0498 is about 310 m seaward of the
beach's own position.

**The consequence is visible on the page the site opens on.** The Scripps tide
gauge (9410230) and the Scripps Pier air station (LJAC1) are at −117.2571 and
−117.2570 — both on a pier, both over water, and both **landward** of the drawn
line. A map that shaded one side as sea and the other as land put two
instruments that are in the ocean onto the beach.

## Decision

**The line is drawn, and the map declines to say where the water stops.**

Three parts, and each is load-bearing:

- **The wash fades rather than ending.** It is transparent where the line is
  and reaches full strength 644 m seaward — the measured median offset itself,
  not a chosen number. The picture says the sea is that way and refuses to say
  the edge is here. Held as a real ground distance rather than a fraction of
  the frame, so it scales with the map: a few plot units on `mission-beach`'s
  20 km frame, about a sixth of the picture on La Jolla's 3.9 km one.

- **The line names what it was traced from**, in a sentence under the picture.
  The markers were attributed one at a time and the largest thing on the map
  was not, which is ADR-0010's own rule applied everywhere except where it is
  hardest to notice. It matters more here than for an ordinary figure: nothing
  about looking at a line down a coast says it is a model line rather than a
  shore, so the words are the only place a reader can learn it.

- **Which side is seaward is still checked, because it is still a fact.** The
  offset does not make the question meaningless — the sea really is west of the
  line at every beach — it only makes the boundary imprecise. The `sea-side`
  gate row proves the side for every beach that binds a wave buoy, 15 of 51,
  and `sideOf` in `src/lib/coastline.ts` is what the map shades by.

## Alternatives considered

**Keep the hard edge; the offset is small against the frame.** 117 to 930 m
against frames of 1.8 to 20 km is 3% to 30%. Rejected on the worst case rather
than the average: 30% is La Jolla, which is the beach the page opens on, and
there the error is not an abstraction — it renders a tide gauge and a pier in a
car park. A rule that is fine on average and wrong on the default page is
wrong.

**Keep the hard edge and caption it.** Say in words that the line is CDIP's
model line at 10 m depth. Rejected because the caption fights the form: the
picture still looks like a coastline, so a reader who does not read the caption
is misinformed exactly where it costs most, and this brief's second principle
is that form carries the claim before words do. The caption is kept — it is the
second clause above — but it is not made to do this work alone.

**Drop the shading entirely.** Draw the line, mark the beach, plot the markers,
claim nothing about which side is water. Unimpeachable and too expensive: it
costs the strongest orientation cue on the map, and it leaves the `sea-side`
gate row checking a fact nothing uses, which is how a checker rots.

**Find a real shoreline.** No shoreline dataset is committed here, and adding
one is a data acquisition rather than a layout decision — a new source, a new
join, a new probe and a new checker. If one ever lands, this decision is what
it supersedes.

**Shift the line inland by the measured offset.** Tempting and worse: it would
invent coordinates no publisher issued, and the offset is not constant — 117 to
930 m — so the correction would be wrong nearly everywhere it was applied. This
site does not manufacture positions, which is the same rule that keeps
`beaches.json`'s distances a join result rather than a runtime computation.

## Consequences

- **The map is honest about a boundary it cannot draw, and looks slightly less
  crisp for it.** Anyone who "fixes" the blur into a hard edge reverses this
  decision, and it will look like tidying.

- **The 644 m fade is a measurement and will go stale.** It is the median of a
  committed table; a re-run of `probe-mop-lines.mjs` that moved the lines would
  make it wrong without failing anything. It is named as a constant with the
  measurement in its docstring, which is this repo's usual answer, and it is
  the kind of figure `TASKS.md` already records as going stale within days.

- **ADR-0010 gains a condition when it is discharged by drawing.** Naming a
  station in words carries its own precision; drawing one asserts a position,
  and a position drawn against a reference the reader cannot see is a claim
  about that reference too. Anything else this page draws at a real position
  owes the same disclosure.

- **The `sea-side` gate row survives and means less than its name suggests.**
  It proves which side, not where the boundary is. `scripts/sea-side.mjs` says
  so; this is the decision that made the distinction matter.
