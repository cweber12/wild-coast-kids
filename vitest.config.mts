import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Keeps `@/*` meaning the same thing in tests as in the app, resolved from
  // tsconfig.json rather than duplicated here. The Next.js guide still reaches
  // for the vite-tsconfig-paths plugin; Vite resolves this natively now and
  // warns that the plugin is redundant.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Agent sessions put git worktrees at `.claude/worktrees/<id>/` — full
    // copies of the repo on other branches — so the default glob collects a
    // second and third suite and runs them against this branch's config.
    // Vitest reads no .gitignore, so ignoring the directory in git does not
    // reach here. Spread rather than replace: setting `exclude` overrides
    // vitest's defaults wholesale, and dropping node_modules while fixing this
    // would trade one kind of foreign test file for another.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
    // Vitest sizes its fork pool from the CPU count. On a 24-core machine that
    // is ~23 jsdom environments competing for one disk, and per-test work then
    // misses the 5s default timeout — tests fail for being starved rather than
    // wrong. Four consecutive runs of one unchanged commit gave 3, 9 and 22
    // timeouts and then a pass, with a different set of files each time and not
    // one assertion among them (issue #114).
    //
    // Capping at 4 is not a throttle. It is *faster*: the whole suite in 26s
    // against 114s, setup 11s against 525s, because the extra workers bought
    // contention rather than parallelism. `ubuntu-latest` gives 4 vCPU, so CI
    // is unchanged and a local run is now the same shape as the CI run — which
    // is what CLAUDE.md asks for when the two disagree.
    //
    // Raise it only with numbers. The failure mode is silent until it is loud:
    // more workers look faster and are not, then start failing tests that are
    // not wrong.
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs"],
      // The floor is what the repo actually achieves today, not an aspiration.
      // Raise it when coverage rises. Never lower it because tested code lost
      // coverage. Two reasons are legitimate, and either way the commit must
      // name the uncovered statements and why they stay that way:
      //   1. the denominator grew with deliberately-untested entry plumbing
      //      (see docs/adr/0002);
      //   2. covered code was deleted, which pulls the whole-project ratio
      //      toward the 0% plumbing even though no test was lost.
      // Nothing is excluded to flatter the number: run-gates.mjs,
      // run-probes.mjs, run-vitest.mjs, check-built-css.mjs, check-db.mjs and
      // check-adr-numbers.mjs sit at 0% on purpose, and all six drag these
      // figures down in plain sight rather than quietly.
      //
      // LOWERED 2026-08-26 under reason 1, when probe-grid-cells.mjs arrived.
      // Its pure half -- parsePoint, parseCell, buildTable, document -- is
      // fully tested; its main() is 85 lines of fetch-and-write plumbing that
      // resolves 90 coordinates against api.weather.gov, and testing it would
      // mean either mocking the network at a seam this repo deliberately does
      // not put one at, or making a gate row that needs the internet.
      // probe-mop-lines.mjs (60.6%) and probe-observation-stations.mjs (82.8%)
      // sit here for the same reason. The join beside it, grid-cell-join.mjs,
      // is at 100% statements -- that is the half that decides anything.
      //
      // 2026-08-27, the gridded sky read. Three rose and one fell, and the one
      // that fell is named rather than absorbed: fetchGridForecast ends with
      // the same defensive `cause instanceof Error ? cause.message : String(cause)`
      // fallthrough fetchMopForecast has, and its non-Error arm is unreachable
      // through parseGridpointForecast's contract -- that parser throws only
      // NwsGridpointDriftError and NwsGridpointNoDataError, both handled above
      // it. Deleting the arm would be the alternative, and it would let a
      // non-Error throw escape a function whose whole contract is that it never
      // throws. So two branches were added that cannot be reached on purpose.
      //
      // 2026-08-27, sky leaving the air card. This one is REASON 2, and the
      // distinction from reason 1 matters: nothing became untested. Well-covered
      // code was deleted -- readSkyHalf, SkyState, skyStats, visibilityWords and
      // the two sky disclosures, with the fifteen tests that covered them -- so
      // the surviving denominator is weighted further toward the 0% entry
      // plumbing that has always dragged these figures down in plain sight.
      // Same event, second half: retiring the sky JOIN as well as the reading.
      // Three rose and branches fell again, still reason 2 -- sky-join.mjs was
      // at 100% and is deleted, along with the parser's visibility branches.
      //
      // LOWERED 2026-08-27 under reason 1, when probe-tide-stations.mjs
      // arrived. The uncovered statements are lines 364-392 and 399 of that
      // file and nothing else: main(), which reads the committed table, asks
      // nine stations for predictions and calls process.exit, plus the
      // `import.meta.url === pathToFileURL(argv[1])` guard below it. Everything
      // with a rule in it is tested directly -- coopsPredictionsUrl,
      // classifyPayload, predictionsWindow, verdict, formatRows, measureStation
      // and measureAll, the last two against a stubbed fetch, at 81.8% of the
      // file. They stay uncovered for the reason probe-grid-cells.mjs's main()
      // does: covering them means either a gate row that needs the internet or
      // a seam around process.exit that would exist only for the test.
      //
      // LOWERED 2026-08-27 under reason 1, when the weekly probe runner
      // arrived. This is the largest single drop the denominator has taken and
      // it is one file: run-probes.mjs, 0% across lines 2-272, which is the
      // process half of the ADR-0002 split -- spawning four probes, the
      // reachability request, and the GitHub Issues calls. It joins run-gates.mjs
      // in the list above for the same reason and is the same kind of file.
      //
      // Its pure half took the opposite path and is at 100% statements, 100%
      // functions, 95.1% branches: the probe table, classify, shouldRetry,
      // decide, marker, findOpenIssue, runUrlFrom, issueTitle, issueBody,
      // commentBody, evaluate and formatRows all sit in probes.mjs and are
      // called directly by 42 tests. Logic was moved OUT of the runner to get
      // there -- findOpenIssue and runUrlFrom were inline in the plumbing
      // first -- rather than the floor being dropped to cover for it.
      //
      // Covering what is left means faking spawn, fetch and the GitHub API at
      // once, which costs more than it returns and is the trade ADR-0002 already
      // made for run-gates.mjs.
      // LOWERED 2026-08-27, twice, by hundredths, and neither time because
      // anything went uncovered. ADR-0023 **deleted covered code** from the
      // week grid, and deleting covered code from a repo whose global ratio is
      // 86% lowers that ratio.
      //
      // The arithmetic is the check, and it is available in the failure output
      // rather than needing to be trusted:
      //
      // - lines 1726/2013 -> 1724/2011, the daylight window leaving
      //   `WeekPanel`'s rows for the day header. Two lines removed, two of them
      //   covered.
      // - branches 1300/1483 -> 1296/1479 and functions 429/463 -> 427/461,
      //   the `allDay` ternaries and the two `worded` helpers going with the
      //   overnight figures. Four branches and two functions removed; the
      //   numerator fell by exactly the same amount, which is what says every
      //   one of them was covered.
      //
      // **Numerator and denominator falling together is the signature of this
      // and not of a regression**, which drops the numerator alone. Check that
      // before touching these numbers again: the failure message reads the same
      // either way, and the ratchet will do this on every slice that removes
      // tested code.
      // RAISED 2026-08-28, all four, by the day view's first slice (#171).
      //
      // This is the ordinary direction and the easy case, but it is written
      // down because the paragraph above spends four entries explaining drops
      // and none explaining a rise, which makes a rise look like something
      // nobody checked.
      //
      // The hourly tide contract, `readHourlyTide`, `localMidnightOf`,
      // `DaySpark` and the grid's sparkline slot are a large amount of new code
      // and every commit carried its tests, so both halves of every ratio grew
      // and the numerators grew faster:
      //
      //   statements 2020/2324  86.16 -> 86.91
      //   branches   1362/1546  87.62 -> 88.09
      //   functions   467/501   92.62 -> 93.21
      //   lines                 85.74 -> 86.57
      //
      // **All four moving the same way is the signature of tested code
      // arriving**, and it is worth knowing because the opposite -- the
      // numerator alone falling -- reads identically in the failure message and
      // is a regression. The four entries above record the third case, where
      // both fall together because covered code was deleted.
      //
      // Nothing new is excluded and nothing was excluded to reach these. The
      // six 0% entry-plumbing files named above still drag all four figures
      // down in plain sight.
      //
      // RAISED 2026-08-29, all four, by the day view's second slice (#172,
      // first half). The same easy case as the entry above and the same
      // signature -- all four moving the same way, both halves of every ratio
      // growing, and the numerators growing faster:
      //
      //   statements 2377/2689  86.91 -> 88.39
      //   branches   1608/1818  88.09 -> 88.44
      //   functions   567/604   93.21 -> 93.87
      //   lines      2154/2446  86.57 -> 88.06
      //
      // Nine files arrived and seven were modified, and the ones that moved
      // these figures are the ones with rules in them: nws-forecast.ts, the
      // shortForecast parser (97.3% statements); nws-gridpoint.ts, extended
      // from one series to five (97.8%); conditions.ts, which gained
      // readSkyWording and the day-shaped gridpoint and wave reads (98.5%);
      // and the four presentational components HourChart, DayPanel,
      // SkyWording and ChosenDay, which are pure by construction and testable
      // without a network for that reason. HourChart alone is 1,031 lines at
      // 99.0% statements.
      //
      // **Branches rose least of the four, and that is worth knowing rather
      // than smoothing over.** They went 87.62 -> 88.09 -> 88.44 across the
      // two slices while statements went 86.16 -> 88.39, because a chart is a
      // large amount of straight-line drawing hung off a small number of
      // decisions, and every absence path this work added -- four tabs' worth
      // of no-station, unavailable, out-of-reach and declared-but-empty -- is
      // a branch that has to be reached by its own test to count. They all
      // are; the ratio moves slowly because the denominator moved too.
      //
      // Nothing new is excluded. The same six 0% files still drag all four
      // down, and this slice added none.
      //
      // 2026-08-29, THREE LOWERED AND ONE RAISED, by the day view's second
      // slice (#172, second half). REASON 2, and it is worth reading the
      // arithmetic rather than the percentages, because three of these moving
      // down looks like the regression it is not.
      //
      // The slice deleted `TideToday`, `WavesToday`, `WindToday`, the three
      // panels behind them and `readTodaysLowestLow` -- about 1,850 lines with
      // their tests -- and added `MeasuredToday` and `MeasuredPanel`, which
      // carry the surviving two thirds of that markup with tests of their own.
      // Well-covered code left; well-covered code arrived; the denominator
      // shrank either way, so the whole-project ratio moved toward the 0%
      // entry plumbing that has always dragged it down.
      //
      //   statements 2377/2689 -> 2363/2672   88.39 -> 88.43
      //   branches   1608/1818 -> 1564/1769   88.44 -> 88.41
      //   functions   567/604  ->  562/599    93.87 -> 93.82
      //   lines      2154/2446 -> 2138/2429   88.06 -> 88.01
      //
      // **The numerator falls by no more than the denominator on every one of
      // the four**, which is the signature of covered code being deleted. A
      // regression drops the numerator alone and reads identically in the
      // failure message; that is what to check here before touching these
      // numbers again, and it is available in the output rather than needing
      // to be trusted. Statements rose because the arriving code is slightly
      // better covered than the leaving code was -- `heightWords`' two end
      // bands, flat water and a large sea, had never been asserted on the wave
      // card and are asserted now.
      //
      // Nothing is left uncovered by this slice. `ChosenDay.tsx:86` and
      // `DayPanel.tsx:105` are the two lines the report still names in this
      // subtree and both predate it: the unreachable "no days to show"
      // fallback, and one arm of the swell tab's outage wording.
      //
      // Nothing new is excluded, and the same six 0% files still drag all four
      // down in plain sight.
      //
      // Moved again in the same pull request, by the regression the slab
      // removal turned up: taking the tide card off the page took the only
      // attribution the tide had with it, and `tideStation.ts` and its three
      // tests put it back on the week's tide row. Small and in the ordinary
      // direction -- both halves grew and the numerators grew faster:
      //
      //   statements 2363/2672 -> 2368/2677   88.43 -> 88.45
      //   branches   1564/1769 -> 1573/1779   88.41 -> 88.42
      //   functions   562/599  ->  564/601    93.82 -> 93.84
      //   lines      2138/2429 -> 2143/2434   88.01 -> 88.04
      //
      // The figures below are these, not the ones in the block above, which
      // are kept because they are what the deletion on its own cost.
      //
      // 2026-08-30, #173's first half: the shore map, its assembler and the
      // coastline geometry beneath them. All four rise, which is what a slice
      // that adds only tested code does -- coastline.ts and shore.ts each
      // finished fully covered, and the numerator grew faster than the
      // denominator on every row.
      //
      //   statements 2368/2677 -> 2639/2959   88.45 -> 89.18
      //   branches   1573/1779 -> 1696/1914   88.42 -> 88.61
      //   functions   564/601  ->  606/644    93.84 -> 94.09
      //   lines      2143/2434 -> 2388/2686   88.04 -> 88.90
      //
      // Two branches in this work are unreachable through the committed data
      // and are covered by calling their functions directly rather than by
      // widening the floor around them: `shoreDistanceKm` above 10 km, where
      // the furthest source in the inventory is 9.2 km, and `boundsAround`
      // returning null, which needs a beach whose every source is one point.
      // RAISED 2026-08-30, the compass. All four rose, and every file this
      // half added -- bearing.ts, needles.ts, Compass.tsx, DayCompass.tsx --
      // finished at 100% on all four metrics, so none of them appears in the
      // report's table at all.
      //
      // The two files it modified are named rather than absorbed. `ShoreMap`
      // is 100% statements and 97.56% branches; the one uncovered branch is
      // the `|| 1` in `Math.hypot(px, py) || 1`, the divide-by-zero guard for
      // a drawn run whose two ends project to the same point. `DayPanel` is
      // 97.53%, and its uncovered statement is the body of
      // `WORDS.swell.outage` -- the sentence for a CDIP outage, which no test
      // in that suite provokes.
      // LOWERED 2026-08-30 under REASON 2, when the map stopped plotting the
      // four sources. Nothing became untested: `markersFor` and
      // `shoreDistanceKm` in `shore.ts`, and `Mark`, `MARKS`, `GLYPHS` and
      // `MISSING_SOURCES` in `ShoreMap.tsx`, were all fully covered and are
      // deleted along with the tests that covered them. The surviving
      // denominator is weighted further toward the 0% entry plumbing that has
      // always dragged these figures down in plain sight.
      //
      // Every file this branch touched is still at 100% on all four metrics
      // except two, and both are unchanged from the rise above: `ShoreMap` at
      // 96.77% branches, whose one uncovered branch is the `|| 1`
      // divide-by-zero guard for a drawn run whose ends project to one point,
      // and `DayPanel` at 97.53% statements, whose uncovered statement is the
      // sentence for a CDIP outage that suite does not provoke.
      thresholds: {
        // RAISED 2026-08-31, all four, by the map's corner readout (#192).
        // The ordinary direction and the easy case -- the signature is all
        // four moving the same way, with both halves of every ratio growing
        // and the numerators growing faster:
        //
        //   statements 2749/3069  89.44 -> 89.57
        //   branches   1793/2010  88.94 -> 89.20
        //   functions   634/672   94.28 -> 94.34
        //   lines      2481/2779  89.14 -> 89.27
        //
        // `corner.ts` arrived at 100% on all four and does not appear in the
        // report's table at all; `Compass.tsx` went back to 100% on all four
        // as the dial's geometry left it. The two files this slice modified
        // and did not finish clean are named rather than absorbed, and both
        // are unchanged from before it: `ShoreMap.tsx` at 97.29% branches,
        // whose one uncovered branch is the `|| 1` divide-by-zero guard for a
        // drawn run whose ends project to the same point, and `DayPanel.tsx`
        // at 97.7% statements, whose uncovered statement is the sentence for a
        // CDIP outage that suite does not provoke.
        //
        // Nothing new is excluded. The same 0% entry-plumbing files named
        // above still drag all four down in plain sight.
        //
        // RAISED again 2026-08-31, all four, by the magnitudes joining the
        // readout's rows. Both halves of every ratio grew and the numerators
        // grew faster:
        //
        //   statements 2764/3084  89.57 -> 89.62
        //   branches   1815/2032  89.20 -> 89.32
        //   functions   638/676   94.34 -> 94.37
        //   lines      2493/2791  89.27 -> 89.32
        //
        // **Branches went down before they went up, and the dip is the part
        // worth recording.** Wording the two magnitudes inline in `DayPanel`
        // added four branches for the same fact -- a source that gave a
        // direction and no magnitude -- and none of them could be reached from
        // that component: a wind needle exists only where the speeds and the
        // bearings joined, so a null peak beside a drawn needle is not a state
        // `DayPanel` can be put in. Moving the wording into `windFigure`,
        // `swellFigure` and `swellStepNote` -- null in, null out, which is
        // `mopLineDistanceKm`'s shape -- put each of those arms somewhere a
        // unit test can call it. The alternative was four branches covered by
        // nothing and explained here, which is what this file already carries
        // too much of.
        //
        // BRANCHES LOWERED 2026-08-31 under REASON 2, by the readout reaching
        // all 51 beaches. Nothing became untested: the coast gate --
        // `!hasCoast || drawnSegment.length === 0` -- was fully covered and is
        // deleted, so three branch arms left and the surviving denominator
        // tilts further toward the 0% entry plumbing.
        //
        //   branches 1815/2032 -> 1812/2029   89.32 -> 89.30
        //
        // **The numerator fell by exactly what the denominator did**, which is
        // what says every deleted arm was covered; a regression drops the
        // numerator alone and reads identically in the failure message. The
        // other three are unmoved, because the slice deleted a condition rather
        // than a statement, a function or a line.
        // RAISED 2026-08-31, all four, by the readout following the selected
        // hour (#193). Both halves of every ratio grew and the numerators grew
        // faster, which is the ordinary direction:
        //
        //   statements 2902/3224  89.62 -> 90.01
        //   branches   1894/2114  89.30 -> 89.59
        //   functions   661/699   94.37 -> 94.56
        //   lines      2616/2915  89.32 -> 89.74
        //
        // **Two files this slice touched came back to 100% on all four after
        // being read here, and neither was cleaned by a test.** `Compass.tsx`
        // had one uncovered arm -- a `??` standing in for a swing the caller
        // had already proved was there -- and `Wedge` taking the swing as its
        // own prop deleted the branch instead of covering it. `needles.ts` had
        // one uncovered statement, the check that a published wave hour carries
        // both halves of an estimate; that one earned a test, because the type
        // permits the state and this is the boundary that refuses it.
        //
        // The two files this slice modified and did not finish clean are named
        // rather than absorbed, and every uncovered branch in both predates it:
        // `DayPanel.tsx` at 98.14% statements and 94.31% branches, whose
        // uncovered statement is the sentence for a CDIP outage that suite does
        // not provoke, and `dayFrame.ts` at 87.5% branches, whose one uncovered
        // arm is `nightBands` dropping a band with no width -- a polar summer,
        // which this coast does not have.
        // LOWERED 2026-08-31 under reason 1, when probe-coastline.mjs arrived
        // with ADR-0037. Nothing new is excluded and no test was lost; the
        // denominator grew by one 450-line probe whose untestable half is the
        // usual one.
        //
        // It lands at 76.2% statements, 74% lines -- better covered than
        // probe-mop-lines.mjs at 60.6% and 56.9%, which sits here for exactly
        // the same reason. The uncovered statements are lines 465-551 and
        // 560-562: `getJson`, `queryUrl` and `main()`. That is fetch-and-write
        // plumbing against services2.arcgis.com, and covering it would mean
        // either mocking the network at a seam this repo deliberately does not
        // put one at, or a gate row that needs the internet.
        //
        // Everything in the file that decides the shape of a coastline is
        // tested: arcBetween, simplifyIndices, densifyIndices, thin,
        // anchorsFrom, mainlandRing, coastalArc, metresBetween, nearestVertex
        // and document, including all six of the refusals -- among them the one
        // this slice's own test found missing, where a flipped ring winding
        // would have returned the inland ecoregion boundary and drawn it as a
        // shoreline forty kilometres inland.
        // LOWERED 2026-08-31 again, one commit later, under reason 2 this time:
        // ADR-0038 deleted corner.ts and corner.test.ts. That module was at
        // 100% on all four, so removing it pulls the whole-project ratio toward
        // the 0% entry plumbing even though no test was lost and nothing became
        // untested. 23 statements and 26 branches left the numerator with their
        // denominators; the ratio falls about a tenth of a point.
        //
        // LOWERED 2026-08-31 a third time, under reason 2 again: ADR-0039
        // deleted `modelLine()` from coastline.ts, a covered function with its
        // covered tests. Two hundredths of a point on lines and functions.
        //
        // Three lowerings in three commits is worth naming rather than passing
        // over, and they are not one drift. In order: the denominator grew with
        // a probe's untestable half (reason 1), then the numerator shrank twice
        // as fully-tested code was deleted (reason 2) -- corner.ts when the
        // readout left the picture, then modelLine() when the open-coast test
        // it existed for stopped existing. No test stopped running in any of
        // them, and every deletion is a decision with an ADR.
        // RAISED 2026-09-01, all four, by the day chart naming its hours from
        // instants (#196, first slice). The ordinary direction and the easy
        // case -- both halves of every ratio grew and the numerators grew
        // faster:
        //
        //   statements 3003/3365  89.22 -> 89.24
        //   branches   1917/2155  88.89 -> 88.95
        //   functions   682/725   94.04 -> 94.06
        //   lines      2704/3042  88.87 -> 88.88
        //
        // Hundredths, and they are recorded rather than absorbed for the reason
        // the entries above give in both directions: the ratchet only means
        // something if it is moved every time it can be. The slice is small in
        // code -- `localHourOf` and `hourLabelAt` in pacific-time.ts,
        // `instantOfHour` in dayFrame.ts, four call sites following them -- and
        // large in tests, because a rule about 2026-11-01 and 2027-03-14 is
        // worth nothing unless both dates are asserted. `dayFrame.ts` gained a
        // test file of its own and reached 100% on all four; its one previously
        // uncovered branch, `nightBands` dropping a band with no width, is
        // covered now by calling it directly rather than by widening the floor
        // around it.
        //
        // Nothing new is excluded. The same 0% entry-plumbing files named above
        // still drag all four down in plain sight.
        statements: 89.24,
        branches: 88.95,
        functions: 94.06,
        lines: 88.88,
      },
    },
  },
});
