# Nav touch targets

Issue: #18. Supersedes nothing; builds on `docs/adr/0003-nav-in-document-flow.md`.

## Problem, from the user's point of view

On a phone the four nav links are almost impossible to hit. They are 9px
uppercase text with 2px of bottom padding and a 2px border, so the tappable
box is about the height of the text itself — a reader aiming for "Tuesday
Co-op" hits nothing at all, or hits the link above it. The row also runs
edge to edge, so the outer two links sit against the screen bezel, and it is
crowded up against the logo and the Book Now pill with 8px between them.

The Book Now pill has the same defect and matters more, because it is the
one thing the page is asking a visitor to do.

This has survived two design reviews — finding 5 of
`DESIGN_REVIEW-2026-08-11.md` and finding 9 of `DESIGN_REVIEW.md` — because
no gate can see a rendered layout (ADR-0001) and a human had to decide
whether the fix was worth what it costs.

### Correction to the recorded figure

Both reviews record the links as "~30px tall". By arithmetic from the class
list — `text-[9px]` at Montserrat's normal line-height (≈1.22) = 11px, plus
`pb-0.5` = 2px, plus `border-b-2` = 2px — the box is about **15px**. The
anchor is an inline-level box in a flex container with no `items-*`, so
nothing stretches it.

The direction of the error matters. 30px clears WCAG 2.2 AA 2.5.8 (24×24);
15px does not, and the spacing exception cannot rescue it because the pill
sits 8px above. The reviews under-reported a criterion failure as a
guideline miss.

The reviews are dated artifacts and are **not** rewritten. The corrected
figure lives here and in the PR body.

`TODO(verify)`: every dimension in this plan is arithmetic from the class
list and Montserrat's metrics. Nothing was measured in a browser, because
the repo has no browser tooling. Confirm at 375px before the final commit.

## Solution

Below `md`, every interactive element in the nav is at least 44×44. The bar
grows from 90px to 116px to hold them, the mobile gutter comes into line
with the rest of the site, and the links stop hugging the screen edges.

At `md` and above the nav renders exactly as it does today.

## Implementation decisions

- **44 below `md`, 24 at `md` and above.** WCAG 2.5.5 (AAA) / Apple HIG
  where a finger is doing the pointing; WCAG 2.5.8 (AA) where a mouse is.
  Recorded as ADR-0004, because it is the criterion every later target-size
  question gets measured against — starting with `PillLink`. Rejected: 44
  everywhere, which buys nothing on desktop that 24 does not already give
  and would force a visible redesign of an approved layout; and 24
  everywhere, which is the floor rather than the standard on the device
  where this actually goes wrong.

- **The anchor becomes the target; an inner `<span>` keeps the underline.**
  The active and hover indicator is `border-b-2` on the anchor, which is at
  the anchor's box edge by definition — pad the anchor to 44px and the
  yellow rule under the current page drifts ~14px below the text. Moving the
  border to a child keeps the existing idiom
  (`border-transparent` → `border-yellow`) and keeps the rule against the
  text at every size. The anchor takes `group`, the span takes
  `group-hover:` and `group-aria-[current=page]:`, so hovering the new
  padding lights the underline; without that the enlarged target would
  respond only over the glyphs, which reads as broken. Rejected:
  `text-decoration` with `underline-offset`, which works and needs no extra
  node but abandons the border idiom the repo already uses; letting the rule
  fall to the bottom of the 44px box, which is a legitimate tab-bar look but
  is a redesign of the active state nobody asked for; and an
  absolutely-positioned `after:` hit area, which leaves the visuals
  untouched but would overlap the pill's target 8px above — overlapping
  targets are a worse defect than small ones.

- **A shared `TOUCH_TARGET` constant**, `"flex min-h-11 items-center"`,
  composed by both the links and the pill. The failure this repo actually
  suffers is drift: a fifth link or a restyled pill silently shipping
  without the target, exactly as the height offset drifted across six
  modules before ADR-0003. One name means one place to be wrong, and the
  test asserts every interactive child of the nav carries it.

- **The pill takes `md:min-h-0`.** The links have no background, so their
  box growing to 44px at `md` is invisible — the logo already sets that row
  at 52px. The pill is a yellow capsule, so the same class would visibly
  grow it from ~31px to 44px on a desktop layout that was signed off. It
  already clears the 24px floor at 31px, so it takes 44 only below `md`.

- **The mobile gutter goes `px-3` → `px-gutter-sm` (12px → 24px).** Every
  other module in the repo uses `px-gutter-sm md:px-gutter`; the nav's
  hand-rolled `px-3 md:px-8` is the only exception, and the 12px version is
  what puts the outer links against the bezel. Only the mobile half changes:
  bringing `md:px-8` to `md:px-gutter` would move the logo and pill 16px
  inward on an approved layout, and belongs to its own issue.

- **The slack is absorbed into the links, not left as gap.** At 375px a 24px
  gutter leaves 327px for ~286px of text, so ~42px is spare. Spent as
  `px-1.5` on each link with `-mx-1.5` on the container, the labels land
  exactly where they would if it were spent as gap — flush with the 24px
  gutter, ~6px of air between boxes — but the 44px boxes very nearly touch,
  so no tap inside the row falls in a dead zone. Rejected: equal-width
  columns (`flex-1`), which cannot work — 327/4 = 82px and "TUESDAY CO-OP"
  is ~85px.

