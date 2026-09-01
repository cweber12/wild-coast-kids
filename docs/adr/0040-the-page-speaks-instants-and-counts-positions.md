# 0040 — The page speaks instants and counts positions

Date: 2026-09-01. Status: accepted. Discharges the last consequence of
ADR-0035, which recorded this defect as inherited rather than fixed; that
document is a dated record and is not amended. Nothing in ADR-0027, ADR-0034 or
ADR-0035 changes. Corrects the **Hour chart** entry in `CONTEXT.md`, updated in
the same pull request.

## Context

`hourOfDay` derives an hour as `Math.round((atMs - startMs) / HOUR_MS)`. That is
a position in the day, not a reading of a clock, and `localMidnightOf` resolves
the zone offset twice — so `startMs` and `endMs` are true local midnights and a
Pacific day is genuinely twenty-three or twenty-five hours long twice a year.
Four places on the day panel then said that position out loud as though it were
a clock hour, and one placed a tick by dividing it by twenty-four.

This is issue #196, and it is two defects rather than one.

### The name

On the fall-back day, 2026-11-01, the day holds twenty-five hours:

| position | real instant | printed |
| -------- | ------------ | ------- |
| 3        | 2:00 AM      | "3 AM"  |
| 12       | 11:00 AM     | "12 PM" |
| 13       | 12:00 PM     | "1 PM"  |
| 24       | 11:00 PM     | "12 PM" |

So the axis printed "12 PM" twice — once over 11 AM and once at eleven at night
— and **never named noon at all**. #196's own text says the two collide "at noon
and at 11 PM"; the first half of that is not right, and the correction matters
because it is the reading that makes the fault visible. On the spring-forward
day, 2027-03-14, the day holds twenty-three hours and every hour from position 2
was named an hour early.

The chart's readout, its hidden column labels and the map's caption all carried
the same wrong number. `hourLabel(25)` would have returned "13 PM", but position
25 is the next day's midnight and the series bucket by local date, so it was
unreachable.

### The position, which #196 does not mention

The axis placed each label at `(hour / 24) * 100%` while the curve above it is
mapped by `x()` against the day's **real** span. Measured on both days:

| tick, at `hour / 24` | 2026-11-01 sits over | 2027-03-14 sits over |
| -------------------- | -------------------- | -------------------- |
| 3 AM @ 12.50%        | 2:07 AM (−53 min)    | 3:52 AM (+52 min)    |
| 6 AM @ 25%           | 5:15 AM (−45)        | 6:45 AM (+45)        |
| 9 AM @ 37.5%         | 8:22 AM (−38)        | 9:37 AM (+37)        |
| 12 PM @ 50%          | 11:30 AM (−30)       | 12:30 PM (+30)       |
| 9 PM @ 87.5%         | 8:52 PM (−8)         | 9:07 PM (+7)         |

**The error is largest just after the transition and shrinks through the day**,
because the position stretch and the offset partly cancel, which is part of why
it was never noticed. Fixing only the label would have left a correctly-named
tick over the wrong part of the curve — a fault a reader is _less_ likely to
catch than the first one, because the words would now look right.

## Decision

**Every hour this page speaks is named from its instant; the position stays a
position and is never spoken.**

- **`hourOfDay` is unchanged and keeps its meaning.** It is a legitimate plot
  coordinate, and the hour columns, `cloudByHour`, `needles.ts` and the selected
  hour all key on it. A clock hour cannot replace it: a fall-back day holds two
  1 AMs, and keying a selection on one of them would make two hours
  indistinguishable. This is #196's own recommendation and it is taken.

- **`localHourOf` and `hourLabelAt` live in `pacific-time.ts`**, beside
  `localTimeOf`. Naming an instant in a named zone is what that module is;
  `hourLabel` sat in `dayFrame.ts` only while it took `hourOfDay`'s output, on
  the argument that one definition of an hour and one definition of what to call
  it belong together. Naming from the instant dissolves that pairing.

- **The words are built here rather than asked of `Intl`.** An hour-only format
  returns "3 PM" with an ordinary space and "12 AM" at midnight on Node 22.18.0
  / ICU 77 — checked rather than assumed — but which space character ICU picks
  has moved before and CI runs a different build of it, so a label asserted as
  `toBe("3 PM")` could fail there and nowhere else. `localHourOf` reads a
  _number_ out of `Intl`, where no such question arises.

- **The label function is renamed rather than kept.** Its argument went from a
  0-to-23 index to epoch milliseconds and both are `number`, so a missed call
  site would have compiled and returned plausible nonsense — `hourLabel(12)`
  gave "12 PM". This defect exists because an index was silently readable as a
  clock hour; shipping the fix under a signature that stays silently readable
  both ways would leave the same trap one layer down.

- **The map's caption is fixed with the chart, and that is not optional.** It is
  not in #196. ADR-0035 arranged for the chart and the readout to name one hour
  the same way; fixing only the chart would make the two regions disagree on
  exactly the two days that decision was written to make them agree on.

- **The axis names the same eight hours on all 365 days, each at its true
  instant.** `axisTicks` returns a clock hour and the instant it happened at,
  and `HourChart` positions each tick with the same `x` it draws the curve with.
  So a 25-hour day's ticks sit at 0, 16, 28, 40, 52, 64, 76 and 88 per cent
  rather than every 12.5, and a 23-hour day's at 0, 8.7, 21.74 and so on.

