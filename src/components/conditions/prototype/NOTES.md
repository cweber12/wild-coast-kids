# Conditions layout prototype — throwaway

**Delete this whole directory and revert `src/app/conditions/page.tsx` to remove
the experiment.** Nothing here is production code: no tests, no error handling
beyond what makes it run, shortcuts where a real change would need a prop.

## The question

The conditions page's layout doesn't read like a page of its kind. Four things
were named as wrong, from a review of the shipped page at 1536×639 (body height
2300px — 3.6 screens):

1. **No grid.** The page alternates between full-width regions and a ~520px
   text column with no rule, leaving ~900px of dead background beside half the
   content.
2. **The first screen answers nothing.** Above the fold: title, disclaimer,
   dropdown, ten beach links, and two paragraphs explaining what the page
   cannot show. The week grid starts below it.
3. **The explanatory prose makes it noisy.** Three "no one figure for the whole
   area" paragraphs, five attribution lines, a shore-tracing note, a chart
   legend sentence, and the notes block — most of the page's word count is
   spent explaining data rather than being it.
4. **The default view is apologies** — ruled explicitly OUT of scope for this
   prototype. It is caused by ADR-0048 (an area reports only what its beaches
   share), not by layout, and is separate work.

The rip-current ranking was offered as a fifth and was **not** picked, which is
why no variant here promotes it to page hero.

## The variants

`/conditions?variant=` — `now`, `a`, `b`, `c`. Arrow keys cycle.

| Key   | Name                  | Thesis under test                                                                                                                                   |
| ----- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `now` | Current page          | The baseline, rendered from `ConditionsSection` unchanged.                                                                                          |
| `a`   | Answer rail           | Can a 2.4:1 viewport answer "is it OK" and "which day" at once, by giving the whole page two columns instead of only the header?                    |
| `b`   | Week-first spine      | Is "which day" the real question — and does dissolving the header into one line and bracketing the grid with now/judgement read as one time region? |
| `c`   | One grid, quiet prose | How much of the problem is just four competing measures and prose that outranks the figures?                                                        |

## What is approximated

- **B does not fold the measured readings into today's grid cell.** That is the
  research's actual proposal — Surfline's April 2025 "Observation Clarity"
  pattern, forecast as bars with the observation overlaid and badged — and it
  needs surgery inside `WeekGrid`. B tests the structural half only. If B wins,
  the cell merge is the first thing to build for real, because it is what would
  keep ADR-0056's measured/modelled boundary visible.
- **C quiets prose with a scoped CSS rule**, not by editing the panels. The
  sentences come from `withheldWords` via `WeekGrid` and `DayPanel`; the
  selector matches paragraphs leading a region, which is where they land. In
  the real change this would be a prop.
- **A's rail is 288px on purpose.** Tailwind breakpoints resolve against the
  viewport, not the container, so `xl:grid-cols-7` still applies inside the
  narrower flow column. 1440 − 288 − 32 leaves 1120px and cells near 160px —
  just above the 158.8px `WeekGrid` records as its tightest. A wider rail
  silently drops the sparkline.

## Gate status

This branch **does not pass `npm run gate`**, and is not meant to: the variants
carry no tests, which drops coverage below the floor, and
`src/app/conditions/page.test.tsx` asserts against the old signature. That is
the expected cost of throwaway code and the reason this branch never merges.

## The answer

_Unfilled — waiting on the review. Record which variant won and why, then
delete this directory and build the winner properly on its own branch._
