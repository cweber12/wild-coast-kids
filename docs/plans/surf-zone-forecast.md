# The surf zone forecast on the conditions page (issue #217)

Date: 2026-09-02.

## Problem, from the reader's point of view

A parent deciding whether to put children in the water opens `/conditions` and
finds tide times, a modelled swell height, cloud cover, wind and air
temperature. Every one of those is a number they have to interpret themselves.
Nothing on the page answers the question they actually came with.

Between 2026-08-26 and 2026-08-31 the National Weather Service said rip current
risk on this coast was **High** — its own words: _"Life threatening rip currents
are likely"_ — for six consecutive days. Through all six, this page showed a
sub-foot swell figure and no hazard signal of any kind.

## What was measured, and when

Everything below was read from the live products on **2026-09-02**, not
inherited from `docs/plans/conditions-tool.md`, whose figures for this product
are wrong in two places. That plan is historical and is not corrected; see
`docs/plans/README.md`.

### Rip current risk moves

All 14 SRF issuances NWS SGX still held — seven days — first period, `CAZ043`
San Diego County Coastal:

| Issued (PDT)   | Rip current risk | Surf height                   | Water temperature |
| -------------- | ---------------- | ----------------------------- | ----------------- |
| 09-02 01:54 AM | Low              | 1 to 3 feet. Sets to 4 feet.  | 70 to 74 degrees  |
| 09-01 12:20 PM | Moderate         | 2 to 4 feet.                  | 70 to 76 degrees  |
| 09-01 01:44 AM | Moderate         | 2 to 4 feet.                  | 70 to 76 degrees  |
| 08-31 01:15 PM | High             | 3 to 5 feet. Sets to 6 feet.  | 70 to 77 degrees  |
| 08-31 01:20 AM | Moderate         | 2 to 4 feet. Sets to 5 feet.  | 73 to 77 degrees  |
| 08-30 12:09 PM | High             | 3 to 5 feet.                  | 70 to 77 degrees  |
| 08-30 12:59 AM | High             | 3 to 5 feet, local sets to 6. | 70 to 77 degrees  |
| 08-29 02:01 PM | High             | 3 to 5 feet, local sets to 6. | 68 to 78 degrees  |
| 08-29 12:11 AM | High             | 3 to 5 feet.                  | 68 to 78 degrees  |
| 08-28 12:44 PM | High             | 3 to 5 feet.                  | 73 to 77 degrees  |
| 08-28 12:11 AM | Moderate         | 2 to 4 feet.                  | 72 to 77 degrees  |
| 08-27 01:39 PM | High             | 3 to 5 feet.                  | 70 to 77 degrees  |
| 08-27 01:17 AM | High             | 3 to 5 feet.                  | 70 to 77 degrees  |
| 08-26 12:10 PM | High             | 3 to 5 feet with sets to 6.   | 70 to 76 degrees  |

High on 8, Moderate on 4, Low on 2; the value changed on five of seven days.
**It is not a constant that renders the same all summer**, which was the main
reason to suspect this feature was not worth building.

It also changes **within a calendar day**: 08-31 read Moderate at 01:20 AM and
High at 01:15 PM, both for "today". So the value is an as-of-issuance judgement,
not a property of a day — which is what rules out a week-grid cell, whose whole
register is a fact about one day.

### Alerts are not a substitute

`/alerts/active?zone=CAZ043` was empty on 2026-09-02, and the whole of
2026-06-01 to 2026-09-02 carried only 6 Beach Hazards Statements (plus 10 Heat
Advisories). The statement fires rarely; the risk was elevated most of last
week. An alerts-only safety layer would have been silent through all six High
days.

### The product's shape

Fixed-width dot-leader fields, not forecaster prose:

```
Rip Current Risk*.............High.
Surf Height...................3 to 5 feet. Sets to 6 feet.
Thunderstorm Potential........None expected.
Water Temperature.............70 to 77 degrees.
```

Contract facts, each 14 of 14:

- **Exactly two periods.** Never three. `docs/plans/conditions-tool.md` records
  `~3 d` and is wrong.
- **Period labels are not calendar days.** A morning issuance (~1 AM PDT) reads
  `TODAY` then a weekday. An afternoon issuance (~1 PM PDT) reads
  `THIS AFTERNOON THROUGH <weekday>` — today's remainder merged with tomorrow —
  then the day _after_. So a morning issuance reaches two calendar days and an
  afternoon one reaches three.
- **`Water Temperature` appears in the first period only.** The last day covered
  never has one.