- **The one uneven gap is the first, which is where the transition is.** On a
  fall-back day midnight to 3 AM is 16% against 12% elsewhere, because that span
  really did hold four hours; on a spring-forward day it is 8.7% against 13.04%.
  The curve is already drawn on real elapsed time, so this is a true statement
  about the day rather than a distortion introduced to make one.

- **An hour the day does not hold is dropped; a repeated hour takes the earlier
  of the two.** `LABELLED_HOURS` reaches neither case — the repeated hour is
  1 AM and the skipped one is 2 AM — but that is a property of the current list
  and not a guarantee, so both are defined and both are asserted.

- **A repeated hour is named twice rather than disambiguated.** On 2026-11-01
  the readout and the caption both say "1 AM" for two different hours. They stay
  distinct selections because the position keys them, and neither is ever an
  axis tick.

### What was measured, and where

The narrowest spacing this rule produces is midnight to 3 AM on a spring-forward
day. Measured on the built page, 2026-09-01, at five viewport widths:

| viewport | plot width | "3 AM" would start at | "12 AM" ends at | clearance |
| -------- | ---------- | --------------------- | --------------- | --------- |
| 375      | 237px      | not shown             | 28.6px          | —         |
| 640      | 502px      | 31.2px                | 28.6px          | **2.5px** |
| 768      | 582px      | 38.1px                | 28.6px          | 9.5px     |
| 1024     | 806px      | 57.6px                | 28.6px          | 29.0px    |
| 1536     | 854px      | 61.8px                | 28.6px          | 33.1px    |

`sm` is the binding width: it is the narrowest at which all eight labels show,
and at 375 only the quarter-day four do, so no narrow screen meets this pair at
all. **It clears, so no per-day degrade ships.** The same run reproduced the
237px plot at 375 that `LABELLED_HOURS` already cites, which is what says the
rig agrees with the page those figures came from.

## Alternatives considered

**Even spacing, names from instants.** Ticks stay at positions 0, 3, 6 … 21,
evenly spaced, each named from its own instant — so a fall-back day would read
12 AM, 2 AM, 5 AM, 8 AM, 11 AM, 2 PM, 5 PM, 8 PM. Correct, and rejected. It does
not remove the day's irregularity, it moves it: the ticks are even and the day
then runs 16% past the last one instead of 12%, so the anomaly lands in the tail
where nothing happened rather than in the span that actually holds the extra
hour. It pays for that with the words, which are the half a reader reads, and it
would leave `data-axis-hour` carrying a position — the very thing this decision
stops anything reading as a clock hour.

**Make the hour a clock hour throughout and derive the position.** #196's second
candidate. Rejected there and here: a repeated 1 AM stops being a unique key,
and the columns, `cloudByHour` and the selection all need one.

**Ask `Intl` for the hour-only string.** Shorter, and it produces identical text
on this toolchain. Rejected above: it puts a rendering decision outside the repo
and into an ICU version that CI does not share.

**Keep the name `hourLabel`.** Smaller diff, and the name still reads well.
Rejected: `number` to `number` means the type system cannot catch a stale call
site, and a stale one returns a plausible string rather than an error.

**Fix the label and leave the tick positions.** What #196 describes, and it is
half the defect. Rejected because it is the worse half to fix alone: a
correctly-named tick sitting 53 minutes off the curve is harder for a reader to
catch than a wrongly-named one, since the words now look right.

**Amend ADR-0035's last consequence.** This repo does amend ADRs in place —
0035 amended itself and corrected 0034 inline — so leaving it is a choice.
Rejected: that consequence was _correct_. It recorded a defect as deliberately
inherited so that the chart and the map would stay wrong together rather than
disagree, and said the fix would be a single-site one. It was, and it is
discharged here. An ADR whose prediction came true does not need editing.

**Correct `CONTEXT.md`'s Day sparkline entry too**, which calls that plot "the
24-hour shape" and has the same fault. Rejected as out of scope: `DaySpark` is
untouched by this work and has no hour axis, so nothing here makes that sentence
newly wrong. It is named in the pull request rather than filed.

## Consequences

- **`dayFrame.ts` is no longer a leaf**: it imports `localHourOf` from
  `pacific-time.ts`. Geometry depending on the clock is the right direction and
  there is no cycle — `needles.ts → dayFrame` already existed.
- **`dayFrame.ts` gains a test file.** It had none while it held `nightBands`
  and a one-line `hourOfDay`; a rule whose whole value is being right on
  2026-11-01 and 2027-03-14 should not cost a jsdom render to assert.
- **`data-axis-hour` now carries a clock hour.** Four existing tests already
  read it as one, so this makes an existing reading true rather than adding a
  convention. Anything reading it as a position would now be wrong — nothing
  does.
- **`DayPanel`'s readout rows come back through `instantOfHour` to be named**,
  because `needles.ts` buckets by position and keeps no instant. That inverse is
  exact across a transition, which is asserted rather than argued.
- **`selectedHour.tsx` needed no change**, and its docstring now says why: the
  hour it holds was always a position, and nothing about a position was ever
  shown to a reader once the naming moved.
- **The gate's `mustFail` mechanism cannot express "commit the regression test
  first" for this kind of defect.** It is a per-gate-row flag and the `test` row
  runs the whole suite, so a failing test fails that row too. The failing-first
  evidence is in the pull request instead: the new tests run against the
  pre-fix call sites, with their output.
