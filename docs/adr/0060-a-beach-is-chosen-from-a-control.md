# 0060 — A beach is chosen from a control, not a list of links

Date: 2026-09-11. Status: accepted. Retires `AreaBeaches`. Plan:
`docs/plans/conditions-toolbar.md`.

## Context

`AreaBeaches` drew the area's beaches as a region of the page: a
`TOOL_REGION_HEADING` reading "Beaches in La Jolla" and up to ten wrapped links
beneath it, sitting between the page header and the week grid. On the review
viewport it measured about 160px and pushed the week down by that much.

It sat above the readings on both the area page and a beach page, and the
reason was good: "moving between beaches does not mean scrolling past a page of
figures to find the list you moved with."

**The page is growing a bar that holds scope.** The area chooser and the
measured readings move onto one row across the top. A control that says _which
beach_ belongs on that row with the control that says _which area_ — they are
one question asked at two grains, and splitting them between a toolbar and a
region 160px lower makes the reader look in two places for one answer.

**Two controls for one job is the real cost.** Keeping both would mean a
`<select>` of ten beaches in the bar and a wrapped row of the same ten links
below it. Only one of them is reachable without scrolling, and a reader who
finds the second has no way of knowing it does nothing the first does not.

## Decision

**`BeachSelector` replaces `AreaBeaches`, which is deleted.** A labelled
`<select>` beside the area chooser, mirroring `AreaSelector` — same
`TOUCH_TARGET` floor (ADR-0004), same `noscript` fallback, same navigation on
change.

**The area itself is the first option**, valued empty and labelled "All of
&lt;area&gt;", navigating to the area's own page. `AreaSelector` cannot take a
reader back out of a beach — choosing the area they are already inside
navigates to where they already are — so without this, walking into a beach
would be one-way.

**It is not drawn where the area holds one beach.** Six of the eighteen are
like that, and the rule is the one the list was not drawn under: a choice
between one thing is not a choice.

**It opens on the beach being shown**, and on the area's own page it opens on
the area rather than on whichever beach happens to be first — which would claim
the page is showing a beach it is not.

## Consequences

**The `noscript` fallback is now load-bearing rather than polite.** With the
link list gone, it is the only place an area's beaches appear as links. A
fallback that quietly stopped rendering would make every beach page unreachable
without JavaScript rather than merely inconvenient, so `BeachSelector`'s tests
assert it against server-rendered markup — the client renderer never parses a
`noscript`'s contents, so asserting it after hydration would prove nothing.

**A region leaves the page outline.** `h1` → region `h2` → day `h3` is
unchanged in shape; there is simply one fewer region `<h2>`. Nothing is skipped.

**Four tests moved rather than went.** The area page, the beach page, the
default route and `ConditionsSection` each asserted the list by its heading.
Each asserted something still true — this area, its beaches, reachable from
here — so each now asserts it of the control. The one that changed in substance
is the beach page's: the control does something the list could not, which is
open on the beach being shown, so it says where the reader _is_ and not only
where they could go.

**The list's own argument is honoured, not overruled.** It sat above the
readings so that moving between beaches did not mean scrolling past figures.
The control sits higher still and is reachable without scrolling at all.