- **The full field set** is `Rip Current Risk`, `Surf Height`,
  `Thunderstorm Potential`, `Water Temperature`, `Tides`, `Remarks`.
- **One text carries both zones.** `CAZ552` Orange County sits in the same
  product with different figures (71 to 78 degrees on 2026-09-02, against 70 to
  74 for San Diego) and tides quoted at Newport Beach rather than La Jolla.
- **The product ships its own glossary** — the three risk levels and their
  meanings — so even the explanatory text is the publisher's, not ours.

### The zone cannot be joined per beach

`api.weather.gov/zones?point=<lat>,<lon>&type=public`, both segment ends, all 51
beaches:

| Result                | Beaches |
| --------------------- | ------- |
| `CAZ043` at both ends | 27      |
| `CAZ043` at one end   | 14      |
| no zone at either end | 10      |

The ten include every Coronado beach, Border Field State Park and the inner-bay
sites. **That is not a fact about those beaches** — all 51 are unambiguously
inside San Diego County Coastal. `CAZ043` is a _land_ polygon, and a beach
coordinate on the water side of the mapped shoreline falls outside it. A
containment join fails at the water's edge where this repo's other joins, which
are all nearest-feature, degrade gracefully.

## Solution

A **surf zone forecast** block in the day panel, below the hour chart and above
the measured block, carrying the National Weather Service's published judgement
for the days it covers, quoted and attributed, on the 26 open-coast beaches.

ADR-0009 already fixed the posture: a published judgement is relayed, never
recomputed. This site does not say whether conditions are safe. It says what the
forecaster said, and when they said it.

## Implementation decisions

**The zone binds to the inventory, not to the beach.** No `zone` column in
`beaches.json`, no `srf-join.mjs`. The zone follows from the `County = 'San
Diego'` filter already recorded in `_inclusion`, and it is asserted once. This
contradicts the pattern of every other binding here, which is exactly why it
gets an ADR — someone will try to add the column.

**The parser gets no fallbacks.** Select `CAZ043` by name; its absence is a
failed read. An unrecognised period label is a failed read. Every fallback
available here renders either another county's forecast or the wrong day's, and
both fail silently and plausibly.

**Periods resolve to sets of local dates.** `TODAY` → today;
`THIS AFTERNOON THROUGH SATURDAY` → today and Saturday; `SUNDAY` → Sunday. The
panel shows, for the day a reader picked, whichever period covers it. Coverage
therefore varies with the time of day — two days from a morning issuance, three
from an afternoon one — so the block names its issuance, and that reads as the
publisher's cadence rather than as a defect.

**It is withheld at the 25 bay, lagoon and inlet beaches**, with a stated
reason in the `wave_buoy_null_reason` voice. A _surf zone_ forecast for
open-coast areas does not describe Sail Bay, by the same logic those beaches
already carry for having no wave buoy. Region and tide-station water
classification agree 51/51 on the split, so it is twice-recorded already.

The failure mode this avoids is unusually bad: "Rip Current Risk: High" printed
on a lagoon alarms about a hazard that is not there, and teaches a reader that
this line is not about the beach they selected — which destroys it on the 26
beaches where it is the most important thing on the page.

**Three of the six fields are dropped**, and the reasons are recorded so they
are not re-litigated:

- **Tides** — quoted at La Jolla for the whole county, so wrong at 50 of 51
  beaches, and the page already holds per-beach NOAA predictions.
- **Remarks** — swell direction, which the shore map readout already carries per
  beach from CDIP at finer resolution.
- **Thunderstorm potential** — "None expected" on 14 of 14. A field that reads
  the same every day trains a reader to skip the block, and the block's standing
  risk is already that "Low" is common.

**No glyph.** ADR-0015's vocabulary is 🐚 tide, 🏄 waves and water, 💨 air, and
it is explicitly scoped to the three reading cards. This block is not one.
Borrowing 🏄 would put "waves and water" over a rip current risk. Removing the
slot discharges ADR-0015's open note that 🏖️ marks this product wrongly.

**1800s revalidate**, against a product issued strictly twice daily with no
off-cycle reissue in the sampled week. Its own Suspense boundary, failing apart
from the other four agencies, per the page's standing rule.

**The loading line must not contain "forecast".** `ConditionsSection` and
`DayPanel` both assert loading copy against `CONTEXT.md`'s
`_Avoid_: weather, forecast, surf report`. The assertion is scoped to loading
lines, so the block's own heading may use the publisher's name for the product;
the loading line may not. "Reading the rip current risk…".

