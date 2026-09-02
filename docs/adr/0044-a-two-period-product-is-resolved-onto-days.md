# 0044 — A two-period product is resolved onto calendar days, and an unknown period stops the read

Date: 2026-09-02. Status: accepted. Extends ADR-0035's rule that the page is
indexed by a chosen day, to a product that is not.

## Context

The conditions page is indexed by day. The week grid is the control, the day
panel is what redraws, and ADR-0035 fixed that a reader's choice persists across
products. Every feed behind it is addressable by day: NOAA's tide predictions,
CDIP's three-hourly estimates, and the gridpoint's hours all carry instants.

The surf zone forecast does not. It names its periods and never dates them.
Measured across all 14 issuances NWS SGX held on 2026-09-02 — seven days —
`CAZ043`:

| Issuance         | First period                       | Second period |
| ---------------- | ---------------------------------- | ------------- |
| morning, ~1 AM   | `TODAY`                            | `<weekday>`   |
| afternoon, ~1 PM | `THIS AFTERNOON THROUGH <weekday>` | `<weekday>`   |

Every issuance carried exactly two periods, never three. But the two shapes do
not cover the same ground: a morning bulletin describes **two** calendar days,
while an afternoon one merges today's remainder with tomorrow into one period
and pushes the second to the day after — **three**.

`nws-forecast.ts` already records the neighbouring version of this hazard, that
"the first period is not today's", and solved it by selecting on instants the
publisher supplies. That solution is unavailable here: this product supplies no
instants at all.

Three options were considered.

**Clamp to today.** Show the first period, ignore the second. Stable and simple,
and throws away a forecast day the office published.

**Show both periods on today's panel, in the publisher's own words.** Never
asserts a mapping, so nothing can be wrong. But it puts a block about Sunday on
Wednesday's panel, which fights the day selector the whole region is built
around.

**Resolve the labels onto dates.** `TODAY` becomes the issuance's local date;
`THIS AFTERNOON THROUGH SATURDAY` becomes every date from the issuance through
that weekday inclusive; a bare weekday becomes the next such day at or after
where the previous period ended.

## Decision

**The labels are resolved onto calendar dates**, by `resolvePeriodDates`, and
the day panel shows whichever period covers the day a reader picked.

**A label the resolver does not know stops the read.** It throws
`NwsSurfZoneDriftError` rather than dropping the period or resolving it to
nothing. The measured vocabulary is one week of one summer, which is not the
whole of what NWS period naming produces — `TONIGHT`, `REST OF TODAY` and
holiday names all exist in the wider product family and none appeared in the
capture window.

**The publisher's own name for the period is printed beside the resolved day.**
The dates are this repo's arithmetic; the name is the office's fact. Showing
both is what keeps them apart, and it is how a reader can see that one period
covers both Tuesday and Wednesday.

**The headline is carried unreconciled with the days beneath it.** It is scoped
to the bulletin, and on 2026-08-28 07:11 it read `HIGH RIP CURRENT RISK` over a
`TODAY` that read Moderate — because `SATURDAY` was the High one. Both are
correct at their own scope. Taking the worse of the two, or hiding the headline
when it disagrees, would be this site editing a safety product.

## Consequences

**Coverage varies with the time of day.** A reader at 9 AM finds the block on
two days; the same reader at 3 PM finds it on three. That is the publisher's
cadence showing through rather than a defect, and the block states its issuance
so the variation is legible rather than mysterious.

**A vocabulary change takes the block down rather than moving it.** A new period
label — likely, since the measured set is small — means every reader on all 26
open-coast beaches sees the outage sentence until the resolver learns the word.
That is the deliberate trade: the alternative failure is a period silently
dropped, which shows a day as "beyond the horizon" when the office did forecast
it. On a page whose only hazard signal this is, a loud absence beats a quiet
wrong answer.

**The resolver is the seam, and it is a pure function.** It takes a label and a
date to search from, and returns dates. That is testable without a network, a
clock or a fixture, which is what lets the unrecognised-label path be asserted
at all — no capture would ever have produced one.

**The `searchFrom` argument is load-bearing and easy to misread as a
convenience.** A bare weekday is ambiguous on its own: `THURSDAY` read on a
Thursday could mean today or a week away. Resolving each period from where the
previous one ended is what disambiguates it, and a caller that passed the
issuance date to every period would put the second period on the wrong day
roughly once a week without raising.
