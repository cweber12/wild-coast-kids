# 0034 — The weather leaves the map for a corner readout

Date: 2026-08-31. Status: accepted. Reverses the decision in
`docs/plans/conditions-day-view.md` that "the compass sits on the map, because a
bearing is meaningless without a coast", and replaces the `Dial` entry in
`CONTEXT.md` with `Readout`, updated in the same pull request. ADR-0032's rule —
one instrument may carry two provenances — stands unchanged; its subject is now
this block. ADR-0033, ADR-0024 and ADR-0010 are untouched.

## Context

The compass shipped in #184 as a dial drawn inside the shore map's own drawing
space: a ring at `RING_RADIUS = 30` in a 100-unit frame — 60 units across, with
labels out at 34 — translated onto the beach's own stretch of coast rather than
the frame's middle.

**Reviewed on the built page, the instrument was covering its own subject.** The
coastline the needles exist to be read against was underneath them, and on some
beaches the dial overflowed the frame. That is the whole of issue #192.

Two further things were true of the map and were not visible until it was looked
at properly. `anchor === null` withheld the dial **and its provenance** wherever
no coast is traced, so 23 of 51 beaches — Mission Bay and San Diego Bay — printed
no wind bearing and no wind figure anywhere on the picture. And the sentence
under the map restated the dial's bearings, because the `<svg>` is one
`role="img"` and nothing drawn inside it reaches the accessibility tree.

**The decision being reversed is binding and lives only in a plan file**, which
stops being maintained the moment it merges. That is why this is an ADR: without
one, the reversal would be an undocumented contradiction of a document that
still reads as current.

## Decision

**The wind and the swell are read in a corner of the map, as HTML laid over the
picture rather than as a drawing inside it.**

- **One row per source**: an arrow pointing the way the weather travels, a faint
  wedge behind it for the range the direction swung through in daylight, the
  word for that direction, and its degrees.
- **The ring goes and the arc becomes a wedge**, which is one change rather than
  two. The ring's only stated justification was that "an arc with nothing to be a
  portion of reads as a stray stroke rather than as a range". At corner size that
  arc cannot be judged — a 40° arc and a 50° arc on a 9px ring are the same
  picture — so the thing it justified goes with it. The wedge was rejected once,
  because "a wedge covering a fifth of the map on a settled day and half of it on
  an unsettled one would hide the coast underneath"; in a corner block there is
  no coast underneath, so that reason has expired.
- **The corner is measured per beach, not fixed.** See below: a fixed corner
  cannot be kept off the picture on this inventory.
- **The block is the text equivalent of itself.** Each row is one `role="img"`
  with the unabbreviated sentence as its label, which is how `DaylightWeek` and
  `Placeholder` already name a thing whose visible content is not its name. The
  sentence under the map keeps attribution and stops restating bearings.
- **It is drawn on all 51 beaches**, including the 23 in Mission Bay and San
  Diego Bay that the traced coast does not reach. The dial was withheld there
  on the rule that "a bearing read against no shoreline is the bare gauge the
  brief's anti-references open with". That objection was about a needle drawn
  over an empty frame; a labelled block carrying a word for the direction, its
  degrees, a magnitude with units and a publisher beneath is not that thing.
  The cost of withholding it was that nearly half the inventory printed no wind
  figure anywhere on the picture — the same figure the week grid above states
  for every one of those beaches.

**The bearing is still read against the coast, which is what the reversed
decision was protecting.** The block is inside the same square frame as the
shoreline, north-up, a few centimetres from it; an arrow whose tail is out over
the shaded sea is onshore wind, exactly as before. What changed is that the
reader can now see the coast they are reading it against.

## What was measured

**Placement.** Every beach walked through `shoreViewFor` and projected, as the
widest readout each placement rule survives on its worst beach. The three
figures do not move at any block height from 12 units to 40:

| placement                        | widest readout | worst beach                    |
| -------------------------------- | -------------- | ------------------------------ |
| fixed top-left                   | 8.3 units      | `childrens-pool`               |
| top, side flipping left/right    | 19.0 units     | `la-jolla-cove`                |
| the roomiest of the four corners | 50.5 units     | `mission-bay-visitor-s-center` |

