# Scope and the measured readings, in one bar across the top

Issue: [#246](https://github.com/cweber12/wild-coast-kids/issues/246).
Started 2026-09-11.

## The problem, from the reader's side

`/conditions` is 2300px tall at a 1536×639 window — 3.6 screens — and the first
of them answers almost nothing. It opens on a three-word headline set in the
largest type on the page, a liability sentence, a dropdown, a wrapped row of
ten beach links, and two paragraphs explaining what the page _cannot_ show. The
week grid, which is the thing the page is for, starts at 459px and the day
panel at 869px, well past the fold.

The page also has no single measure. Regions alternate between full width and a
~520px text column with no rule governing which, so roughly 900px of background
sits empty beside half the content.

## The solution

One toolbar row across the top carrying everything that says _where_ and
_now_: a `Conditions` wordmark, an area select, a **beach** select, the
measured readings, and the rip current level. The readings lose their dark
ground and become an instrument readout on the page's own surface. The
standing notice sits under the bar at body size. The page then opens on the
week.

Measured on the prototype (`prototype-conditions-layout`, variant `d`):

|                    | body   | week grid at | day panel at |
| ------------------ | ------ | ------------ | ------------ |
| before             | 2300px | 459px        | 869px        |
| after              | 2156px | 370px        | 724px        |
| before, beach page | 2518px | 473px        | 905px        |
| after, beach page  | 2424px | 378px        | 810px        |

The day panel still falls past a 639px fold. That is not solved here and is not
claimed to be.

## Implementation decisions

**The wordmark goes to the label register.** `Conditions` in
`text-2xs font-extrabold tracking-widest text-ocean uppercase`, not a smaller
display size. At `--text-tool-region` it would render at exactly the size
`TOOL_REGION_HEADING` gives every region heading, which is the rank collapse
ADR-0014 exists to escape — `headingRank.ts` says it in as many words: "34px
under a 36px title is not a second rank, it is the same one twice."

This inverts _visual_ rank against the document outline: the `<h1>` becomes
smaller than the `<h2>`s beneath it. That is deliberate and is what a toolbar
does — the bar is chrome, and the first display heading on the page is the
first region. The outline is unchanged and nothing is skipped.

**`--text-tool-title` retires with it.** It exists for this one element and
nothing else uses it. The token goes from `globals.css`, its `REQUIRED` row
goes from `scripts/built-css.mjs`, and ADR-0014's postscript and
`headingRank.ts`'s clamp justification are corrected — both quote the 24/36px
figures to argue about a rank that will no longer exist.

**The standing notice stays at body size.** ADR-0009 rejects an embed partly
because "the host page is asserting something it does not control", and that
sentence is the assertion. The prototype rendered it at 10px; shrinking the one
sentence the site owns is not a side effect a layout change gets to have.

**The beach list retires; the select replaces it.** `AreaBeaches` is imported
by nothing else. A `<select>` of ten beaches and a wrapped row of ten links are
the same control twice, and only one of them is reachable without scrolling.
The `noscript` list `AreaSelector` already carries is the pattern the beach
control copies, so the links survive for a reader with no JavaScript.

## Test seams

Prefer the seams that exist. All four already do:

- **`ConditionsSection.test.tsx`** mocks the panels and asserts composition —
  which elements are present, in what order, and what props each panel is
  handed. It is where the bar's contents and the beach list's removal are
  asserted.
- **`MeasuredBand.test.tsx`** asserts the band's own rendering, and is where
  the labels, the rule and the loss of the dark ground land.
- **`scripts/built-css.mjs`** is the only seam that can see a _rendered_ size.
  jsdom applies no stylesheets (ADR-0001), so no test can assert that the
  wordmark is smaller than a region heading; the gate asserts which tokens
  compile, and `headingRank.ts`'s tests assert class reference rather than
  size. Removing the `text-tool-title` row is therefore part of the change, not
  cleanup after it.
- **`AreaSelector.test.tsx`** is the template for `BeachSelector.test.tsx` —
  same control, same `noscript` obligation, same `TOUCH_TARGET` floor.

A human confirms the visible rank. That is already how ADR-0014 is verified.

## Considered and rejected

**Keeping the headline in the display register at a smaller size.** Rejected:
there is no size between `--text-tool-region` (22px) and `--text-tool-title`
(36px) that is not either equal to the regions or back to the headline this
change exists to shrink. Adding a fifth size token to dodge that is a worse
outcome than admitting the title is a wordmark.

**Omitting the title entirely, `sr-only`.** Tested as variant `f`. Rejected:
the bar loses the only thing naming what the controls belong to, and the page's
identity then rests on the nav's active state, which scrolls with the nav.

**Pinning the bar (variant `f`).** Rejected for now. It works — offset by
`top-nav-sm md:top-nav`, since ADR-0003 makes the nav sticky rather than fixed
so a bar at `top-0` slides under it — but it spends its height on every screen
rather than only the first, and on a 639px window that is a standing tax. Worth
revisiting once the day panel's height is addressed.

**A two-tier bar (variant `e`).** Rejected: stacking controls over readings
keeps everything in the left ~660px and leaves the right of a 2.4:1 window
empty, which is the defect this change is meant to remove.

**Folding the readings into the week grid's "today" column (variant `b`).**
Rejected: it made the page _taller_ (2529px against 2300px), because a
full-width band wastes at 1440px what a three-column header row packs
efficiently.

## Out of scope

**The area-scope absences.** On an area page the week and day render "no one
figure for the whole area. Choose a beach for it." That is ADR-0048 — an area
reports only what its beaches share — and no arrangement of the header changes
it. Choosing a beach from the new control does make them disappear, because
beach scope withholds nothing; that is a side effect, not the fix.

**The day panel's height**, and the rip level appearing both in the bar and
again inside `DayPanel`'s surf zone block. Both predate this change and neither
is made worse by it.

## Slices

1. The page title becomes a wordmark.
2. The measured readings lose their ground.
3. A beach is chosen from a control.
4. The header becomes one bar.

Each leaves the page working and the gates green. Slice 4 depends on all three.

## ADRs

- The tool titles itself with a wordmark rather than a headline — qualifies
  ADR-0014, retires `--text-tool-title`.
- The measured readings sit in the page's bar without a ground — supersedes
  ADR-0056 on presentation and placement. ADR-0057's forecast mark is kept
  intact: the glyph stays and its attribution stays with it.
