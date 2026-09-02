# 0045 — The day view discharges the week's daylight note

Date: 2026-09-02. Status: accepted. Supersedes one clause of ADR-0023.

## Context

ADR-0023 removed each day's own lowest tide and biggest swell from the week
grid's cells, keeping only the extremes that fall between sunrise and sunset. It
allowed that removal on one condition, stated in its Decision:

> **The loss is stated, not silent.** One sentence sits with the grid's other
> notes: the week shows what falls between sunrise and sunset, overnight lows and
> swells are real and often bigger, and today's are on the cards above. **This
> sentence is the condition the drop is allowed under. Removing it while keeping
> the drop reintroduces exactly the failure ADR-0017 objected to.**

The sentence is `WeekPanel`'s only unconditional note. It is removed here, and
this decision is what it is removed against.

**The condition ADR-0023 named has been met.** That decision scoped the loss
precisely, in the same paragraph: the day's own extreme "leaves this grid, and
does not leave the site", and what is lost is the overnight figure for the six
future days **"until a day view carries them"**. The day view now exists.
`ChosenDay` draws all twenty-four hours of the selected day with night shaded,
on any of the seven, so a 3 AM low is on the page as the dip it is — which is
what ADR-0023 was waiting for, described in its own words.

**Half the sentence already points at nothing.** It ends "and today's are on the
cards above". Those cards are gone: the three-card slab was removed as redundant
against the week grid and the day chart, and the two readings that survived it
are measurements rather than predicted extremes. A note that directs a reader to
a card that is not there is worse than no note, which is the standard `WeekPanel`
already applies to its other sentences — one of them was rewritten for exactly
this reason when the tide card went.

**The other half is done by the cell header, and by ADR-0023's own mechanism.**
The sentence's remaining job is to say that a cell's figures are daylight-scoped.
ADR-0023 put `☀ 6:20 AM to 7:20 PM` at the top of every day's cell precisely so
that "the header scopes the cell, so the labels do not have to". That header is
untouched and still prints on all seven days. The qualification a reader needs is
on the line above the figure, which is where that decision put it.

**What is not a reason.** Height alone would not justify this. The sentence is
three lines on a page whose largest recoverable spaces were elsewhere, and
`.design/conditions-minimal/DESIGN_BRIEF.md` states as one of its principles that
a note reporting a failure or qualifying a visible figure is never removed for
space. This is removed because its own condition expired, and it would still be
removed if it cost nothing.

## Decision

**`WeekPanel`'s unconditional daylight note is removed.** ADR-0023's "the loss is
stated, not silent" clause is superseded: the loss is now shown rather than
stated, by the day chart that decision was waiting for.

**Nothing else in ADR-0023 changes.** The daylight window is still stated once in
the day's header; the rows still carry only the figures inside it; the labels are
still short because the header scopes them; seven columns still start at `xl`.

**The seven conditional notes stay exactly as they are** — NOAA unreachable,
hourly heights missing, no tide station, no wave line, no cloud cell, cloud
unavailable, wave unavailable. Those report outages rather than qualifying a
figure, and `CLAUDE.md`'s "nothing fails silently" is untouched by this decision.
The test added with this change asserts each of them still appears in its own
failure state, so removing the intro cannot take an outage message with it.

## Alternatives considered

**Keep the sentence, shortened.** Cheapest, and it was the recommendation until
the second half was checked: any honest shortening still has to say where the
overnight figures went, and the answer is no longer "the cards above". A sentence
that must be rewritten to stay true is a sentence whose reason has moved.

**Fold the scope into the region heading** — "The week ahead, sunrise to sunset".
Costs no height and reads well. Rejected because it duplicates the per-cell `☀`
header that ADR-0023 already introduced to do this job, and because it silently
drops the "overnight lows are often bigger" half rather than deciding about it.
Two places stating one scope is the drift `REGION_HEADING` and `TOUCH_TARGET`
were both extracted to stop.

**Leave it and accept the stale clause.** Rejected: "today's are on the cards
above" is false today, and an ADR whose condition is discharged by a sentence
nobody can act on is a decision maintained on paper only.

## Consequences

The week region goes from heading to grid on a healthy page, and still explains
itself on a broken one.

**The "overnight lows are often bigger" fact is no longer stated in prose
anywhere on the page.** It is shown, on the chart, once a reader selects a day —
and `ConditionsNotes`' "Daylight first" entry still says it in words for a reader
who wants it stated. That entry is itself about to sit behind a disclosure, so
the fact is on the page but is no longer unavoidable. That is the real cost of
this decision and it is recorded here rather than argued away: a reader who never
opens the chart or the notes now learns the scope from the `☀` header alone.

**If the day chart is ever removed or made optional, this decision expires with
it.** The chart is the thing discharging ADR-0023's debt; without it, the debt
returns and the note has to come back. That is the condition on _this_ ADR, in
the shape ADR-0023 wrote its own.
