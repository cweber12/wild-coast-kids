# Wild Coast Kids landing page

## Problem, from the user's point of view

A homeschool parent who hears about Wild Coast Kids has nowhere to look it up.
They need to learn, in one visit: what it is (art classes and a Tuesday
outdoor co-op), whether it fits their kid (K–8, charter-fund eligible, San
Diego), and how to act (book a class or join the interest list).

## Solution

A single landing page at `/`, built from the supplied style template
(`wildcoastkids_placeholders.html`) with three layout changes the client
asked for:

1. Hero and marquee wrapped in one `min-h-dvh` block so the marquee sits at
   the bottom edge of the first window (min-height, not hard lock, so small
   screens can grow rather than clip).
2. The gallery moves up beneath that block and becomes a single-row film
   strip scrolling at the same pixels-per-second as the marquee.
3. The programs grid follows; remaining sections keep their template order.
   The editorial block and yellow wordmark banner are cut entirely.

Full design record: `.design/wild-coast-kids-landing/` (brief, IA, tokens,
tasks). This plan is the distilled, committed version.

## Implementation decisions

- **Tailwind translation, not CSS port.** Template palette/type become a
  Tailwind v4 `@theme` block in `globals.css`; sections become React
  components under `src/components/`, composed by `src/app/page.tsx`.
  Rejected: porting the template CSS verbatim — two styling systems in one
  repo, and Tailwind already installed.
- **One fixed palette, no dark mode.** The scaffold's
  `prefers-color-scheme` swap is deleted. Rejected: dual palettes — an
  art-directed poster page does not survive automatic inversion.
- **Montserrat via `next/font`** (weights 400–900 + italics) replaces Geist.
- **Shared strip mechanic.** One duplicated-track pattern (translateX loop,
  `aria-hidden` duplicate, pause on hover, frozen under
  `prefers-reduced-motion`) drives both marquee and gallery strip. The
  marquee's 20s half-track loop defines the speed; the gallery derives its
  duration from its own track width to match px/s. Rejected: same 20s
  duration for both — visibly different speeds.
- **Labeled placeholders everywhere an image belongs** (template's
  dashed-border pattern): nav logo, hero photo, card backgrounds, all nine
  strip images. Real photography is a later content pass.
- **Form is client-side only.** Submit swaps to the success state; no data
  leaves the page. Wiring a destination is a future slice. Rejected for
  now: form service or API route — needs an account/provider decision.
- **Copy verbatim from the template**, with its mojibake (UTF-8 corrupted
  emoji/arrows) restored to real characters. Booking link is `TODO(verify)`
  — the template's bare `https://calendly.com` is a placeholder, and this
  repo does not invent URLs.

## Test seams

- Every section component renders standalone and is asserted by **role and
  accessible name** (repo's established style in `src/app/page.test.tsx`) —
  landmarks, headings, links, form controls.
- The strip mechanic's seam: content readable exactly once by AT, duplicate
  track `aria-hidden`.
- The form's seam: valid submit hides the form and shows the success state,
  via Testing Library user events — the state change, not the handler.
- Gates: `npm run gate` (format, lint, typecheck, tests + coverage) green
  at every commit.

## Slices

See `.design/wild-coast-kids-landing/TASKS.md` for the authoritative
checklist. Order: plan commit → tokens/Montserrat/nav → marquee →
hero+viewport → gallery strip → program cards → quote/stats → conditions →
community form → footer/metadata → a11y audit.

## Out of scope

Real images and logo, form backend, real booking URL, conditions-tool embed,
dark mode, extra pages, CMS, analytics. The cut template sections (editorial,
wordmark banner) are removed by decision, not deferred.
