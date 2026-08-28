# The week grid's day cell, rebuilt around the daylight window

Planned 2026-08-27. Issue #169.

> **Historical.** Planned 2026-08-27, shipped in PR #170 on 2026-08-27.
> It records what was intended then, not what the code does now, and is not
> maintained. The decision it turns on is ADR-0023, which is kept current.
> See [`README.md`](README.md).

## The problem, from the reader's side

A parent opens `/conditions/<beach>` to decide which afternoon this week is
worth driving to. The week grid is where they answer that, and it currently
asks them to read fourteen lines per day and work out for themselves which
lines belong together.

Measured on the rendered page at La Jolla Shores, 2026-08-27:

| viewport | columns | cell width | **content width** | grid height |
| -------- | ------- | ---------- | ----------------- | ----------- |
| 1024     | 7       | 120px      | **88px**          | 498px       |
| 1280     | 7       | 157px      | **125px**         | 414px       |
| 1536     | 7       | 193px      | **161px**         | 414px       |

And the strings that have to live in that width, at the sizes the grid sets
them in (10px `font-extrabold tracking-widest uppercase` for a label, 13px for
a value):

| string                          | rendered width |
| ------------------------------- | -------------- |
| `LOWEST DAYLIGHT TIDE`          | 170px          |
| `BIGGEST DAYLIGHT SWELL`        | 187px          |
| `TODAY · THU, AUG 27`           | 151px          |
| `THU, AUG 27`                   | 88px           |
| `6:20 AM to 7:20 PM` (13px)     | 123px          |
| `11:00 AM 0.7 ft · 6 s` (13px)  | 117px          |
| `LOW TIDE` / `SWELL` / `CLOUDS` | 70 / 47 / 56px |
| `6:20 AM – 7:20 PM` (11px)      | 98px           |

Two facts fall out of that table and they are the whole plan.

**The two long labels never fit.** Not at 1024, not at 1280, not at 1536.
ADR-0017 predicted the wrap and accepted it ("about 30px of the 108px"),
reasoning that the label is what names the selection and could not be
shortened without hiding the cell's judgement. That reasoning was right about
the constraint and wrong about the only way out of it: the selection can be
named **once, in the header**, instead of three times in three labels.

**Seven columns at 1024 gives a cell 88px — one pixel less than the day name
it has to hold.** This is the root cause of every hard-coded `lg:block` in
`DaylightWeek`, `TideWeek`, `WaveWeek` and `SkyWeek`. Each of those components
carries a paragraph of docstring justifying a forced line break, and each of
those paragraphs is really describing this measurement. The grid is 84px
_taller_ at 1024 than at 1536, which is the tell.

## The solution, from the reader's side

The day cell becomes a header and three readings.

```
┌──────────────────────────────┐
│ TODAY                        │  yellow chip, reserved on every day
│ THU, AUG 27                  │  band: mist / ocean-on-today
│ ☀ 6:20 AM – 7:20 PM          │
├──────────────────────────────┤
│ LOW TIDE                     │  ocean label
│ 3:13 PM 1.6 ft               │
├──────────────────────────────┤  hairline, border-lavender
│ SWELL                        │  purple label
│ 11:00 AM 0.7 ft · 6 s        │
├──────────────────────────────┤
│ CLOUDS                       │  fog label
│ 40% Patchy fog               │
└──────────────────────────────┘
```

**The header scopes the cell.** Once the day block opens with the daylight
window, every figure under it is understood to be inside that window, and
"Lowest daylight tide" can become "Low tide" without hiding anything. This is
the load-bearing move: the short labels are not a cosmetic trim, they are
what the header pays for. Reverting the header without reverting the labels
would leave three unqualified superlatives, which is the failure ADR-0017 was
written to prevent.

**Six lines per day instead of eleven.** The `all day` overnight figures leave
(see the decision below), the forced line breaks go, and the three readings
are separated rather than run together.

## Implementation decisions

### The daylight window is not a row

`DaylightWeek` stops being a `WeekRow` and becomes the day header's second
line. `WeekGrid` grows a per-day `daylight: ReactNode` slot rather than
accepting it in `rows`, because a row is a thing repeated in every day block
under a `<dt>`, and this is now one line in the header.

