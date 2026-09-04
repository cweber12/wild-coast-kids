# 0050 — The surf zone forecast is exempt from the intersection rule

Date: 2026-09-04. Status: accepted. The one exception to ADR-0048, which is
otherwise unchanged. Builds on ADR-0043, which bound this forecast to the
inventory, and ADR-0009, which is why the product is on this site at all.

## Context

ADR-0048 says an area reports a product only where every one of its beaches
binds the same source for it. ADR-0049 applied that to the week and the day
chart. Applied to the surf zone bulletin as well, it produces an answer to a
question the product cannot be asked.

**The bulletin is not a point measurement, and the rule is built entirely out of
point measurements.** A tide station stands at a pier, a buoy floats at a
coordinate, a model line sits at 10 m depth, a forecast cell is a 2.5 km square
of map. Each is somewhere, `_served` exists to say how far its reading may
travel from that somewhere, and the intersection rule is what stops an area
publishing a figure measured at a place some of its beaches are not near.

The National Weather Service issues `CAZ043` for **San Diego County Coastal
Areas**. One bulletin, for a unit larger than every area in this table put
together. There is no per-beach source to intersect: `readSurfZone` reaches
`fetchSurfZoneForecast()`, which takes no beach at all. The only per-beach input
is `surfZoneWithheldReason`, which asks whether the beach is open coast or
sheltered water — a question about _coverage_, not about which instrument was
read.

So intersecting it across members is not a strict rule; it is a category error.
Two beaches "disagreeing" about the bulletin is not a state that exists.

### What it is worth, measured

`docs/plans/areas-over-locations.md` §4 argued this exemption from La Jolla,
saying a strict rule would cost that area its rip current risk because
`Childrens Pool` is bay-class. **That example has expired.** `Childrens Pool`
binds `9410230`, which is `open-coast`, and La Jolla is 10 of 10 open coast. The
argument above does not depend on it.

Measured over the twelve areas that hold more than one beach, on 2026-09-04:

|                                                          |       |
| -------------------------------------------------------- | ----- |
| areas carrying the bulletin                              | **7** |
| areas wholly sheltered, withholding it                   | **5** |
| areas reading it through a beach that is not their first | **1** |

The one is **Tijuana Estuary**, whose first member is the slough — sheltered
water — and whose second is Border Field State Park, which is open coast. Read
through the member everything else on that page is read through, the area would
withhold a forecast that is issued for half of it.

The larger visible change is not that one. It is that **the rip current risk
appears on all twelve multi-beach area pages**, where before it was drawn only
on a beach page. On the seven it names a level; on the five it says why there is
none. It is the single line on this page that answers whether to put children in
the water, and an area page without it was the page's most important omission.

## Decision

**The surf zone bulletin is read through a member the forecast is issued for,
and is not resolved against `areaSources`.**

`surfZoneBeachOf(area)` in `src/lib/areas.ts` returns the first member whose
`surfZoneWithheldReason` is null, and the first member otherwise. It is carried
on `AreaScope` as `bulletinBeach`, beside `sources` rather than inside it,
because it is not a source the beaches agree about.

**This is not picking a representative, and that distinction is the whole
defence.** ADR-0048 rejects a representative beach because the figure would be a
measurement taken at one place published under the name of a wider one. Here
every open-coast member reads the _same_ bulletin — there is only one — so the
choice decides whether the area gets it, not which figure it gets.

**The fallback is what makes the withheld case honest.** Reaching it means no
member is open coast, so the reason that comes back is true of every beach in
the area rather than of the one it was read through. That is what licenses the
page saying "this forecast is not issued for **any beach in** Mission Bay –
West" having asked about one of them, and `areas.test.ts` asserts it over the
whole table rather than leaving it in a comment.

**The withheld sentence is the only copy an area changes.** The bulletin itself
names no beach — `SurfZone` prints the office's level, gloss, surf and water
ranges and period name, all of which are already true at either scope — so
`areaName` reaches exactly one sentence.

**ADR-0043 is unchanged and this depends on it.** That decision withholds the
bulletin at 25 sheltered beaches, on the grounds that "Rip Current Risk: High"
over Sail Bay would alarm about a hazard that is not there. Nothing here
publishes it at a beach ADR-0043 withholds it from; an area with no open-coast
member withholds it exactly as its members do.

**ADR-0009 is unchanged and this is still the only relayed judgement on the
page.** It sits beside the chooser rather than inside the measured block, which
is that decision as a layout: the band below is what the instruments read, this
is a forecaster's verdict relayed. Widening its scope does not widen what the
site is willing to say.

## Alternatives considered

**Apply the intersection rule anyway.** Five of the twelve areas would keep the
bulletin, Tijuana Estuary would lose it, and the rule would be answering a
question about agreement between sources where there is one source. Rejected on
the category argument, which does not depend on the count.

**Give the area its own zone lookup.** `CAZ043` covers the whole county, so this
is the same answer reached expensively, and it would make an area an input to a
join — which ADR-0011 forbids and ADR-0046 restated.

**Withhold it wherever any member is sheltered.** The strictest reading, and it
loses the product at Tijuana Estuary while gaining nothing: the bulletin does
not become less true of Border Field State Park because the slough is next to
it. It would also make an area's rip current line depend on where a membership
boundary was drawn, which is an authored table.

**Word the withheld case from the area rather than from a member's reason.**
Rejected for ADR-0048's own reason about borrowed reasons — except that here
there is nothing to choose between, since every sheltered member gives the same
sentence. The member's reason is used, and the claim that it speaks for all of
them is asserted rather than assumed.

## Consequences

Every region of an area page now answers for the area, including the one that
answers by exception.

**`bulletinBeach` is a second slug on `AreaScope`,** so a panel can read one
product through a different member from the rest. That is a real widening: it is
now possible to read anything through a beach the area did not agree about.
`ConditionsSection` composes both and hands them down, and the props allowlists
on all three panels are what keep a third slug from arriving unannounced.

**The plan's §4 example is stale and is not repaired.** `docs/plans/` is a dated
record once its work merges, and this ADR is the thing kept current — which is
exactly the split `docs/plans/README.md` draws. The addendum on that plan says
so.

The part most likely to be re-litigated is whether an exception recorded once
becomes a habit. The answer is the test for it: a product is exempt when it has
no per-beach source to intersect. Every other product on this page has one.
