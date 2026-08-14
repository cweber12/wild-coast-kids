#!/usr/bin/env node
/**
 * The `stylesheet` gate row: asserts what `next build` actually emitted.
 *
 * Entry-point plumbing only — resolve, print, exit. Everything that decides
 * the verdict lives in built-css.mjs, where it is unit-tested against a temp
 * directory (ADR 0002, same split as run-gates.mjs and gates.mjs).
 */
import { checkBuiltCss, STYLESHEET_ROOT } from "./built-css.mjs";

const { ok, lines } = checkBuiltCss(STYLESHEET_ROOT);

console.log(lines.join("\n"));
process.exit(ok ? 0 : 1);
