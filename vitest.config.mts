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
      // run-vitest.mjs, check-built-css.mjs, check-db.mjs and
      // check-adr-numbers.mjs sit at 0% on purpose, and all five drag these
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
      thresholds: {
        statements: 88.83,
        branches: 90.49,
        functions: 94.72,
        lines: 88.41,
      },
    },
  },
});
