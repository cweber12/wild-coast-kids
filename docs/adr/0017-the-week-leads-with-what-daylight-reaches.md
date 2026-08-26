# 0017 — The week leads with the extreme daylight reaches

Date: 2026-08-26. Status: accepted.

## Context

Every product row on the conditions page led with the extreme of the whole day.
The tide row showed the day's lowest low; the wave row showed the day's biggest
swell. Both are correct, both are what the upstream publishes, and on this coast
both are frequently useless.

Measured at La Jolla Shores over the seven days of 2026-08-26:

| row           | led with                                       | in daylight? |
| ------------- | ---------------------------------------------- | ------------ |
| lowest low    | 3:14, 3:38, 4:02, 4:25, 4:49, 5:13 AM, 7:02 PM | 1 of 7       |
| biggest swell | 11:00 AM, 11:00 PM ×3, 5:00 AM, 2:00 AM ×2     | 1 of 7       |

Sunrise runs 6:20–6:24, sunset 7:14–7:21. So six of seven tide figures and six
of seven swell figures named a time nobody planning a trip with children can
use.

The page already held the correction. `DaylightWeek` exists, and its docstring
says so in as many words: it is there "to make the tide row mean something",
because "a lowest low at 2:23 AM and a lowest low at 2:23 PM are the same number
and not the same trip, and the tide row alone cannot say which is which". That
put the work on the reader — read the figure, read the daylight row two lines
down, decide whether the first was reachable — on a page whose whole argument is
that a parent should not have to assemble the answer themselves.

## Decision

**Each product row leads with the extreme that falls between sunrise and sunset,
and carries the day's own extreme beside it as a secondary figure.** The row
labels say which is which: "Lowest daylight tide", "Biggest daylight swell".

- **Daylight is one computation for the whole week**, shared by all three rows,
  so they cannot disagree about when Tuesday's sun sets. It is astronomy from
  the beach's own coordinates, so constraining a NOAA reading or a CDIP forecast
  by it introduces no new way for either to go quiet.
- **The day's own extreme is kept, not dropped.** A −0.2 ft at 3:14 AM is
  exactly the figure a tidepooler willing to set an alarm wants to know exists,
  and dropping it would trade one kind of incompleteness for another.
- **When the two are the same reading the second line says so** — "none lower",
  "none bigger" — rather than printing the same figure twice, which reads as a
  fault rather than as agreement.
- **When nothing falls in daylight the cell says "None" and the day's own
  extreme carries the answer.** Close to unreachable for tides on this coast —
  two lows about twelve and a half hours apart against ten to fourteen hours of
  daylight — and reachable for waves whenever a forecast is ragged.
- **The now-cards follow the grid**, because a card saying 3:14 AM above a
  today column saying 2:40 PM would be the page contradicting itself on one
  screen.

The extremes are compared on their instant, not their height. Two lows can round
to the same figure at the precision this page prints and still be two different
times to leave the house.

## Alternatives considered

**Leave the rows as they were and let the daylight row do its job.** It is what
shipped, and it works if the reader does the cross-reference. The measurement
above is the argument against: this is not an occasional mismatch to be caught,
it is the normal case six days out of seven.

**Show only the daylight extreme.** Cheapest, and it costs the grid nothing in
height. Rejected: the overnight extreme is real, it is often much lower or much
bigger, and a page that silently declines to mention a −0.2 ft is withholding
the figure a tidepooler came for.

**Drop the daylight row, since both products now carry the constraint.** It
would have paid for most of the height this decision costs. Rejected: sunrise
and sunset still answer a question the other rows do not — when you can be down
there at all, and how much of the day is left after the tide window — and the
row is the only place on the page that says either. Its docstring is rewritten
to claim the narrower job it now does.

**Constrain to a "useful hours" window rather than daylight** — say 8 AM to 6 PM.
Rejected outright: it is this site making a judgement about when someone should
go, which is what ADR-0009 forbids. Sunrise and sunset are published astronomy,
not an opinion.

## Consequences

- **The grid is taller.** Measured at 1536×639: 225px to 333px, all seven cells
  identical, no day wrapping where its neighbours do not. On a 375px viewport,
  1507px to 1780px. That is the largest single addition this grid has taken, and
  it buys every figure in it being one a reader can act on.
- **The row labels wrap to two lines at `lg`** — "Lowest daylight tide" and
  "Biggest daylight swell" do not fit a 161px cell at 10px with wide tracking.
  Uniform across the seven columns, so alignment holds; about 30px of the 108px.
  Shortening them was rejected because the label is what names the selection,
  and a label that dropped "lowest" or "biggest" would leave the cell's
  judgement hidden.
- **Two figures can print the same height.** On 2026-08-27 the daylight peak
  read 0.7 ft and the day's own read 0.7 ft at a different hour: a real
  difference below the precision the page shows. Reporting it is the honest
  reading — there is a bigger one, and it is not worth waiting for — but a
  future reader will see the repeat and should find the reason here.
- **Anything that reverts a row to the day's extreme breaks this decision**, and
  will look like a simplification. `DaylightWeek` no longer records the reason,
  because it is no longer the row that carries it.
