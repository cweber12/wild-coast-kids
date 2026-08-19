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
      // run-vitest.mjs, check-built-css.mjs and check-db.mjs sit at 0% on
      // purpose, and all four drag these figures down in plain sight rather
      // than quietly.
      thresholds: {
        statements: 88.34,
        branches: 88.9,
        functions: 93.75,
        lines: 88.21,
      },
    },
  },
});