## Test seams

Existing seams, preferred to new ones:

- **`lib/upstream.ts`** — the fetch policy, tested by stubbing `fetch`, as the
  other five reads are. What a 404 means, what a missing `CAZ043` means, what an
  issuance older than a cycle means.
- **A pure parser over committed fixtures**, the `ndbc-realtime2` pattern:
  real product text in `src/lib/__fixtures__/`, offline, no network in any gate.
  Fixtures must include **both period-label shapes** — one morning issuance and
  one afternoon — plus a text whose `CAZ043` section is absent, which is the
  fail-loud path and the one a fallback would have rendered wrongly.
- **`lib/conditions.ts`** — the read that composes what the component gets,
  where the bay withholding is decided and stated.
- **The component's own tests**, on `MeasuredToday`'s precedent: what a covered
  day renders, what an uncovered day says instead, and what a bay beach says.

The label→date resolution is a pure function and is the highest seam the
mapping can sit at. It must be tested for the unrecognised label, because that
path is the one no fixture will discover naturally.

## Out of scope

- **Surf height and water temperature** — slice 4. The block ships with rip
  current risk first because that is the product's reason to exist and the rest
  is additive.
- **Staleness** — slice 5. A missed issuance cycle saying so rather than
  presenting an 18-hour-old risk as current.
- **Active alerts.** The other half of `conditions-tool.md`'s slice 9. Measured
  above as a poor substitute for this product, and it is not made redundant by
  it either — both is right eventually, this first.
- **The bay beaches' missing water temperature.** `conditions-tool.md` says it
  "waits for the surf zone forecast's county-wide range". It does not: the
  product does not describe bay water. Those 25 beaches keep the gap, and the
  correction lives here rather than in that historical plan.
- **The landing-page teaser.** Outside this brief; ADR-0015 records why the
  first screen wants its own branch.

## Considered and rejected

**A week-grid row.** The obvious and cheapest answer — the reserved slot already
sits there, `WaveWeek` already handles a row that does not reach all seven days,
and both earlier slots became rows. Rejected on two counts: a grid cell states a
fact about a day, and this value changed _within_ 2026-08-31; and a row of five
empty cells out of seven, sitting fifth below tide, wave and sky in a 159×148
cell, inverts the importance of the one thing on this page that answers the
question the site exists for.

**A standing block above the week.** The highest-prominence option and the right
register — it would sit directly under the standing notice, which disclaims
_our_ judgement where this relays _theirs_. Rejected because anything above the
readings is paid for out of a first screen with about two pixels of slack, and
the trade was not worth making before the block has been seen. If the day panel
proves too deep, this is what to reconsider — not a different position inside
the panel.

**Above the hour chart, joined to the sky wording.** Conceptually tidy: both are
NWS's relayed words for the chosen day. Rejected because a five-line block
collapsing to a one-line absence would move the plot up and down the page as a
reader steps across the week, which is the constraint `ChosenDay` already pays
for by putting the measured block below. Noted that the chart already drifts a
little, since the publisher's sky wording varies in length — so this is a
difference of degree, and the degree is large.

**Clamping to today only.** Stable, simple, and throws away a real forecast day
the publisher gave us.

**Showing both periods on today's panel in the publisher's words.** Never
asserts a mapping, which is honest — but it puts a block about Sunday on
Wednesday's panel, fighting the whole point of the day selector.

**Drawing it at all 51 beaches.** The `Readout` precedent: it is drawn on all
51, including the 23 the traced coast does not reach, because withholding left
nearly half the inventory with no wind figure anywhere. Rejected because the
analogy fails — wind blows on a bay, so a wind figure there is true; a surf zone
forecast describes water that does not exist at Sail Bay.

**Dropping surf height entirely.** Argued first, on the grounds that the page
already has two better surf numbers — CDIP's per-beach modelled swell and the
buoy's measured height — and a coarse county range would be a third that
disagrees. Reversed: the measured table shows risk and surf height moving
together, and "High — 3 to 5 feet, sets to 6" is one coherent statement where
"High" alone is a bare word. It ships in slice 4 as the evidence for the risk,
never as a competing surf reading, and never adjacent to the MOP swell.

**A `zone` column and a re-join script**, by analogy with every other binding
here. Rejected on the measurement above: the join is containment rather than
proximity and fails at the water's edge for 10 of 51 beaches, and the zone is
not per-beach data in the first place.

## Addenda

### 2026-09-02 — the product has a headline, and it outranks the day

