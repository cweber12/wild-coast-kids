# The art program

> **How this file got here.** Supplied as notes on 2026-08-19 and committed
> because none of it is derivable from the code. `docs/plans/art-program-page-copy.md`
> implements part of it; this file is where the rest — the decisions taken, and
> the questions still open — is written down so that it outlives a conversation.
>
> **What this repo uses it for.** Two things. The pricing model, which explains
> why `/art` states tiers in page copy while `public.sessions.price_cents` stays
> null on standing sessions. And the shape of a future pack system, which is the
> reason PRD 04's registration design must leave room for a second caller.
>
> **Status of the numbers.** Business facts, not measurements. They come from the
> program's owner and change when she changes them. Nothing here is verified
> against anything.

---

## 1. What the program is

Art classes for K–8 kids, opening **fall 2026**. It is the program the site
leads with; the Tuesday co-op follows later.

What distinguishes it, in the program's own terms:

- The work starts from what the kids are curious about, not from a lesson plan
  that ignores them.
- Every class includes art history — real artists and movements.
- Skill-focused rather than everyone copying one result. Nobody leaves with the
  same picture; everyone leaves with the same technique.
- Technique and foundations are taught so that creative freedom has something to
  stand on.
- The skills go home with the kid, and so does the confidence.

These are rendered as page copy on `/art`. They are not data and are not
expected to become data.

## 2. Packages

**Weekly small-group class.** Capped at **ten** kids. This is the package
opening in fall 2026 and the only one currently on the site.

**Monthly themed class.** A class with a set theme. **No price has been set**,
which is why it is deliberately absent from `/art` — a named package with no
number generates email rather than signups. `src/app/art/page.test.tsx` asserts
it stays absent, so it cannot be half-added later.

Neither is a **Program** in the `CONTEXT.md` sense: the two programs are art and
co-op, they are hardcoded, and `sessions.program` is a foreign key to code. These
two are a level between Program and Session that the glossary has no word for.
That is deliberate — see §5.

## 3. Pricing

| Tier    | Price | Effective                   |
| ------- | ----- | --------------------------- |
| Drop-in | $20   | $20 per class               |
| 6-pack  | $100  | one free — $16.67 per class |
| 12-pack | $200  | two free — $16.67 per class |

**These live in page copy, not in `price_cents`.** Two reasons, and the first is
structural: a pack spans sessions, and `price_cents` holds one integer per
session, so "six classes for $100" has nowhere to live. The second is that the
three numbers are identical across every weekly session, which makes them a fact
about the package rather than about any date.

Standing weekly sessions therefore carry `price_cents = null`, which already
means "not priced here, which is not the same as free". A session priced
differently from the tiers — a one-off workshop — still carries its own
`price_cents` and renders it. Both readings are live at once.

The cost of this is that a price change needs a deploy. Accepted: it happens at
most once a term and is worth reviewing before it is public, while the rows that
change weekly stay editable in Studio. Frequent price edits would be the signal
to revisit. Full argument in `docs/plans/art-program-page-copy.md`.

## 4. Decisions taken

**Packs are shared.** A pack belongs to the **account**, not to a child, and its
credits are spent **per booked seat**. Two kids at one class spends two credits.

This is the cheaper model and removes a whole dimension: there is no child
entity, no per-child balance, and no allocation rules. The pack is a family
wallet. It also means that when registrations exist, the party-size field on a
registration **is** the number of credits to deduct — one number, two purposes,
nothing to reconcile between them.

**Packs are account-linked, and booking is the spend.** A balance has to belong
to someone recognisable across months and devices. Two consequences:

1. **Authentication becomes a prerequisite for the revenue model**, not only for
   an admin interface. There is no auth anywhere in this project today.
2. **The credit decrement and the seat lock must be one transaction.** Separately
   they admit two failures: a credit spent with no seat — a parent has paid for a
   class they are not in — or a seat taken with no credit spent. The row lock that
   prevents overselling is the same lock that prevents double-spending. The
   reverse path needs equal care: a cancellation restores the credit, and
   cancelling a class restores everyone's.

**Kids' names and ages stay roster information.** If registrations are ever
built, children's first names and ages are minimal information for the operator
to read — never entities, never with balances attached. This keeps the most
sensitive data the site would hold as far from any ledger as possible.

## 5. What needs no change

- **Location.** Undecided, and carried per-session on the row. `location_name`
  and `location_url` are already nullable and the schedule component already
  handles both being absent.
- **Themes.** A monthly theme maps onto the existing `title` and `summary`
  columns. "October: Coastal Printmaking" needs nothing new.
- **Distinguishing the two package types.** Convention only for now — say it in
  the title and summary. A column, a check constraint, a `check:db` assertion and
  a render decision are what it would cost, and nothing yet needs them filtered
  apart. If that changes, `CONTEXT.md` gains a term in the same slice.

## 6. Open questions

None of these blocks the first term. The first four change the schema and want
answers before a pack system is built rather than after; the last two block
page copy instead, and cost nothing but the answer.

1. **Do credits expire?** If so, on what clock — purchase date, or term end?
   Easy to add up front, awkward to add to balances already sold.
2. **What happens to a credit when a class is cancelled?** It must return. Who
   is told, and how?
3. **Can a parent transfer or refund an unused pack?** Policy before code.
4. **Does a drop-in purchase create an account?** If not, a parent who drops in
   twice and then buys a pack has two identities and a split history.
5. **What does the monthly themed class cost?** Blocks putting it on the site.
6. **How does charter funding actually work here?** Which charters or vendor
   systems, whether Wild Coast Kids is an approved vendor yet, and what a parent
   has to do. The site claimed charter-fund eligibility in seven places and
   explained it nowhere, so the claim was withdrawn on 2026-08-20 rather than
   invented around — issue #104, `docs/plans/charter-claim-withdrawn.md`. These
   answers are what brings it back.

## 7. The wider PRD set

The seven-step `Events & Calendar Module` build plan this program's future work
descends from was cut into seven PRDs on 2026-08-19 and translated into this
repo's vocabulary and schema. That set is **not committed here** — five of the
seven describe undecided work that contradicts shipped ADRs, and this repo
already carries open issues about documents drifting from the code they
describe.

It is published instead, and covers: the schema and RLS as built; the public
session pages; a calendar feed; a free RSVP flow; an admin interface; paid
sessions and packs; and a Google Calendar mirror recommended against.

<https://claude.ai/code/artifact/66686e4e-bdd5-453f-b252-05854441eef6>

Treat it as a parking lot for undecided work, not as a plan. Anything that
becomes real gets a plan file of its own under `docs/plans/`, per CLAUDE.md.
