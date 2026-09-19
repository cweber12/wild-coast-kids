# 0061 — The hour columns are a scrubber, and the stepper is the target

Date: 2026-09-17. Status: accepted. Reads ADR-0004 for one control. Plan:
`docs/plans/conditions-audit-fixes.md`.

## Context

ADR-0004 puts a 44px floor under every tap target below `md`. The hour chart
lays twenty-four transparent buttons over its plot, one per hour, so a reader
can choose an hour by tapping the curve. At 375px the plot is about 237px wide
and each button is under 10px; at 320px, under 8px. Measured on 2026-09-17:
10×119px per column at 375.

Twenty-four 44px targets need 1,056px. No phone has it, and a plot that only
drew every fourth hour would stop being the shape of the day.

## Decision

**The columns are one control, not twenty-four.** They are contiguous, so a
tap anywhere on the plot selects the hour under the finger, and the effective
target is the plot: 237×119px at 375. What a thumb cannot do on it is land on
a chosen hour rather than a neighbour, and that is the job of the **Earlier**
and **Later** buttons beneath the plot, which are 44px below `md` and step one
hour at a time. The readout names the hour either way, so a tap that lands one
hour off is corrected in one press.

That is the reading of ADR-0004 this page takes for a scrubber: the coarse
gesture has a target the size of the whole instrument, and the precise gesture
has a control that meets the floor. The columns keep their roving tabindex and
their labels, because for a keyboard and a screen reader they are exactly the
right shape.

## Consequences

- The columns carry no `TOUCH_TARGET`, and nothing in `HourChart` claims they
  meet the floor on their own. A later audit that flags them should find this
  file rather than a code change.
- The stepper is load-bearing below `md`. Removing it, or letting it lose its
  44px floor, reopens ADR-0004 for this chart.
- A `<input type="range">` below `md` was considered and rejected: it is a
  second control for the job the stepper already does, and it introduces a
  third selection idiom beside the columns and the stepper.
