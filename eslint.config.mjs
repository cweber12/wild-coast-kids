import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent sessions put git worktrees at `.claude/worktrees/<id>/` — full
    // copies of the repo on other branches. Flat config walks dot-directories
    // and reads no .gitignore, so nothing else keeps this run inside the
    // branch it is meant to be judging.
    ".claude/**",
    // Vendored istanbul output, written by the `test` row that runs one line
    // above `lint` in the gate table. Gitignored and in .prettierignore, but
    // eslint reads neither, so this is the only place it is excluded — and
    // without it the row's verdict turns on whether coverage has been
    // generated, which is a local/CI disagreement waiting to happen.
    "coverage/**",
  ]),
]);

export default eslintConfig;
