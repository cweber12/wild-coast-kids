# 0014 — A region heading outranks a card heading, in the display register

Date: 2026-08-24. Status: accepted.

## Context

Twelve of the thirteen headings on `/conditions` render at 10px. Measured: the
`<h1>` is 56px, and every other heading on the page — the three card `<h2>`s,
the two region `<h2>`s and the seven day `<h3>`s — is
`text-2xs font-extrabold tracking-widest text-ocean uppercase`, identical to
each other and to the stat labels and the provenance lines beside them.
`--text-2xs` is the smallest token in the system and `--text-base` body is 13px,
so a heading is smaller than the text it introduces.

The consequence is that "The week ahead" (a region), "Air" (a card inside it)
and "Tue, Aug 25" (a day inside that) are typographically indistinguishable. The
DOM outline is correct and nothing is skipped — this is purely visual — but the
page has **two visual type levels where its outline has four**. Reported as
finding 5 of `.design/conditions-page/DESIGN_REVIEW.md`.

**The brief names the lever and it does not reach.** `DESIGN_BRIEF.md`'s
typography section says "One family; weight and italics carry all hierarchy",
so weight and italics are what a fix should try first. Both are already spent:
every heading here is `font-extrabold` and non-italic, 800 → 900 at 10px
uppercase is close to imperceptible, and italics at 10px uppercase with
`tracking-widest` reads as a rendering fault rather than as emphasis.

**Size is not a departure from the brief.** The brief's own `<h1>` uses
`--text-title` and its `--text-stat` figures use a size token, so the system
already differentiates by size wherever the difference has to be seen.

**The site has two heading registers, and it has never written the rule down.**
That is the actual gap, and it is why this is an ADR rather than a page fix.

- **Display register** — `font-black italic`, a size token, `leading-display`.
  `ConditionsSection`'s `<h1>`, `community`'s and `InterestListTeaser`'s and
  `GallerySection`'s `<h2>`s (`--text-title`), `ProgramCards`' card titles
  (`--text-card`), `QuoteStats`' pull quote (`--text-quote`).
- **Label register** — `text-2xs font-extrabold tracking-widest uppercase` in an
  accent colour. Card headings, day headings, stat labels, provenance lines,
  eyebrows — and also five region `<h2>`s: two on `/art`, one in
  `SessionSchedule`, two on `/conditions`.

So a region heading has been written both ways depending on which page reached
for it first, which is the drift `PillLink` and `ReservedSlot` were both
extracted to stop, one layer up. Two of those pages already invert: `/art`'s
`<h3>` is display-register at 13px under a label-register `<h2>` at 10px, and
`SessionSchedule`'s `<h3>` is display-register at 18px under the same. A child
heading outranks its parent in both.

## Decision

**A region heading is display register. A card heading and a day heading stay
label register.**

A region heading takes `--text-quote`: `text-quote leading-display mb-4
font-black italic`, inheriting its colour as the `<h1>` does. Named once, as
`REGION_HEADING` in `src/components/ui/headingRank.ts`, because a rank asserted in
two places is one of them waiting to drift — the argument `touchTarget.ts`
already makes about a number.

That gives `/conditions` three visual levels — 56 / 34 / 10 at 1536, 32 / 20 /
10 at 375 — against four outline levels. Card and day headings stay identical
to each other deliberately: the review grouped them, and a card `<h2>` and the
day `<h3>` inside its sibling grid are not competing for the same glance.

**`--text-quote` and not `--text-card`**, which is the other unused mid token.
`--text-card` is `clamp(30px, 3vw, 44px)` against the `<h1>`'s
`clamp(32px, 5vw, 56px)`: 44 against 56 at 1536, and **30 against 32 at 375**,
where a region heading would all but equal the page title. `--text-quote` is
`clamp(20px, 2.8vw, 34px)` — 34 against 56, and 20 against 32. Clear at both
ends of the clamp, which is the property that matters, since a rank that holds
only on a desktop is not a rank.

**No new colour pair.** A region heading inherits the same ink on the same cream
the `<h1>` already uses, so the brief's rule that any new surface is checked
before it ships is not engaged. At 34px and 20px it is large text besides,
needing 3:1 rather than 4.5:1.

