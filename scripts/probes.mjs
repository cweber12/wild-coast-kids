/**
 * The probe table and the rules for reading a weekly run.
 *
 * Nothing in this file spawns a process, touches the filesystem or reaches the
 * network. That is the seam: what a run's outcomes mean, whether to file or to
 * comment, and what the issue says are the parts that can be wrong, and they
 * are decided by pure functions tests call directly. `run-probes.mjs` is the
 * process half. Same split as `gates.mjs` and `run-gates.mjs`, ADR-0002.
 *
 * Add a probe by adding a row. See docs/adr/0022-drift-is-reported-as-an-issue.md.
 *
 * WHY A ROW CARRIES ITS UPSTREAM HOSTS. The only contract the four probes share
 * is the exit code: non-zero when what was measured disagrees with what is
 * committed. Nothing else is uniform -- one throws a Node stack trace where the
 * others print a sentence and exit -- so their output is captured wholesale for
 * a reader and never parsed for meaning.
 *
 * That contract cannot tell drift from a bad day upstream. Both are exit 1. So
 * the runner asks the question the probes cannot answer: if a probe failed, is
 * its publisher answering at all? A probe that failed while its upstream is
 * reachable measured something and disagrees. A probe that failed while its
 * upstream is not reachable measured nothing. That check needs the hosts, so
 * the hosts are a column rather than knowledge inside the runner.
 */

/**
 * @typedef {object} Probe
 * @property {string} name       Names the probe in the run and in its issue marker.
 * @property {string} command    Run through a shell, from this table and never from input.
 * @property {string[]} upstream Origins the probe reads. All must answer for a
 *   failure to count as drift rather than as an unreachable publisher.
 */

/** @type {Probe[]} */
export const PROBES = [
  {
    name: "grid-cells",
    command: "node scripts/probe-grid-cells.mjs --check",
    upstream: ["https://api.weather.gov"],
  },
  {
    name: "mop-lines",
    command: "node scripts/probe-mop-lines.mjs --check",
    upstream: ["https://thredds.cdip.ucsd.edu"],
  },
  {
    name: "observation-stations",
    command: "node scripts/probe-observation-stations.mjs --check",
    upstream: ["https://api.weather.gov", "https://www.ndbc.noaa.gov"],
  },
  {
    // No --check: this one has no other mode. See ADR-0021.
    name: "tide-stations",
    command: "node scripts/probe-tide-stations.mjs",
    upstream: ["https://api.tidesandcurrents.noaa.gov"],
  },
];

/** Upstream answered and agrees with what is committed. */
export const UNCHANGED = "unchanged";

/** Upstream answered and disagrees with what is committed. */
export const MOVED = "moved";

/** No measurement was taken, so nothing can be said about drift. */
export const UNREACHABLE = "unreachable";

/** Report nothing: this probe is clean. */
export const NOTHING = "nothing";

/** No issue is open for this probe. File one. */
export const CREATE = "create";

/** One is already open. Add to it rather than filing a second. */
export const COMMENT = "comment";

/**
 * What a finished attempt means.
 *
 * `upstreamReachable` is the runner's own answer, not the probe's, for the
 * reason in the header: exit codes cannot separate drift from a publisher
 * having a bad day, and reporting the second as the first is how a weekly job
 * teaches its readers to ignore it.
 *
 * @param {number} exitCode          The probe's exit status.
 * @param {boolean} upstreamReachable Whether every origin in its row answered.
 * @returns {typeof UNCHANGED | typeof MOVED | typeof UNREACHABLE}
 */
export function classify(exitCode, upstreamReachable) {
  if (exitCode === 0) return UNCHANGED;
  return upstreamReachable ? MOVED : UNREACHABLE;
}

/**
 * Whether a finished attempt is worth one more try before it is believed.
 *
 * Only a clean run is believed first time. Everything else gets a second
 * attempt, because the cheapest explanation for a probe failing once is that a
 * publisher blinked -- and a retry that comes back clean costs one request and
 * saves an issue nobody should have read.
 *
 * @param {string} outcome
 * @returns {boolean}
 */
export function shouldRetry(outcome) {
  return outcome !== UNCHANGED;
}

/**
 * The marker that ties an issue to a probe.
 *
 * Deliberately not the title. Whoever triages an issue renames it, and a
 * de-duplication keyed on title text would file a second issue the moment
 * somebody made the first one clearer.
 *
 * @param {string} probeName
 * @returns {string}
 */
export function marker(probeName) {
  return `<!-- probe-drift:${probeName} -->`;
}

/**
 * File a new issue, add to the open one, or say nothing.
 *
 * `unreachable` reports too. A publisher that is down this morning is noise,
 * which the retry absorbs; one that answers HTTP 400 forever because the
 * product was retired is exactly the rot this job exists to surface, and it
 * would never appear if only drift were reported.
 *
 * @param {string} outcome
 * @param {number | null} openIssue  The open issue's number, or null if none.
 * @returns {{action: string, issue?: number}}
 */
export function decide(outcome, openIssue) {
  if (outcome === UNCHANGED) return { action: NOTHING };
  if (openIssue === null || openIssue === undefined) return { action: CREATE };
  return { action: COMMENT, issue: openIssue };
}

