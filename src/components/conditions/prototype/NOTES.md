# Conditions layout prototype — throwaway

**Delete this whole directory and revert the three `src/app/conditions/*`
pages to remove the experiment.** Nothing here is production code: no tests, no
error handling beyond what makes it run, shortcuts where a real change would
need a prop.

## The question

The conditions page's layout doesn't read like a page of its kind. From a
review of the shipped page at 1536×639 (body height 2300px — 3.6 screens),
four things were named as wrong:

1. **No grid.** The page alternates between full-width regions and a ~520px
   text column with no rule, leaving ~900px of dead background beside half the
   content.
2. **The first screen answers nothing.** Above the fold: title, disclaimer,
   dropdown, ten beach links, and two paragraphs explaining what the page
   cannot show.
3. **The explanatory prose makes it noisy** — most of the page's word count is
   spent explaining data rather than being it.
4. **The default view is apologies** — ruled explicitly OUT of scope. It is
   ADR-0048's doing (an area reports only what its beaches share), not
   layout's.

## Round one — rejected whole

`a` answer rail, `b` week-first spine, `c` one grid quiet prose, `ac` the
combination. All four rejected. They are in this branch's history at `c84dbc4`.

The finding worth keeping from them: **`b` made the page taller** (2529px
against 2300px) by dissolving the header row into one line, because the
full-width measured band wastes at 1440px what the three-column header row was
packing efficiently.

## Round two — the current set

Direction given: put the area **and** location selection in a top bar along
with the current conditions; give the conditions a more professional layout
with **no background or border**; and either shorten the headline to
"Conditions" or drop it entirely.

`/conditions?variant=` — `now`, `d`, `e`, `f`. Arrow keys cycle. The seam is
wired into all three routes (`/conditions`, `/conditions/<area>`,
`/conditions/<area>/<beach>`) and the selects carry `?variant=` across a
navigation, so the bar can actually be used while being judged.

| Key   | Name                 | What it tests                                                                                        |
| ----- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `now` | Current page         | The baseline, `ConditionsSection` unchanged.                                                         |
| `d`   | One-row toolbar      | Wordmark + both selects + readings + judgement on one line. The "shorten the headline" option.       |
| `e`   | Two-tier readout     | Controls and judgement on tier one, readings as labelled columns on tier two. Headline omitted.      |
| `f`   | Sticky condensed bar | `d` without the wordmark, pinned below the nav. Tests whether scope is worth its pixels permanently. |

Measured at 1536×639, body height and where the week grid starts:

|       | body   | week at | on a beach page |
| ----- | ------ | ------- | --------------- |
| `now` | 2300px | 459px   | 2518px          |
| `d`   | 2156px | 370px   | 2424px          |
| `e`   | 2196px | 410px   | 2456px          |
| `f`   | 2124px | 338px   | —               |

**Judge these on a beach page, not the area page.** La Jolla's ten beaches do
not share a buoy, so at area scope the readout has one source (Air) and the bar
looks half-empty. `/conditions/la-jolla/la-jolla-shores-beach?variant=d` is
where it shows its real shape, with Sea and Air either side of a rule.

## What is approximated or deliberate

- **`BareReadout` re-reads rather than reusing `MeasuredBand`.** The band's
  presentation is a dark slab with registers tuned for it; light-on-dark type
  does not just invert. In the real change this would be a prop on the band.
- **The source labels come from `bandView`'s documented order** (waves first
  when measured, then air), never from parsing the figure strings. A label
  guessed from `"3.0 ft · 72°F water"` would be a fabrication with a plausible
  shape.
- **The sky glyph stays.** ADR-0057 makes the mark on the air segment the sky
  forecast for this hour, credited on the attribution line. Dropping it removes
  a product, not a flourish — say so explicitly if it should go.
- **The `<h1>` survives in `e` and `f` as `sr-only`.** Omitting the headline is
  a visual decision; omitting the heading breaks the document outline and
  leaves a screen-reader user nothing to land on.
- **The beach list is gone from the page body** in all three. A `select` of ten
  beaches and a wrapped row of ten links are the same control twice.
- **Choosing a beach changes scope**, so the "no one figure for the whole area"
  sentences stop appearing. The bar is therefore partly an answer to the
  problem we agreed not to solve here.

## Two bugs this prototype found in itself

- `isVariantKey` was exported from a `"use client"` module and _called_ by a
  server component. Every request threw while `page.test.tsx` passed 5/5 and
  typecheck was clean — vitest renders both sides in one process and enforces
  no RSC boundary.
- `f`'s bar was at `top-0` on the belief that the nav scrolls away. ADR-0003
  makes the nav `sticky`, not `fixed`: it occupies its own space but still
  pins. The bar slid under it, leaving only the provenance line visible at
  `scrollY` 900. Now `top-nav-sm md:top-nav`.

## Gate status

`npm run gate` **fails**, and is meant to: `test` misses all four coverage
thresholds because the variants carry no tests. Every other row passes —
`format`, `lint`, `typecheck`, `adr-numbers`, `sea-side`, `areas`, `build`,
`stylesheet` — and all 1866 tests pass. That is the expected cost of throwaway
code and the reason this branch never merges.

## The answer

**`d` — the one-row toolbar.** Chosen 2026-09-11.

What it settles: scope and now belong on one line across the top; the measured
readings carry no ground and no border; the headline shrinks to a single word
rather than being dropped entirely.

What it does **not** settle, and what has to be decided before the real build —
three collisions found by reading the record after the choice, not before:

1. **The wordmark's rank.** `d` sets its `<h1>` in `text-tool-region`, the same
   token `TOOL_REGION_HEADING` gives "The week ahead". That makes the page
   title exactly equal to every region heading below it, which is the rank
   collapse ADR-0014 was written to escape — `headingRank.ts` says it outright:
   "34px under a 36px title is not a second rank, it is the same one twice."
   It also drops `text-tool-title` out of `src/`, and `scripts/built-css.mjs`
   carries a `REQUIRED` row for it whose stated reason is this page's `<h1>`.
   With Tailwind's `source(none)`, losing the last use fails the `stylesheet`
   gate.
2. **The standing notice at `text-2xs`.** ADR-0009 rejects an embed partly
   because "the host page is asserting something it does not control", and
   `ConditionsSection` names that sentence as the assertion. `d` renders it at
   10px.
3. **The beach list.** Removing it orphans `AreaBeaches` — nothing else imports
   it — and breaks the area page's own test, whose stated purpose is that "what
   says the page opened on something real is the list of that area's beaches".

Once those are answered: delete this directory, revert the three
`src/app/conditions/*` pages, and build `d` properly on its own branch with
tests and its own ADRs.
