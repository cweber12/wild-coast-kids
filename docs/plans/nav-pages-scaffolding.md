# Nav pages and scaffolding

> **Historical.** Planned 2026-08-12, shipped in PR #10 on 2026-08-12.
> It records what was intended then, not what the code does now, and is not
> maintained. See [`README.md`](README.md).

## Problem, from the user's point of view

Everything a visitor can reach lives on the single landing page. The nav's
four links scroll to sections, and Book Now points at the art section for
lack of anywhere better. A parent who wants to book, check conditions, or
read more than a teaser paragraph has no page to land on — and every future
feature (booking, the conditions tool, program detail) has no place to grow.

## Solution

Hybrid IA: the landing page keeps its sections as teasers, and five routes
carry full pages — `/art`, `/coop`, `/conditions`, `/community`, `/book`.
All five are structural shells in the repo's labeled-placeholder pattern:
the section's copy as the seed, placeholders where real content (schedule,
pricing, photos, scheduler embed, conditions tool) lands in later passes.

The nav converts from hash anchors to routed links, flipped one link per
page slice so a routed link never points at a route that does not exist.

## Implementation decisions

- **Hybrid, not a migration.** Sections stay on `/`; pages are added
  beside them, each teaser linking to its page. Rejected: stripping the
  landing page down (destroys finished, verified work for no stated need);
  keeping anchors and adding only `/book` and `/conditions` (leaves a nav
  that is half anchors, and anchors only work from `/`).
- **Shared chrome moves to the root layout.** `Nav` and `Footer` leave
  `page.tsx` for `layout.tsx`, so every route gets them for free. `main`
  stays per-page: each page owns its main landmark and the `flex-1`
  spacer, and page tests keep asserting the landmark on the page itself.
- **Routed nav from one links config.** The link list stays a single
  array; entries flip from `#hash` to a route as that route's slice lands.
  The routed-link machinery (`next/link`, active state via a client
  component reading `usePathname`, `aria-current="page"` on the current
  page's link) lands with the first slice that flips a link and is reused
  by the rest. The Book Now pill points at `/book`. Rejected: flipping the
  whole nav at once — every link 404s until the last page exists.
- **Short slugs** matching the existing section ids (`#art` → `/art`,
  etc.). Rejected: label-verbatim slugs (`/art-classes`, `/tuesday-co-op`)
  — diverges from the id vocabulary already in the URLs.
- **Per-page metadata** via the Metadata API; the layout gains a title
  template so page titles read "Page — Wild Coast Kids".
- **Structural shells only.** No booking provider is chosen (`/book` gets
  a labeled placeholder slot, like the conditions embed slot); the
  conditions tool remains its own future plan (`/conditions` carries the
  same reserved slot the section has); no client copy exists yet.
- **No content layer.** Rejected: extracting copy into shared data
  modules so teasers and pages can share it — exactly one paragraph is
  shared today, and structure for one string is the speculative
  flexibility this repo's rules prohibit.
- No new dependencies. No ADR: nothing here decides a dependency, data
  format or threading contract; the IA decision is recorded in this file.

## Test seams

- **Layout wiring:** `layout.test.tsx` renders the root layout with a
  sentinel child (`next/font/google` mocked — it throws outside the Next
  compiler) and asserts the `navigation` and `contentinfo` landmarks plus
  the child. This is the seam for "every route gets the chrome", and it
  moves `layout.tsx` out of the deliberately-untested set — the coverage
  floor rises to match, per the threshold comment's own rule.
- **Each page:** its own test in the same commit, asserting by role and
  accessible name (main landmark, heading, its placeholder slots) —
  the established style from `src/app/page.test.tsx`.
- **Nav flips:** `Nav.test.tsx` href assertions update in the same slice
  as each flip; the active-state behavior is asserted with a mocked
  `usePathname`.
- **Gates:** `npm run gate` green at every commit.

## Slices

PR 1 — branch `layout-shared-chrome`:

1. This plan.
2. Move `Nav` and `Footer` into the root layout; `page.tsx` keeps only its
   sections and `main`. Ships `layout.test.tsx`; coverage floor rises.

PR 2 — branch cut from `main` after PR 1 merges (order mirrors the nav;
each slice = route + shell + metadata + its nav flip + teaser link):

3. `/book` — Book Now pill flips; routed-link machinery lands here.
4. `/art` — first section link flips; active-state assertion lands here.
5. `/coop`
6. `/conditions`
7. `/community`

Per-slice issues are skipped deliberately: one person works these in
sequence from this file, and splitting would buy nothing (CLAUDE.md §5).

## Addendum — 2026-08-12 (build)

- **The /book slice flipped one more CTA than planned.** The art card's
  "Book a class" link carried the template's placeholder calendly.com
  behind a TODO(verify); pointing it at `/book` retires that TODO and
  moves the provider decision behind the booking page. The hero CTAs
  stay on their program anchors — their flow targets the cards, not
  booking directly.
- **The active-state assertion landed one slice early.** NavLink and its
  aria-current tests shipped with `/book` (the component's own slice)
  rather than waiting for `/art`; the `/art` slice then only moved the
  nav's link row onto the existing machinery.

## Addendum — 2026-08-12 (review)

- **`/community` linked to itself.** The `/community` slice reused the
  landing section wholesale, so the teaser's "Meet the community" CTA
  rendered on the page it points at. Fixed by splitting `InterestListForm`
  out of `CommunityForm`: the landing page composes teaser + form, and
  `/community` renders the form alone under its own heading. A MUST FAIL
  regression test went in first, as `test.fails` — the gate table's
  `mustFail` flag judges a whole gate, and the test gate runs the whole
  suite, so it cannot express one failing test inside a passing suite.
- **`CONTEXT.md` landed here**, though this plan put it out of scope. The
  split needed a name for the thing the form collects, and the repo had
  four in use: "interest list" (program card, `/book`, `/coop`), "join the
  community" (the form's own button), "stay in the loop" (its heading) and
  "email list" (in conversation). The glossary picks **interest list**.
- **Two inconsistencies are knowingly left open**, both deliberately out of
  this PR's scope: the form's submit button still reads "Join the
  community", and `CommunityForm` no longer contains a form. Both are
  rename/copy slices, which this repo keeps separate from bugfixes.
- **The "no content layer" rejection above is worth reopening**, but not
  here. It was decided when exactly one paragraph was shared; the reserved
  slot is now duplicated at six call sites. That is a structural
  duplication rather than a copy one, and it gets its own plan.

## Out of scope

Real copy, images and logo, booking provider choice and its embed, the
conditions tool itself, form backend, CMS, analytics, dark mode. Creating
the `CONTEXT.md` that CLAUDE.md references but the repo lacks — its own
slice if wanted.
