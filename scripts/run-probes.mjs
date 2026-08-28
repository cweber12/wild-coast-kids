#!/usr/bin/env node
/**
 * Runs every probe in the table, reports what each found, and exits non-zero
 * only if the reporting itself failed.
 *
 *   node scripts/run-probes.mjs             run and report to GitHub Issues
 *   node scripts/run-probes.mjs --dry-run   run and print what would be reported
 *
 * This file is the subprocess, network and API plumbing, and stays deliberately
 * thin: everything that decides an outcome lives in probes.mjs, where it is
 * unit-tested. Same split as run-gates.mjs, ADR-0002.
 *
 * See docs/adr/0022-drift-is-reported-as-an-issue.md.
 */
import { spawn } from "node:child_process";
import {
  classify,
  COMMENT,
  commentBody,
  CREATE,
  decide,
  evaluate,
  findOpenIssue,
  formatRows,
  issueBody,
  issueTitle,
  NOTHING,
  PROBES,
  runUrlFrom,
  shouldRetry,
  UNCHANGED,
} from "./probes.mjs";
import { generatedDate } from "./generated-date.mjs";
import { normalizeDriveCasing } from "./gates.mjs";

/** One attempt's ceiling. The slowest probe takes seconds; this is for a hang. */
const PROBE_TIMEOUT_MS = 5 * 60 * 1000;

/** How long a publisher gets to answer the runner's own reachability request. */
const REACHABILITY_TIMEOUT_MS = 15_000;

const USER_AGENT =
  "wild-coast-kids/0.1 (+https://github.com/cweber12/wild-coast-kids) probe-runner";

const dryRun = process.argv.includes("--dry-run");

/**
 * Run one probe to completion, capturing everything it printed.
 *
 * A probe that cannot be spawned, or that outruns the timeout, yields a
 * non-zero code like any other failure -- what it means is decided by
 * `classify`, not here.
 *
 * @param {string} command
 * @returns {Promise<{exitCode: number, output: string}>}
 */
function run(command) {
  return new Promise((resolve) => {
    // shell: true so the command resolves the same way it does in run-gates.mjs.
    // Commands come from the table in this repo, never from input. cwd is
    // normalized for the same reason the gate runner normalizes it (issue #4).
    const child = spawn(command, {
      shell: true,
      cwd: normalizeDriveCasing(process.cwd()),
    });

    let output = "";
    let settled = false;
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, output });
    };

    const timer = setTimeout(() => {
      output += `\nThe runner stopped this probe after ${PROBE_TIMEOUT_MS / 1000}s.\n`;
      child.kill();
      finish(124);
    }, PROBE_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => {
      output += `\nThe runner could not start this probe: ${error.message}\n`;
      finish(127);
    });
    child.on("close", (code) => finish(code ?? 1));
  });
}

/**
 * Whether every publisher a probe reads answered the runner at all.
 *
 * ANY HTTP RESPONSE COUNTS AS ANSWERING, including a 400 or a 500. The question
 * is whether the publisher is there, not whether it is happy: a product that
 * was retired and now answers HTTP 400 forever is a real change this job should
 * report as drift, not something to write off as a bad connection. Only a
 * transport failure or a timeout says nothing was measured.
 *
 * @param {string[]} origins
 * @returns {Promise<boolean>}
 */
async function reachable(origins) {
  for (const origin of origins) {
    try {
      await fetch(origin, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
      });
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * The GitHub REST API, or a refusal that names what is missing.
 *
 * @param {string} path
 * @param {object} [init]
 * @returns {Promise<unknown>}
 */
async function api(path, init = {}) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set, so nothing can be reported. The workflow must " +
        "declare `permissions: issues: write` -- this repo's default token is " +
        "read-only and an omitted block fails here rather than at parse time.",
    );
  }
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is not set, so no repo can be named.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub answered HTTP ${response.status} for ${init.method ?? "GET"} ${path}: ` +
        `${(await response.text()).slice(0, 300)}`,
    );
  }
  return response.json();
}

/**
 * The open issue already filed for this probe, found by its marker.
 *
 * The fetch is here; which issue matches is `findOpenIssue`, next door and
 * tested.
 *
 * @param {string} probeName
 * @returns {Promise<number | null>}
 */
async function openIssueFor(probeName) {
  return findOpenIssue(await api("/issues?state=open&per_page=100"), probeName);
}

const measuredOn = generatedDate(new Date());
const runUrl = runUrlFrom(process.env);

const results = [];

for (const probe of PROBES) {
  console.log(`… ${probe.name}`);

  let attempt = await run(probe.command);
  let outcome = classify(
    attempt.exitCode,
    attempt.exitCode === 0 ? true : await reachable(probe.upstream),
  );

  // One retry before a failure is believed. The cheapest explanation for a
  // probe failing once is that a publisher blinked, and a retry that comes back
  // clean costs one run and saves an issue nobody should have read.
  if (shouldRetry(outcome)) {
    console.log(
      `  ${probe.name}: ${outcome} on the first attempt, retrying once`,
    );
    attempt = await run(probe.command);
    outcome = classify(
      attempt.exitCode,
      attempt.exitCode === 0 ? true : await reachable(probe.upstream),
    );
  }

  // Every probe runs on every invocation, so one probe's outcome -- including a
  // failure to report it -- must not stop the rest. Hence the try around the
  // reporting alone, with the error carried into the row rather than thrown.
  let action = NOTHING;
  let error = null;
  try {
    const openIssue =
      outcome === UNCHANGED || dryRun ? null : await openIssueFor(probe.name);
    const decision = decide(outcome, openIssue);
    action = decision.action;

    if (dryRun && action !== NOTHING) {
      console.log(
        `  ${probe.name}: would ${action} an issue titled ` +
          `"${issueTitle(probe.name, outcome)}"`,
      );
    } else if (action === CREATE) {
      const created = await api("/issues", {
        method: "POST",
        body: JSON.stringify({
          title: issueTitle(probe.name, outcome),
          body: issueBody({
            probe,
            outcome,
            output: attempt.output,
            measuredOn,
            runUrl,
          }),
        }),
      });
      console.log(`  ${probe.name}: filed #${created.number}`);
    } else if (action === COMMENT) {
      await api(`/issues/${decision.issue}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: commentBody({
            outcome,
            output: attempt.output,
            measuredOn,
            runUrl,
          }),
        }),
      });
      console.log(`  ${probe.name}: commented on #${decision.issue}`);
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
    console.error(`  ${probe.name}: reporting failed -- ${error}`);
  }

  results.push({ probe, outcome, action, error });
}

const { exitCode, rows } = evaluate(results);

console.log(
  `\nProbe run ${measuredOn}${dryRun ? " (dry run, nothing reported)" : ""}:`,
);
console.log(formatRows(rows));

// The run passes when it reported successfully, whatever it found. A red X on a
// repo with no open PR is easy to miss, and delivering the same news twice
// makes the copy nobody can act on the louder one.
if (exitCode !== 0) {
  console.error(
    "\nThis run failed because reporting failed, not because a probe moved.",
  );
}

process.exit(exitCode);
