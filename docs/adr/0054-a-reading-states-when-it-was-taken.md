# 0054 — A reading states when it was taken, and "now" comes from the client

Date: 2026-09-04. Status: accepted. Narrows ADR-0016's `Measured now` label.
Plan: `docs/plans/the-measured-band.md`.

## Context

`MAX_WAVE_AGE_MINUTES` and `MAX_OBSERVATION_AGE_MINUTES` are both 180. A buoy
publishing every thirty minutes can miss five cycles and still be inside the
window; an hourly station can miss two. The observation's own timestamp is read
in `lib/upstream.ts`, used to enforce that limit, and then dropped — nothing
downstream of `lib/conditions.ts` knows when anything was measured.

So the page prints a figure that may be nearly three hours old under a
provenance line reading **`Measured now`**. ADR-0016 put that label there for a
real reason — to separate the buoy's height from the modelled forecast beside
it — and the separation it draws is still the right one. The word that has
stopped being true is `now`.

`CONTEXT.md`'s **Conditions** entry has said since it was written that this tool
shows readings "attributed and timestamped". The attribution shipped. The
timestamp never did.

**A reading is not one row.** Probed on 2026-09-04 at 21:26 UTC for Shell Beach:
buoy `46254` published wave height at 21:26, station `LJAC1` published wind at
21:00 and air temperature at 20:48 — its `ATMP` column was `MM` on the four
newest rows. `fetchLatestNdbcAir` ages each field independently on purpose, so
that "a station reporting wind every six minutes and temperature every hour
yields a current wind rather than nothing". The consequence is that the air half
of the panel is two rows as often as one.

**And "now" cannot come from the server.** The route sets `revalidate = 900`.
A server-rendered clock is the render time and can be a quarter of an hour
behind the reader — a confidently wrong number on a page whose entire discipline
is refusing to print one.

## Decision

**Every reading carries `observedAtMs`, and it is the oldest row that
contributed to it.** Not the newest, and not the row the lead figure came from.
A view model that carried the newest would let one fresh field vouch for a stale
one standing beside it.

**A single-row source states its time; a multi-row source states a bound.**
The wave read is one row of `realtime2`, so the card says `Measured 2:26 PM`.
The air read is up to two rows and the panel cannot see which network answered —
`StationBinding` carries a name and a distance and no network, deliberately
(ADR-0010) — so it says `nothing older than 1:48 PM`.

The bound wording is load-bearing twice. It is **true**, where `readings from
1:48 PM` would be false of the wind. And a bound over a set is not a provenance
claim about any figure, so it does not put two rows behind one attribution.

**`Measured now` becomes `Measured`.** ADR-0016's contrast is between a
measurement and a model, and that contrast survives the word `now` leaving. The
time now says what `now` was asserting, and says it correctly.

**"Now" is rendered on the client, ticking, in Pacific time.** Behind
`useHydrated()`, which is already this site's answer for a value allowed to
differ between the server render and the client one (ADR-0027). Pacific rather
than the browser's locale: a reader in New York would otherwise see 5:26 PM
beside a reading taken at 2:26 PM at a San Diego beach, and the gap between
those two numbers is the only reason to show both.

Without JavaScript the reader gets the observation time and no "now". Nothing
false is shown, which is the same trade `hydrated.ts` records.

## Consequences

**A reading can now look stale, and that is the point.** A card that said
`Measured now` at 11:40 for an observation taken at 08:55 said the wrong thing
confidently. It now says `Measured 8:55 AM` and the reader decides. Some beaches
will look worse than they did, at moments when they were already worse than they
looked.

**The oldest-row rule understates freshness, knowingly.** On the probe above,
the air line reads `nothing older than 1:48 PM` while the wind it describes is
26 minutes newer. Understating is the safe direction here: the failure it
prevents is a reader trusting a figure staler than they think, and the failure
it causes is a reader distrusting one fresher than they think.

**`ProvenanceLine` acquires a fifth fact.** It already carries what, who, how
far and why-not-a-nearer-one; `observed` is when. It renders as the last
interpunct segment, so the wave line reads `Measured · Buoy Scripps Nearshore ·
NDBC · 2:26 PM` and the air line ends with its bound. One placement for both,
because the alternative is the four-wordings-of-one-fact drift that component's
docstring exists to record.

**The 180-minute windows are not touched.** Making the bound honest by
construction would mean tightening them, which changes what the page shows
rather than how it labels it, on every beach. If the windows look wrong once the
times are visible, that is its own decision with its own evidence — and it will
have evidence, which it does not today.

**A client island enters the measured block.** It is small, it renders nothing
before hydration, and it is the second one on this page after `AreaSelector`.
The cost is that the only figure on this block a no-script reader cannot see is
the one that was never on it before.
