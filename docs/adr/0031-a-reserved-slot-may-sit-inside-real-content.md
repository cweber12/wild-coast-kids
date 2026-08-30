# 0031 — A reserved slot may sit inside real content

Date: 2026-08-30. Status: accepted. Amends the `Reserved slot` entry in
`CONTEXT.md`, which is updated in the same pull request.

## Context

A reserved slot in this repo is a labelled stand-in for content that has been
decided on but not yet built — a schedule, a booking scheduler, the conditions
tool. It renders as a dashed frame naming what lands there, and its argument is
that a reader can tell the difference between a feature that is coming and one
that was never considered.

Every one of the six call sites stands **instead of** something: where the
content will go, there is a dashed box saying what it will be.

The sighting map from #121 was one of those. It sat at the foot of
`/conditions`, full width, and said "A map of what people have found here is
coming."

**Then the map arrived, and it was not the sighting map.** #173 draws this
beach's coast and the four sources its figures come from — real content, in the
place the reserved slot had been holding open. What is still missing is not a
map at all: it is the _sightings_, drawn on top of one.

So the slot had a choice of two wrong answers. Left where it was, the page
carries a real map and, a few hundred pixels below it, a dashed box promising a
map — which reads as an oversight or as two different maps. Removed, the page
stops saying that the sightings are coming, and a reader loses the distinction
the component exists to draw.

## Decision

**A reserved slot may stand for a layer of something that exists, not only for
the whole of something that does not.**

The sighting slot moves inside the map's own column, beneath the picture it
annotates, at `row` density. Its copy changes from naming the container to
naming the layer: "Sightings will be drawn on this map."

Two things do **not** change, and the amendment is only worth making because
they do not:

- **The claim stays exactly what #121 fixed.** iNaturalist records where people
  with phones went rather than where animals are, so the slot promises a record
  of reports and never a survey, and it says what the layer _will_ show rather
  than what was found. That sentence survived the move verbatim — confirmed by
  diffing the page's rendered text against `main`, where it appears on neither
  side of the diff.

- **No issue number in the copy.** A reader is owed what is coming, not our
  backlog. The standing rule, unchanged.

## Alternatives considered

**Delete the slot when the map lands, and re-add it with the sightings.** The
simplest, and it is the thing this component exists to prevent: between the two
pull requests the page would say nothing about the sightings, and a reader in
that window cannot tell a deferred feature from one nobody thought of. It also
loses the copy #121 spent an argument getting right, which would have to be
rebuilt from the issue.

**Leave it where it was and change nothing.** Cheapest, and it puts a dashed
box promising a map directly under a map. The failure is not subtle.

**Overlay the slot on the map itself**, inside the SVG frame. The most literal
reading of "inside the map", and it obscures the thing it is annotating —
trading real content for a stand-in, which is the exact inversion this decision
is meant to license against.

**Keep it full width, below the day region.** Preserves the current layout and
breaks the association: a slot describing a layer of a specific picture has to
sit with that picture, or the reader has to work out which map it means. The
map is a third of the row at `xl`, so the slot is too.

## Consequences

- **`ReservedSlot` gains no prop and no new tone.** The amendment is about where
  a slot may be put and what it may stand for, not about how it renders — which
  is why this is an ADR and not a component change. Its two closed lists are
  untouched.

- **`CONTEXT.md`'s definition widens**, and the glossary is the thing kept
  current. A slot is a stand-in for content that has been decided on and not
  yet built, whether that content is a region, a page or a layer of something
  already drawn.

- **A slot inside real content has a new way to be wrong**: it can start
  describing the container rather than the layer, which is what the old copy
  did the moment the map existed. The test that catches that is the one
  asserting the tense and the subject, and it moved to `DayPanel.test.tsx` with
  the slot — in `ConditionsSection.test.tsx` it would have passed whatever the
  slot said, because that suite mocks the panel.

- **The other five call sites are unaffected** and still stand instead of
  content. This widens what is permitted; it deprecates nothing.