8.3 units is about 27px on the 327px map a 375px viewport draws. At a realistic
46 × 14 a fixed top-left block sits on the beach's own stretch on **21 of the 47
beaches that draw one**, including the default beach. The cause is structural:
where no coast is traced, `beachStretch` draws the beach's own two ends, so the
segment is a chord between the frame's margin corners and always blocks one
diagonal pair — `childrens-pool` reads 8 units clear at the top-left, 8 at the
bottom-right and 92 at each of the others.

An adaptive corner clears the beach's stretch **and the whole windowed
coastline** on every beach in the inventory. `corner.test.ts` asserts it.

**Width is the entire constraint and height is free.** The 50.5-unit ceiling is
identical for a band 14 units deep and one 40 deep, because what blocks a corner
is a stroke crossing it diagonally rather than one grazing its edge.

**What the rows cost, at `text-2xs`.** `SWELL south-west 270°` is 147.6px. The
block's box leaves 151.5px inside a 327px map and 124px inside the 272px map a
320px viewport draws — and ADR-0004 commits this site to 320 CSS px. So the row
**wraps**, which is ADR-0004's own resolution of the same squeeze: content that
no longer fits grows its container rather than being clipped, because a taller
block is a visible degradation and a line running off the picture is an
invisible one. Measured on the built page at `ocean-beach`, which prints the
widest row the inventory holds: one line at 1536 and 375, two at 320, and the
ink inside the reserved box at all three.

## Alternatives considered

**Fixed top-left, as the plan wrote it.** Rejected by the measurement above: it
is not a corner the block can stand in. The plan's stated reason for preferring
it — a control that moves between Del Mar and Coronado is a control a reader has
to find again — is real, and is the price this decision pays. Its other reason,
that an adaptive corner "becomes untestable in the useful direction", is wrong:
the property is exactly as assertable either way, and it is the fixed rule that
cannot be verified, because it is false.

**Reserving a band inside the frame**, projecting the whole picture into the
lower 86 units so a fixed top-left is empty by construction. Keeps the corner
fixed and makes the check trivial. Rejected: it costs about 14% of the drawn
picture's height on every lat-dominant beach, on a map whose entire complaint
was that the picture was being taken away from the reader.

**The block above the map rather than on it.** No overlay, no collision, no
contrast question. Rejected: it costs vertical height in a column already
stacking a map, a coast credit, provenance rows and the sightings slot, reviewed
in a 555px-tall stop — and it puts the bearing outside the frame that gives it
meaning.

**A translucent panel behind the block.** Legible over anything. Rejected: a
bordered panel floating on a map is the boxed legend the brief lists as an
anti-reference, and the dial already rejected exactly this once, where a label
halo at `strokeWidth` 2.5 "read as a chip stuck on the map".

**Keeping the dial and shrinking it.** The smallest change. Rejected: a ring at
half the radius puts the labels inside the picture rather than outside it, the
arc becomes unjudgeable at any radius that fits, and none of it is in the
accessibility tree — so the duplicated sentence under the map would have to
stay.

**Dropping the direction word and keeping only the degrees**, which is what
makes a row fit on one line at 320px. Rejected: `bearing.ts` exists because a
bearing in degrees is not a direction most readers can picture, and the word is
the half of that pair a parent planning a beach day actually reads.

## Consequences

- **`Compass` renders HTML and no longer knows where it is.** Which corner is
  safe is a question about the coastline underneath, so `ShoreMap` projects,
  asks `corner.ts`, and positions the block. `NEEDLE_TRACKS` and the two needle
  radii go: two arrows in two labelled rows cannot overlap, so the separate
  tracks that stopped them coinciding have nothing left to do.
- **`ShoreMap`'s `compass` slot is now `readout`**, and its contract changed with
  its name: it was a group translated into plot units and it is now HTML
  positioned against the map's box.
- **`corner.ts` is a new pure module and a new seam.** It takes projected points
  and a box and answers with a corner, so the inventory-wide check calls it
  directly rather than rendering 51 maps.
- **The readout's width has a hard ceiling of 50 drawing units**, and a later
  slice adding a field to a row will meet it. The height does not; spend that
  instead.
- **The 23 beaches with no traced coast gain a wind row**, where they had
  neither a bearing nor a provenance line before. They gain no swell row, and
  that is right rather than incidental: they bind no MOP line, so there is no
  swell estimate for them to be given.
- **The map's own absence sentence is unchanged.** A beach with no traced coast
  still says so under the picture, and now says it beneath a readout rather
  than beneath nothing.
