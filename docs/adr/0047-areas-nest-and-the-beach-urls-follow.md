# 0047 — Areas nest in the URL, and the beach URLs move under them

Date: 2026-09-02. Status: accepted. Builds on ADR-0046, which made an area the
authored grouping. Amends the tree position ADR-0035's selected day relied on;
ADR-0035's own decision is unchanged.

## Context

ADR-0046 made an **area** the thing a reader chooses. It has to be reachable,
and `/conditions/<beach>` already occupies the only dynamic segment at that
level — `src/app/conditions/[slug]`, serving all 51 beaches.

**Three area names are already beach slugs**: `pacific-beach`, `mission-beach`
and `ocean-beach`. `beaches.json` documents a slug as a "Stable primary key…
Never change after first write", so they cannot be renamed apart. Five would
have collided before Mission Bay and San Diego Bay were split into compass
points; splitting them removed two.

So areas and beaches cannot share one flat namespace, and the beach URLs cannot
simply stay where they are.

## Decision

**`/conditions/<area>` and `/conditions/<area>/<beach>`, with the old beach URLs
redirecting permanently into the area holding them.**

The redirect is computed, not configured: the `[area]` route asks the area table
first and the inventory second, and a slug that is only a beach is sent to
`/conditions/<its area>/<that beach>`. No list of 48 rules to maintain, and it
follows `areas.json` automatically when a beach changes area.

**Where a slug is both, the area wins.** A reader following an old bookmark to
`/conditions/ocean-beach` lands on the Ocean Beach _area_, which contains the
beach they saved and links to it. A near miss rather than a broken link, and the
alternative — the beach winning — would make three areas unreachable at their
own names.

**A mismatched pair is corrected rather than served.**
`/conditions/coronado/la-jolla-cove` is a claim about San Diego that is false,
and serving it would mean two URLs for one beach with one of them lying about
where it is. It redirects to the right area. An _invented_ first segment is a
404 instead: correcting a wrong area is only defensible when the area named is a
real one somebody could have meant.

**The two scopes are one section.** `ConditionsSection` takes an area and an
optional beach, so three routes render one component and cannot drift apart —
which is the reason it existed for two.

**The chooser offers areas, and the beaches moved to the page.** Eighteen
entries, flat: there is nothing to group eighteen places by that a reader would
recognise. The beach list is a region of the page, and it is a list rather than
a map because the map cannot do it — four of La Jolla's ten beaches fall within
549 m of one another, 6.7 of the map's 100 units, and giving each a 44px target
under ADR-0004 would need the map **2,634px wide**. The marks orient; the list
selects.

**The selected day moves to `app/conditions/layout.tsx`.** A layout is the only
thing App Router keeps mounted across a navigation between sibling pages, and
moving from an area to one of its beaches is now an ordinary thing to do.
ADR-0035's argument — that keeping a choice is how one hour is compared from day
to day — applies unchanged to comparing one day from beach to beach.

**The selected hour does not move, and resets on a navigation.**
`SelectedHourProvider` takes a `currentHour` computed from the chosen beach's
own daylight read, and `selectedHour.tsx` requires the hour to come "from the
read that knows which day is today, never from a clock read here". A layout does
not know which beach is rendering, so hoisting it would mean either threading a
server value across a boundary with no access to it, or putting a second clock
on the page — which that file forbids. The hour starts at the hour it is now
anyway (ADR-0035), so a reset lands where it would have started. Recorded as a
knowing gap rather than a fixed one.

## Consequences

`src/app/conditions/[slug]` becomes `[area]` and `[area]/[beach]`. All 51
beaches keep their page and their content; only the URL moves. Nothing in the
repo linked to a per-beach URL — `Nav.tsx` and `ConditionsTeaser.tsx` both point
at `/conditions` — so the redirect is for external links and indexed URLs only.
`generateStaticParams` returns `[]` on both, so nothing was prerendered under
the old shape either.

**A documented structural guarantee became an asserted one, and that is the part
worth arguing.** The measured block — the buoy and the air station, the only
instruments this site reports — sat _outside_ `SelectedDayProvider` in the tree
on purpose: "frozen to the present is the whole contract of this region, and
putting it outside the provider is what makes that structural rather than a
convention… A later change cannot quietly make these figures follow Thursday,
because there is nothing to follow." Moving the provider to a layout puts the
whole page inside it and the tree stops saying anything.

So the claim is tested instead: `MeasuredToday.test.tsx` renders the block with
a day chosen and with none and requires identical markup. **With a probe in the
same provider**, because otherwise "the markup did not change" would be true
whether or not a day was ever chosen — a test that can only pass. The assertion
is the stronger form of the guarantee, since it constrains behaviour rather than
tree shape, but it is a trade and this is where it is recorded.

**The area page carries no readings yet.** An area reports only what all its
beaches share, and measuring that is the next slice. It says so in a sentence
rather than showing an empty frame, and the beaches are one click away. Under
identifier equality the eighteen areas share an air station 18 times, a tide
station 16, a grid cell 11, a MOP line 6 and a wave buoy 3 — so most of that
slice is withholding rather than rendering, which is why it is its own.

**The rip current risk waits for a beach**, though ADR-0046's plan exempts it
from the intersection rule — the bulletin is issued for "San Diego County
Coastal Areas", a unit larger than any area here. That exception lands with the
readings and gets its own decision rather than arriving as a side effect of a
routing change.

The part most likely to be re-litigated is the area winning a collision. The
answer is that the alternative makes three areas unreachable at the names people
use for them, and that the beach is one click from where the reader lands.
