# 0021 — A station table carrying hand-written prose gets a checker, not a generator

Date: 2026-08-27. Status: accepted.

## Context

Four of the five station/line bindings this site reads now have a re-runnable
probe. Three of them — `probe-grid-cells.mjs`, `probe-mop-lines.mjs`,
`probe-observation-stations.mjs` — are **generators**: each re-derives its whole
table from upstream, writes it, and under `--check` re-derives it again and
fails if the committed file differs. That shape is why the committed file can be
trusted: it is not a record of what someone typed, it is the output of a rule
anyone can re-run.

`tide-stations.json` is the fourth, and it is not that kind of file.

Its nine stations carry four fields a probe can never re-derive:

- `water`, an open-coast/bay judgement the file itself records as "an author
  judgement, written by hand because no upstream authority publishes one";
- `dead_note`, a paragraph of prose per dead station explaining what it answered
  and why it was kept rather than deleted;
- `_provenance`, which records a coordinate filter applied by hand on a date;
- two `unresolved` entries, one of which `beaches.ts` spreads into the caveats
  shown to readers.

Only `delivers` is measurable. `probe-observation-stations.mjs` met the
equivalent problem and solved it by hoisting its hand-written `shore` judgement
into the script as a literal; doing the same here would move several paragraphs
of prose out of the data file and into a `.mjs`, for no gain in what can be
checked.

There is a second reason, and it is mechanical rather than editorial. The
stations are committed **north to south** — 9410230 La Jolla first, TWC0405 last
— and seven of the nine ids are integer-like strings. JavaScript objects iterate
integer-like keys in ascending numeric order regardless of insertion order, so
`JSON.parse` followed by `JSON.stringify` does not round-trip this file:

```
committed order:   9410230 9410196 TWC0413 9410170 9410166 9410152 9410135 9410120 TWC0405
after a round-trip: 9410120 9410135 9410152 9410166 9410170 9410196 9410230 TWC0413 TWC0405
```

A generator would rewrite the whole file on its first run, destroying the
geographic ordering, and every diff afterwards would carry that noise. This is
easy to miss: reading the file with `JSON.parse` and printing `Object.keys`
shows the _reordered_ order, so the committed order is only visible in the bytes.

The measurement that prompted this: `TWC0405` Point Loma is committed as not
delivering, measured 2026-08-18. Asked the same question under the same contract
on 2026-08-27 it answers with real predictions. Nine days, and nothing in the
repo noticed, because nothing was watching.

## Decision

**`scripts/probe-tide-stations.mjs` reads and reports. It never writes.**

There is no flag for a mode that does — not `--write`, not a default-write with
`--check` — because a mode that regenerates this file cannot reproduce it.

Three things follow from that, and they are the decision as much as the first
sentence is:

**The verdict is a pure function over two arguments.** `verdict(stations,
measured)` takes a committed table and a set of measurements and returns the
rows to print and the exit code. It is the part that can be wrong, so it is the
part a test calls directly with a fabricated table — the same split ADR-0002
made for the gate runner.

**A fourth outcome sits beside the parser's three.** `src/lib/coops-predictions.ts`
already distinguishes a usable payload, a CO-OPS error object arriving under
HTTP 200, and a payload whose shape has drifted. A request that never completes
— a refused connection, a timeout, a non-200 — is none of those. It is reported
as `unreachable` and is never folded into `not-delivering`. A station this site
could not reach today has not been measured to have stopped delivering, and
reporting it as though it had would manufacture the false alarm the probe exists
to prevent.

**The request contract is mirrored, and the mirror is pinned by test.** The
probe runs under node unbuilt and cannot import TypeScript, so the datum, units,
time zone, application identifier and URL builder are spelled twice —
`generated-date.mjs` already says the same thing about `pacific-time.ts` and
spells its zone twice on purpose. What is new here is that the duplication is
not left on trust: `probe-tide-stations.test.mjs` imports both sides and asserts
that they build the same URL for the same station and range, and that they
classify the same payload the same way. A probe measuring a contract the site
does not read measures nothing.

## Consequences

**A human edits `tide-stations.json`, and the probe is what tells them to.**
This is more work than the generator shape, and it is work the generator shape
could not have done correctly. The exchange is that the file keeps its prose and
its geography, and gains a check on the one field that rots.

**A `delivers` flag is now a claim with an expiry.** Before this, the flag was a
measurement that had quietly become a typed value; the gap between 2026-08-18
and 2026-08-27 is what that costs. Running the probe is now the difference
between a measured flag and a remembered one.

**Nothing runs it yet.** Like its three siblings it reaches the network, so it is
not a row in the gate table — the gate stays offline so it passes on a fresh
clone with no credentials. Running it on a schedule is issue #160, and this probe
is designed to be a row in that table rather than a special case in it.

**The two copies of the request contract can still drift, and will fail loudly
when they do.** The pinning test is the whole guard. If a future change adds a
parameter to `coopsPredictionsUrl` in `src/` and not here, the URLs stop matching
and the test says so. That is a deliberately brittle test: it is asserting an
agreement, and an agreement that can be broken silently is not one.

**This does not decide what the flag should say.** The probe measures; a person
decides what the inventory records and writes the prose that goes with it.
`TWC0405`'s revival is issue #161, which is blocked on this one precisely so the
flag is flipped from a measurement rather than from a memory.
