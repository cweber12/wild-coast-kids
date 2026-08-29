# 0026 — The cloud wash belongs to the day chart, not the week cell

Date: 2026-08-28. Status: accepted. Amends one sentence of ADR-0025.

## Context

`DaySpark` shipped in #171 drawing three things in a 240×30 frame: a tide
curve, two night bands, and a cloud wash of one rect per forecast hour whose
opacity carried the percentage. All three were specified together, and
`docs/plans/conditions-day-view.md` gave the reason: cloud and daylight are
_layers_ rather than tabs, "the conditions the selected variable happens in,
not variables competing with it".

That reasoning is about **what kind of thing** cloud is, and it is not
disputed here. What it did not settle is **at what size** a layer earns its
place.

Reviewed on the rendered page, the wash was read as confusing rather than as
context: asked what the shape at the top of each day was, the first guess was
that the curve itself was the cloud. Two grey layers of similar weight in a
21px frame have to be told apart before the curve can say anything, and the
one thing the reader is meant to take from seven of these — which day is
calmer, and whether the dip is at night — is carried by the other two layers
entirely.

**#171's own width measurement had already found this edge from the other
side, and it was not read that way at the time.** The ladder in
`MIN_USEFUL_SPARK_WIDTH_PX` records what fails as the cell narrows:

| width | what survives                                    |
| ----- | ------------------------------------------------ |
| 133   | everything; both dips and both night bands clear |
| 110   | night bands still separable from the cloud wash  |
| 88    | curve survives, layers do not — the bands merge  |

Every row from 110 down is a sentence about **two grey layers being hard to
distinguish**. That was recorded as a fact about width. It is at least as much
a fact about there being two of them.

## Decision

**`DaySpark` draws the curve and the night bands. The cloud wash is drawn only
by the day chart.**

- **The `cloud` prop is removed rather than defaulted off.** A prop nobody
  passes is speculative flexibility, and this repo deletes rather than keeps —
  git remembers. `SkyWeekDay.hours` is still read by `WeekPanel`, because the
  grid's cloud row still prints from the same read; what changed is that
  nothing paints them behind a curve.
- **A test asserts the absence**, and asserts it twice: no element carries
  `data-cloud-percent`, and every `<rect>` inside the plot carries
  `data-night`. The second is the one that matters, because the day chart will
  draw a wash from the same series shape and a layer reintroduced without its
  data attribute would pass the first assertion alone.
- **`MIN_USEFUL_SPARK_WIDTH_PX` stays at 110 and is re-described rather than
  re-measured.** The ladder above was taken on a frame that drew a wash. Taking
  a competing layer away cannot make the remaining one harder to see, so 110 is
  now a safe bound rather than a fitted threshold. It is left alone because it
  does not bind — the narrowest cell this grid renders is 133px — and moving a
  number that changes no behaviour would be churn wearing the clothes of rigour.

**What this costs, stated plainly:** the week no longer says anything about the
sky in the shape. It still says it in the cloud row, in figures, which is where
it said it before #171 and where ADR-0024 put it.

## What this amends in ADR-0025

ADR-0025's consequences say:

> **One series shape, shared.** `DaySpark` and the day chart to come take the
> same points and draw the same two background layers.

The first half stands and is the design's first principle: `SparkPoint` is one
type and both plots take it. The second half is now wrong, and the corrected
version is that **one background layer is shared and one is not**. Night is
drawn at both zoom levels; cloud is drawn only where there is height to carry
it without competing.

That is a weaker guarantee than ADR-0025 claimed, and the weakening is worth
naming: the two plots can now differ in a way that document said they could
not. What holds them together is the shared point type and the shared night
band, not an identical background.

**Nothing here touches ADR-0023.** No figure is added to or removed from a week
cell. The curve still draws the hours the daylight figure was selected out of,
and the overnight dip is still visible inside a band that is obviously night —
which is the whole of what #171 was for. Removing a layer that was never
carrying that fact does not give it back.

## Alternatives considered

**Keep the wash and lighten it.** The smallest change, and it was the first
thing to reach for. Rejected: the problem is not the weight of one layer but
that two layers of the same colour family occupy one 21px frame, and a lighter
wash that can still be seen still has to be told apart from the night band. A
wash light enough not to compete is a wash carrying no information, which is
worse than none — it is decoration on a plot this brief asks to read like a
field guide.

**Give cloud its own colour rather than its own zoom level.** Real, and it
would separate the layers. Rejected on two counts: the palette is fixed and
art-directed in `globals.css`, and a third hue inside a 21px annotation is more
chrome than the register allows; and it would still be a second variable
competing for the frame, which is the duplication the brief's first principle
exists to prevent.

**Move the night band out instead and keep the wash.** Symmetrical on its face
and much worse. The night band is what makes the sparkline fulfil ADR-0023 at
all: the dropped figure was an overnight extreme, and a dip nobody can see is
at night carries none of it. Night is also astronomy and cannot fail, where
cloud is a forecast that can.

**Keep both and raise the shape's height.** The 8:1 ratio exists because 5:1
read as a second chart above the figures, measured in #171 and reviewed. Going
back up to fit a third layer would re-buy the problem that ratio was chosen to
solve, and it would do it in the PR that adds a full day chart below the grid —
the exact duplication the first principle names.

## Consequences

- **`DaySpark` takes one fewer prop and draws one fewer layer.** `cloudOpacity`
  and its floor are gone with it. The floor was a good rule — a published 0%
  must not render like an hour nobody forecast — and the day chart's wash will
  need it again; it is in this file's history rather than in the component.
- **A sky outage no longer changes the shapes at all.** It used to strip a
  layer out of seven of them. `WeekPanel`'s test now asserts the curves are
  byte-for-byte identical with the sky read failing and succeeding, which is a
  stronger property than the one it replaced.
- **The day chart inherits the wash and the argument for it.** It has the
  height, and at that size the wash is the only thing that can say a day is a
  burn-off — which is ADR-0024's finding and the reason the thirds exist.
- **Anything that puts a second background layer back in a week cell reverses
  this**, and it will look like restoring context. The table above is the
  argument, and the confusion it records was a reader's, not a measurement's.
