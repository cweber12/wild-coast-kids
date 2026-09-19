# Conditions audit fixes

> Planned 2026-09-17. In flight.

Fixes from a UX/UI audit of `/conditions` taken on 2026-09-17 at `main`
(`5b27470`, after PR #247). The audit rendered the default page, a no-buoy area,
a beach page and a single-beach area at 1536×639 @1.25, 1280×800, 768×1024 and
375×812, walked the tab order, exercised every control, and rendered the page
without JavaScript. Every finding below was confirmed on the rendered page
unless it says code-level.

## The problem, from the reader's point of view

**The tool opens on its emptiest view.** `/conditions` renders the La Jolla
area, and La Jolla's ten beaches share only a tide station and an air station.
So the first visit shows a bold "No temperature reading", two paragraphs saying
what the area cannot show, a tide-only week, and a chart whose Swell, Wind and
Temp tabs each open to a sentence. Only two areas share every source and both
hold a single beach, so this is the shape of every multi-beach area view, not a
bad day's data.

**A keyboard cannot see where it is.** Tab lands on the day strip's selected
pill, whose focus ring is `currentColor` — white on cream, invisible. On the
chart, ArrowRight selects the next tab but leaves focus on the old one, now
`tabindex=-1`. The two `<select>`s and the three `<summary>`s get the browser's
ring rather than the site's, because the rule in `globals.css` names `a`,
`button`, `input` and `[tabindex]` and nothing else.

**A thumb has two targets it cannot hit.** Hour columns are 10×119px at 375;
the map's pin links are 24px tall at every width. ADR-0004's floor is 44px.

**The page reshapes itself by content.** Between 1024 and 1279px a two-segment
beach page wraps the rip level onto its own line with a stray rule and a 25px
indent; on area pages the Swell tab collapses a 261px plot to two lines; at `xl`
the chart column ends about 300px above the map column on every page.

**Three of seven tide cells are italic absences on the default page.** "None"
under LOW TIDE reads as no tide. "Not in range" on a Saturday inside the
seven-day request is the wording for a request fault applied to a diurnal day —
the sea put no low on that calendar date, which the code's own docstring calls
close to unreachable.

## What this plan does

Six pull requests, independent of one another, each of one to four slices.
Letters are the audit's grouping; issue numbers are on the tracker.

| PR  | What                                                                          | Issue |
| --- | ----------------------------------------------------------------------------- | ----- |
| A   | Keyboard and focus: ring rule, selected pill ring, roving focus, one idiom    | #248  |
| B   | The bar: absence out of bold, rule gated at `xl`, `noscript` layout, defaults | #249  |
| C   | The day region: absent-series height, `xl` grid, hover states, level token    | #250  |
| D   | Tide cell wording, with the diurnal-day regression test                       | #251  |
| E   | Map pins as a 44px list below `md`                                            | #252  |
| F   | Housekeeping: dead band, unused constant, stale comment                       | #253  |

## Decisions

### Default beaches (PR B)

Cole named a default beach for four areas on 2026-09-17:

| Area                | Default beach                |
| ------------------- | ---------------------------- |
| La Jolla            | `la-jolla-shores-beach`      |
| Mission Bay – North | `mission-bay-leisure-lagoon` |
| Mission Bay – West  | `mission-bay-sea-world`      |
| Pacific Beach       | `tourmaline-surfing-park`    |

**Read as: an area's opening page.** `areas.json` gains an optional
`default_beach` per area, validated by the `areas` gate row as a member of that
area. `/conditions` opens on the default area's default beach. Choosing an area
in the AREA control navigates to that area's opening page: its default beach
where one is named, its sole beach where it holds one, and the area view
otherwise. **The area URL itself is unchanged**: `/conditions/la-jolla` still
renders the shared view, and "All of La Jolla" in the BEACH control still
reaches it. That keeps every existing URL meaning what it meant and every view
reachable, while the two entry points a reader actually uses land on numbers.

Rejected: making the area URL render the default beach. That leaves the shared
view with no address, and the beach control's first option would navigate to
where the reader already is.

Rejected: switching `DEFAULT_AREA_SLUG` to Del Mar or Mission Beach, the two
areas that share everything. It moves the tool away from the co-op's own coast
to fix a layout.

The other eight multi-beach areas keep opening on the area view until a
default is named for them; that is a row in `areas.json`, not code.

### Hour columns stay a scrubber (PR A, as an ADR)

Twenty-four 44px targets cannot fit in a 327px plot. The columns are
contiguous, so a tap anywhere on the plot selects the hour under the finger,
and the Earlier/Later stepper is the 44px control for precise adjustment. That
reading of ADR-0004 goes in a one-page ADR rather than in a code change. Its
number is re-derived at commit time; the `adr-numbers` gate catches a
collision.

Rejected: a `<input type="range">` below `md`. A second control for one job,
and the stepper already is that control.

### Tide cell wording (PR D)

Aimed at a parent, not a tide table. When the day's lowest low falls outside
daylight: **"Lowest after dark"**. When a diurnal day puts no low on the
calendar date at all: **"No low tide today"**. The `no-low` docstring in
`lib/conditions.ts` stops calling that state a fact about the request window,
because the regression test proves it reachable from real-shaped predictions.

### Focus ring (PR A)

`globals.css` adds `select` and `summary` to the one rule; no component sets
its own. The selected day pill adds `focus-visible:outline-ocean`, the
convention `BeachPins` already uses, so the ring is ocean on cream with a 2px
cream gap against the ocean pill.

### One selection idiom (PR A)

The day strip marks the shown day with `aria-current="date"`, as the week grid
does, and roves `tabindex` with arrow keys so the strip is one tab stop rather
than seven. The week grid is unchanged: it is a list of day cells and each
header is a heading a reader may want to stop on.

### Focus follows the arrow keys (PR A)

`HourChart` keeps a ref per tab and per hour column and calls `focus()` on the
target after each keyboard move. The hour handler already computes the target
index before it writes to the provider, so the ref is focused with the same
index.

### The day region at `xl` (PR C)

`ChosenDay` becomes a three-column grid from `xl`: chart in columns one and
two, map in column three spanning two rows, rip block in columns one and two
beneath the chart. DOM order is unchanged (chart, map, rip block), so below
`xl` nothing moves and the reason the rip block sits below the chart — the
plot stays still as a reader steps across the week — still holds.

### An absent series keeps the plot's height (PR C)

The absence sentence's container takes the plot's aspect ratio (`WIDTH` over
`HEIGHT` from `HourChart`), so choosing Swell on an area page no longer
collapses the tile by 250px.

### Pins below `md` (PR E)

On a phone the labelled pin links render as a list under the map with 44px
rows and `md:hidden`; the on-map labels render `hidden md:flex`. `display:none`
removes the hidden set from the accessibility tree, so exactly one set is
exposed at a time and no link is announced twice.

## Test seams

All existing seams; one new one.

- **`globals.css` as text** — new. jsdom applies no stylesheets, so a test
  reads the file and asserts the focus selector list names `select` and
  `summary`. The `stylesheet` gate proves the rule compiles; this proves it
  names the elements.
- **`DayStrip.test.tsx`** — selected pill carries the ring class;
  `aria-current` replaces the seven `aria-pressed` assertions; arrow keys move
  focus and selection together.
- **`HourChart.test.tsx`** — after `ArrowRight` on the tablist,
  `document.activeElement` is the Swell tab. Committed failing first. Same for
  the hour group.
- **`bandText.test.ts`** — an absent temperature is in the gloss, not the
  figure.
- **`AreaSelector.test.tsx` / `BeachSelector.test.tsx`** — the `noscript` list
  is a sibling of the label/select group, not a child; the area option carries
  the area's opening path.
- **`areas.test.ts` and `scripts/check-areas.mjs`** — a `default_beach` must
  be a member of its area; `/conditions` opens on the default area's default
  beach.
- **`ChosenDay` via `DayPanel.test.tsx`** — the three wrappers carry the grid
  placement classes.
- **`HourChart.test.tsx`** — the absence panel carries the plot's aspect
  ratio.
- **`SurfZone.test.tsx`** — `getByRole("region", { name: "Rip current
risk" })`; the level word uses `text-tool-region`.
- **`TideWeek.test.tsx` and `conditions.test.ts`** — a diurnal fixture (one
  low per lunar day) reaches `no-low`; the two absence words.
- **`BeachPins.test.tsx`** — list rows carry `TOUCH_TARGET`; on-map labels
  carry `hidden md:flex`.

Class assertions prove a utility is asked for, not that it paints. Each PR
body carries the Playwright measurement for the thing the classes are meant to
change: the 1100/1200/1280 bar, the `xl` void, the focused pill.

## Out of scope

- **The week before the day on a phone.** The hour-by-hour panel starts
  2,240px down at 375. Reordering or compacting the week is a change to the
  page's shape and needs its own brief.
- **Suspense fallback heights.** Production is ISR-prerendered, so the shift
  appears only on the first uncached request, and a fix is a constant per
  breakpoint per region.
- **The no-JS streaming behaviour.** Same reason.
- **The nav wrapping COMMUNITY to a third row at 375.** Not this tool.
- **The area view's emptiness by construction.** ADR-0048's intersection rule
  is why a ten-beach area shares two sources. Default beaches route around it;
  they do not change it.