- **Horizontal padding is reset at `md`** (`md:px-0 md:mx-0`, `md:gap-7`
  unchanged). Keeping it and retuning the gap cannot reproduce today's
  desktop exactly: the padding also adds 6px outside the first and last
  links, so preserving the 28px text spacing widens the group by 12px and
  shifts the outer labels apart under `justify-between`. `md` needs no
  horizontal padding anyway — 44px of height already clears 24×24.

- **`--spacing-nav-sm` 90px → 116px.** `8 + 44 + 12 + 44 + 8`: `py-2`, the
  logo/pill row now set by the 44px pill, `gap-y-3` (up from `gap-y-2`,
  which is the crowding in the issue), the link row, `py-2`. Per ADR-0003
  the hero poster and `scroll-padding-top` subtract the same token, so both
  follow with no module touched. `--spacing-nav` stays 84px: at `md` the
  52px logo still sets the row and `14 + 52 + 14 = 80` is still under it.

- **116px of sticky chrome on a phone is accepted.** It is 17.4% of a
  375×667 screen and costs the poster 26px (577px → 551px, ~4.5%). There is
  no cheaper shape: the 44px pill sets one row, the 44px links set the
  other, and the issue asks for _more_ separation between them, so trimming
  padding claws back 6px against the complaint that started this. Rejected:
  a fixed bottom bar, which occupies no space and so puts back the
  reserve-room-for-the-nav problem ADR-0003 deleted from six modules, costs
  ~7% of every screen instead of 26px once, needs a `scroll-padding-bottom`
  counterpart, and puts app chrome in competition with the page's primary
  action; a hamburger, which hits every target trivially and would shrink
  the bar to ~64px but hides a four-item IA behind a tap on a marketing site
  and brings a stateful disclosure widget — `aria-expanded`, focus
  management, Escape, outside-click, scroll lock — with it; `static md:sticky`,
  which reclaims the reading area but makes Book Now unreachable mid-page on
  the device where reaching it matters most; and shrinking the labels below
  9px, which fixes tapping by making legibility worse.

- **Below ~340px the links wrap to a third row.** Four labels cannot share a
  row at any gutter down there — ~286px of text against 272px — and they
  already spill today, where 286px of text plus 24px of gap exceeds the
  296px available. `flex-wrap` stays, the bar grows to ~160px, and nothing
  clips: every height in this nav is `min-h`, which ADR-0003 chose
  deliberately so the bar could grow under text scaling rather than clip.
  This matters because WCAG 1.4.10 Reflow is an AA criterion at 320px — the
  same level as the target-size floor — and it is also what a reader gets at
  400% zoom on a 1280px screen. The bar exceeding its token there is a known
  and visible degradation, recorded rather than hidden. Rejected: a
  horizontally scrollable row, which keeps the bar exactly its token but
  puts a link off-screen with no affordance — `GalleryRow` needed explicit
  controls for that reason and a nav has no room for them; and a custom
  sub-375px breakpoint, which adds to the design system to move the failure
  point from 340px to 330px.

- No new dependencies. No new components. `NavLink` stays thin — it knows
  about `aria-current` and nothing else.

## Test seams

Per ADR-0001, jsdom applies no stylesheets, so **the gate cannot assert the
property this whole issue is about.** A test that the class list contains
`min-h-11` proves someone typed `min-h-11`. It is worth saying plainly that
this issue exists because class-contract tests did not catch the defect.

- **Every interactive child of the nav carries `TOUCH_TARGET`.** Iterating
  `getAllByRole("link")` rather than asserting a literal per element is what
  makes this more than a tautology: it fails when a link is added or the
  pill is restyled without the target, which is the drift that actually
  happens.
- **The indicator is on the inner span, not the anchor**, so the refactor
  cannot silently regress into padding the underline away from the text.
- **The existing `Nav.test.tsx` contract assertions stay green** — sticky,
  not fixed, `min-h-nav-sm md:min-h-nav`. The refactor commit must not
  disturb them.
- **Outside the gate, needs a human in a browser:** that the targets measure
  44px, that 116px does not spoil the poster at 375px, that `md` really is
  unchanged, and the wrap behaviour at 320px. Inherited from ADR-0001;
  closing it means Playwright, which is its own plan.
- `npm run gate` green at every commit.

## Slices

1. This plan.
2. `docs/adr/0004-touch-target-sizes.md` — 44 on touch, 24 on pointer.
3. Move the nav link's indicator onto an inner span. No visual change; the
   commit exists so the next one's diff is only about targets, and so a
   revert of the token does not drag the refactor with it.
4. Bring the nav's touch targets to 44px below `md`: `TOUCH_TARGET` on the
   links and the pill, gutter to `px-gutter-sm`, slack absorbed as
   `px-1.5`/`-mx-1.5`, `gap-y-3`, `--spacing-nav-sm` 90 → 116.

Strictly ordered. Slice 3 before 4 because 4's padding is what would move
the underline.

## Out of scope

- **`PillLink`'s ~41px.** `text-sm` + `py-3.25` misses the 44px floor across
  eleven call sites, and growing it changes the hero and program-card
  compositions this issue never looked at. Filed separately.
- **The `md` gutter**, `md:px-8` → `md:px-gutter`. A real consistency defect,
  but it moves an approved desktop layout and is not about touch targets.
- **Playwright**, and the geometry gate that would actually verify this.
- **A visible desktop redesign.** `md` and above render identically.
- **The interest-list form's controls**, not audited here.
