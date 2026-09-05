# 0055 — A wave absence is worded where the model that replaces it is drawn

Date: 2026-09-04. Status: accepted. Discharges a condition of ADR-0019 by
moving it; applies ADR-0049's rule to a panel that is about to lose its slot.
Plan: `docs/plans/the-measured-band.md`.

## Context

**Thirty-six of the fifty-one beaches have no wave buoy.** All fifty-one have an
air station. Ten of the thirty-six are the beaches ADR-0019 admits, where a CDIP
MOP line answers for the waves and no instrument does; the rest are bays,
lagoons and inlets where swell does not reach at all.

Applying ADR-0048's intersection rule over the eighteen areas gives the same
shape one level up: waves are `shared` in 3 areas, `mixed` in 2 and `absent` in 13. So a measured wave height exists on 15 of 51 beach pages and 3 of 18 area
pages — **18 of 69 routes**.

Today every one of the other 51 routes says so inside the measured block, in a
card: a paragraph, plus a `<details>` carrying the join's own reason. That was
the right shape while the block was two cards, and ADR-0049 says so in as many
words — "that block is two cards, one per product, so a withheld product is a
card". `docs/plans/the-measured-band.md` takes the block to one line, and a line
has no room for a paragraph.

**The question is not where the sentence fits. It is who the sentence is for.**
ADR-0019 names the reader it protects: "a parent reading '1.5 ft' before taking
children into the water is not weighing model against instrument", and it
records the model and the buoy disagreeing 2.0 ft against 0.8 ft at La Jolla
Shores on 2026-08-26. That reader is looking at a **modelled height**. The
modelled heights are drawn in two places, and neither of them is the measured
block: the week grid's wave row, the day chart's swell tab, and the shore map's
readout.

So the disclosure has been sitting one region away from the figure it is about.

## Decision

**A sentence explaining a missing wave measurement is worded on the attribution
of the modelled height that replaces it, everywhere one is drawn.** Three
places, and the rule rather than the list is what is being decided — a fourth
drawing would take it too.

- **The week grid's wave row**, on its provenance line.
- **The day chart's swell tab**, on its provenance line.
- **The shore map's readout**, on the swell row's provenance line.

All three already carry `MOP_MODEL_NOTE` — "a model of the swell at 10 m depth,
not a measurement" — which is the same claim about the same figure, one clause
short of this one. The clause is appended to it, semicolon-joined, the way the
cloud row composes `GRID_MODEL_NOTE` with its cell caveat.

**On the attribution and not in the week's notes array**, which was the first
answer and is the wrong one. That array says why a row a reader expected is
_not there_; this says what a row that _is_ there is made of. Putting it in the
notes would also have left the claim in two shapes — a free sentence in one
region, a provenance clause in the other two — for one fact, which is the drift
`mopLine.ts` exists to prevent.

**Not in the `absence` slot**, and this is the part most likely to be got
wrong. `HourSeries.absence` is "what to say instead of a plot when `points` is
empty", and on the ten ADR-0019 beaches the plot is **not** empty: MOP answers,
the curve draws, and a sentence in the absence slot would never render. The
whole risk this discloses is a reader trusting a curve that is there.

**The measured block keeps the absence and hands over the substitution.** Its
card said two things — that no buoy reaches this coast, and that every wave
height on the page is therefore modelled. The first is a fact about this beach
and stays where the reader asks "what was measured here". The second is a fact
about the other two panels and belongs beside them.

## Consequences

**ADR-0019's condition is discharged, not weakened, and the wording is
stronger.** That decision requires the page to say "the height shown is
modelled" and warns that if the disclosure "is ever removed or weakened, this
decision goes with it". It now sits on the attribution of the modelled height
itself, on both panels that draw one, rather than one region above them in a
block about a different thing. A reader who scrolls past the measured block —
which is most of them, since it is the part with no figure on these beaches —
used to miss it entirely.

**ADR-0049's rule survives its own example.** That decision's rule is that a
withheld product is worded "in the slot its own panel already uses for a product
it cannot draw". Its worked example was the measured block's card, because that
was the panel in question. Here the panel that cannot draw is the wave row and
the swell tab, and both already have such a slot. The rule generalises; the
example was never the rule.

**A note fires on inventory, not on a fetch.** Whether a beach has a buoy is
`beach.wave_buoy`, known without a request, so the week's note does not wait on
CDIP and does not vanish when CDIP is quiet. That is deliberate: ADR-0019
already records that `modelAnswersInstead` is "carried as a fact from the join
rather than inferred from whether a forecast happened to arrive, because CDIP
having a bad day must not make the card claim swell does not reach an open
coast."

**The third drawing was found while building the second, and the decision is
what changed rather than the code.** This ADR first named two homes and put the
week's in the notes array. The shore map's readout composes its own MOP
attribution through `swellStepNote`, so it draws a modelled swell height with a
provenance line of its own — and would have been the one place on the page
where a modelled height stood unqualified, which is precisely the state
ADR-0019 forbids. Naming the rule rather than the list is the repair: any
attribution built from `MOP_MODEL_NOTE` carries the clause.

**One existing sentence pointed at the card and is repaired.** The week's
`no-line` note reads "for the same reason as the reading above", which is the
wave card. With a second wave note landing in the same array the pointer becomes
ambiguous, and the card is scheduled for deletion regardless. It states the
reason instead of pointing at it.

**A bay is not an ADR-0019 beach and gets no such note.** Where there is no buoy
_and_ no line, nothing is drawn to be disclosed about, and the week's existing
`no-line` note already says why. Telling a lagoon's reader that its wave heights
are modelled would name a figure the page does not show.
