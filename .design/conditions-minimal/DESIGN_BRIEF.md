# Design Brief: Conditions, compressed

Date: 2026-09-02. Status: agreed in the design-flow grill of the same date.

Supersedes nothing. `.design/conditions-page/DESIGN_BRIEF.md` and
`.design/conditions-day-view/DESIGN_BRIEF.md` are the briefs that built what
this one edits; both are historical and are not amended here.

---

## Problem

A parent opens `/conditions` on a phone or a laptop to answer one question —
_is it worth taking the kids to the water today, and if not today, when?_ — and
the page makes them work for it.

**The answer is buried under an introduction.** Before any number there is an
eyebrow, a 56px headline, a paragraph explaining what the site is, and a second
paragraph explaining what the readings are not. The reader already clicked
"Conditions"; they know what the page is. What they cannot see without scrolling
is a single measurement.

**The reading they came for is three regions down.** The live surf height, the
water temperature, the air temperature and the rip current risk sit inside the
day panel, below the week grid and below the hourly chart. On the review
machine's 639px-tall window they are off the first screen entirely.

**Changing the day means scrolling away from the thing you are changing.** The
week grid is the only day selector, and it sits above the hourly chart. To see
Thursday's tide curve a reader picks Thursday at the top, scrolls down to the
chart, decides Thursday is wrong, and scrolls back up. The control and its
effect are never on screen together.

**The page ends in a wall of reference prose.** Five multi-sentence notes about
the tide datum, the daylight window, buoy heights, the CDIP model and cloud
cover — correct, carefully written, and read once. They occupy roughly a screen
at the bottom of every visit forever.

The page is honest and it is thorough. It is not fast, and speed is what this
particular reader wants.

## Solution

The page opens with a **now-strip**: one compressed band beside the beach
selector that says what the water and the air are doing at this beach right now,
and what the National Weather Service calls the rip current risk today. It is the
first thing on the page and it is the only loud thing on it.

Everything below it becomes a **planning surface**, deliberately quiet: the week
grid, then a day strip, then the hourly chart for whichever day the strip has
selected. The day strip sits directly above the chart, so the control and its
effect are on screen together and stepping across the week costs no scrolling.

The reference prose does not go away — it collapses. "How to read these numbers"
becomes a single closed disclosure, and each region's source attributions gather
into one `▸ Sources` line. Every word still ships in the DOM, still reaches a
screen reader, still satisfies the gate that asserts caveats reach readers. It
simply stops occupying the page by default.

## Experience Principles

**1. Now above, plan below — and the line between them is visible.**

The strip means _right now at this beach_, always. It does not change when a
reader picks Thursday, because "right now" has no Thursday. Everything beneath
the beach selector is about a chosen day. The day strip is the seam: above it,
the present; below it, whichever day you asked for.

This resolves the tension the current page has never resolved — `MeasuredToday`
is today-only and `SurfZone` is per-day, and today they are stacked together as
though they were the same kind of fact. Separating them by position is what makes
each one honest without a sentence explaining it.

**2. Compressed, not hidden.**

Every removal on this page is one of three things: a duplicate deleted, a
sentence whose justification has expired, or a disclosure that keeps the content
in the DOM. Nothing else is cut.

Two categories are never collapsed, at any density: **a note that reports a
failure** (a feed that went quiet, a station that could not be reached) and **a
qualification that changes what a visible figure means**. The seven conditional
week notes stay exactly as they are. The ADR-0009 safety notice stays visible.

**3. One loud thing.**

The page has exactly one expressive surface, and it is the now-strip: the dark
saturated card ADR-0015 established, the yellow eyebrow, the glyph vocabulary,
the large italic figures. Everything else is small, quiet and utilitarian.

Personality by concentration rather than distribution. The current page spreads
its character thinly — an italic heading here, an accent there — which is a large
part of why trimming it felt like it would leave nothing. Concentrating the voice
in one band means the rest of the page can go as quiet as the reader needs
without the page stopping sounding like this site.

## Aesthetic Direction

- **Philosophy**: Instrument panel. A dark, dense readout band above a pale,
  spacious planning surface. The contrast between the two is the design.