> **Amended 2026-09-02.** The rule holds; the sizes it names are no longer the
> only ones. `/conditions` now takes a **tool register** — `--text-tool-title`
> for its `<h1>` and `--text-tool-region` for its three region headings, named
> as `TOOL_REGION_HEADING` beside `REGION_HEADING` — giving 36 / 22 / 10 at 1536
> and 24 / 17 / 10 at 375. The page is read for a figure rather than arrived at,
> and the display sizes above are scaled for arrival: at 56 / 34 the first
> measurement fell off a 639px window.
>
> **What this ADR decided is unaffected**, and that is why this is an amendment
> rather than a superseding decision. A region heading is still display register
> and a card or day heading still label register; the three levels are still
> clear at both ends of the clamp, which is the property this decision says
> actually matters. Only the token pair changes, and only on the page that
> needed it — `/art` and `SessionSchedule` keep `REGION_HEADING` untouched.
>
> The contrast clause survives too, with one narrowing: at 17px the smaller rank
> is no longer large text under WCAG's 18.66px bold threshold, so it needs
> 4.5:1 rather than 3:1. It inherits the same ink on the same cream as before,
> which the page already holds to 4.5:1, so nothing new is owed a measurement.

## Consequences

`/conditions` gains the middle level its outline always had. The two region
headings there change; nothing else on that page moves.

**Three region headings are knowingly left in the label register** — `/art`'s
"What makes it different" and "Packages & pricing", and `SessionSchedule`'s
"Upcoming sessions". They are outside the brief this decision was taken under,
they each carry a different accent colour, and converting them is a visible
change to two finished compositions that wants its own look. This ADR is what
they are converted _against_ when someone does it, and recording the omission
here is the point: the alternative is a rule that quietly means "on the page
where it was written".

> Amended 2026-09-01. **All three are converted**, in #139. They take
> `REGION_HEADING` as-is and inherit their colour, so `/art` loses a purple and
> `SessionSchedule` loses an accent that was a function of which program was
> rendering. That was the decision inside the deferral, and it was taken by
> looking: at 1536 the accented variant put a third large purple element in the
> same viewport as `/art`'s `<h1>` and its pill, so colour would have meant
> "label" and "rank" at once. The alternative considered and rejected was a
> colour axis on `REGION_HEADING`, in the shape `PillLink` uses for its tones —
> a second axis on a constant whose whole argument is that it names one rank.
> Neither page's accent is gone from the component: `SessionSchedule` still
> derives it for the date line above each session title.
>
> The path above is corrected in the same change. It said
> `src/components/headingRank.ts` and the file was never there; it is now
> `src/components/ui/headingRank.ts`, beside the `touchTarget.ts` this decision
> argues from.

**The heading inversion on those two pages is not fixed by this.** `/art` and
`SessionSchedule` each render a display-register `<h3>` under a label-register
`<h2>`, so a child outranks its parent. Converting the parents closes it;
until then the defect stands and is recorded rather than filed.

> Amended 2026-09-01. **Closed by #139**, by converting the parents, which is
> what this paragraph said would close it. One correction to what it claimed:
> only two of the three headings had a display-register `<h3>` beneath them —
> `/art`'s "What makes it different" and `SessionSchedule`'s "Upcoming
> sessions". "Packages & pricing" sits over tier headings that are label
> register like itself, so nothing under it was inverted; it converted anyway,
> because two region headings on one page at two different ranks is its own
> defect.
>
> `/art`'s approach cards stay display register at `text-base`, one size token
> under their region heading rather than in the label register this ADR names
> for a card heading. The rank is monotonic and the inversion is gone; whether
> those cards should be label register is a separate look at a finished
> composition, and is not answered here.

**The gate cannot check a rank.** jsdom applies no stylesheets (ADR-0001), so
tests assert that a region heading composes `REGION_HEADING` and that a card
heading does not. That 34px reads as outranking 10px is a human check at the
review viewport, which is the same compromise ADR-0004 records for the touch
target.

The part most likely to be re-litigated is using three levers where the brief
names two. The honest answer is that the two it names were tried and cannot
move: this page had already spent both before the question was asked.
