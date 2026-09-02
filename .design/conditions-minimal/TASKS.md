# Build Tasks: Conditions, compressed

Generated from: `.design/conditions-minimal/DESIGN_BRIEF.md`
Date: 2026-09-02

## How this list is grouped, and why not the usual way

The `brief-to-tasks` template groups work as Foundation → Core UI → Interactions
→ Polish. **`CLAUDE.md` forbids that grouping**, in terms:

> Slices are **vertical**: each cuts a complete path through every layer rather
> than delivering one layer across the whole feature. A slice that delivers only
> a schema, or only a UI, cannot be demonstrated or verified except by the slice
> that finally uses it.

So the list below is grouped by **pull request**, and every slice inside one is
a complete path a reader can see. There is no "add the token" slice separate
from the slice that uses it, and no "accessibility pass" slice — the 44px floor
and the focus ring ship inside the slice that creates the control that needs
them.

Three PRs rather than the two the brief guessed. The boundaries are dependency
boundaries, and each PR is comfortably inside the ~400-line / ~5-slice
reviewability guide.

**Every slice below**: own branch off current `main`, own commit, gates green at
that commit, test in the same commit. Standard full-lane rules apply — none of
them are restated per slice.

---

## Decision surfaced during the code trace — please confirm

**The measured cards leave the day panel entirely.**

Pain point 3 points at a screenshot containing the rip block _and_ the
waves/water + air cards, and asks for that info "compressed and displayed at the
top". That is a move, not a copy. The grill settled that the **rip block stays**
in the day panel (Q2) but said nothing about the measured cards, so this is the
gap.

The reading taken here: **`MeasuredToday`'s live cards move to the strip and do
not stay below.** Two consequences follow, and the second is the one to check:

1. On today, the day panel no longer carries a measured block. Nothing is lost —
   the same readings are at the top of the page, larger and sooner.
2. On the other six days, the day panel currently shows a sentence saying
   nothing has been measured about a day that has not happened. **That sentence
   goes too.** It exists because the block used to sit in a position where its
   absence would read as an outage; once no measured block lives in the day panel
   at all, there is no gap to explain, and the strip is labelled as the present.

This is not a silent failure — no feed is being hidden. A future day having no
measurement is a logical fact, not an outage, and the seven conditional week
notes still report every real outage.

**If you would rather keep the absence sentence, say so before Slice 3** — it is
one line in `ChosenDay` and cheap to keep, but it is text you said you wanted
less of.

---

## PR 1 — The page opens on the readings

Five slices. The top of the page, in reading order. Sequential: slices 1, 3 and 5
all edit `ConditionsSection`'s header block, so working them in order avoids
conflicts inside one file.

> **Ordering note, 2026-09-02, during implementation.** The hero trim and the
> heading rank were originally listed the other way round. Swapped before the
> first commit: the heading rank's docstring argues its size is legible against
> the conditions `<h1>`, citing that `<h1>`'s numbers. Written first, it would
> have cited numbers that were not true until the next commit — a measured claim
> false at its own commit, which is exactly the drift this repo's docstrings are
> written to avoid. The two slices are otherwise independent.

- [ ] **Slice 1 — Cut the conditions hero to a title and the notice.**
      Remove the eyebrow (`Surf · Tide · Wind · Visibility`) and the lead
      paragraph. Drop the `<h1>` from `text-title` to roughly
      `clamp(24px, 3vw, 36px)`. Tighten the ADR-0009 notice to one line, keeping
      both its claims: these are instrument readings, not a safety assessment;
      lifeguards and posted signs are the authority.
      **Done looks like**: the beach selector is visibly higher on a 639px
      window; the notice is still plainly readable above the selector.
      **Test**: both halves of the ADR-0009 notice are still present — this is
      the regression test that stops a later "tighten" from deleting the
      liability half. Assert the eyebrow and lead copy are gone.
      _Modifies: `ConditionsSection`._
      _The `<h1>` size is a local class, not a token change — nothing else on the
      site uses `text-title` at this rank._

