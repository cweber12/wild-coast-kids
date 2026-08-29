# 0027 — A plot may be asked a question, and hover is still not how

Date: 2026-08-28. Status: accepted. Amends the aesthetic direction in
`.design/conditions-day-view/DESIGN_BRIEF.md` and one rejected alternative in
`docs/plans/conditions-day-view.md`.

## Context

The brief put a **hover tooltip** among its anti-references, beside gridlines
in every direction and a boxed legend. It went further in the responsive
section:

> hover does not exist, so the plot carries no hover affordance at any width —
> every value a reader needs is either marked on the plot or stated as a figure
> beside it. This is why the compass reads the day rather than a scrubbed hour:
> a design that needed hover would be a design that worked only on a laptop.

The plan rejected an alternative on the same grounds — needles that follow a
hovered or scrubbed hour — because "hover does not exist on touch, the audience
is parents on phones, and a slider is a great deal of machinery for a secondary
reading."

Reviewed on the built page, `HourChart` was asked for the opposite: the points
should be selectable and should show detail for the hour they mark.

**Two different objections were bundled into one rule, and only one of them
survives contact with the request.**

The first is about **hover as a mechanism**: it does not exist on touch, so a
design that depends on it works on a laptop and nowhere else. That objection is
correct and is not reopened here.

The second is about **hiding**: an affordance that conceals a value a reader
came for makes the reader hunt for it, and this page's whole argument is that
nothing is hidden. That objection is also correct — and it is about _what_ is
put behind an interaction, not about whether interaction exists.

## Decision

**A plot on this page may be asked a question, under four conditions.**

- **Not by hovering.** Selection is by click, tap or key. No value appears
  because a pointer passed over it, and nothing on the plot behaves differently
  under a mouse than under a finger.
- **Only additively.** An interaction may reveal what the page did not
  otherwise carry. It may not take something that was drawn or written and put
  it behind a gesture. `HourChart`'s summary line, range, night shading, cloud
  band and published-point marks are all present before anything is touched,
  and a test asserts the summary survives a selection.
- **With a control that meets the touch floor.** Measured on the built page, an
  hour column is 33.6px wide at 1536 and **9.9px at 375**, against ADR-0004's
  44px. A hit area that small is not a control on a phone, so the columns are
  an enhancement and a prev/next pair carrying `TOUCH_TARGET` is the guarantee.
  Anything interactive here needs one route that clears 44px below `md`.
- **Reachable without a mouse, and announced.** A roving tabindex rather than a
  tab stop per point; arrow keys that walk and stop rather than wrap; each
  target named in full so a reader is told what they selected without moving to
  the readout; the readout `aria-live` because nobody walking by keyboard is
  looking at it.

**And the controls are mounted only once they can work.** Rendered on the
server they would be dead buttons for a reader with a blocked script — the
failure `BeachSelector`'s `noscript` list exists to prevent. Unlike a beach
chooser there is nothing to fall back _to_, because the per-hour detail is not
on the page in any other form, so the honest fallback is no affordance at all.
`useSyncExternalStore` provides the server-versus-client value; this repo's lint
rules refuse `setState` inside an effect and are right to.

**ADR-0025 is untouched.** The plot still renders complete on the server, which
is what that decision requires of the page's primary content. A test against
server-rendered markup asserts the whole chart is present and not one button is.

## What this does not license

**The compass may not follow the selected hour.** The plan rejected that on two
grounds and only one has moved. The surviving objection is its own: a needle
whose meaning changes depending on what was last clicked is a different
instrument from one showing the day's dominant direction, and "two needles that
always mean the same thing on all seven days is worth more than one striking
exception" is an argument about meaning rather than about hover. Anyone
building `Compass` in #173 should read that rejection as standing.

**No readout may form a judgement.** `HourChart`'s states the hour, the figure,
the cloud the National Weather Service published, and whether the sun was up —
each a fact the page already holds. It says nothing about whether the hour is
good, which is ADR-0009's line and the one an interactive readout is most
likely to cross, because a sentence assembled per-hour reads like advice in a
way a column of figures does not.

**A tooltip is still refused.** What was built is a readout in the page's own
flow, not a panel floating over the data. The anti-reference was about a
charting library's default hover card, and that remains what it was.

## Alternatives considered

**Keep the rule as written and decline.** Defensible: the rule was recorded,
and this is a reviewer changing their mind about their own brief. Rejected
because the rule bundled a mechanism objection with a hiding objection, and the
request violates neither once they are separated. A rule that cannot be taken
apart when it turns out to be two rules is a rule nobody can apply.

**Hover, with tap as a fallback.** The cheapest implementation and what a
charting library would give. Rejected on the brief's own argument, which is
undamaged: hover is not a thing a phone has, and a design whose primary
affordance works only on a laptop is a design for the wrong reader.

**A scrubber under the plot.** One control, trivially 44px, no small hit areas
at all. Rejected: it is the "great deal of machinery for a secondary reading"
the plan already refused, it cannot be tapped at the point a reader is looking
at, and a range input is the one form control on this site with no precedent.
The prev/next pair gets the same guarantee out of two ordinary buttons in the
site's own pill shape.

**Make every point a 44px target and let them overlap.** Meets the floor
literally and lies about it: overlapping targets mean a tap lands on whichever
is on top, so a reader aiming at 3 PM gets 4 PM and has no way to know.

## Consequences

- **`HourChart` is a client component**, the second interactive component in
  `src/` after `BeachSelector`. The four tabs planned for it are a third
  interaction inside the same file and inherit every condition above.
- **The brief's "no hover affordance at any width" is now half a rule.** The
  half about hover stands; the half read as "no interaction" does not. This
  document is what a reader of that sentence should be sent to.
- **`docs/plans/conditions-day-view.md` keeps its rejection of scrubbed
  needles**, and the reason it keeps it is now narrower and written down.
- **Anything interactive added to this page owes the four conditions**, and the
  third one — a route that clears 44px below `md` — is the one a new control is
  most likely to miss, because it only fails at a width nobody develops at.
