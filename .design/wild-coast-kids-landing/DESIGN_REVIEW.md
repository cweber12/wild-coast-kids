# Design Review: Landing page section snapping

Reviewed against: DESIGN_BRIEF.md
Philosophy: Coastal pop editorial
Date: 2026-08-13
Reviewed at: branch `section-snapping`, commit `129ddc1` (PR #14), Next.js dev server

> The previous review is preserved at `DESIGN_REVIEW-2026-08-11.md`.

## Screenshots Captured

No browser tooling was available in this session — no Playwright MCP, no
in-app browser — so these were **captured by the user and pasted into the
conversation** rather than written to `screenshots/`. Ten captures, a scroll
from top to bottom and back up, at roughly 1900×866 (≈782px of usable height
after the nav).

| Capture                     | What it shows                                      |
| --------------------------- | -------------------------------------------------- |
| Hero + marquee              | Stop 1, scrolling down                             |
| Gallery                     | Stop 2 — row, native scrollbar, controls below     |
| Program cards               | Stop 3, scrolling down — top-aligned               |
| Conditions                  | Stop 4 — cream band above the ocean surface        |
| Interest list               | Stop 5, scrolling down — form clipped at the fold  |
| Quotes + footer             | Stop 6 — stray line below the nav, right-hand side |
| Interest list (up)          | Stop 5, scrolling up — clipped at the top          |
| Conditions (up), cards (up) | Same stops on the way back                         |
| Gallery (up), hero (up)     | Same stops on the way back                         |

## Summary

The snapping mechanic works — every stop lands where it should, and the
poster, gallery, cards, conditions and closing screens each read as one
composition. What is wrong is almost entirely one bug wearing four hats:
`SnapSection` centres with plain `justify-center` while every child still
carries its own `md:py-section`, so sections that should fit overflow, and
the overflow escapes off the top where nobody can reach it. The gallery row
is a separate, straightforwardly unfinished piece of interaction design.

## Must Fix

1. **Sections overflow off the top when scrolling up.** `md:justify-center`
   in `src/components/SnapSection.tsx` pushes overflow out of both ends of
   the box, and the top end is unreachable inside a snap stop. Affects the
   program cards and the interest list at this window height.
   _Fix: `justify-center-safe` (Tailwind 4.3.3 ships it) — centres when the
   content fits, falls back to start-alignment when it does not, so the top
   of a section is always reachable._

2. **Vertical padding is counted twice, which is what causes the overflow.**
   Each section keeps `md:py-section` (80px top and bottom) inside a box that
   is already sizing and centring it — 160px of dead height per stop. The
   interest list needs ~810px of the ~782px available; without the double
   padding it needs ~650px. This is also the "too much white space at the
   top" in the interest-list capture: that gap is `py-section`, not centring.
   _Fix: drop `md:py-section` from `GallerySection`, `ProgramCards`,
   `Conditions` and `InterestListTeaser`. Mobile keeps `py-section-sm`, since
   there is no snapping below `md` and the padding is doing real work there._

3. **A hairline rules across the window below the nav on the closing screen,
   and the section above bleeds in underneath it.** The line is
   `QuoteStats`'s own `border-t-[1.5px] border-lavender` — the only full-width
   hairline in that part of the DOM. It reads as sitting below the nav
   because stop 6 is `natural` height: quotes plus footer come to roughly
   716px against ~761px of usable space, so the section's top edge lands
   about 45px down, with cream on both sides of it and the tail of the
   interest-list section above.
   _Fix: invert the footer's height into a token the way ADR-0003 did for the
   nav — `--spacing-footer`, `Footer` takes `md:min-h-footer`, and stop 6
   becomes `calc(100dvh − var(--spacing-nav) − var(--spacing-footer))`. The
   footer stays in the shared layout and the screen becomes exact._
   **Removing the border is required, not incidental**: once the section
   fills its stop, its top edge aligns exactly under the nav, so that border
   would draw hard against the bar instead of 45px below it. Sizing the
   section without removing the border makes this finding worse. It also no
   longer separates anything — the two sections it divided are never on
   screen together now.

4. **The gallery row is unfinished as an interaction.** A native horizontal
   scrollbar is visible under the tiles, the controls sit below-left rather
   than at the row's edges, the tiles are small enough to leave a band of
   empty mist beneath them, and pressing a control advances by a single item
   rather than by a screenful.
   _Fix: page by the row's width and let `snap-x mandatory` correct the
   alignment; hide the scrollbar; move the controls onto the row's left and
   right edges; size tiles so a fixed 3–4 are visible and scale them with
   the available width._

5. **The row's smooth scroll ignores `prefers-reduced-motion`.**
   `src/components/GalleryRow.tsx` uses bare `scroll-smooth`. Everywhere else
   in this repo motion is gated — `motion-safe:scroll-smooth` on `html`,
   `motion-reduce:animate-none` on the marquee, and snapping itself is
   `motion-safe`. This is a direct contradiction of the brief's second
   experience principle.
   _Fix: `motion-safe:scroll-smooth`._

## Should Fix

6. **Section surfaces do not fill their stop.** In the Conditions capture a
   cream band sits above the ocean section: the background is on the inner
   section, which is content-height and centred inside a taller box. Same for
   the gallery's mist. For a design whose whole premise is one screen per
   section, the surface is the section.
   _Fix: move the surface onto `SnapSection` as a closed `tone` prop
   (`cream` default, `mist`, `ocean`) — two non-default adapters, so a real
   variant, and the same shape `ReservedSlot` already uses._

7. **The row is a focus stop with no styled focus ring.** `globals.css` scopes
   the focus treatment to `a`, `button` and `input`; the row is a
   `div[tabindex="0"]`, so it falls back to the browser default rather than
   the site's `currentColor` ring.
   _Fix: include the row in the base focus-visible rule._

8. **The brief no longer describes what is built**, which matters because it
   is the document this review is measured against:
   - Experience principle 2 and Key Interactions describe two synced strips
     giving the page its pulse. The gallery no longer moves at all.
   - "Nav anchors: links smooth-scroll to `#art`, `#coop`, `#conditions`,
     `#community`" — the nav has been routed links since PR #11, and `#art`
     and `#coop` no longer exist.
   - "Nav: fixed top bar" — sticky and in flow since ADR-0003.
   - Component inventory lists `GalleryStrip` and `CommunityForm`; the code
     has `GalleryRow`, `InterestListTeaser` and `InterestListForm`.
   - `HeroViewport: min-h-dvh` — now `100dvh` minus the nav.
   - The previous review's _What Works Well_ still credits "the synced
     strips", a quality that has since been deliberately removed.
     _Fix: amend the brief with a dated addendum rather than a rewrite._

## Could Improve

9. **Nav link touch targets** are ~30px tall, below the 44px guideline —
   unchanged from finding 5 of the previous review. The new gallery controls
   are `size-11` (44px) and do clear it.

10. **Uniform tiles.** Finding 4 of the previous review stands: the template
    mixed aspect ratios and the row flattens them. Worth revisiting once the
    tiles are larger, since the rhythm will read more strongly.
    _Fixed, issue #19 (2026-08-14)._ A row is now two 4:3 tiles and one 16:9
    at one height, the wide slot alternating right, left, right. Three fill a
    screenful from `lg`, which also made the 4:3 tiles larger — 417px against
    348px at a 1536px window — so the rhythm has the size to read.

11. **The stops do not fit a 555px viewport.** Found while verifying finding
    10 at the owner's own window, 1536×639 (a 1080p display at 125% Windows
    scaling, less Chrome's furniture). Against the 555px a stop then has, the
    hero needs 612, the program cards 577 and the interest list 560. All three
    therefore start-align instead of centring — `justify-center-safe` doing
    exactly what finding 1 asked it to — and mandatory snapping over an
    over-tall section reads as the page refusing to settle.
    This review was conducted at 1900×866, where 782px is available and all
    three fit, which is why it went unseen. Present on `main` and unrelated to
    the gallery. _Filed as its own issue; it is a page-level constraint, not a
    section's bug._
    _Fixed, issue #37 (2026-08-15)._ **The three sections were trimmed to fit,
    rather than the snapping being switched off above them.** All six stops now
    come in under 540px, and the page snaps at 1536×639 with every stop whole:
    the hero at 532, the cards at 531, the interest list at 504.

    The first attempt did switch the snapping off instead, on a `stops` variant
    of 45rem. That was wrong for a reason worth recording, because it is this
    finding's own mistake repeated: **1920×1080 at 125% scaling is 864 CSS
    pixels, and Chrome's furniture takes 177, so a maximised window cannot
    exceed a 639px viewport on this machine.** A 720px threshold would have made
    the mechanic permanently invisible here. The variant survives at
    `lg` × 39rem (624px) — below the ceiling by design.

    Where the height was hiding, none of it in the compositions: 120px of
    padding on the poster's text column, which is centred in a box already a
    screen tall and therefore unaffected above the threshold; 22px of line box
    around a decorative emoji at `text-[44px]`; and 56px on the interest form's
    card, which was sized to its success state rather than to the form.

    Measuring across widths also turned up a **twelfth** finding, filed as
    issue #40 and _not_ fixed: the gallery stop's height grows with viewport
    _width_ without limit — 473px at 1536, 559 at 1920, 703 at 2560 — so on a
    639px-tall window it overflows above about 1850px wide. No height threshold
    reaches it. Between `md` and `lg` it was worse still, 734px at 1023, a
    regression from finding 10's fix dropping the two-up tile step; that half is
    moot now that the band has no stops. At 1536 and 1900, the widths both of
    these findings were checked at, it stays inside its stop, which is why it
    went unseen.

## What Works Well

- **The snapping itself.** Every stop lands where intended, the nav offset is
  respected, and the six-screen structure reads as deliberate.
- **The reordering.** Closing on parent voices rather than interrupting the
  program cards with them is a clear improvement, and the two-quote row
  carries a closing screen much better than one quote beside two facts.
- **The poster still holds.** Stop 1 is unchanged and still lands exactly as
  the brief's first principle demands, now with the nav in flow above it.
- **Aesthetic fidelity is intact.** Italic-900 Montserrat, electric yellow on
  purple, the ocean band, pill CTAs — nothing generic has crept in across
  four PRs of structural change.
- **The cards and conditions stops** are the strongest screens in the set:
  content, surface and stop agree, which is exactly what fixing findings 2
  and 6 will do for the rest.

## Checklist Notes

- Hierarchy ✓ — h1 then section h2s, in DOM order
- Consistency ✓ — tokens throughout; `PillLink` and `ReservedSlot` have
  removed the one-off geometries the earlier reviews would have flagged
- States — hover/focus/success ✓; focus ring gap at finding 7
- Responsive — snapping is `md`+ by decision; mobile is an ordinary page
- Accessibility — landmarks ✓, labels ✓, reduced motion ✗ at finding 5
- Dark mode — N/A by decision (fixed art-directed palette)
- Typography — Montserrat loading correctly, italics visible throughout
