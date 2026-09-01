#!/usr/bin/env node
/**
 * The `sea-side` gate row: asserts the sea is on the side the map shades.
 *
 * Entry-point plumbing only — read, print, exit. Everything that decides the
 * verdict lives in sea-side.mjs, where it is unit-tested against a fabricated
 * county with a buoy moved inland (ADR 0002, same split as
 * check-adr-numbers.mjs and check-built-css.mjs).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkSeaSide } from "./sea-side.mjs";

const read = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../src/data/${name}`, import.meta.url)),
      "utf8",
    ),
  );

const { ok, lines } = checkSeaSide({
  shoreline: read("shoreline.json").points,
  mopLines: read("mop-lines.json").lines,
  beaches: read("beaches.json").beaches,
  buoys: read("wave-buoys.json").buoys,
  tideStations: read("tide-stations.json").stations,
  observationStations: read("observation-stations.json").stations,
});

console.log(lines.join("\n"));
process.exit(ok ? 0 : 1);
