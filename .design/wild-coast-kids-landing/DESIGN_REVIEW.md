# Design Review: Wild Coast Kids Landing Page

Reviewed against: DESIGN_BRIEF.md
Philosophy: Coastal pop editorial
Date: 2026-08-11
Reviewed at: branch `wild-coast-kids-landing`, commit `2ce3c63`, Next.js dev server

> **Outcome addendum (2026-08-11, same day):** findings 1–3 fixed on the
> branch and re-verified against the running app (`verify-*.png`):
>
> 1. Nav — fixed in two steps (`2f40bb0`, then `90ad232` after measurement
>    showed slimming alone still overflowed 55px): below `md` the nav wraps
>    to two rows, restoring the CTA on phones. Measured zero overflow at
>    375px and 320px.
> 2. Hero slot — fixed in `61d6eab`: the placeholder label now shows over
>    the photo column (`verify-hero-desktop-1280.png`).
> 3. Success jump — fixed in `6d55c5f`: card height measured identical
>    before and after submit (560px → 560px, delta 0).
>
> Findings 4–6 remain open as could-improves.

## Screenshots Captured

| Screenshot                                 | Breakpoint         | Description                                 |
| ------------------------------------------ | ------------------ | ------------------------------------------- |
| `screenshots/review-home-desktop-1280.png` | Desktop (1280×800) | Full page, top to footer                    |
| `screenshots/review-home-tablet-768.png`   | Tablet (768×1024)  | Full page                                   |
| `screenshots/review-home-mobile-375.png`   | Mobile (375×812)   | Full page                                   |
| `screenshots/review-viewport-block-*.png`  | All three          | First window only — the hero+marquee poster |
| `screenshots/review-nav-cta-focus.png`     | Desktop            | Focus ring on the Book Now pill             |
| `screenshots/review-form-filled.png`       | Desktop            | Form with values entered                    |
| `screenshots/review-form-success.png`      | Desktop            | Post-submit success state                   |
| `screenshots/review-card-art-hover.png`    | Desktop            | Art card under hover                        |

> Screenshots live in `.design/wild-coast-kids-landing/screenshots/`. They are
> generated artifacts and stay untracked. The dark "N" badge visible bottom-left
> in some captures is the Next.js dev-tools indicator — dev server only, not a
> finding.

## Summary

The build is faithful to the brief: the desktop poster lands exactly as
specified (hero filling the window, marquee pinned at the fold —
`review-viewport-block-desktop-1280.png`), the film strip reads as a synced
companion to the marquee, and the palette/type carry the coastal-pop voice
unmistakably. Two real findings: the nav clips its CTA at 375px, and the hero's
photo slot is invisible, leaving the right half of the hero reading as empty
purple until real photography arrives.

## Must Fix

1. **Nav overflows at 375px — the primary CTA is clipped.** In
   `review-home-mobile-375.png` the yellow "Book Now →" pill is cut off at the
   right edge (body `overflow-x-hidden` masks it rather than scrolling). The
   four links + logo + pill don't fit at the current paddings.
   _Fix in `src/components/Nav.tsx`: tighten mobile spacing (`px-3`, `gap-2`,
   smaller logo, e.g. `size-10`) and slim the CTA below `md` (`px-3 py-2`,
   or text-only "Book →")._

## Should Fix

2. **The hero photo slot is invisible.** The `background` Placeholder variant
   is a near-transparent gradient, so on desktop and tablet the hero's right
   half reads as blank purple (`review-home-desktop-1280.png`,
   `review-home-tablet-768.png`) — the poster looks half-empty and nothing
   communicates that a photo belongs there. The brief's placeholder principle
   is "labeled placeholders ship".
   _Fix in `src/components/Hero.tsx` / `Placeholder.tsx`: give the hero slot a
   visible treatment while it's a placeholder — e.g. show the label (the
   gradient overlay can stay), or raise the placeholder fill opacity so the
   slot reads as reserved space._

3. **Success card causes a large layout jump.** The success state is much
   shorter than the form it replaces (`review-form-success.png` vs
   `review-form-filled.png`), so the page collapses ~400px on submit while the
   user is looking at it.
   _Fix in `src/components/CommunityForm.tsx`: give the card a `min-h` close
   to the form's rendered height (or center the success state in the same
   min-height) so the swap doesn't move the page._

## Could Improve

4. **Uniform strip tiles.** The template's gallery mixed aspect ratios; the
   film strip flattened them to identical 288×208 tiles. Varying tile widths
   (portrait/landscape rhythm) would make the strip livelier and more
   print-zine. _Suggestion: two or three width variants cycling through the
   list._
5. **Touch target height on nav links.** The 9px uppercase links are ~30px
   tall including padding — below the 44px guideline, though mitigated by
   generous horizontal spacing. _Suggestion: add vertical padding on mobile._
6. **Sub-16px body copy on mobile** (13px) is an accepted template-verbatim
   decision recorded in the brief; inputs were already lifted to 16px in the
   audit slice. Noted here so the acceptance is on the record, not silent.

## What Works Well

- **The poster composition.** The one-window hero+marquee lock is exactly the
  brief's "poster first" principle, at every breakpoint that matters.
- **The synced strips.** Marquee and film strip visibly share one speed; the
  shared `StripTrack` makes the sync structural, not tuned.
- **Aesthetic fidelity.** Italic-900 Montserrat, electric yellow on purple,
  pill buttons, ✦ separators — instantly the template's voice; nothing generic
  crept in.
- **Accessible mechanics.** Focus ring clearly visible on the yellow pill
  (`review-nav-cta-focus.png`), form labels associated, success state
  announced via `role="status"`, strips silent-once to AT, contrast lifted
  above the template where it failed AA.
- **Consistency.** Every section pulls from the same token set — no stray
  hex values or one-off radii anywhere in `src/components/`.

## Checklist Notes

- Hierarchy ✓ (h1 → section h2s in DOM order; biggest type = most important)
- Consistency ✓ (tokens only; shared pill/section/card patterns)
- States: default/hover/focus/success ✓; form error states rely on native
  browser validation (accepted — boundary validates)
- Responsive: mobile-first `md:` min-width throughout ✓; finding #1 above
- Accessibility: landmarks ✓, reduced-motion ✓, contrast ✓ (see audit slice)
- Dark mode: N/A by decision (fixed art-directed palette)
- Typography: Montserrat loading correctly (italics visible in every capture)
