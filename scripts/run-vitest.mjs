#!/usr/bin/env node
/**
 * Launches vitest with the cwd drive-letter casing normalized, so the direct
 * test scripts survive a shell whose cwd starts with `c:\` (issue #5 — same
 * mechanism as the gate fix in run-gates.mjs, see docs/plans/gate-drive-casing.md).
 * The chdir must happen before any vitest module loads; a chdir inside
 * vitest.config.mts was tested and is too late (vitest captures the cwd first).
 *
 * Vitest then runs in this process: its bin entry is imported rather than
 * spawned, which keeps stdio, watch-mode interactivity, argument forwarding
 * and the exit code native. The entry path comes from vitest's own package
 * metadata, not a hardcoded path. Like run-gates.mjs, this file is entry-point
 * plumbing and stays deliberately thin and untested (ADR 0002); the
 * normalization logic itself is unit-tested in gates.test.mjs.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDriveCasing } from "./gates.mjs";

process.chdir(normalizeDriveCasing(process.cwd()));

// The bin path is normalized too: require.resolve walks up from this file's
// own URL, which inherits the launching shell's casing, and an entry URL of
// `file:///c:/...` would load vitest's graph under the second cache key the
// chdir above just removed.
const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("vitest/package.json");
const binPath = join(
  dirname(packageJsonPath),
  require(packageJsonPath).bin.vitest,
);
await import(pathToFileURL(normalizeDriveCasing(binPath)).href);