/**
 * The open issue already filed for this probe, out of everything the issues
 * endpoint returned.
 *
 * Pure, over a list, so the two things that can be wrong here are both tested:
 * that the match is on the marker and not the title, and that pull requests are
 * skipped -- `GET /issues` returns them too, and a PR whose body quoted the
 * marker would otherwise be commented on instead of the issue.
 *
 * @param {Array<{number: number, body?: string | null, pull_request?: unknown}>} issues
 * @param {string} probeName
 * @returns {number | null}
 */
export function findOpenIssue(issues, probeName) {
  const found = issues.find(
    (issue) =>
      !issue.pull_request && (issue.body ?? "").includes(marker(probeName)),
  );
  return found ? found.number : null;
}

/**
 * The URL of the run doing the reporting, or null when this is not a workflow.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function runUrlFrom(env) {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return null;
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

/**
 * @param {string} probeName
 * @param {string} outcome
 * @returns {string}
 */
export function issueTitle(probeName, outcome) {
  return outcome === UNREACHABLE
    ? `probe ${probeName}: upstream did not answer`
    : `probe ${probeName}: upstream has moved`;
}

const OUTCOME_SENTENCE = {
  [MOVED]:
    "The probe completed a measurement and it disagrees with what is committed. " +
    "Its publisher answered, so this is a change upstream rather than a bad day.",
  [UNREACHABLE]:
    "The probe could not complete a measurement: at least one of its publishers " +
    "did not answer, on two attempts. This says nothing about whether the data " +
    "has drifted -- only that it could not be checked. A publisher that stays " +
    "unreachable is itself worth chasing, which is why this is reported and not " +
    "swallowed.",
};

/**
 * The body of a newly filed issue.
 *
 * The probe's own output is carried verbatim rather than summarised, because
 * every generator's failure message asks the reader to "read the diff, and say
 * in the commit message what changed upstream" -- and the diff is the thing a
 * bot can supply and the explanation is the thing it cannot.
 *
 * @param {{probe: Probe, outcome: string, output: string, measuredOn: string,
 *   runUrl?: string | null}} report
 * @returns {string}
 */
export function issueBody(report) {
  const { probe, outcome, output, measuredOn, runUrl = null } = report;
  return [
    marker(probe.name),
    "",
    `**Probe:** \`${probe.command}\``,
    `**Outcome:** ${outcome}`,
    `**Measured:** ${measuredOn}`,
    `**Upstream:** ${probe.upstream.join(", ")}`,
    runUrl ? `**Run:** ${runUrl}` : null,
    "",
    OUTCOME_SENTENCE[outcome],
    "",
    "What the probe printed:",
    "",
    "```",
    output.trim() || "(the probe printed nothing)",
    "```",
    "",
    "This issue was filed by the weekly probe workflow, which commits nothing " +
      "and opens no pull request. Re-run the probe locally, read the diff, and " +
      "say in the commit message what changed upstream.",
    "",
    "While this issue stays open, later runs that find the same probe still " +
      "moved will comment here rather than file another.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * The body of a comment added to an issue already open for this probe.
 *
 * @param {{outcome: string, output: string, measuredOn: string,
 *   runUrl?: string | null}} report
 * @returns {string}
 */
export function commentBody(report) {
  const { outcome, output, measuredOn, runUrl = null } = report;
  return [
    `Still **${outcome}** on ${measuredOn}.`,
    runUrl ? `\nRun: ${runUrl}` : null,
    "",
    "```",
    output.trim() || "(the probe printed nothing)",
    "```",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Reduce a run to the rows to print and the process exit code.
 *
 * THE RUN PASSES WHEN IT REPORTS. A run that found drift and successfully filed
 * it has done its job; failing as well would deliver every notification twice,
 * once as an issue somebody can act on and once as a red X nobody can. Failure
 * is reserved for the reporting itself failing -- an API call rejected, a probe
 * that could not be spawned.
 *
 * @param {Array<{probe: Probe, outcome: string, action: string,
 *   error?: string | null}>} results
 * @returns {{exitCode: number, rows: Array<{name: string, outcome: string,
 *   action: string, ok: boolean, error: string | null}>}}
 */
export function evaluate(results) {
  const rows = results.map((result) => ({
    name: result.probe.name,
    outcome: result.outcome,
    action: result.action,
    ok: !result.error,
    error: result.error ?? null,
  }));
  return { exitCode: rows.every((row) => row.ok) ? 0 : 1, rows };
}

/**
 * One line per probe, whatever it found. A clean probe is reported too: a run
 * that printed only its complaints would leave a reader unable to tell a quiet
 * week from a week half the table never ran.
 *
 * @param {ReturnType<typeof evaluate>["rows"]} rows
 * @returns {string}
 */
export function formatRows(rows) {
  const width = Math.max(...rows.map((row) => row.name.length));
  return rows
    .map((row) => {
      // The action, not a past-tense claim about it. `run-probes.mjs --dry-run`
      // decides an action and takes none, and a row reading "filed an issue"
      // there would be this table's own output lying to a reader.
      const reported = row.action === NOTHING ? "" : `  (${row.action})`;
      const failure = row.error ? `  REPORTING FAILED: ${row.error}` : "";
      return `  ${row.name.padEnd(width)}  ${row.outcome}${reported}${failure}`;
    })
    .join("\n");
}
