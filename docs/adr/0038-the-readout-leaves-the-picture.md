# 0038 — The readout leaves the picture

Date: 2026-08-31. Status: accepted. **Supersedes the placement half of
ADR-0034**; its other clause — that the readout is rendered on every beach,
including the ones with no coast — stands and is what this makes cheap.
Retires `corner.ts`. ADR-0037 is what forced it.

## Context

ADR-0034 lifted the weather readout out of the map's drawing space, where it had
been translated onto the beach's own stretch of coast and covered the one thing
the picture exists to show. It became an HTML overlay positioned in CSS against
the map's box, standing in whichever of the four corners the drawn geometry left
free — measured, not fixed, and held for the whole inventory by
`corner.test.ts`.

That worked because the drawn coast was CDIP's model line: a nearly straight
run down a west-facing county, which leaves three corners of a square empty.
The worst beach left 50.5 units clear of 100, so a 50-wide block fitted
everywhere.

**ADR-0037 changed what the coast is traced from, and ADR-0037's own follow-on
changes where it reaches.** A traced shore reaches the bays, and a bay shore
does not run down one side of a frame — it surrounds it.

### What was measured

With the traced coast drawn on all 51 beaches, the roomiest corner on each:

|                                                  |                                  |
| ------------------------------------------------ | -------------------------------- |
| beaches with a corner clear enough for the block | **31 / 51**                      |
| `fiesta-island`                                  | **0.0 units** (505 points drawn) |
| `mission-bay-sea-world`                          | **0.0 units** (380 points)       |
| `shoreline-park`                                 | 3.5 units (1,700 points)         |
| `mission-bay-mariners-basin`                     | 4.0 units (613 points)           |

**Shrinking the block does not rescue it.** The widest box that fits every
beach, by band depth:

| band depth             | 8   | 12  | 16  | 20  | 30  | 40  |
| ---------------------- | --- | --- | --- | --- | --- | --- |
| widest box fitting all | 4.0 | 4.0 | 0.9 | 0.1 | 0.0 | 0.0 |

Four units of a hundred, against the 46 the block needs. There is no size at
which an overlay clears every beach, because on two of them there is no clear
corner at all.

## Decision

**The readout is printed under the picture, not over it.**

- **`corner.ts` and `corner.test.ts` are deleted.** `cornerFor`, `clearanceAt`,
  `readoutStyle`, `READOUT_BOX` and `CORNER_ORDER` all existed to answer a
  question that no longer has an answer. `ShoreMap` places the block below the
  frame; nothing measures anything.
- **The block gets wider, not narrower.** The overlay was capped at 46 units —
  46 percent of a square that is itself a third of the row at `xl`, and 46
  percent of `max-w-sm` below it. Under the map it spans the column, about twice
  the width at every breakpoint. The cap only ever existed to keep it off the
  picture.
- **The readout and its sources stay coupled, and it is now stated.** Both were
  gated on a corner having been chosen, so the coupling ADR-0034 required was
  carried by an accident of the implementation. With no corner to gate on, one
  `hasReadout` decides both.
- **The document order is picture, readout, credit, sources.** Which is the
  order a reader meets them and the order a screen reader announces them.

## Alternatives considered

**Keep the overlay and give it a scrim.** Let it cover the coast, with a
translucent backdrop so both stay legible. Rejected: it trades the property
`corner.test.ts` asserted — the readout covers nothing the map draws — for one
no gate can check, since "legible over a wash" is a contrast judgement against
whatever the coastline happens to be doing underneath. It also fights ADR-0033's
finding that the map's subject is the place; a block over the middle of a bay
map is the same fault ADR-0034 fixed, one layer up.

**Keep the corner and leave the bays undrawn.** This is what shipped in
ADR-0037, deliberately, to keep that change reviewable. Rejected as a permanent
answer: it withholds a coastline the repo now holds from 23 beaches, on no
better reason than that a block sits on top of it.

**Put the readout beside the map rather than under it.** Two columns inside the
map's own column at `xl`, stacking below. Rejected as more responsive machinery
for the same result: the map column is already a third of the row, so a split
inside it gives the readout less width than putting it underneath, and it is
the width that constrains the rows.

**Shrink the block until it fits.** Measured above and it does not: four units
of a hundred at the most generous depth.

## Consequences

- **ADR-0037's re-measurement of `READOUT_BOX` is retired one commit after it
  landed.** That is not waste — the figure was needed to ship #205 honestly, and
  this decision is what #205's own body said would supersede it.
- **`Compass.tsx`'s wrap measurement expired**, and is not restated on a guess.
  Its figures — 147.6px of text against 151.5px and 124px of inner width —
  described the overlay. The wrap rule is kept because it is right under
  squeeze; the numbers need the rendered page.
- **Nothing about the map's own geometry changes.** `shore.ts`, `coastline.ts`,
  the projection, the sea wash and the frame are untouched.
- **The map is taller in the column than the readout was over it**, in the sense
  that the column now carries both rather than one on top of the other. The
  conditions page is not stop-constrained — it is not the landing page — so the
  budget CONTEXT.md sets for a stop does not apply.
- **This wants a human look, and no gate replaces it.** The block moved and got
  wider; whether the rows read well at that width is a question about the
  rendered page.
