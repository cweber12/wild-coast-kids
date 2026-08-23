# 0004 — Touch targets are 44px below `md`, 24px above it

Date: 2026-08-14. Status: accepted.

## Context

Two design reviews reported the nav links as "~30px tall, below the 44px
guideline" — finding 5 of `DESIGN_REVIEW-2026-08-11.md`, then finding 9 of
`DESIGN_REVIEW.md` — and nothing happened either time. Part of why nothing
happened is that "the 44px guideline" names no criterion, so there was no
way to tell whether the nav was failing a requirement or missing an
aspiration, and therefore no way to argue about what it was worth breaking to
fix it.

It also turned out the figure was wrong. The links are about 15px tall, not
30 (`text-[9px]` at Montserrat's normal line-height, plus `pb-0.5`, plus
`border-b-2`; the anchor is inline-level in a flex container with no
`items-*`, so nothing stretches it). 30px would have cleared WCAG 2.2 AA;
15px does not. A vague standard let a criterion failure be recorded twice as
a style note.

WCAG 2.2 has two target-size criteria, and the difference is the whole
question:

- **2.5.8 Target Size (Minimum)**, level **AA**: 24×24 CSS px, with an
  exception for undersized targets that are far enough apart.
- **2.5.5 Target Size (Enhanced)**, level **AAA**: 44×44. Apple's HIG gives
  the same number for touch.

The site already has 44px in it: the gallery controls added in PR #14 are
`size-11`. So the choice is not between a standard and nothing; it is
between one standard and two.

## Decision

**44×44 below `md`. 24×24 at `md` and above.**

A pointer is a finger below `md` and a mouse above it, and the two are not
the same instrument. This is written as a breakpoint rule rather than a
pointer-media-query rule because the layout already branches at `md` and a
second, invisible axis of variation would be worse than a slightly blunt
one.

Where an element has no background, it takes 44px at every breakpoint — the
box growing is invisible, so there is nothing to buy by restricting it.
Where an element is a visible shape, it takes 44 only below `md`, because
growing it above `md` is a redesign.

## Consequences

The reviews get a criterion to cite instead of a number, and this repo gets
a fact about itself that is true or false rather than better or worse.

Adopting AAA for touch and AA for pointer is deliberately mixed, and the
honest reason is cost, not principle: 44px on a phone is affordable and 44px
on desktop would force visible changes to compositions that are finished.
Anyone revisiting this should know it was a trade and not a reading of the
spec.

**The gate cannot check this.** jsdom applies no stylesheets (ADR-0001), so
no test can measure a rendered box, and this ADR therefore describes a
property that is asserted by a human looking at a screen. The compromise is
to name the target in one place — a shared constant composed by every
interactive element in a component — so tests can assert that each element
_refers to_ the standard even though they cannot confirm it holds. That
catches the failure this repo actually has, which is drift: an element added
later without the class. It does not catch the class being wrong. Closing
that gap means Playwright, and is the same gap ADR-0001 and ADR-0003 already
record.

**WCAG 1.4.10 Reflow is at the same level and pulls the other way.** It
requires the page to work at 320 CSS px, which is also what a reader gets at
400% zoom on a 1280px screen. Targets grown to 44px are wider as well as
taller, and at 320px the nav's four labels already cannot share a row. The
resolution is that nothing in the nav is a fixed height — every height is
`min-h`, per ADR-0003 — so content that no longer fits grows its container
instead of being clipped or hidden. A bar that is taller than its token at
320px is a visible degradation; a link scrolled off the edge of a row is an
invisible one. This decision prefers the visible failure, and that
preference is the part most likely to be re-litigated.

`PillLink` does not meet this standard: `text-sm` with `py-3.25` comes to
about 41px, across eleven call sites (issue #30). The standard is adopted
knowing one shared component already violates it, rather than being narrowed
until everything passes.

_2026-08-23: that exception is closed. `PillLink` composes the shared floor
with `md:min-h-0`, under the visible-shape clause above, and `TONES` is
unchanged (issue #30). The paragraph stands as written because it records the
trade that was made on adoption, not the state of the code today. The decision
is unamended._