- [ ] **Slice 2 — Quieten the conditions region headings.**
      Add a second heading rank beside `REGION_HEADING` in
      `src/components/ui/headingRank.ts` — roughly `clamp(17px, 1.6vw, 22px)`,
      same black italic — and use it for the three conditions `<h2>`s
      (`WeekGrid`, `ChosenDay`, `ConditionsNotes`).
      **Done looks like**: the three region headings render smaller; `/art` and
      `/coop` are pixel-identical.
      **Test**: each of the three components refers to the new rank, and
      `REGION_HEADING`'s own value is unchanged so `/art` and `SessionSchedule`
      cannot move.
      _Modifies: `headingRank.ts`, `globals.css`, `built-css.mjs`, `WeekGrid`,
      `ChosenDay`, `ConditionsNotes`._
      _ADR-0014 still holds — region headings outrank card headings, just
      quieter._
      _The new `--text-tool-region` token needs a `REQUIRED` row in
      `scripts/built-css.mjs`: without it, deleting the token would leave
      `text-tool-region` in the markup compiling to nothing, with every jsdom
      test still green. This is the same guard `min-h-footer` already carries._

> **Addendum, 2026-09-02, during implementation.** What was one slice here is
> now two. Moving the readings and restyling them into a band cannot be
> described without an "and", and the reason is in the code: `MeasuredToday` is
> 502 lines against a 983-line test file, every branch of it reasoned about in
> its own docstring. Rewriting its presentation in the same commit that moves it
> would put a large refactor and a structural move in one diff, where a
> regression in either reads as a regression in the other. The move deletes the
> absence branch and nothing else; the band is presentation only. Slices 4 and 5
> below are renumbered accordingly.

- [ ] **Slice 3 — Move the live readings to the top of the page.**
      Render `MeasuredPanel` from `ConditionsSection`, in its own Suspense
      boundary, **outside `SelectedDayProvider`**. Remove it from `DayPanel` and
      drop `DayView.measured` from `ChosenDay`. Presentation unchanged — this
      slice moves the block, it does not restyle it.
      **Done looks like**: the live readings are above the week grid; picking
      Thursday does not change them.
      **Test**: (a) `ConditionsSection` renders the readings above the week
      region; (b) **changing the selected day leaves them untouched** — the seam
      that catches "frozen to now" being broken later; (c) `ChosenDay` no longer
      renders a measured block on any of the seven days.
      _Modifies: `ConditionsSection`, `ChosenDay`, `DayPanel`, `MeasuredToday`._
      _Deletes: `MeasuredToday`'s `readings === null` branch and its `when` prop,
      with the tests that cover them. Once the day panel stops rendering the
      block, nothing can reach that branch — and `CLAUDE.md` forbids leaving it
      as dead code for a caller that no longer exists._

> **Addendum, 2026-09-02, after slice 3 shipped. Slice 4 as written below is
> blocked, and must not be built as described.** `MeasuredToday`'s docstring
> settles it: _"Two cards, not one, and that is ADR-0010 rather than a layout
> preference. The buoy and the air station are two provenances, which that
> decision permits behind one *panel* and refuses behind one *sentence*... merging
> them would produce exactly the sentence ADR-0010 forbids."_
>
> A second constraint sits under it. `CARD_PROSE` and `CARD_MUTED` are measured
> against `bg-dark` and against nothing else -- white at 55% on the page's cream
> ground is 1.03:1, a bug already fixed once in three places. Any band that is
> not itself dark takes those two colours out of the surface they were measured
> on.
>
> Three ways forward, for the designer to pick:
>
> 1. **Drop it.** The two cards are already the brief's "one loud thing", and
>    slices 1-3 delivered the compression by other means. Measured cost: the pair
>    is 223px.
> 2. **Compress inside the two-card structure.** Each card keeps its own
>    sentence, its own lead figure and its own provenance line -- which is all
>    ADR-0010 actually requires -- and the height comes out of padding and row
>    count instead. No ADR is engaged.
> 3. **One dark band holding two attributed groups.** Satisfies both constraints
>    on a literal reading (two sentences, two provenances, still `bg-dark`), but
>    it reads against the docstring's intent and would need ADR-0010 amended
>    rather than merely cited. Saves only the gap and one set of padding.
>
> Option 2 is the recommendation: it is the only one that recovers height without
> touching a decision.

