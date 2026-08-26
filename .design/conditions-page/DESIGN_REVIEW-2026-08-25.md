# Design Review: The Conditions Page — cleaner and more fun

Reviewed against: `DESIGN_BRIEF.md`
Philosophy: Coastal pop editorial
Date: 2026-08-25
Branch: `conditions-notes-two-up` @ `834281d`
Reviewed URL: `http://localhost:3000/conditions/la-jolla-shores-beach`

> This is a second review, driven by four specific notes rather than a fresh
> sweep. **It does not replace `DESIGN_REVIEW.md`** (2026-08-24), whose findings
> 11, 12 and 13 are still open — that file is left untouched rather than
> overwritten. Where a note below reverses something that file recommended, it
> says so.

> **Findings 1–4 have been acted on; see the addendum at the foot of this file
> before following any _Fix:_ clause above.** Two of them were answered
> differently from what is written here, and finding 3's fix in particular was
> built and rejected. Findings 5–8 are still open and are the brief for the work
> that follows.

## Screenshots Captured

| Screenshot                                                                | Breakpoint       | What it shows                                      |
| ------------------------------------------------------------------------- | ---------------- | -------------------------------------------------- |
| `screenshots/review2-la-jolla-shores-desktop-1280-full.png`               | Desktop 1280×800 | Whole page, current state                          |
| `screenshots/review2-la-jolla-shores-desktop-1280-fold.png`               | Desktop 1280×800 | First screen                                       |
| `screenshots/review2-la-jolla-shores-tablet-768-full.png`                 | Tablet 768×1024  | Whole page                                         |
| `screenshots/review2-la-jolla-shores-mobile-375-full.png`                 | Mobile 375×812   | Whole page                                         |
| `screenshots/review2-la-jolla-shores-review-1536x639-fold.png`            | 1536×639         | The review machine's first screen                  |
| `screenshots/review2-nowband-crop-1280.png`                               | Desktop          | The three reading cards, isolated                  |
| `screenshots/review2-tidecard-crop-1280.png` / `-wavecard-` / `-aircard-` | Desktop          | Each card alone                                    |
| `screenshots/review2-weekgrid-crop-desktop-1280.png`                      | Desktop          | The seven day cells                                |
| `screenshots/review2-weekgrid-crop-tablet-768.png` / `-mobile-375.png`    | Tablet / Mobile  | Week grid stacked                                  |
| `screenshots/review2-weekgrid-daycell-1280.png`                           | Desktop          | One day cell                                       |
| `screenshots/review2-glyph-matrix.png`                                    | —                | Ten glyphs × eight backgrounds at 48px             |
| `screenshots/review2-chip-test.png`                                       | —                | Seven glyphs × eight chip colours at 34px on mist  |
| `screenshots/review2-wind-glyphs.png`                                     | —                | Faceless wind candidates, ranked                   |
| `screenshots/review2-glyph-set-surfer.png`                                | —                | The decided set 🐚/🏄/💨 on five chip treatments   |
| `screenshots/review2-options-board.png`                                   | —                | Radius, glyph and week-layout options side by side |

> All screenshots are in `.design/conditions-page/screenshots/`. The last three
> are rendered comparison boards, not captures of the running app.

## Summary

All four notes hold up, and three of them turn out to be the same defect wearing
different clothes: **the page paints in three near-identical pale tones and then
relies on shape alone to do the work colour would have done.** Measured on the
rendered DOM inside `<main>`, the entire page uses eight colour utilities —
`bg-mist`, `bg-white`, `bg-white/60`, `border-lavender`, `border-ocean`,
`text-dark`, `text-fog`, `text-ocean` — and paints exactly three background
colours. Yellow, purple and pink appear **zero times**. Mist against cream is
**1.10:1**. So the card fill is essentially invisible, the 24px corner is the
only part of the card a reader can actually see, and a big radius on an
invisible surface is precisely what reads as "tacky."

The emoji note has a sharper version than it was given: **every glyph attached to
real data on this page renders at 10px, and the only large glyphs — 24px and
48px — are inside empty dashed placeholder boxes.** The biggest mark on the page
is a 48px 🗺️ in a box with no map in it.

The shell-and-wind swap is the right instinct and the background caveat that
blocked it before is real but narrower than recorded — it applies to the _glyph's
own backing_, not to the card, and the fix is four lines.

---

## Must Fix

### 1. Radius is being chosen by token name, not by the size of the box it lands on