- **Tone**: Calm and factual, with one moment of warmth. Not urgent — this page
  relays measurements and ADR-0009 forbids it forming a safety judgement, so
  nothing may look like an alarm.
- **Reference points**: A tide clock. A marine VHF weather readout. The dark
  reading cards this page already ships.
- **Anti-references**: A surf report with a green/amber/red verdict badge — this
  is forbidden outright by ADR-0015, which holds that a surface here is
  decoration and not a verdict. Also: a dashboard of equal-weight tiles, which is
  what the page becomes if the strip is not clearly louder than everything else.

## Existing Patterns

This design extends the vocabulary already in the repo. It introduces no new
dependency, no new colour and no new radius.

- **Typography**: `--text-2xs` 10px through `--text-base` 13px for body and
  labels; `--text-stat` 36px, `--text-quote` clamp(20–34px), `--text-title`
  clamp(32–56px) for display. Montserrat, black italic for display type.
- **Colors**: `ocean`, `fog`, `dark`, `mist`, `lavender`, `cream`, yellow accent.
  Defined in `src/app/globals.css`.
- **Spacing**: `px-gutter-sm` / `px-gutter`, `py-section-sm` / `py-section`, and
  Tailwind's default scale for everything inside a section.
- **Components reused**: `ReadingCard` and `StatGroup` (the dark card and its
  label/value pairs), `ProvenanceLine` (attribution at 10px), `BeachSelector`,
  `DISCLOSURE_TARGET` (the 44px-floor `<summary>`), `HourChart`, `WeekGrid`,
  `SelectedDayProvider` / `resolveSelected`.
- **Glyphs**: ADR-0015's vocabulary, unchanged — 🐚 lowest tide, 🏄 waves and
  water, 💨 air. A glyph marks a panel, never a row inside one.

## Component Inventory

| Component           | Status | Notes                                                                                                          |
| ------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `NowStrip`          | New    | The compressed band. Composes waves + air + today's rip level word. Client-agnostic; rendered from the server. |
| `DayStrip`          | New    | Seven day pills above the chart. Client component; reads and writes `SelectedDayProvider`.                     |
| `SourcesDisclosure` | New    | Wraps a region's `ProvenanceLine`s in one closed `<details>`.                                                  |
| `ConditionsSection` | Modify | New order: title + notice + selector + strip, then week, then day, then collapsed notes.                       |
| `ConditionsNotes`   | Modify | Whole region wrapped in one closed `<details>`.                                                                |
| `WeekPanel`         | Modify | Unconditional daylight note removed. Seven conditional failure notes unchanged.                                |
| `ChosenDay`         | Modify | Renders `DayStrip` above the chart. Heading takes the smaller rank.                                            |
| `DayPanel`          | Modify | Keeps the full rip block and the measured block; also supplies today's rip level to the strip.                 |
| `MeasuredPanel`     | Modify | Read is lifted so both the strip and the day panel can use it. Costs no extra request — see below.             |
| `headingRank.ts`    | Modify | Adds a second, smaller rank for tool-page regions. `REGION_HEADING` itself is untouched.                       |
| `SurfZone`          | Keep   | Unchanged. The day panel keeps the full block on every day.                                                    |
| `ReadingCard`       | Keep   | The strip is built from it rather than replacing it.                                                           |

## Implementation Decisions

**The strip's reads cost nothing extra.** Every upstream call in
`src/lib/upstream.ts` is a `fetch` with `next: { revalidate: N }`, so Next's Data
Cache deduplicates identical requests within a render. Reading the surf zone at
page level for the strip and again in `DayPanel` for the chosen day is one
upstream request, not two. This was measured against the code, not assumed, and
it is the fact the whole "lift the reads" decision rests on — if it stops being
true, the strip must take its values as props from a single read instead.

**The strip is a server render inside its own Suspense boundary.** It follows
the rule the page already holds to: five agencies go quiet independently and none
may hold up another. A slow buoy must not delay the week grid.

**The strip never reads `SelectedDayProvider`.** It is deliberately outside it.
That is what makes "frozen to now" structural rather than a convention someone
can break later by passing the wrong prop.

