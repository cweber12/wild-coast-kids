# Build Tasks: Wild Coast Kids Landing Page

Generated from: .design/wild-coast-kids-landing/DESIGN_BRIEF.md
Date: 2026-08-11

Each task is one repo slice per CLAUDE.md: one nameable change, its own
role-based test in the same commit, `npm run gate` green before committing.
Every slice ships its own responsive behavior — there is no "make it mobile"
cleanup task. Components live in `src/components/` (PascalCase), composed by
`src/app/page.tsx`.

## Foundation

- [x] **Tokens, Montserrat, and the nav bar**: Replace the scaffold tokens in
      `globals.css` with the `@theme` block from DESIGN_TOKENS.css (deleting
      the dark-mode swap), swap Geist for Montserrat in `layout.tsx`, and
      build the fixed Nav — Placeholder logo, four anchor links, yellow
      "Book Now" pill. Establishes the coastal-pop-editorial direction in the
      first visible commit. Test: nav landmark reachable, all four links by
      role+name. _New: `Placeholder`, `Nav`. Modifies: `globals.css`,
      `layout.tsx`, `page.tsx`._

- [x] **Marquee strip**: The yellow looping text band and, inside it, the
      shared strip mechanic every strip uses — duplicated track
      (`aria-hidden` copy), `strip-scroll` keyframes, pause on hover, frozen
      under `prefers-reduced-motion`. Riskiest mechanic in the build, so it
      lands second. Test: phrases readable exactly once by AT; duplicate
      track hidden. _New: `Marquee` (+ shared track pattern)._

## Core UI

- [x] **Hero + viewport lock**: Purple split hero (tag, italic-900 headline,
      description, yellow/ghost CTAs, photo Placeholder, corner caption)
      wrapped with the Marquee in a `min-h-dvh` flex column so the marquee
      sits at the bottom edge of the first window on desktop and the block
      may grow on small screens. Photo column hidden ≤768px. Test: h1 and
      both CTAs reachable by role+name. _New: `Hero`, `HeroViewport`.
      Depends on: Marquee._

- [x] **Gallery section**: "What kids make here." header plus the film
      strip — the nine labeled image Placeholders in a single infinite row
      reusing the strip mechanic, duration derived from track width so it
      moves at the marquee's px/s. Test: section heading reachable; each
      image placeholder present once by `role="img"` name. _New:
      `GallerySection`, `GalleryStrip`. Depends on: Marquee (mechanic)._

- [x] **Program cards**: The `#art` and `#coop` cards — background
      Placeholders, numbers, emoji, titles, tags, co-op activities grid,
      pill CTAs (Calendly href is `TODO(verify)`), hover lift. Two columns
      → one ≤768px. Test: both card titles and CTAs reachable; anchor ids
      present. _New: `ProgramCards`._

- [x] **Quote and stats**: Pull-quote with attribution beside the K–8 and
      Charter stat tiles; stacks ≤768px. Test: quote text and both stat
      labels reachable. _New: `QuoteStats`._

- [x] **Conditions section**: Ocean-blue `#conditions` split — heading/copy
      and the dashed "tool coming soon" box reserving the embed slot. Test:
      heading reachable, section id present. _New: `Conditions`._

## Interactions & States

- [x] **Community form**: `#community` section with the form card — labeled
      name/email/ages inputs, interest checkboxes, purple pill submit — and
      the client-side success swap ("You're in!"). Covers: default, invalid
      (required fields), submitted. Test: submit with valid input hides the
      form and shows the success state; labels associated with inputs.
      _New: `CommunityForm` (client component)._

- [x] **Footer and page metadata**: Dark footer bar (pink wordmark, summary
      columns, stacked ≤768px) and the real `metadata.description` in
      `layout.tsx`. Test: contentinfo landmark and wordmark reachable.
      _New: `Footer`. Modifies: `layout.tsx`._

## Responsive & Polish

- [x] **Accessibility and motion audit**: Visible focus rings on every
      interactive element, smooth-scroll disabled under reduced motion,
      strip pause behavior verified, contrast spot-check of yellow/ink and
      white-on-purple pairs, placeholder `aria-label`s complete. Test:
      focus-visible styles asserted on nav CTA; reduced-motion media rules
      present. _Modifies: existing components only._

## Review

- [ ] **Design review**: Run /design-review against the brief with the dev
      server running; screenshots at 1280/768/375.

## Repo process (wraps the list above)

Per CLAUDE.md, before the first slice: commit the plan file
(`docs/plans/wild-coast-kids-landing.md`, distilled from these .design docs)
as its own first commit on branch `wild-coast-kids-landing`, then work the
slices in order, one commit each, gates green at every commit; PR at the end
with gate output pasted.