> Half superseded 2026-08-25 by PR #142. The reading card's radius was not
> reduced and did not need to be: this finding's own argument is that the corner
> was all you could see _because_ `bg-mist` sits at 1.10:1 against the page, and
> the card is now `bg-dark` at 16:1, where 24px reads as intended. **The week
> day cell is untouched and this finding stands for it in full.**

**(note 1 — "the cards with large border radius are tacky")**

Measured radii and boxes on the rendered page:

| Element                                                                     | Box @1280 | Box @1536×639 | Radius | Radius as % of width |
| --------------------------------------------------------------------------- | --------- | ------------- | ------ | -------------------- |
| Reading card ([`ReadingCard.tsx:92`](src/components/ReadingCard.tsx#L92))   | 384 × 301 | 469 × 283     | 24px   | 6.3%                 |
| Week day cell ([`WeekGrid.tsx:145`](src/components/WeekGrid.tsx#L145))      | 159 × 148 | 195 × 128     | 24px   | **15.1%**            |
| Program card ([`ProgramCards.tsx:15`](src/components/ProgramCards.tsx#L15)) | 384 × 520 | —             | 24px   | 6.3%                 |

`rounded-card` is a 520px-tall saturated hero card's radius. It is on a 159×148
week cell unchanged, where it eats 15% of the width and the cell stops reading
as a rectangle at all. See [`screenshots/review2-weekgrid-daycell-1280.png`](.design/conditions-page/screenshots/review2-weekgrid-daycell-1280.png)
and panel **A** of [`screenshots/review2-options-board.png`](.design/conditions-page/screenshots/review2-options-board.png).

The compounding half is the surface. `bg-mist` (#f0ebf8) against the page's
`bg-cream` (#faf8f5) is **1.10:1** — for practical purposes the fill is not
there. With no visible fill and no edge, the corner arc is the entire card, so
the eye reads seven blobs rather than seven cells.

_Fix, using tokens and patterns the repo already has — no new tokens:_

- **Week day cell** → `rounded-tile` (12px) with `border-[1.5px] border-lavender
bg-white/60`. That is verbatim the treatment
  [`SessionSchedule.tsx:87`](src/components/SessionSchedule.tsx#L87) and
  [`art/page.tsx:134`](src/app/art/page.tsx#L134) already use for boxes this
  size, and it gives the cell a real edge instead of a phantom fill. Today's
  marker keeps `border-ocean`, and since every cell now carries a 1.5px border,
  the "marked day is not wider than its neighbours" property in `WeekGrid`'s
  comment still holds.
- **Reading card** → `rounded-thumb` (16px). Precedent:
  [`QuoteStats.tsx:44`](src/components/QuoteStats.tsx#L44) is a stat box on a
  colour fill at `rounded-thumb`, which is the nearest analogue on the site.

Panel **A** of the options board shows 24 / 16 / 12 / 12-with-edge on the same
content. The fourth is the clearest at a glance; the second is the smallest
change that fixes the reading card.

_Note, not a finding:_ the ~60px of empty surface at the bottom of the tide and
wave cards is **already argued and accepted** (`ReadingCard`'s `h-full flex-col`,
recorded in the 2026-08-24 review). It is not raised again — but it is why the
radius reads so loudly here, because the empty part of the card is exactly the
part with nothing in it but corners.

### 2. Every glyph on real data is 10px; the only big glyphs on the page are in empty boxes

> Shipped 2026-08-25 in PR #142, by the position this finding proposed. The
> glyph is 30px on the figure's row and costs no height at all — better than the
> 8px this predicted, because a 30px glyph fits inside the 36px figure line.

**(note 2 — "I liked the large emojis better")**

Measured, every `aria-hidden` glyph inside `<main>`:

| Where                                    | Count | Size     |
| ---------------------------------------- | ----- | -------- |
| Reading card headings (🌊 🏄 🌡️)         | 3     | **10px** |
| Week grid `<dt>` labels (🌊 🌅 × 7 days) | 14    | **10px** |
| Reserved forecast slots (🏄 🌡️ 🏖️)       | 3     | 24px     |
| Reserved map slot (🗺️)                   | 1     | **48px** |

Seventeen glyphs marking live measurements at the smallest size in the system;
four glyphs marking things that do not exist yet at up to five times that. At
10px a full-colour emoji is not a mark, it is a coloured smudge in front of an
otherwise crisp uppercase eyebrow — visible in
[`screenshots/review2-nowband-crop-1280.png`](.design/conditions-page/screenshots/review2-nowband-crop-1280.png),
where 🌡️ reads as a pink tick and 🏄 as an orange blur.

**This is a reversal of finding 9 in the 2026-08-24 review, and the reversal is
sound.** That finding was right that the 34px glyph on its own line cost 46px per
card against a 639px screen, and shipping it recovered real height. But it moved
the glyph into a 10px heading, which does not just shrink the glyph — it deletes
it, and it closed the page's only sanctioned outlet for colour (see finding 4).

_Fix that honours both:_ put the glyph **beside the lead figure**, not above the
heading. The figure line is already 36px tall (`--text-stat`), so a 40–44px glyph
sharing that row costs **zero** additional height — the constraint that shrank it
does not apply to this position. Panel **B** of the options board shows it.
[`ReadingCard.tsx:94–105`](src/components/ReadingCard.tsx#L94-L105) is the only
file that changes.

Note this breaks [`ReadingCard.test.tsx:146–150`](src/components/ReadingCard.test.tsx#L146-L150),
which asserts the glyph is inside the heading. That is the test doing its job —
it is asserting the decision being changed, so it gets rewritten in the same
commit.

### 3. 🐚 and 💨 cannot sit on the mist card as-is — an ocean chip is what makes the swap possible

> **Superseded 2026-08-25 by PR #142. Do not follow the _Fix:_ below.** The
> vocabulary shipped — 🐚 tide, 🏄 waves, 💨 air — but the ocean chip was built,
> reviewed and rejected: a badge behind each glyph read as decoration applied to
> the card rather than as part of it, and it cost 8px per card. The card itself
> went `bg-dark` instead, which carries the pale glyphs for nothing and fixes
> finding 1's cause as a side effect. The chip table below is still a correct
> measurement of glyphs on backings; it is the conclusion drawn from it that was
> wrong. See ADR-0015, which is the maintained record.

**(note 3 — "tide should be a shell and air should be the wind; adjust
background if necessary")**

The brief rejected 🐚 on two grounds
([`DESIGN_BRIEF.md`, Experience Principles 3](.design/conditions-page/DESIGN_BRIEF.md)).
Both were checked:

**(a) "It renders pale lavender on a pale lavender surface." Confirmed, and it is
worse at 44px than it was at 34px** — a bigger glyph shows more of the wash. See
row 1 of [`screenshots/review2-glyph-matrix.png`](.design/conditions-page/screenshots/review2-glyph-matrix.png):
🐚 is a grey-lavender spiral, effectively invisible on cream, mist, lavender and
white.

**(b) "The animal vocabulary is reserved for sightings." This one is softer than
recorded.** #121's roster is 🐙 🦀 🪸 🐌 ⭐ 🦭 🦈 🦞 🪼 🐢 — **🐚 is not in it**, and a
shell is not an animal a naturalist logs. The "one glyph, one meaning" rule is
not actually violated. What _is_ violated today: 🌊 currently means three things
across this site — the tide card
([`TideToday.tsx:71`](src/components/TideToday.tsx#L71)), the Tidepools program
([`ProgramCards.tsx:5`](src/components/ProgramCards.tsx#L5)) and the tidepools
interest checkbox ([`InterestListForm.tsx:7`](src/components/InterestListForm.tsx#L7)).
Moving tide to 🐚 **reduces** glyph collision rather than creating it.

**(c) The wind glyph must be faceless.** 🌬️ is a blue face and is out. The
faceless candidates were rendered at 44px bare on mist and at 34px on six chips —
[`screenshots/review2-wind-glyphs.png`](.design/conditions-page/screenshots/review2-wind-glyphs.png):

| Candidate     | Bare on mist                            | Reads as    | Verdict                                        |
| ------------- | --------------------------------------- | ----------- | ---------------------------------------------- |
| 💨 dash       | **fails** — white puff on pale lavender | wind        | **the one**, with a chip                       |
| 🍃 leaf       | strong                                  | a plant     | wrong subject, and green is not in the palette |
| 🌀 cyclone    | strong                                  | a hurricane | overstates a 3 mph breeze                      |
| 🪁 kite       | strong                                  | a toy       | leisure object, same defect as 🏖️ in finding 6 |
| 🎐 wind chime | weak                                    | a furin     | wrong subject                                  |
| 🌪️ tornado    | weak                                    | a hazard    | reads as a funnel/cone at 44px; overstates     |

**💨 is the only faceless glyph that actually means moving air**, and it is the
one that cannot survive on the mist card unaided. So the chip is not optional
here — it is what makes the swap possible.

**The decided set is 🐚 tide · 🏄 waves · 💨 air.** The surfer stays — that is a
call taken, not a compromise, and it turns out to be the cheaper of the two
options in three separate ways:

- `WavesToday` and the reserved wave-forecast row
  ([`WeekPanel.tsx:44`](src/components/WeekPanel.tsx#L44)) both already carry 🏄
  for the same product, so **the wave card needs no change at all**.
- The 🌊 collision resolves anyway: with tide on 🐚, 🌊 leaves the conditions page
  entirely and is left meaning one thing site-wide — Tidepools, at
  [`ProgramCards.tsx:5`](src/components/ProgramCards.tsx#L5) and
  [`InterestListForm.tsx:7`](src/components/InterestListForm.tsx#L7).
- It reopens `bg-ocean` as a chip colour (below).

**The background adjustment you asked about is the glyph's chip, not the card**,
and the set decides the colour. Rendered on all three cards together —
[`screenshots/review2-glyph-set-surfer.png`](.design/conditions-page/screenshots/review2-glyph-set-surfer.png):

| Chip                   | 🐚 tide | 🏄 waves | 💨 air                   | Set verdict                                    |
| ---------------------- | ------- | -------- | ------------------------ | ---------------------------------------------- |
| **`bg-ocean`** #1a4e8a | strong  | strong   | strong                   | **carries the set, and is already the accent** |
| `bg-dark` #1a1a2e      | strong  | strong   | strong                   | carries the set; highest contrast              |
| `bg-yellow` #e8ff00    | strong  | strong   | washed (white on yellow) | loudest, air is the weak one                   |
| `bg-purple` #6b5faa    | weakest | strong   | strong                   | the shell goes pale on it                      |
| none (bare on mist)    | fails   | strong   | fails                    | two of three invisible                         |

_Fix:_ a 56px `rounded-thumb` chip in **`bg-ocean`** behind each glyph, identical
on all three cards.

This reverses what I said an hour ago, and the reason is exactly the surfer.
Ocean failed the last round on one cell only — 🌊 on ocean is blue on blue. With
🏄 on the wave card that cell is gone, and ocean becomes the better answer than
dark, because `text-ocean` is already this page's accent: the chip then reads as
the same system as the eyebrow above it rather than as a foreign black block.
`bg-dark` remains correct and is the higher-contrast fallback if the ocean chip
sits too close to the eyebrow blue in place.

Either way this introduces no new colour to the site, and being the page's only
saturated element, three chips anchor a layout that is otherwise entirely pale
(finding 4).

Call sites — **two files, not three**:
[`TideToday.tsx:71`](src/components/TideToday.tsx#L71) 🌊 → 🐚 and
[`WindToday.tsx:270`](src/components/WindToday.tsx#L270) 🌡️ → 💨, plus the matching
week rows at [`TideWeek.tsx:34`](src/components/TideWeek.tsx#L34) (whose comment
arguing 🌊-over-🐚 needs rewriting, not deleting) and
[`WeekPanel.tsx:50`](src/components/WeekPanel.tsx#L50).
[`WavesToday.tsx:54`](src/components/WavesToday.tsx#L54) is untouched.

---

## Should Fix

### 4. The page renders in three background tones and two of the brand's colours never appear

> Partly answered 2026-08-25 by PR #142: the three reading cards are `bg-dark`
> and their eyebrows `text-yellow`, which is the first brand colour to reach
> this page. The measurement below describes the page before that. Everything
> outside the now-band — the week grid, the reserved slots, the notes — is
> unchanged and the finding stands for it.

**(note: "more fun")**

Counted on the rendered DOM inside `<main>`:

- **Painted backgrounds: three.** `rgb(240,235,248)` mist ×10 (3 cards + 7 day
  cells), `white/60` ×4 (the dashed slots), white ×1 (the beach selector).
- **Colour utilities: eight**, all pale — listed in the Summary.
- **`bg-yellow`, `bg-purple`, `text-purple`, `text-pink`: zero.**
- The only saturated colour on the page is `text-ocean`, and it is at 10–13px.

The brief opens by naming this exact problem — _"the page does not look like the
site it belongs to… every other surface here is loud"_ — and the rebuild fixed
the _structure_ without fixing the _palette_. `ProgramCards` two clicks away is
saturated purple with white type and yellow pills; this page is grey on cream
with blue captions.

**ADR-0009 does not block this, and it is worth being precise about why.** The
ADR forbids the site making _a judgement about whether conditions are good_ —
"excludes the thing a surf report leads with, a judgement." `ReadingCard`'s
docstring extends that to "a card that looked like a verdict would be making one
in CSS," which is a fair inference and still leaves colour available: what makes
colour a verdict is **differential** colour (green card = good, red card = bad).
Colour applied **identically to all three cards** asserts nothing about
conditions. The docstring's own resolution was _"the colour goes into the glyph
and the eyebrow"_ — and then the glyph shrank to 10px, which closed that valve.
Finding 2 reopens it.

_Fix:_ finding 3's chip is the cheapest 80% — three saturated 56px blocks across
the band, identical on all three cards, zero verdict. Beyond that, the highest-
value single addition is a yellow or ocean surface behind the **week grid's
header row or today marker**, which is the page's other natural accent.

### 5. The week cells are ragged, and most of it is fixable without touching the structure

**(note 4 — "the week forecast cards seem too compressed")**

At 1280 each cell is 159×148 with 32px of horizontal padding, leaving a 127px
content box for a 10px letterspaced uppercase label plus its value. Two
consequences, both visible in
[`screenshots/review2-weekgrid-crop-desktop-1280.png`](.design/conditions-page/screenshots/review2-weekgrid-crop-desktop-1280.png):

- **Thursday's daylight value wraps** ("6:20 AM to 7:20 / PM") while the other
  six do not, so one cell in seven is a line taller than its neighbours.
- **The today cell's header wraps** ("TODAY · TUE, / AUG 25") while the other six
  are one line, so the marked cell is visibly out of rhythm with the row it is
  meant to sit in.

_Fix (low risk, no structural change):_

1. Break the daylight value onto two lines **deliberately** — `6:20 AM` over
   `to 7:21 PM` — so all seven cells are identical instead of six-and-a-wrap.
2. Shorten the today header to `Today · Tue 25`, or drop the date from it
   entirely since the border and the word already mark it.
3. `px-4` → `px-3` on the cell, recovering 8px of content width.

Combined with finding 1's radius and border change, that is the whole of "looks
compressed and tacky" addressed without reopening any recorded decision.

### 6. 🏖️ still marks a rip-current product with a leisure glyph

Carried over from the 2026-08-24 review (finding 12), still open at
[`WeekPanel.tsx:56`](src/components/WeekPanel.tsx#L56). The surf zone forecast is
about rip current risk and its glyph is a beach parasol. If the glyph vocabulary
is being reopened for finding 3 anyway, this is the cheapest moment to fix it.

---

## Could Improve

### 7. The week could be a real matrix — but this contradicts a recorded decision

The structural version of finding 5. Today each of the seven cells prints both
row labels, so "LOWEST TIDE" and "DAYLIGHT" are rendered **fourteen times** and
the labels consume roughly half of every cell's width. A matrix — label once down
the left, days as column headers — gives every value the full cell. Panel **C** of
the options board shows both.

**The catch is real.** `WeekGrid`'s docstring, and the 2026-08-24 review's
"already considered" list, argue the repeated labels deliberately: below `lg` a
day is a row, there is no side to print a label down, and the DOM is day-major at
every width so no hidden second copy can drift (`ADR-0005`). A matrix at `lg`
only means either invoking ADR-0005's render-twice allowance, or a CSS-grid
transpose that reparents visually — both of which are more than a polish change.

_Recommendation:_ do finding 5 now; treat this as a separate decision with its own
justification if finding 5 does not go far enough. It should not ride along
inside a polish PR.

### 8. Nineteen percent of the page's height is dashed placeholder

The reserved forecast band is 166px and the map slot is 223px — **389px of the
page's 2019px scroll height**, and they hold the only large glyphs on it
(finding 2). This is already much better than the 503px the last review measured,
and the density variant that fixed it was the right call. Flagged only because
"the page looks unfinished" and "the cards look tacky" are easy to confuse, and
four dashed boxes carrying the page's biggest marks contribute to the first.

---

## What Works Well

- **The lead figures still carry the page.** 2:49 AM, 2.0 ft, 78°F at
  `--text-stat` in italic 900, landing on one baseline across the band. Nothing
  in these notes should touch them.
- **The now-band's anatomy is now consistent across all three cards.** The
  2026-08-24 review's finding 7 — the air card skipping its plain-words line —
  has shipped: "Warm, with barely any wind." now sits where "about knee to thigh
  high" does. The three cards read as one component again.
- **Both Must-Fixes from the last round are closed.** `DISCLOSURE_TARGET`
  composes `TOUCH_TARGET` at [`disclosure.ts:38`](src/components/disclosure.ts#L38),
  and the map slot's detail is in the future tense.
- **Contrast still holds where it is claimed to.** fog-on-mist 5.04:1,
  ocean-on-mist 7.18:1, dark-on-mist 14.58:1. Nothing proposed here weakens it;
  a `bg-dark` or `bg-yellow` chip is decoration behind a glyph, carrying no text.
- **The transpose still works.** Seven columns at `lg`, seven rows at 375, one
  DOM, no scroll container, no horizontal overflow at 375, 768, 1280 or 1536.
- **Nothing reads as a verdict.** Still true, and finding 4 is careful to keep it
  true — uniform colour on all three cards asserts nothing about the water.

---

## What I Did Not Do

- **No code was changed.** This is a review; every fix above is a proposal.
- **Did not run `npm run gate`.** Nothing was edited, so there is nothing to
  verify. The gate is the next PR's job.
- **Did not re-audit the accessibility, typography or dark-mode checklists** —
  the 2026-08-24 sweep covered them and nothing on this branch since has touched
  those surfaces. This review is scoped to the four notes plus what they exposed.
- **The waves glyph was raised and settled.** I flagged 🏄 as a human figure in an
  otherwise environmental set and suggested 🌊; the surfer stays, by your call.
  Finding 3 is written to the decided set and notes what it saves.

---

## Addendum, 2026-08-25 — what PR #142 shipped, and what it changed here

Written while the work is in flight, per `CLAUDE.md`. The findings above are a
dated record of the page as it was and are not rewritten; this says what
happened to each of them. When the remaining work merges, this file gets the
historical note that `docs/plans/README.md` describes and stops being amended.

| Finding                                   | Status                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1 · Radius by token name                  | **Half done.** Reading card resolved by its new surface, not by a radius change. Week cell untouched. |
| 2 · Every live glyph is 10px              | **Done.** 30px on the figure's row, at no height cost.                                                |
| 3 · 🐚 and 💨 need a backing              | **Done differently.** Vocabulary shipped; the ocean chip was rejected.                                |
| 4 · Three pale tones, no brand colour     | **Partly done.** Now-band only.                                                                       |
| 5 · Ragged week cells                     | Open.                                                                                                 |
| 6 · 🏖️ on a rip-current product           | Open.                                                                                                 |
| 7 · Week as a matrix                      | Open, and still needs a decision before it can be worked.                                             |
| 8 · 19% of the page is dashed placeholder | Open.                                                                                                 |

### The two things this review got wrong

**The chip.** Finding 3 concluded that because 🐚 and 💨 are pale, the _glyph_
needed a saturated backing, and specified a 44px `bg-ocean` chip. That was
built and rejected on sight: it reads as a badge stuck onto the card. The
premise was right and the conclusion was one level too low — what needed to be
dark was the card, not a shape behind the glyph. Darkening the card also
removed finding 1's cause on the same element, which the chip did not.

The general shape of the error is worth keeping: the review measured a glyph
against seven backgrounds and then proposed the smallest object that could hold
one of those backgrounds, rather than asking which existing surface should hold
it.

**The height.** Finding 2 predicted a chip beside the figure would cost 8px per
card, and it did. What shipped costs **0** — a 30px glyph fits inside the 36px
figure line, so the row never grows. Cards measure 283px at 1536×639 and 301px
at 1280, which are the heights they had before this branch. The fold concern
raised against the chip does not apply to what merged.

### What is now true of the page, measured after the merge

- The three reading cards are `bg-dark` `#1a1a2e`. Text on them: figures and
  stat values `text-white` (17.06:1), eyebrow `text-yellow` (15.22:1), prose
  `text-white/75` (10.02:1), provenance and stat labels `text-white/55`
  (5.96:1). The two secondary roles are named in `src/components/cardText.ts`.
- The now-band's glyphs are 🐚 🏄 💨 at 30px, bare, on the figure's row.
- **The week grid is unchanged**: seven `bg-mist` cells at 1.10:1 against the
  page, 159 × 148 at 1280, `rounded-card` 24px, labels repeated fourteen times,
  one cell wrapping where six do not.
- So the page now has a dark band above a pale grid. ADR-0015 left that
  deliberately — "now" and "planning" as different registers — and names itself
  as the decision to convert against if it reads as an oversight instead. That
  is the open question in front of finding 5.
