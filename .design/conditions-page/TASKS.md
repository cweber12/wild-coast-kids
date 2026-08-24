# Build Tasks: The Conditions Page

Generated from: `.design/conditions-page/DESIGN_BRIEF.md`
Date: 2026-08-24

IA amended in `.design/wild-coast-kids-landing/INFORMATION_ARCHITECTURE.md`
(closes #78). The sighting map is deferred to PRD #121 and ships as a reserved
slot here.

## How this list is shaped

**Ten slices, three PRs, cut at dependency boundaries** rather than at layer
boundaries. Nine when this file was written; the tenth arrived mid-flight and
the addendum at the foot of this file records what changed and why. Each slice does one nameable thing, leaves the repo working and the
gates passing, and can be reverted or bisected on its own.

**There is no trailing responsive or accessibility phase, on purpose.** Those
are horizontal — one layer smeared across the whole feature — and this repo has
paid for that before: ADR-0004 exists because two design reviews reported the
nav's touch targets and nothing happened either time. Every slice below ships
its own breakpoints, its own `aria`, its own contrast and its own tests. A slice
that needs a follow-up pass to be accessible is not done.

**No `docs/plans/` file, and no issue per slice.** The brief holds the design,
this file holds the slices and the seams, and #121 holds the map. A fourth
document would be a third copy of the same decisions with its own drift. Issues
are skipped for the reason CLAUDE.md gives — these nine are strictly sequential
and touch the same handful of files, so two people could not pick up two of them
without colliding. Both omissions get stated in the PR body rather than left to
look like lapses.

## Test seams

Established seams, reused. Nothing new is invented.

| Layer          | Seam                                                              | Prior art                                    |
| -------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| Composition    | Pure function, clock injected as `nowMs`, returns a settled model | `readTodaysLowestLow` in `lib/conditions.ts` |
| Presentational | Pure component per state, render assertions                       | `TideToday.test.tsx`                         |
| Panel          | Untouched — read, render, nothing to test                         | `TidePanel.tsx`                              |
| Section        | Renders the parts, caveats reach the page                         | `ConditionsSection.test.tsx`                 |
| Data → reader  | Every `unresolved` entry reaches a reader, both directions        | `lib/caveats.test.ts`                        |

**The caveats chain is already asserted end to end and must stay green rather
than be added to.** `caveats.test.ts` binds data files to `inventoryCaveats()`;
`ConditionsSection.test.tsx` binds that to the rendered page. Slice 1 moves
`Caveats` inside a new block, and the second test is what proves nothing was
dropped.

**jsdom applies no stylesheets** (ADR-0001), so no test here asserts a rendered
box, a column count or a pixel. Layout claims are verified by a human at the
review viewport — see _Verification_.

---

## PR A — the reading becomes a card

Establishes the visual direction on one card before three are converted. Slice 2
is the **aesthetic checkpoint**: stop and look before building the rest on top
of it.

- [x] **1. Collect the shared explanation into one block.** New `ConditionsNotes`
      holding what the three panels each repeat — the datum and what a negative
      tide height means, that a buoy measures open-water swell rather than the
      wave at the shore, that visibility is an airport reading and why, and the
      standing sentence that none of this is a safety assessment. `Caveats` moves
      inside it unchanged. Each panel keeps its own attribution sentence and
      sheds only the general prose. **Done when** the explanations render once
      instead of three times and `ConditionsSection.test.tsx`'s caveat assertion
      is still green. _New: `ConditionsNotes`. Modifies: `TideToday`,
      `WavesToday`, `WindToday`, `Caveats`, `ConditionsSection`._
      _Must precede slices 2–4: it is where their shed prose lands._

- [x] **2. The reading card, proven on the tide.** New `ReadingCard` and
      `ProvenanceLine`, adopted by `TideToday` only. **`StatGroup` is not built
      here** — the tide card's secondary content is the height _sentence_, which
      this slice keeps verbatim, so there is nothing for a stat list to hold.
      Building it now would be a component with no consumer, which is the
      speculative flexibility this file bans elsewhere. It lands in slice 3,
      where waves is its first real user. Emoji header
      🌊, lead figure at `--text-stat` (replacing the raw `text-4xl`), the
      plain-language height sentence kept verbatim, and the station line as
      `station · network · distance`. All four tide
      states keep rendering their own sentence — no blanks, no zeros. The glyph
      shipped as 🐚 and was changed to 🌊 at the checkpoint: a shell renders pale
      on mist, and reads as an animal on a page where animal glyphs are about to
      mean sightings (#121).
      **Done when** the tide card matches the brief's anatomy and every existing
      `TideToday` test still passes unmodified. _New: two components. Modifies:
      `TideToday`._ **Aesthetic checkpoint — needs a human look.**

- [x] **3. Waves adopts the card, and brings `StatGroup` with it.** 🏄 header;
      swell period and water temperature
      become labelled stats instead of clauses in a sentence; `heightWords` keeps
      its plain-language line. The buoy attribution becomes a `ProvenanceLine`,
      keeping the distance disclosure past the existing threshold. **Done when**
      period and water temp are readable without reading a sentence, and the
      no-buoy and unavailable states are unchanged. _Modifies: `WavesToday`._

- [x] **4. Air adopts the card, with two provenances made visible.** 🌡️ header;
      **two** `StatGroup`s — wind and gust from the air station, sky and
      visibility from the sky station — each followed by **its own**
      `ProvenanceLine`. Grouping by provenance is the point: ADR-0010 requires a
      reader be able to tell which station supplied which figure, and two
      adjacent sentences in one grey paragraph technically satisfied that while
      practically hiding it. "10 miles or more" stays worded that way; it is a
      ceiling, not a measurement. The two halves still fail independently.
      **Done when** a reader can attribute every figure without reading prose,
      and each half renders alone when the other is missing. _Modifies:
      `WindToday`._

## PR B — the page fills its width

- [x] **5. The chooser moves into the header row.** `BeachSelector` sits beside
      the `<h1>`, right-aligned from `md`, stacked below it under that. Label
      promoted from a whisper to a real one; pill shape kept; `TOUCH_TARGET`
      composed; the `<noscript>` plain-link list preserved exactly, because it is
      the entire control for a reader without JavaScript. **Done when** the
      control is the second thing on the page rather than the fourth, and the
      `noscript` fallback still lists the full inventory. _Modifies:
      `BeachSelector`, `ConditionsSection`._

- [x] **6. The now-band.** The three cards go three-across at `lg`, two at `sm`,
      one below. Prose blocks — the lead paragraph and the notes — keep
      `max-w-130`; only the figures leave it. **Done when** the page uses its
      width and the now-band clears the 555px first screen at the review
      viewport. _Modifies: `ConditionsSection`._ _Depends on: 2, 3, 4, 5._
      **Needs a human look at 1536×639.**

- [x] **7. The sighting map slot.** `ReservedSlot` with 🗺️, naming what lands
      there and pointing at #121. Sized into the layout it will eventually
      occupy, so the space is designed rather than discovered. **Done when** the
      page states what is coming instead of being silent about it. _Reuses:
      `ReservedSlot` unchanged._ _Depends on: 6._

## PR C — the week

- [x] **8. A week of lowest lows, from one widened request.**
      `lib/conditions.ts` gains a read returning one lowest low per day for seven
      days. **This widens the CO-OPS request rather than re-reading data already
      in hand** — the existing call asks for `nowMs − 1 day` to `nowMs + 1 day`,
      a three-day window sized so "today" survives the timezone boundary, and a
      week is not in it. Same endpoint, same parser, same six-hour cache; the
      `endDate` moves out, and the lower bound stays at −1 day for the boundary
      reason it already exists for. **The day read and the week read share that
      one request**, because separate ranges mean separate URLs, which Next will
      not dedupe — the page would then make two NOAA calls where it makes one
      today. Clock injected as `nowMs`; a day the window does not cover is a
      named absence rather than a gap in an array. **Done when** the seven-day
      model is asserted against fixed instants — including the day-boundary case
      the existing tide-day tests already cover — and the page still issues
      exactly one predictions request per beach. No new upstream product, no new
      dependency. _Modifies: `lib/conditions.ts`._

- [x] **9. The week grid.** New `WeekGrid` and `TideWeek`. **Day-major DOM**,
      identical at every width: seven day-columns at `lg`, seven day-rows
      below, switched by `grid-template-columns` alone — so ADR-0005's
      render-twice rule is not invoked. The tide row is live; rows for the
      gridded NWS forecast (#95) and the surf zone forecast are
      `ReservedSlot`s naming what lands there. A product with no forecast is
      **absent, not blank**. **Waves get a reserved row, not no row.** An
      earlier draft of this file said wave observations have no forecast and
      should get no row at all. That was wrong, and only NDBC is
      observation-only: **CDIP's MOP system publishes an hourly wave forecast
      about ten days ahead, at roughly 100 m alongshore spacing**, driven by
      real buoy directional spectra rather than modelled winds. Adopting it is
      its own decision — NetCDF over THREDDS is not a shape this repo parses,
      `waveFlagPrimary == 1` must be filtered at ingest, and CDIP asks to be
      contacted and credited — so this slice reserves the row rather than
      filling it. What it must not do is encode "no wave forecast exists" into
      the layout. **Done when** a reader can find next Tuesday's low tide on a
      phone without horizontal scrolling, and the screen-reader order reads
      day-then-values. _New: `WeekGrid`, `TideWeek`._ _Depends on: 8._

- [x] **10. Daylight, the second live row.** New `lib/daylight.ts` computing
      sunrise and sunset from the beach's own latitude and longitude, and a
      `DaylightWeek` row rendering them beneath the tide. Computed in-repo
      with no API and no dependency, which is what `docs/plans/conditions-tool.md`
      already asks for — "there is no sun API here and there should not be" —
      and `beaches.json` already carries the `lat`/`lon` it needs. The clock
      is injected as `nowMs` and the seven local dates come from the same
      helper the tide row uses, so the two rows cannot disagree about which day
      is Tuesday. Sunrise and sunset are the two instants named and nothing
      else: civil twilight, solar noon and day length are all computable from
      the same math and none of them were asked for. **Done when** the grid
      carries two live rows, the times are asserted against values published by
      an authority rather than against this repo's own output, and a reader can
      see whether the week's lowest low falls in daylight. _New:
      `lib/daylight.ts`, `DaylightWeek`._ _Depends on: 9._

## Verification

Every slice: `npm run gate` green before commit, output pasted in the PR body.
A claim is not evidence.

Three things the gate cannot assert, checked by a human:

- [ ] **The first screen at 1536×639, 125% scaling** — 555px after the nav. The
      now-band must land above the fold. Measure on the base branch too before
      accepting blame for anything.
- [ ] **Contrast on every new surface**, AA — 4.5:1 body, 3:1 large text.
      Checked before shipping a surface, not after.
- [ ] **The aesthetic direction after slice 2**, before three cards are built on
      top of it.

Remove `.next/` before believing anything about the built stylesheet.

## Review

- [ ] **Design review**: run `/design-review` against the brief once PR B has
      merged and there is something to look at.

## Addenda

**2026-08-24 — PR C gained a tenth slice, the daylight row.** Slices 8 and 9
give the week grid one live row and three reserved ones, which is a grid in
name more than in fact. Daylight was raised as a candidate second live row and
adopted at the author's decision, so it is recorded here rather than left to
look like scope that crept. Three things made it cheap enough to say yes to:
it needs no upstream product and no dependency, `beaches.json` already carries
the coordinates, and `docs/plans/conditions-tool.md` had already ruled that
this value is computed in-repo. It is also the row that makes the tide row
mean more than it did — a 6:42 am lowest low in December is before sunrise,
and the tide row alone cannot say so.

The cost is stated too. It is new astronomical math in a repo that had none,
and the honest test for it is published sunrise and sunset times from an
authority, not this repo's own output fed back to itself. That is the same
standard `coops-predictions.ts` already holds itself to, where the fixture's
converted rows are checked against the National Weather Service quoting the
same station.

## Deliberately not here

- The sighting map itself — PRD #121, `needs-human`.
- Gridded NWS forecast rows (#95) and the surf zone forecast. Slice 9 leaves
  labelled slots for them.
- The landing-page teaser's stale reserved-slot copy, which says surf and wind
  are "still to come" after they shipped. Noticed while working here; belongs to
  its own branch, and goes in the PR body rather than the backlog.
- Any computed verdict, rating or colour that encodes a judgement. ADR-0009.
