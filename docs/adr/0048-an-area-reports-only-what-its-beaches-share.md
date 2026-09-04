# 0048 — An area reports only what its beaches share, and says which kind of silence it is

Date: 2026-09-04. Status: accepted. Builds on ADR-0046 (an area is authored) and
ADR-0047 (an area has a page). Decides what goes on that page. ADR-0011 is
unchanged: an area is still never an input to any join.

## Context

ADR-0047 gave an area a page with no readings on it, because working out what an
area may report is a decision rather than a wiring job.

**An area could report a figure three ways, and two of them are lies.** It could
join its own sources to a centroid — but that publishes a reading taken nowhere,
under a name implying otherwise, in a repo where `_served` exists to state how
far a measurement may travel from the place it is shown for. It could pick a
representative beach — same objection, with the added defect that the choice is
invisible from the page. Or it can report **only what all its beaches share**,
which says less and says nothing untrue.

## Decision

**An area reports a product when every beach in it binds the same source, and
withholds it otherwise.** `areaSources` in `src/lib/areas.ts` resolves the five
products the page draws — tide, waves, swell, sky, air — against the five
bindings in `beaches.json`.

**Identifier equality, which is the strict form and is knowingly too strict.**
Two beaches share a product only when they bind the very same station, line or
cell. That refuses agreement it should allow: CDIP's model lines sit about 100 m
apart and come from one model run, so La Jolla's nine almost certainly publish
the same forecast to the one decimal this page prints. The measured form of the
rule needs a probe against live feeds and is its own slice. Until it exists, this
version has the property that matters — **everything it calls shared is one
source** — and the page never overclaims while waiting.

**Three states, not two.** "Shared or not" runs together two facts that owe a
reader different sentences:

- **`shared`** — one source behind every beach. The area reports it.
- **`absent`** — no beach has one. The bay's missing buoy: already true one
  beach at a time, and not news.
- **`mixed`** — the beaches do not all read one source. New with areas, and the
  only state a reader has never seen before.

`mixed` covers two shapes and counts them apart: the beaches read different
sources, or some read one and some read none. Both mean no single figure answers
for the area, so both are one state — but the page prints the numbers, and
"2 different sources" is false of nine beaches sharing a buoy and a tenth
lacking it. That is La Jolla's own wave buoy, and the default area's page said
it until `distinct` learned to tell a source from a gap; two more
product-instances are the same shape (La Jolla's swell, Tijuana Estuary's).
So `areaSources` returns `distinct` for the sources and `without` for the
beaches that have none.

This is the distinction `beaches.json` already draws about a null `wave_buoy`,
whose schema says it "carries TWO meanings and wave_buoy_null_reason always
distinguishes them". Measured over the eighteen areas:

| product | shared | absent | mixed |
| ------- | -----: | -----: | ----: |
| air     |     18 |      0 |     0 |
| tide    |     16 |      0 |     2 |
| sky     |     11 |      0 |     7 |
| swell   |      6 |      7 |     5 |
| waves   |      3 |     13 |     2 |

So only **16 product-instances across 18 areas** are the genuinely new case.
Everything else either renders or is a silence the page already words.

**An area states the fact and does not borrow a beach's reason.** It cannot: the
reasons differ between members. Coronado's three beaches name 20.9, 21.6 and
21.2 km for the buoy that does not reach them, and Tijuana Estuary's two give
different _kinds_ of reason — one is sheltered water, the other is simply too far
from a buoy. Lifting any one of them would print a figure about one beach as
though it were the area's. So `areaSources` returns facts and counts, the page
writes the sentence, and the sentence sends the reader to a beach for the rest.

**A withheld product is not read.** No request is made for a figure the page has
already decided not to print.

**A shared reading is labelled with the area.** Both measured cards print
`beachName` as their context, and leaving the member's there would put "La Jolla
Shores Beach" over a station every beach in La Jolla binds — which reads as a
claim about that one beach. The area's name is the true label _because_ the
source is shared; where it is not shared, nothing is read and there is no label
to get wrong.

**Which beach an area reads through is immaterial, and that is asserted rather
than argued.** `areas.test.ts` checks, over every area and every product, that
where `areaSources` says shared, every beach in the area binds that same source.
Without that check "read through any member" would be a claim about the data
made in a comment.

## Consequences

The measured block answers for an area. Air is shared by all eighteen, so every
area page has something measured on it; three areas also carry a wave reading.

**The withheld card is the card it replaces**, with the same glyph, title,
heading id and rank passed in by the caller. ADR-0015 makes the glyph a closed
vocabulary, so a second glyph for waves would be a second word for one thing. A
first draft of this invented 🌊, its own titles and an `h3`, which would also
have put a hole in the heading outline; it is called out here because the
mistake is easy and invisible from the component that makes it.

**The week and the day chart are still one beach at a time**, and the area page
says so. `WeekPanel` and `DayPanel` mix three and four products respectively, so
gating them is per-product surgery inside the two largest components on the page
and is its own slice. Tide is shared by 16 areas and sky by 11, so that slice is
where most of an area's forecast arrives.

**The rip current risk is still beach-scoped**, though the plan exempts it from
this rule — it is issued for "San Diego County Coastal Areas", a unit larger than
any area here, so the intersection rule is a category error against it. That
exception is real and lands with the forecast slice.

**A props allowlist caught this change, which is what it is for.**
`ConditionsSection.test.tsx` asserted the measured block is handed exactly
`{ slug }`, so that no future edit could quietly pass it a chosen day — the
structural guarantee ADR-0047 converted into an assertion. Adding `area` failed
it. The list is widened to `{ slug, area }` deliberately and a separate line now
asserts no day-shaped key, so the guarantee is stated rather than implied by a
list that will keep growing.

The part most likely to be re-litigated is the strictness. The answer is that it
is temporary and directional: the probe can only ever _add_ products to an area,
never remove one, so nothing shown today becomes false when it lands.
