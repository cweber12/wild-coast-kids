# 0009 — The conditions tool is built here, not embedded

Date: 2026-08-17. Status: accepted.

## Context

`CONTEXT.md` defines **Conditions** as "the real-time surf, tide, wind and
visibility tool for San Diego's coast, built separately and embedded here", and
both reserved slots — in `src/components/Conditions.tsx` and
`src/app/conditions/page.tsx` — say _"Drop the URL and it embeds here
automatically."_ The slot has been waiting for a URL that does not exist.

Two things have changed since that was written.

**There is a body of verified upstream work to draw on.**
`cweber12/socal-coastal-data` holds request contracts measured against live
endpoints, parsers pinned to specific column headers and unit strings, and a set
of data-integrity rules each of which was written after something went wrong: a
buoy serving HTTP 200 on its station page while its data feed 404s; a feed whose
timestamps carry no offset, so asking for local time and tagging it UTC ages
every reading by 7–8 hours; the same river published in cubic metres per second
by one agency and cubic feet per second by another. That is transferable as
contracts and rules without being transferable as a service — its corridor,
its audience and its computed verdicts are all wrong for this site.

**The content this site needs is not what a general surf tool shows.** The
audience is co-op groups taking K–8 children to the coast: tidepoolers,
swimmers and snorkellers, surfers, and beach-goers. What they need includes
things a surf report does not carry — whether take is permitted where a child
picks something up, how often a beach is posted, what the tide does at 3 pm on
Tuesday — and excludes the thing a surf report leads with, a judgement about
whether conditions are good.

The decision then is where the tool is built, and the constraints are the ones
this repo already documents.

**An iframe cannot inherit a stop.** A stop is 540px and content that does not
fit is a bug in the section. An embedded document sizes itself; the host page
can give it a box but cannot make its contents obey the budget, and the height
negotiation is exactly the class of problem the stop rule exists to prevent.

**An iframe cannot be vouched for.** The safety framing this content needs — a
standing notice that these are instrument readings and not a safety assessment,
and that lifeguards and posted signs are the authority on the day — has to sit
around the readings. Inside a frame, the host page is asserting something it
does not control; outside it, the notice describes content the page cannot see.

**Nothing in an iframe reaches the design system.** Tailwind's source detection
here is opt-in and scoped to `src/`, which is what makes "the class is in the
built stylesheet" evidence that a component uses it (ADR-0006). An embed is
outside that boundary entirely: no tokens, no pill, no gutter, no touch-target
floor from ADR-0004, and no gate can see any of it.

## Decision

**The conditions tool is built in this repo, natively.** `CONTEXT.md`'s
**Conditions** entry is amended to drop "built separately and embedded here".

The two `ReservedSlot` usages stay for now. They come out in the slice that has
something to put in their place — a slot removed before its replacement exists
would leave the page promising less than it did.

The plan is `docs/plans/conditions-tool.md`, and two decisions in it are
load-bearing enough to name here:

**Published judgements are relayed; inferred ones are not computed.** The
National Weather Service publishes a rip current risk for San Diego County
Coastal — "Moderate", measured 2026-08-17 — and that is a forecaster's judgement
this site quotes verbatim and attributes. "Safe for kids today" would be this
site's own judgement, and the only numbers available to found it on are author
estimates: the source repo's swell ceiling is a single uncalibrated figure
standing in for reefs of differing exposure, and its own file says so. Facts get
described in plain language; the only computed value is the low-tide window,
whose input is an astronomical prediction rather than an estimate.

**Resolved values come from joins, never from typing.** Beach coordinates, tide
station, buoy, water-quality station and marine protected area are joined against
upstream authorities and committed with enough provenance to re-run, with one
re-join script per binding that exits nonzero when a match moves. The location
list is seeded from the state's Beach Detail Information resource — 82 beaches
with `County = 'San Diego'`, which the county's own map corroborates as
"approximately 80 beaches from Camp Pendleton to the US/Mexico border" — rather
than typed off a map.

## Consequences

The tool inherits the stops, the tokens, the pill, the touch-target floor and
the gate. Its readings are testable by the same seams as everything else here,
and its parsers are pure and offline against committed fixtures, so a pinned
column header or unit string is asserted without a network.

The safety notice becomes ordinary page content, which is the only arrangement
where it is true.

`/conditions` gains real routes and real data, so this repo acquires an outbound
network dependency it did not have — and with it a failure surface. The policy
is stated rather than discovered: fetching, caching and what a failure means live
in one module; a missing reading degrades to a named unavailable state with its
reason on the page; and three states stay visibly distinct — a fresh reading, a
station gone quiet, and no station covering this beach at all. That third state
is the common one, and rendering it as a blank would let a reader read it as calm.

**This repo now owns data that rots.** A decommissioned buoy, a retired dataset,
a re-gridded forecast point and a renamed column are all things that happen
without notice and none of them break a build. A weekly probe and the re-join
scripts are how that becomes a notification rather than a wrong number on a
landing page, and they are slices in the plan rather than aspirations here.

What this costs is scope. An embed would have been one `iframe` and a URL; this
is thirteen slices, eleven upstream products and a location inventory with
provenance per entry. The trade is taken knowingly: the embed was cheap because
it moved every hard decision somewhere else, and there was nowhere else. That is
the part most likely to be re-litigated, and the answer to "why not just embed
something" is that after this decision there is nothing to embed.
