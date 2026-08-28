# 0023 — The week states its window once, in the day header

Date: 2026-08-27. Status: accepted. Supersedes part of ADR-0017.

## Context

ADR-0017 established that every product row leads with the extreme that falls
between sunrise and sunset, because on this coast the day's own extreme is
usually unreachable — six of seven tide lows and six of seven swell peaks fell
outside daylight on the week measured. That decision was right and is not
reopened here.

It made two commitments that have not held up:

**The label names the selection.** "Lowest daylight tide" and "Biggest daylight
swell". ADR-0017 anticipated these would wrap and accepted about 30px of the
108px for it. Measured on the rendered page at 10px with `tracking-widest`,
they are 170px and 187px wide, against:

| viewport | columns | content width per cell |
| -------- | ------- | ---------------------- |
| 1024     | 7       | 88px                   |
| 1280     | 7       | 125px                  |
| 1536     | 7       | 161px                  |

They do not fit at any width the grid has ever had, and they were never going
to. The consequence went further than height: the four cell components each
grew a hard-coded `lg:block` line break and a paragraph of docstring defending
it, and the grid rendered 84px **taller** at 1024 than at 1536.

**The day's own extreme is kept, not dropped.** So each cell carried a second
figure under an "all day" prefix, and the day block ran to eleven or fourteen
lines with no separation between the four products in it.

Together these are why the grid reads as an undifferentiated column of numbers.

## Decision

**The daylight window is stated once, in the day's header, and the rows carry
only the figures inside it.**

```
THU, AUG 27
☀ 6:20 AM to 7:20 PM     <- the scope, said once
─────────────────────
LOW TIDE   3:13 PM 1.6 ft
SWELL      11:00 AM 0.7 ft · 6 s
CLOUDS     40%
```

- **The header scopes the cell**, so the labels do not have to. "Low tide" is
  70px, "Swell" 47px, "Clouds" 56px: one line each at every seven-column width.
  Nothing is hidden by the shortening, because the qualification a reader needs
  is on the line above rather than removed.
- **The window is not a `WeekRow`.** A row states a figure; this states the
  scope figures are selected within. It is a slot on the day, printed above the
  `<dl>` rather than inside it.
- **The day's own extreme leaves this grid**, and does not leave the site.
  `TideToday` and `WavesToday` still print "Lowest all day" and "Biggest all
  day" for today on the cards above, so what is lost is the overnight figure for
  the six **future** days, until a day view carries them.
- **The loss is stated, not silent.** One sentence sits with the grid's other
  notes: the week shows what falls between sunrise and sunset, overnight lows
  and swells are real and often bigger, and today's are on the cards above.
  This sentence is the condition the drop is allowed under. Removing it while
  keeping the drop reintroduces exactly the failure ADR-0017 objected to.
- **Seven columns start at `xl` rather than `lg`.** The 88px cell above is what
  every forced line break in the grid was really describing. Four columns at
  1024 give 189px of content, all seven days still stand on one screen as 4 + 3,
  and the four cell components drop their breaks.

## Alternatives considered

**Shorten the labels without moving the window.** Fits, and leaves three
unqualified superlatives — "Low tide" over a figure with no stated scope is the
hidden judgement ADR-0017 exists to prevent. The header is what makes the
shortening honest; neither half works alone.

**Keep both figures and compress the second to one line.** Preserves ADR-0017
intact and needs no decision at all. Rejected: it costs two lines per cell back
and keeps "daylight" load-bearing in the labels, which is the thing that does
not fit. It solves the height and not the legibility.

**Drop the overnight figures silently.** Cheapest and the cleanest cell.
Rejected under this repo's rule that nothing fails silently: a reader who saw a
−0.2 ft last week would find it gone with nothing to explain the change.

**Wait for the day view, and change nothing until it exists.** The honest
sequencing, and it leaves the grid unreadable for however long that takes. The
sentence beneath the grid is what makes shipping in this order defensible: it
tells a reader the figure exists and where today's is, rather than pretending
the week is the whole picture.

**Keep seven columns at `lg` and set the header line smaller.** The window is
109px at 11px and the cell is 88px; the sizes below 11px are the label register,
and a clock time in it would be unreadable. The cell has to get wider.

## Consequences

- **The grid is shorter and the cell is legible.** Measured at La Jolla Shores:
  1280 goes 414px to 371px before any styling change, 1024 goes to four columns
  at 221px per cell from 120px, and 375 goes 1655px against 1780px. The day
  block runs six lines instead of eleven.
- **The overnight extreme is missing for six days of seven** until the day view
  ships. This is the cost, it is stated on the page, and it is the first thing
  to check if that view slips.
- **`lib/conditions.ts` is untouched.** `allDay` stays on `TideWeekDay` and
  `WaveWeekDay` and is still computed; only the week cells stopped rendering it.
  The day view will want the data, and removing it would have made this decision
  expensive to reverse.
- **`SkyWeek`'s label lost the distinction it was carrying.** "Cloud by day"
  said, against two superlatives, that this row is a mean rather than a peak.
  With the superlatives gone from the other labels there is nowhere to draw that
  in three words, so `ConditionsNotes` carries it and the component's docstring
  flags it to whoever edits the wording next.
- **Anything that restores an "all day" figure to a week cell reverses this**,
  and will look like restoring information. The measurement above is the
  argument: the label that figure needs does not fit the cell it would live in.
- **The week is two rows between 1024 and 1279**, which is a real loss for
  comparing across days and was taken knowingly against 88px cells.
