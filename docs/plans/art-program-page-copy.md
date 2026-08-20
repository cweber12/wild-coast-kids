# The art page says what the classes are and what they cost

## Problem, from the reader's point of view

A parent lands on `/art` in the weeks before the fall term. The page tells them
the media — watercolors, ink, collage, printmaking — and that full class details
are on their way. It does not tell them what a class costs, how often classes
run, how many kids are in one, or what makes this different from any other art
class in the county.

So the page cannot be decided on. A parent who is interested has to join the
interest list and wait, which is the right CTA for someone who has already
decided and the wrong one for someone still deciding.

Art is the program opening first — fall 2026 — and the schedule below the copy
is already wired to Supabase and waiting on rows. What is missing is not
machinery. It is the words.

## Solution

`/art` states the program's story and its pricing.

- **Why it is different**: the work starts from the kids' own interest; every
  class includes art history; the class is skill-focused rather than everyone
  copying one result; technique and foundations are taught so that creative
  freedom has something to stand on; the skills go home with the kid.
- **What you get**: a weekly small-group class, capped at ten.
- **What it costs**: drop-in $20, a 6-pack for $100, a 12-pack for $200.

The schedule below keeps doing what it already does — the published upcoming
sessions, or the reserved slot when there are none — and its slot stops
promising pricing, because pricing is now above it.

## Relationship to what already shipped

The schedule on this page came from `session-schedule-from-supabase.md` and is
unchanged by this work. No migration, no new query, no change to
`src/lib/sessions.ts` or `src/components/SessionSchedule.tsx`.

**One earlier assumption is refined rather than reversed.** A comment in
`src/app/art/page.test.tsx` reads:

> Prices vary from one class to the next, which is why they live on the row
> rather than in page copy, and why the schedule is where a parent finds them.

That was a reasonable reading when the only thing known about art pricing was
that `price_cents` existed. The program's actual pricing is tiered and identical
across every weekly session, so it describes the **program**, not any one date.

Both remain true, and that is the point:

- **Program-level tiers are page copy.** They cannot be expressed on a session
  row at all — "6 classes for $100" is not a price for one class.
- **`price_cents` stays on the row and still renders.** A one-off workshop
  priced differently from the standing tiers still says so on its own line.
- **Standing weekly sessions carry `price_cents = null`**, which already means
  "not priced here, which is not the same as free" — the distinction was written
  into `src/lib/sessions.ts` before there was a case for it, and this is the
  case.

So this slice is additive. The existing assertion that a `4500` row renders
`$45` stays green and stays correct.

## Implementation decisions

- **The tiers are copy on the page, not rows in the database.** The argument in
  full is under _Considered and rejected_. The short version: a pack is not a
  price for a session, the tiers are the same for every session, and programs
  are already hardcoded — `ProgramCards.tsx` is a bespoke design and the
  `program` column is a foreign key to code, not to a table. Program-level facts
  living in code is the established pattern here, not a new one.

- **Weekly only. The monthly themed class is not mentioned.** It has a
  description and no price, and a described package with no price generates
  email rather than signups. It lands when it has a number.

- **No new shared component unless a second caller appears.** `/coop` has no
  pricing and is not opening this term. A pricing block used once belongs in the
  page that uses it, and extracting it before there is a second caller is
  speculative flexibility.

- **The eyebrow keeps saying "Group & Private".** Private classes are still
  offered; this slice adds the group pricing and does not remove anything.

- **No change to `ProgramCards.tsx`.** Its art card copy and badges may want a
  look — "Outdoors" on a studio class is worth questioning — but the landing
  page's card is a different surface with a 520px height budget set by issue
  #37, and touching it here would be a second thing in one slice.

- **The reserved slot's copy narrows to the schedule.** It currently reads
  "Schedule & pricing coming soon." Once the page states pricing, a slot
  promising pricing is stale — and a reserved slot that promises what has
  already arrived is exactly the drift the component was extracted to stop.

## Test seams