**The day strip and the week grid share one provider.** `DayStrip` calls
`useSelectedDay()` exactly as `WeekGrid` does, so choosing Thursday in either
control moves both. No second source of truth for which day is showing.

**The heading rank is added, not changed.** A new export beside
`REGION_HEADING`, used only by the three conditions regions. Changing
`REGION_HEADING` itself would silently resize `/art`'s two section headings and
`SessionSchedule`'s, which reaches `/art` and `/coop` — pages that have made no
such complaint. (Checked against the code: the landing page does not use
`REGION_HEADING`, so it is unaffected either way.)

## What was considered and rejected

**The strip follows the chosen day.** Rejected: `MeasuredToday` is today-only, so
on six of seven days the strip would half-empty into "nothing has been measured
yet" — and it sits _above_ the control that changed it, so a reader would watch
the top of the page empty for a reason not visible from where they were looking.

**The day panel drops its rip block when today is showing.** Rejected: the block
would appear and disappear as a reader steps across the week, moving everything
below it. `ChosenDay`'s current order exists specifically to keep the chart still
while the day changes, and this would undo it.

**The full rip block moves to the strip.** Rejected: it is the level, a meaning
sentence, two ranges and a period name. Putting all of it at the top makes the
top tall, which is the opposite of the request. The strip takes the level word;
the day panel keeps the block.

**Shrink `REGION_HEADING` globally.** Rejected: one edit, but it moves four pages
that were designed at the current size.

**Sticky day bar on scroll.** Rejected: most complex option, and on the 639px
review window a pinned bar spends the scarce resource the whole brief is trying
to recover.

**Collapse the sky wording.** Rejected by the designer: it is the publisher's own
prose and the most human block on the page.

**Collapse the safety notice.** Rejected on ADR-0009, which holds that the
standing notice "has to sit around the readings" and cites it as one of three
reasons the tool is native rather than embedded. The notice is shortened, not
hidden.

## The ADR-0023 debt

Removing the week grid's unconditional daylight note contradicts ADR-0023, which
states in terms: _"This sentence is the condition the drop is allowed under.
Removing it while keeping the drop reintroduces exactly the failure ADR-0017
objected to."_

It is removed anyway, and a new ADR records why. The argument is that ADR-0023's
own conditions have since been met:

- ADR-0023 scoped the loss as lasting **"until a day view carries them"**. The
  day view now exists and draws the whole twenty-four hours with night shaded, so
  the overnight extremes it was waiting for are on the page.
- The sentence points at "the cards above". **Those cards are gone**, removed
  with the three-card slab, so the sentence already directs a reader to something
  that is not there.
- The sentence's other job — saying the cell figures are daylight-scoped — is
  done by the `☀ 6:20 AM to 7:20 PM` line that ADR-0023 itself placed in every
  day's header.

The new ADR supersedes that clause of 0023 and nothing else. Its number must be
re-derived at implementation time rather than taken from this file; the
`adr-numbers` gate catches a collision, but guessing wastes a run.

## Key Interactions

**Choosing a beach.** Unchanged. The selector navigates; the whole page re-reads
for the new beach, strip included.

**Choosing a day.** A reader clicks a pill in the day strip or a cell in the week
grid. Both write the same provider. The hourly chart, the sky wording, the rip
block and the measured block all follow. **The now-strip does not move.** The
selected pill and the selected week cell both mark themselves, so the two
controls always agree.

The chart is not keyed on the day, so the tab a reader chose (tide, swell, wind,
air) and the hour they selected both survive stepping across the week. This is
existing behaviour and the day strip must not break it.

**Opening a disclosure.** Native `<details>`. No animation, no JavaScript, works
before hydration and without it. `DISCLOSURE_TARGET` gives every `<summary>` the
44px floor ADR-0004 requires.

**Arriving without JavaScript.** The page shows today: the strip renders, the
week grid renders with today marked, the chart draws today, the disclosures open
and close natively. Only the day strip's selection is inert, which is the state
`selectedDay.tsx` already documents as acceptable and degrades to "you get
today".

## Responsive Behavior

- **Below `md`**: everything stacks. Title, notice, selector, strip full width.
  The strip's figures wrap to two rows rather than shrinking below legibility.
  The day strip scrolls horizontally rather than wrapping — seven pills on one
  line is the point of it.
