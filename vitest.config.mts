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
      thresholds: {
        statements: 86.16,
        branches: 87.62,
        functions: 92.62,
        lines: 85.74,
      },
    },
  },
});
