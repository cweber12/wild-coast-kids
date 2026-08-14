import { defineConfig } from "vitest/config";
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
      // run-vitest.mjs and check-built-css.mjs sit at 0% on purpose, and all
      // three drag these figures down in plain sight rather than quietly.
      thresholds: {
        statements: 78.94,
        branches: 81.81,
        functions: 89.06,
        lines: 79.88,
      },
    },
  },
});