Capturing fixtures surfaced an element the design above does not account for.
The `CAZ043` section may open with a headline in the National Weather Service's
own emphasis markers, before the first period:

```
...HIGH RIP CURRENT RISK...
```

Read across all 14 issuances:

| Issued (UTC) | First period's risk | Headline                                                   |
| ------------ | ------------------- | ---------------------------------------------------------- |
| 09-02 08:54  | Low                 | —                                                          |
| 09-01 19:20  | Moderate            | `...MODERATE RIP CURRENT RISK...`                          |
| 09-01 08:44  | Moderate            | —                                                          |
| 08-31 20:15  | High                | `...HIGH RIP CURRENT RISK...`                              |
| 08-31 08:20  | Moderate            | —                                                          |
| 08-30 19:09  | High                | `...HIGH RIP CURRENT RISK...`                              |
| 08-30 07:59  | High                | `...HIGH RIP CURRENT RISK...`                              |
| 08-29 21:01  | High                | `...HIGH RIP CURRENT RISK...`                              |
| 08-29 07:11  | High                | `...HIGH RIP CURRENT RISK...`                              |
| 08-28 19:44  | High                | `...HIGH RIP CURRENT RISK...`                              |
| 08-28 07:11  | **Moderate**        | **`...HIGH RIP CURRENT RISK...`**                          |
| 08-27 20:39  | High                | `...BEACH HAZARDS STATEMENT THROUGH 11 PM THIS EVENING...` |
| 08-27 08:17  | High                | `...BEACH HAZARDS STATEMENT THROUGH 11 PM THIS EVENING...` |
| 08-26 19:10  | High                | `...BEACH HAZARDS STATEMENT THROUGH 11 PM THURSDAY...`     |

Three facts, and the third is why this changes the plan.

**It is optional** — absent on 3 of 14. A parser that requires it fails on a
quiet day.

**It is scoped to the product, not to a period.** On 2026-08-28 07:11 the
headline read `HIGH RIP CURRENT RISK` while `TODAY` read Moderate; the second
period, `SATURDAY`, read High. Verified in the product text rather than
inferred. So the headline and the per-day field can differ, legitimately, and
neither is wrong.

**It sometimes announces an active Beach Hazards Statement** — 3 of 14. That is
the event-driven signal measured above as the thing this page has none of, and
it arrives inside a read this slice already makes.

**Decision: the headline is relayed**, as a product-level line above the
per-day risk, worded so that its scope is the issuance rather than the chosen
day. Omitting it would let the page print "Moderate" on a day the forecaster
headlined `HIGH RIP CURRENT RISK`, and stay silent while a Beach Hazards
Statement is running — which is the same failure of omission the whole feature
exists to correct.

**What this costs**: two risk words on screen that can differ, one above the
other. That is the product being honest about scope rather than a
contradiction, but it only reads that way if the wording carries the scope, and
no gate can check that it does. It is why #217 is `needs-human`.

**What it does not do**: deliver active alerts. The headline is the SGX
forecaster's announcement text, not the alert product, and it appears only when
that office chooses to lead with it. `Active alerts` stays out of scope above.

### 2026-09-02 — the work is done, and what it cost

All five slices shipped: #216 (the horizon correction), #218 (the block, the
zone binding, the period resolution) and #219 (the two figures and staleness).
Three things are worth recording against the plan above.

**Slices 2 and 3 shipped as one commit.** Separating them would have meant a
parser that deliberately discarded a second period it had already read. The
boundary was drawn for this document's benefit rather than the code's.

**The rendered page caught two copy defects the fixtures could not**, both in
the withheld sentence at the 25 sheltered beaches. The publisher was named
twice in one sentence; and the obvious short fix — "none is forecast here" —
reads as _there is no rip current risk here_, a claim about the water rather
than about the product's coverage, which ADR-0009 forbids and which would have
landed at exactly the beaches least able to carry it. The copy is now about the
forecast, and a test holds all four states to that line. **Nothing in the test
suite could have found either.** Rendering against the live feed is what did.

**The surf height sits nearer the buoy than intended.** The decision above
keeps it away from CDIP's modelled swell, and it does. But `MeasuredToday` is
the next block down and carries the buoy's measured height, and on 2026-09-02
the page read "Surf 1 to 3 feet. Sets to 4 feet." above "🏄 3.0 ft — about waist
high". Those are breaking surf face height and significant wave height at a
buoy: different quantities, similar numbers that day, two blocks apart. Not
resolved here — recorded, because it is the same collision the plan reasoned
about and it turned up against a neighbour the reasoning did not consider.
