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
      // Raise it when coverage rises; never lower it to make a commit pass.
      // Nothing is excluded to flatter the number: run-gates.mjs sits at 0% on
      // purpose (see docs/adr/0002) and layout.tsx is untested, and both drag
      // these figures down in plain sight rather than quietly.
      thresholds: {
        statements: 63.54,
        branches: 73.52,
        functions: 78.94,
        lines: 66.27,
      },
    },
  },
});