`WeekPanel` still reads daylight first and still takes the week's columns from
it — an outage there costs the grid rather than a row, which is the property
that read was chosen for. Nothing about the read changes.

### The mark is an SVG, not an emoji

ADR-0015 records that a full-colour emoji at 10px "is not a mark; it is a
smudge", which is why the week grid has no glyphs at all today. A ☀️ in the
header at 11px would walk straight back into that. An inline SVG at 12px on
`currentColor` goes white on today's ocean band and fog on mist, renders
identically on every OS rather than as whatever the visitor's emoji font
draws, and is `aria-hidden`.

This does not reopen ADR-0015. That decision is about _which glyph means which
product_ in the site's emoji vocabulary; a stroked icon in `currentColor` is
not in that vocabulary and claims no product.

### The window is named to a screen reader, not to a pointer

The header's daylight line takes `role="img"` with
`aria-label="Daylight, 6:20 AM to 7:20 PM"`. The visible text is the two clock
times; the accessible name carries the word the visible text drops.

Rejected: a `title` tooltip. It does not appear on touch, where most of this
site's readers are; it is not keyboard-reachable; and this grid's stated
principle is that nothing is hidden behind an affordance. Rejected too:
`sr-only` — the repo does not use it, and `ReadingCard` records why.
`role="img"` + `aria-label` is already the `Placeholder.tsx` idiom here.

### The `Today` chip gets its own reserved line

`TODAY · THU, AUG 27` is 151px and does not fit 125px, so today's header wraps
where the other six do not — the misalignment the existing `lg:min-h-8`
reservation exists to prevent. Keeping a reservation is unavoidable at 1280.

What changes is that it stops looking like a missing line: inside a tinted
band, an empty first row reads as the band's padding. The chip is
`bg-yellow text-dark`, which is the first of the brand's colours to reach this
grid and the same move ADR-0015 made for the reading cards' eyebrow.

Rejected: dropping `Thu,` from today's column to make it fit (`TODAY · AUG 27`
is about 116px). A weekday is the more useful of the two tokens in a week
grid, and dropping it from the one column a reader most needs named is what
`WeekGrid`'s own comment already argues against.

### Separation is a hairline, not a box

`border-t border-lavender` between readings; the header band's bottom edge is
the heavier `1.5px` rule that separates header from body. Lavender because it
is the tile's own border colour, so the rule reads as the same system.

Rejected: boxing each reading. The tile is already a box, and three nested
boxes inside a 157px cell is a grey mess. Rejected: a 3px accent bar per
reading — built and measured, it takes 9 of the 125px and wraps the swell line
at 1280.

### Colour is per product, never per value

Labels take a constant colour across all seven days: ocean tide, purple swell,
fog cloud. Measured against the cell's `white/60` over cream: ocean 8.5:1,
purple 5.3:1, fog 5.0:1 — all clear of the 4.5:1 this page holds itself to.

ADR-0009 forbids this site judging whether conditions are good, and ADR-0015
already draws the line that matters: what makes colour a verdict is
_differential_ colour. Every day's swell label is the same purple whether the
swell is 0.7 ft or 6 ft, so nothing here asserts anything about the water.

### Columns step 1 / 2 / 4 / 7

At `md`, `lg` and `xl` respectively. Still one CSS property, so the transpose
argument in `WeekGrid`'s header stands unchanged and nothing renders twice.

The cost is that between 1024 and 1279 the week reads as 4 + 3 rather than one
row of seven, which is a real loss for comparing across days. It buys 223px
cells instead of 120px, and with them the deletion of four components' worth
of forced line breaks. Below `md` a day is a full-width row and nothing wraps,
which is why none of these breaks were ever needed there.

### The variable-length line goes last

`Clouds` keeps its phenomenon words ("Slight chance rain showers", 203px, two
lines) and is allowed to wrap, because it is the last reading in the cell.
A wrap on the final line makes one column's content taller; the tiles are grid
items and stay equal height, and there is no row beneath it to push out of
alignment. That is what lets `SkyWeek` drop its `lg:block`.

## The decision that needs an ADR

**The week grid stops printing the day's own extreme.** ADR-0017 considered
exactly this and rejected it: "a page that silently declines to mention a
−0.2 ft is withholding the figure a tidepooler came for."

