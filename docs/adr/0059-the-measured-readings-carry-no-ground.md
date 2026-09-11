# 0059 — The measured readings carry no ground of their own

Date: 2026-09-11. Status: accepted. Supersedes ADR-0056 on presentation and
placement; keeps its "one band, one line" decision and keeps ADR-0057 whole.
Plan: `docs/plans/conditions-toolbar.md`.

## Context

ADR-0056 gave the measured block a dark surface, and its argument was about the
shape the block had: "on cream the band read as one more paragraph in a column
of them ... a bordered box on it is a weaker signal than a surface". That is
true of a paragraph-shaped block sitting in a column of paragraphs, which is
what it was — full width, under the page header, above the week.

**The premise is what changed, not the reasoning.** The block is moving onto the
page's toolbar row, beside the controls that say which place the figures
describe. A dark slab on that row does not read as a distinguished surface; it
reads as an element pasted into the chrome. ADR-0056 also rejected "beside the
chooser" explicitly, and that rejection was measured against a **288px stacked
column** — "a badge needs horizontal room; 288px is a narrow card". The bar is
not that geometry: the chooser is inline on the same row, and the readings get
roughly 600px on one line at the review viewport.

**A surface was doing a job, and the job outlives it.** What `bg-dark` bought
was the statement that these two runs of figures are _two sources_, not one
sentence — the distinction ADR-0010 requires, since merging them would put two
agencies behind one claim. Remove the ground and two runs of figures on a shared
baseline read as a single sentence.

## Decision

**No background and no border.** The band renders on the page's own cream.

**A micro-label over each segment, and a rule between them.** `Sea` and `Air` in
the label register, with `border-l` on every segment after the first — between,
never around, because a border on all four sides is the box being redrawn one
edge at a time.

**The label belongs to the segment, not to its index.** `BandSegment` carries a
`label` field. `bandView` documents its order — waves first when measured, then
air — so reading the label off the position would be correct today and would
mislabel the sea as the air the first time a third source lands or the order
changes.

**The colours are the ones measured against cream, and the dark-ground pair does
not follow.** The figures set no colour at all, inheriting `--color-dark` on
`--color-cream` from `body`. The two subordinate registers are `text-fog`, which
the standing notice on this same page already uses — so no new text-on-surface
pair is introduced and none is owed a fresh measurement. `CARD_PROSE` and
`CARD_MUTED` are white at 75% and 55% **measured against `--color-dark` and
nothing else**; white at 55% on cream paints **1.03:1**, which is the bug #175
fixed in three places.

**Opacity becomes size.** The two subordinate registers were opacity on the dark
ground because size was already spent there. Here they are `--text-base` for the
plain-words line and `--text-2xs` for provenance, with one colour between them.

## Consequences

**ADR-0056's core decision survives.** One band, one line, two glyph-anchored
segments where both sources answered and one where only air did, wrapping at a
phone width. What is superseded is the ground it is printed on and the claim
that it belongs full-width under the header rather than beside the chooser.

**ADR-0057 is untouched.** The air segment's glyph is still the forecast sky for
the current hour and the attribution still says so. Losing the surface does not
lose a product.

**`MeasuredBand.test.tsx`'s colour test inverts rather than retires.** It asserted
`bg-dark` present and `text-fog` absent; it now asserts the reverse. Keeping it
pointed the other way is the point — the hazard it was written for is live in
both directions, and deleting it with the ground would remove the only thing
watching for #175 coming back.

**The band is no longer visually a block, so it must not be given block
spacing.** Margins and padding that made a slab sit apart from its neighbours
would rebuild the box in whitespace. Its separation is now the toolbar row it
sits on.
