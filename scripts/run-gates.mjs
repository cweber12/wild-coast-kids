#!/usr/bin/env node
/**
 * Runs every gate in the table, prints a row each, and exits non-zero if any
 * gate's verdict is not ok.
 *
 * This file is the subprocess plumbing and stays deliberately thin: everything
 * that decides an outcome lives in gates.mjs, where it is unit-tested. Faking
 * the OS costs more than it returns, so the untested surface is kept small
 * enough to read in one sitting.
 */
import { spawn } from "node:child_process";
import {
  GATES,
  PASSED,
  FAILED,
  SKIPPED,
  evaluate,
  formatRows,
  normalizeDriveCasing,
} from "./gates.mjs";

/**
 * @param {string} command
 * @returns {Promise<{ status: typeof PASSED | typeof FAILED, output: string }>}
 */
function run(command) {
  return new Promise((resolve) => {
    // shell: true so `npm run x` resolves npm.cmd on Windows. The commands come
    // from the table in this repo, never from user input. cwd is normalized
    // because a lowercase drive letter makes vitest load its runner twice and
    // fail every suite at boot (issue #4).
    const child = spawn(command, {
      shell: true,
      cwd: normalizeDriveCasing(process.cwd()),
    });
    let output = "";

    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));

    child.on("error", (error) => {
      resolve({ status: FAILED, output: `${output}${error.message}\n` });
    });
    child.on("close", (code) => {
      resolve({ status: code === 0 ? PASSED : FAILED, output });
    });
  });
}

const results = [];

for (const gate of GATES) {
  if (gate.skip) {
    results.push({ gate, status: SKIPPED, output: "" });
    console.log(`… ${gate.name} skipped: ${gate.skip}`);
    continue;
  }

  console.log(`… ${gate.name}`);
  const { status, output } = await run(gate.command);
  results.push({ gate, status, output });
}

const { exitCode, rows } = evaluate(results);

console.log(`\n${formatRows(rows)}\n`);

// Print the failing gate's own output, not a summary of it. A gate that failed
// for a reason nobody can see is a gate nobody will fix.
for (const row of rows) {
  if (row.ok) continue;
  const result = results.find(({ gate }) => gate.name === row.name);
  console.log(`--- ${row.name} ---\n${result.output.trim()}\n`);
}

process.exit(exitCode);