That objection is weaker than it was, for two reasons ADR-0017 could not have
weighed:

- **Today's overnight extremes are still on the page.** `TideToday` prints
  "Lowest all day" and `WavesToday` prints "Biggest all day" as stat pairs on
  the cards above the grid. Only the six future days lose theirs.
- **A day view is planned** that shows every reading for one day, overnight
  included, which is where these figures are going rather than away.

It is still a loss in the interim, so it is not taken silently: one sentence
beneath the grid says the week shows only what falls between sunrise and
sunset. That is the pattern the grid's `notes` prop already establishes — one
fact about the grid, printed once, rather than seven facts in seven days.

`lib/conditions.ts` is not touched. `allDay` stays on `TideWeekDay` and
`WaveWeekDay`; the week components simply stop rendering it, and the day view
will want the data intact.

## Test seams

All existing, none new:

- **`WeekGrid`** renders from `days` + `rows` + the new per-day `daylight`
  slot. Assert the header's structure and its `aria-label`, that the chip line
  is reserved on every day, and that the `<dl>` holds three pairs rather than
  four.
- **`DaylightWeek`, `TideWeek`, `WaveWeek`, `SkyWeek`** each render one cell
  from a plain view model. Assert the shortened labels, and that the dropped
  `all day` text is absent.
- **`WeekPanel`** composes them from stubbed reads. Assert the daylight slot
  is populated from the daylight read, that the note appears, and that a
  failing read still costs a row rather than the grid.

jsdom applies no stylesheets (ADR-0001), so the class-level facts — the band's
colours, the hairlines, the column steps — are asserted as classnames and
confirmed by eye at the review viewport, which is the compromise ADR-0004 and
ADR-0014 already record. The `stylesheet` gate row is what proves a named
utility compiles.

## Slices

1. **This plan file.**
2. **Daylight moves into the day header.** `WeekGrid` gains the slot,
   `DaylightWeek` becomes the header line and gains the sun mark, `WeekPanel`
   stops pushing it as a row.
3. **The rows carry only what daylight reaches.** `TideWeek` and `WaveWeek`
   drop the `all day` line, all four cells drop `lg:block`, the labels shorten,
   `WeekPanel` gains the note. **ADR: the week shows only the daylight
   window.**
4. **The tile gets a header band and hairline rules**, and labels take the
   colour key. Presentation only.
5. **Columns step 1 / 2 / 4 / 7.**

Dependencies are linear: 3 is only honest once 2 has put the window in the
header, and 4 is styling the structure 2 and 3 build. 5 is independent of 4
but wants 3's shorter strings to be worth measuring.

### Addendum, 2026-08-27: slices 2 and 5 shipped as one

**5 is not independent of 2 — it is a prerequisite.** The daylight line is
`whitespace-nowrap`, because a clock range broken across two lines is two half
times. Measured as shipped it is 109px, and at the old breakpoints the cell it
lands in at 1024 has 88px of content: it would have overflowed rather than
wrapped, for as long as the two slices were apart. A slice is supposed to leave
the repo working, so they went in together.

The plan said "5 is independent of 4", which is still true, and implied it was
independent of 2, which the measurement disproved. Recorded rather than
quietly reordered.

## Out of scope

The reading cards and their `all day` stat pairs, the provenance lines beneath
the grid, the reserved surf-zone slot, `lib/conditions.ts`, and the day view
itself.

## What was considered and rejected

- **Shorten the labels alone**, without moving daylight. Fits, and leaves
  three unqualified superlatives — the exact hidden judgement ADR-0017 forbids.
- **A tooltip on a sun icon** for the daylight window, as first sketched.
  Rejected on touch reachability; see above.
- **Keep `all day`, compressed to one line.** Preserves ADR-0017 intact and
  needs no new ADR, but costs two lines per cell back and keeps the word
  "daylight" load-bearing in the labels, which undoes the point of the work.
- **Seven columns from `xl` only, one column below it.** Every seven-column
  case then has at least 125px, but a full-width stacked day from 768 to 1279
  is a great deal of scroll on a tablet.
- **Accent bar per reading.** Measured; wraps the swell line at 1280.