- [ ] **Slice 4 — Compress the two reading cards into one band.**
      Two `rounded-card bg-dark` cards side by side become one dark band with a
      yellow `RIGHT NOW · <beach>` eyebrow: one surface, one set of padding, the
      two readings as groups inside it rather than as separate sections.
      Presentation only — every state branch and every wording helper stays
      exactly as it is.
      **Done looks like**: the same figures in materially less height, and the
      band is the one loud thing the brief asks for.
      **Test**: the existing `MeasuredToday` assertions pass unchanged. Any that
      break should break because a figure moved, not because a wrapper did — if
      a wording assertion fails here, the slice has overreached.
      **Depends on**: Slice 3.
      _Modifies: `MeasuredToday` (presentation), `ReadingCard` if the band needs
      a surface-less variant. Reuses: `StatGroup`, `ProvenanceLine`, ADR-0015's
      glyphs._
      _This is the aesthetic-direction slice: the brief's "one loud thing". Get
      the strip's look agreed here, because everything after it is quiet by
      contrast._

- [ ] **Slice 5 — Add today's rip current level to the strip.**
      Read the surf zone at page level, find today's `SurfZoneDay` by
      `localDate`, and print its `level` word in the strip. No gloss, no surf or
      water ranges, no period name — those stay in the day panel's full block,
      which is untouched.
      **Done looks like**: the strip reads e.g. `RIP CURRENT RISK · Low`; the day
      panel still shows the full block on all seven days.
      **Test**: (a) every non-`forecast` state — unavailable, no bulletin,
      sheltered beach — renders something honest rather than a blank or a
      guess; (b) a bulletin that does not reach today renders the absence rather
      than silently borrowing another day's level; (c) **no severity colour** —
      assert the level's classes do not vary by level, per ADR-0015.
      **Depends on**: Slice 4.
      _Modifies: the band, `ConditionsSection`. Reuses: `readSurfZone`._
      _Costs no extra upstream request: `readSurfZone` is a `next.revalidate`
      fetch and `DayPanel` already calls it, so the Data Cache dedupes. **Verify
      this holds at build time** — the brief's fallback is to pass the value down
      from a single read instead._

---

## PR 2 — Changing the day without leaving the chart

Two slices. Independent of PR 1 in principle; sequence after it so `ChosenDay`
is edited once by slice 2 before slice 6 restructures around it.

- [ ] **Slice 6 — Put a day strip above the hourly chart.**
      New `DayStrip` client component: seven day pills in one row, directly above
      `HourChart` inside `ChosenDay`. Calls `useSelectedDay()`, so it and
      `WeekGrid` are one control over one fact — choosing in either moves both.
      Horizontal scroll (`overflow-x-auto`) where seven pills do not fit; **never
      wraps to two lines**.
      **Done looks like**: the day can be changed with the chart on screen, and
      the week grid's highlight follows.
      **Test**: (a) clicking a pill changes the selection inside the provider;
      (b) rendered outside the provider it degrades to today rather than
      throwing, matching `selectedDay.tsx`'s documented no-JS state;
      (c) **the chart's selected tab and selected hour survive a day change** —
      existing behaviour `ChosenDay` documents, and the thing this slice is most
      likely to break; (d) every pill refers to the 44px touch-target standard
      per ADR-0004.
      _New: `DayStrip`. Modifies: `ChosenDay`. Reuses: `SelectedDayProvider`,
      `resolveSelected`, `TOUCH_TARGET`._
      _Focus rings: the scroller must not be `overflow-hidden` — a 2px
      `outline-offset` clips against it. Use `overflow-x-auto` with vertical
      padding._