The existing one. `src/app/art/page.test.tsx` renders the page and asserts what
a reader sees; this work adds assertions to it and changes two that name the
slot's old copy.

| Seam                                        | What it covers                                   |
| ------------------------------------------- | ------------------------------------------------ |
| `render(await Art())`                       | The differentiator copy is present and reachable |
| `render(await Art())`                       | Each tier and its price renders                  |
| `render(await Art())`                       | The cap of ten is stated                         |
| `render(await Art())`                       | The slot no longer promises pricing              |
| `render(await Art())` (existing, unchanged) | A priced session still renders its own price     |

No new seam is needed and none is proposed. This is page copy: the thing that
can be wrong is what the page says, and the render test is where that is
asserted. Extracting a pure function to hold three prices would add a seam
without adding a question it can answer.

The prices are asserted **as strings a reader sees** — `$20`, `$100`, `$200` —
not as constants imported from the module under test. A test that imports the
number it asserts cannot fail when the number is wrong.

## Slices

1. **The plan** — this file.
2. **The program's story.** Replace the single intro paragraph with the
   differentiators. Copy and its assertions.
3. **The packages and pricing.** The weekly small group, its cap, and the three
   tiers.
4. **The reserved slot narrows.** Its headline and detail stop promising
   pricing; the two assertions naming the old copy move with it.

Slice 4 depends on slice 3 — the slot can only stop promising pricing once the
page supplies it.

## Verification

`npm run gate` before each commit, and its output in the PR body.

`npm run check:db` is **not** run and is not relevant: no migration, no schema
change, and no new column read.

## Considered and rejected

**Put the tiers in the database.** Rejected on three counts. A pack spans
sessions, so `price_cents` — one integer on one row — cannot express one at all;
representing a purchased balance and its consumption needs tables that do not
exist, and that should not be designed before a term has been sold. The tiers
are identical across every weekly session, so putting them on each row stores
the same three numbers once per date and invites them to disagree. And it would
need a migration and a `check:db` assertion to ship a paragraph of text.

The cost of this rejection is real and worth naming: **Lena cannot change a
price without a deploy.** That is acceptable because a price change is not a
routine edit — it happens at most once a term, it is a decision worth reviewing
before it is public, and the schedule rows that _do_ change weekly remain
editable in Studio with no deploy. If price edits ever become frequent, that is
the signal to revisit, and the revisit is cheap: the page reads from somewhere
else instead.

**Add a `packages` or `pricing_tiers` table now.** Rejected as premature. The
pricing model has never met a customer; it opens in weeks and will change. A
schema built for an untested price list gets built twice. The tiers are three
numbers in a paragraph until a term has run.

**Model the monthly themed class alongside the weekly one.** Rejected for now —
no price, and no confirmation it runs this fall.

**Extract a `PricingTiers` component.** Rejected: one caller. It becomes a
component when `/coop` or a second program needs it.

**Reword the art card on the landing page in the same pass.** Rejected as a
second thing in one slice. Filed as a follow-up rather than folded in.

## Out of scope

- The schedule itself, `src/lib/sessions.ts`, and the sessions table. Untouched.
- Entering fall session rows. Data entry in Supabase Studio, not code, and
  blocked on dates and a location that are not decided.
- The monthly themed class, until it has a price.
- The class location, which is undecided and which the schedule rows carry
  per-session anyway.
- Booking, RSVP, capacity enforcement, accounts and packs. `/book` keeps its
  reserved slot and its interest-list CTA.
- `ProgramCards.tsx`.
- `/coop`, which is not the program opening first.

## Open questions

- **Does this decision want an ADR?** "Program-level pricing is copy; per-session
  pricing is data" will outlive this task and will be re-litigated, which is the
  test CLAUDE.md sets. Argued here in full rather than in `docs/adr/` because it
  refines an assumption rather than establishing a new contract. Worth a second
  opinion at review.
- **What does the monthly themed class cost?** Blocks including it.
- **Where do classes meet?** Undecided. Carried per-session on the row, so it
  does not block this page.
