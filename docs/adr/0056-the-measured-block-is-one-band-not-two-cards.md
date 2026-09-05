# 0056 — The measured block is one band, not two cards

Date: 2026-09-05. Status: accepted. Keeps ADR-0010 and ADR-0015; spends the
slot ADR-0055 emptied. Plan: `docs/plans/the-measured-band.md`.

## Context

The measured block was two dark cards, about 180px tall plus a 36px margin, on
a page reviewed at 639px of viewport height. Above them: a headline, a liability
notice and a list of beach links, roughly 340px. Below them: the week and the
day, which are the two regions a reader came to compare. So the first screen of
a page about deciding when to go to the beach contained no day.

**The shape was built for the minority case.** Two cards side by side is a
layout for two figures, and a measured wave height exists on 15 of 51 beach
pages and — after ADR-0048 withholds waves from 15 of 18 areas — on 3 of 18
area pages. **18 of 69 routes, about 26%.** On the other three quarters the
wave card held no figure at all: a paragraph explaining an absence, plus a
`<details>` carrying the join's own reason, occupying half the block's width and
all of its height.

ADR-0055 moved that paragraph to the attribution of the modelled height that
stands in for it, in all three places one is drawn. What is left in this block
is what was actually measured — which on most routes is one source, not two.

## Decision

**One band, one line, on every route.** Two glyph-anchored segments where both
sources answered, one where only air did, wrapping to its own lines at a phone
width. Full width, under the page header.

**Beside the chooser was the request and is not the answer.** The chooser's
column is `md:w-72` — 288px — and this content is six stacked lines there,
about 130px, which grows the header row from roughly 100px to 246px and returns
about 70px of the 216px the cards occupied. A badge needs horizontal room;
288px is a narrow card, which is the thing being replaced. Across the page there
is about 1440px at the review viewport and the segments set on one line. A third
column beside the chooser does not fit until `xl`: at `md` the usable width is
672px and the title plus the gap plus the chooser already spends 848px.

**Two segments, never one sentence.** ADR-0010 permits two provenances behind
one _panel_ and refuses them behind one _sentence_, and this band is the panel.
`ReadingCard`'s `gloss` docstring named this exact change as the temptation —
"the temptation once the cards are being compressed is to merge them" — so each
source keeps its glyph, its figures and its own plain-words line. "About waist
high, mild with a gentle breeze" is the forbidden shape and `bandText.ts` does
not build it. `bandText.test.ts` asserts it.

**Period and gust are dropped, and both leave the site.** Each needs its own
label to mean anything to a parent — "6 s" is not a figure, "6 s period" is —
which costs about 25 characters in a line whose whole argument is width. They
are also the two most surfer-specific values on the block, on a page whose
`heightWords` and `warmthWord` exist because a raw figure "tells a parent of an
eight-year-old very little". Nothing else on this page carries a measured period
or gust, so this is a real loss of published data rather than a relocation.

**No third glyph.** ADR-0015's vocabulary is closed. 🏄 and 💨 come across from
the cards they anchored; the clock has none.

**Cream, and the colours were re-measured for it.** `CARD_PROSE` and
`CARD_MUTED` are white at 75% and 55%, measured against `--color-dark` and
against nothing else — white at 55% on this page's cream paints **1.03:1**,
which is the bug #175 fixed in three places. The band uses `PAGE_MUTED`, which
`cardText.ts` records at 5.56:1 on cream and which the week grid and the day
chart already print their provenance lines in.

**One region with an `aria-label`, no visible heading.** The two card `<h2>`s
leave the outline with the cards, which becomes `h1` → region `h2` → day `h3`
with no card level between. `aria-label` rather than a hidden heading, for the
reason `ReadingCard` recorded: the accessible-name algorithm joins adjacent
inline text nodes with no separator, and this repo uses `sr-only` nowhere.

## Consequences

**`MeasuredToday`, `ReadingCard` and `StatGroup` are deleted with their tests** —
about 2,100 lines. The latter two had exactly one caller each. `MeasuredPanel`
survives unchanged as the fetch seam: two reads, two networks, concurrent,
failing apart.

**A null water temperature is now omitted rather than stated.** `StatGroup`
printed "Not reported" and was right to — in a table a blank cell where a
measurement goes reads as a calm sea. In a run of interpuncts there is no cell
to leave blank and "70°F water" carries its own noun, so the absence is an
absence. The air lead keeps the opposite rule: a station publishing no
temperature says so, because an empty lead figure reads as a fault.

**Air is the only source that can speak without a figure.** All 51 beaches bind
a station and all 18 areas share one, so an absence there is an outage rather
than a fact about the place, and CLAUDE.md's "nothing fails silently" applies:
the band names the station that went quiet. A wave slot with no reading
contributes no segment at all — its sentence is elsewhere now (ADR-0055).

**A client island enters the measured block.** `NowClock` renders nothing on the
server and the Pacific time after hydration, ticking each minute. Without
JavaScript the reader gets the observation bound and no "now", which is the
trade `hydrated.ts` records. It is the second client component on this page
after `AreaSelector`.

**The band is a smaller target than the cards were.** Nothing in it is
interactive, so no tap target is lost — but the disclosures are. The
`<details>` carrying a feed's own error string does not come across; that string
is a diagnostic for us rather than prose for a parent, and ADR-0022 already
routes drift to a GitHub issue. What survives is the sentence that does not
blame a station for this site's parser.