- [ ] **Slice 7 — Remove the week grid's daylight note, and record why.**
      Delete the single unconditional note pushed at the top of `WeekPanel`'s
      `notes`. **Keep all seven conditional failure notes exactly as they are.**
      Write an ADR superseding that one clause of ADR-0023, carrying the
      three-part argument from the brief: the day view it was waiting for now
      exists, the cards it points at are gone, and the per-cell sunrise/sunset
      header still scopes every figure.
      **Done looks like**: the week grid goes straight from heading to grid on a
      healthy page, and still explains itself on a broken one.
      **Test**: assert the unconditional note is gone **and** that each of the
      seven conditional notes still appears in its own failure state. Commit the
      failure-state half as MUST FAIL first if the gate table supports it — this
      is the regression test that stops the intro removal quietly taking an
      outage message with it.
      _Modifies: `WeekPanel`. New: one ADR._
      _**Re-derive the ADR number** from `docs/adr/` at build time. Do not take
      it from the brief — the highest number moves, and the `adr-numbers` gate
      will fail the run._

---

## PR 3 — The reference text stops occupying the page

Two slices. Independent of both PRs above and of each other.

- [ ] **Slice 8 — Collapse "How to read these numbers".**
      Wrap the whole `ConditionsNotes` region in one `<details>`, closed by
      default, using `DISCLOSURE_TARGET` on the `<summary>`. The `<summary>`
      carries the heading text so the region keeps its landmark; the `<h2>` stays
      for the same reason. The five notes and the nested `Caveats` disclosures
      ship unchanged inside it.
      **Done looks like**: roughly a screen of prose becomes one line, and every
      word is still in the DOM.
      **Test**: the existing `ConditionsNotes` and `Caveats` assertions still
      pass unmodified — they use `getByText`, which resolves inside a closed
      `<details>`. **Do not add a `toBeVisible` assertion**; there are none in
      `src/components/conditions/` today and adding one would break the gate that
      guarantees every caveat reaches a reader.
      _Modifies: `ConditionsNotes`. Reuses: `DISCLOSURE_TARGET`._

- [ ] **Slice 9 — Gather each region's attributions into one `▸ Sources`.**
      New `SourcesDisclosure` wrapping a region's `ProvenanceLine`s in one closed
      `<details>`. Applied to the now-strip, the day panel and the week panel.
      **Done looks like**: each region ends in a single `▸ Sources` line instead
      of two to four 10px attribution lines.
      **Test**: (a) every provenance string still reaches the DOM;
      (b) **ADR-0010's two air provenances stay separately named and separately
      distanced** inside the disclosure — gathering them must not merge them into
      one line, which is the exact failure that ADR forbids.
      _New: `SourcesDisclosure`. Modifies: `NowStrip`, `DayPanel`, `WeekPanel`.
      Reuses: `ProvenanceLine`, `DISCLOSURE_TARGET`._
      _Depends on Slice 4 only for the band's own sources; the day and week
      halves are independent._

---

## Measurement, before any PR claims a result

The brief's height budget is the thing this work is judged on: on a 1536×639
window at 125% scaling, **the beach selector, the now-strip and the first row of
the week grid all above the fold.**

- [ ] **Measure `main` first, then the branch.** Playwright, from the npx cache.
      A before-figure taken after the change is not a before-figure.
- [ ] **Remove `.next/` before believing anything about the built stylesheet.**
      The build cache hides Tailwind source changes.
- [ ] Paste real gate output into every PR body. Not "tests pass".

## Review

- [ ] **Design review**: run `/design-review` against
      `.design/conditions-minimal/DESIGN_BRIEF.md` once PR 1 is merged, so the
      strip's aesthetic is judged before PRs 2 and 3 build around it.