- **`md` and up**: title and notice share a row with the selector and the strip,
  as the current header does.
- **`xl`**: the week grid reaches seven columns; the chart and shore map sit two
  thirds to one third, as now.

The day strip is a horizontal scroller at every width where seven pills do not
fit. It must never wrap to two lines — a wrapped day strip costs the height the
whole brief is recovering, and it stops reading as a single control.

## Accessibility Requirements

- **Contrast**: 4.5:1 minimum for all text, which is the floor this page already
  holds itself to. The strip is white and white/85 on the dark surface, matching
  `ReadingCard`'s existing measured ratios. Any new pale-on-pale pairing must be
  measured from painted pixels, not from the CSS tree.
- **Touch targets**: 44px floor for every day pill and every `<summary>`, per
  ADR-0004. Pills carry a visible background, so they may take the `md:` opt-out
  that `PillLink` has; summaries do not.
- **Focus**: every pill and summary keeps a visible focus ring. The day strip is
  a horizontal scroller, so its container must not be `overflow-hidden` — a 2px
  `outline-offset` clips against it. Use `overflow-x-auto` with vertical padding
  for the ring.
- **Screen readers**: the day strip is a labelled group of buttons with
  `aria-pressed` (or a tablist, if the chart is treated as its panel — decide at
  build time and be consistent with `WeekGrid`, which is a list of cells and
  should stay one). Collapsing a region must not remove its heading from the
  landmark structure: the `<summary>` carries the heading, so the `<h2>` stays.
- **Reduced motion**: no new motion is introduced, so nothing new to honour.

## Verification seams

Agreed before implementation, per `CLAUDE.md`. All existing seams; no new ones.

1. **`NowStrip` as a pure component** — takes finished readings and a rip level,
   renders markup. Every judgement about what to show is testable without a
   network, exactly as `MeasuredToday` is today.
2. **`DayStrip` against `SelectedDayProvider`** — render inside the provider,
   click a pill, assert the selection changed; render outside it, assert it
   degrades rather than throwing. `selectedDay.test.tsx` already establishes this
   pattern.
3. **`ConditionsSection` order** — assert the strip renders above the week
   region and that it does not re-render on day change. This is the seam that
   catches "frozen to now" being broken later.
4. **`WeekPanel` notes** — assert the unconditional note is gone **and** that
   each of the seven conditional notes still appears in its own failure state.
   This is the regression test for the ADR-0023 change: it must fail first if a
   failure note is removed along with the intro.
5. **Collapsed content still reaches the reader** — the existing
   `Caveats.test.tsx` and `ConditionsNotes.test.tsx` assertions use `getByText`,
   which passes inside a closed `<details>`. Verified: there are no
   `toBeVisible` assertions anywhere in `src/components/conditions/`, so
   collapsing does not fight the gate. Do not add one.
6. **Stylesheet gate** — any utility named in prose but not used by a component
   must stay out of the built CSS, per ADR-0006.

## Height budget

The review machine is 1536×639 at 125% scaling (a 555px working stop). The
target is that on that window, **the beach selector, the now-strip and the first
row of the week grid are all above the fold**. That is the measurement this
brief is judged on, and it must be taken on the branch and against `main` before
any claim is made about it.

## Out of Scope

- **The shore map, the compass readout and the hourly chart's internals.** Not
  touched. The chart gains a control above it and nothing else.
- **The seven conditional week notes.** Their wording, their conditions and their
  order are unchanged.
- **Colour-coding rip current risk.** Forbidden by ADR-0015. Issue #217 —
  whether size and weight are enough emphasis for `High` — stays open and is not
  resolved here.
- **Deep-linking a day in the URL.** `selectedDay.tsx` records why this was
  rejected: `searchParams` makes the route dynamic and forfeits
  `revalidate = 900`. Adding a second day control does not reopen it.
- **The landing page, `/art`, `/coop`.** The new heading rank is additive, so
  none of them move.
- **`BeachSelector`'s own design.** It gains a neighbour, not a redesign.
- **Removing the week grid.** It is a table a reader reads, not merely a
  selector, and it keeps its per-day figures.
