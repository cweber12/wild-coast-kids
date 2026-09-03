#!/usr/bin/env node
/**
 * The `areas` gate row: asserts `areas.json` still partitions the inventory.
 *
 * Entry-point plumbing only — read, print, exit. The verdict lives in
 * `areas-partition.mjs`, where it is unit-tested against fabricated tables
 * (ADR-0002, the same split as `check-sea-side.mjs` and
 * `check-adr-numbers.mjs`).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkAreaPartition } from "./areas-partition.mjs";

const read = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../src/data/${name}`, import.meta.url)),
      "utf8",
    ),
  );

const { ok, lines } = checkAreaPartition({
  areas: read("areas.json").areas,
  beaches: read("beaches.json").beaches,
});

console.log(lines.join("\n"));
process.exit(ok ? 0 : 1);
