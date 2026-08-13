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
      // coverage; the one legitimate reason to move it down is that the
      // denominator grew with deliberately-untested entry plumbing (see
      // docs/adr/0002), and the commit doing so must name the statements and
      // why they stay untested. Nothing is excluded to flatter the number:
      // run-gates.mjs and run-vitest.mjs sit at 0% on purpose, and both drag
      // these figures down in plain sight rather than quietly.
      thresholds: {
        statements: 67.54,
        branches: 75,
        functions: 84.09,
        lines: 70.19,
      },
    },
  },
});
