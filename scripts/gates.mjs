/**
 * The gate table and the rules for reading it.
 *
 * Nothing in this file spawns a process or touches the filesystem. That is the
 * seam: the part that can be wrong is the part that decides the verdict, and it
 * is decided by a pure function that tests can call directly. See
 * docs/adr/0002-gate-runner-in-node.md.
 *
 * Add a gate by adding a row.
 */

/**
 * @typedef {object} Gate
 * @property {string} name         Shown in the results table.
 * @property {string} command      Run through a shell, so npm scripts work on Windows.
 * @property {boolean} [mustFail]  The run fails if this gate *passes*.
 * @property {string} [skip]       Why this gate cannot run on a fresh clone. Declared, not run.
 */

/** @type {Gate[]} */
export const GATES = [
  { name: "format", command: "npm run format:check" },
  { name: "lint", command: "npm run lint" },
  { name: "typecheck", command: "npm run typecheck" },
  // Reads only the working tree, so it sits above the expensive rows and fails
  // in milliseconds. Two decisions shared ADR-0008 for two days while every
  // gate stayed green (#102). See docs/plans/adr-number-gate.md.
  { name: "adr-numbers", command: "node scripts/check-adr-numbers.mjs" },
  // Reads only committed JSON, so it sits with adr-numbers above the expensive
  // rows. ShoreMap shades the sea by a one-sentence rule about which way the
  // MOP lines run, and a rule holding up a picture is what ADR-0021 says gets a
  // checker. See scripts/sea-side.mjs for why the whole-county form of the
  // check is the wrong one.
  { name: "sea-side", command: "node scripts/check-sea-side.mjs" },
  // Reads only committed JSON, so it sits with the two rows above. areas.json
  // is the one table about the beaches a person writes by hand, and
  // beaches.json beside it is rewritten from an upstream resource by
  // seed-beaches.mjs -- so a beach can arrive with no area named for it and go
  // missing from the chooser with nothing thrown. See scripts/areas-partition.mjs.
  { name: "areas", command: "node scripts/check-areas.mjs" },
  // Runs with coverage so the floor in vitest.config.mts is enforced here:
  // Vitest exits non-zero when a threshold is missed, which is the third way
  // CLAUDE.md says this command must fail.
  { name: "test", command: "npm run test:coverage" },
  { name: "build", command: "npm run build" },
  // Reads what the build just emitted, so it has to follow it. Not a skip when
  // the stylesheet is missing: the state it needs is produced by the row above,
  // so absence is a failure. See docs/plans/assert-built-stylesheet.md.
  { name: "stylesheet", command: "node scripts/check-built-css.mjs" },
];

/**
 * Uppercase a leading lowercase Windows drive letter, leaving everything else
 * alone. Node's ESM loader keys its module cache by file URL, so a process
 * whose cwd starts with `c:\` loads the same file twice under `file:///c:/`
 * and `file:///C:/` — which makes every vitest suite fail at boot with
 * "Vitest failed to find the current suite". Some shells and agent harnesses
 * launch with a lowercase drive; the gate must not care which kind it was
 * born in. See docs/plans/gate-drive-casing.md.
 *
 * @param {string} path
 * @returns {string}
 */
export function normalizeDriveCasing(path) {
  return path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
}

export const PASSED = "passed";
export const FAILED = "failed";
export const SKIPPED = "skipped";

/**
 * Decide one gate's outcome from whether its command succeeded.
 *
 * @param {Gate} gate
 * @param {typeof PASSED | typeof FAILED | typeof SKIPPED} status
 * @returns {{ name: string, label: string, ok: boolean, note?: string }}
 */
export function judge(gate, status) {
  if (status === SKIPPED) {
    // Skipped is deliberately not ok-by-omission in the eyes of a reader, but
    // it does not fail the run: CLAUDE.md wants these declared and visible
    // rather than quietly absent. The run stays green; the row says SKIP.
    return { name: gate.name, label: "SKIP", ok: true, note: gate.skip };
  }

  if (gate.mustFail) {
    return status === FAILED
      ? { name: gate.name, label: "PASS", ok: true, note: "failed as required" }
      : {
          name: gate.name,
          label: "FAIL",
          ok: false,
          note: "declared MUST FAIL but passed",
        };
  }

  return status === PASSED
    ? { name: gate.name, label: "PASS", ok: true }
    : { name: gate.name, label: "FAIL", ok: false };
}

/**
 * Reduce every gate's result to the rows to print and the process exit code.
 *
 * @param {Array<{ gate: Gate, status: typeof PASSED | typeof FAILED | typeof SKIPPED }>} results
 * @returns {{ exitCode: number, rows: ReturnType<typeof judge>[] }}
 */
export function evaluate(results) {
  const rows = results.map(({ gate, status }) => judge(gate, status));
  return { exitCode: rows.every((row) => row.ok) ? 0 : 1, rows };
}

/**
 * @param {ReturnType<typeof judge>[]} rows
 * @returns {string}
 */
export function formatRows(rows) {
  const width = Math.max(...rows.map((row) => row.name.length));
  return rows
    .map((row) => {
      const note = row.note ? `  (${row.note})` : "";
      return `  ${row.label.padEnd(4)}  ${row.name.padEnd(width)}${note}`.trimEnd();
    })
    .join("\n");
}
