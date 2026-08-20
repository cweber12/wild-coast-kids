#!/usr/bin/env node
/**
 * The `adr-numbers` gate row: asserts each ADR number names one decision.
 *
 * Entry-point plumbing only — resolve, print, exit. Everything that decides
 * the verdict lives in adr-numbers.mjs, where it is unit-tested against a temp
 * directory (ADR 0002, same split as check-built-css.mjs).
 */
import { ADR_ROOT, checkAdrNumbers } from "./adr-numbers.mjs";

const { ok, lines } = checkAdrNumbers(ADR_ROOT);

console.log(lines.join("\n"));
process.exit(ok ? 0 : 1);
