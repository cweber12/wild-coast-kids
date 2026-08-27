import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
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
  marker,
  MOVED,
  NOTHING,
  PROBES,
  runUrlFrom,
  shouldRetry,
  UNCHANGED,
  UNREACHABLE,
} from "./probes.mjs";

describe("the probe table", () => {
  it("names a script that exists, for every row", () => {
    // The table is the thing that decides what runs weekly. A row naming a
    // script that was renamed would go quiet rather than fail, which is the
    // failure mode this whole workflow exists to remove.
    for (const probe of PROBES) {
      const script = probe.command.split(/\s+/)[1];
      expect(script, `${probe.name} names ${script}`).toMatch(
        /^scripts\/probe-.+\.mjs$/,
      );
      expect(existsSync(script), `${script} exists`).toBe(true);
    }
  });

  it("holds all four probes, including the tide probe with no --check", () => {
    expect(PROBES.map((probe) => probe.name)).toEqual([
      "grid-cells",
      "mop-lines",
      "observation-stations",
      "tide-stations",
    ]);
    // probe-tide-stations.mjs never writes, so it has no --check to ask for.
    // A row carries its own command precisely so this is a row and not a
    // special case in the runner. See ADR-0021.
    const tide = PROBES.find((probe) => probe.name === "tide-stations");
    expect(tide.command).not.toContain("--check");
  });

  it("gives every row at least one upstream origin to test", () => {
    for (const probe of PROBES) {
      expect(probe.upstream.length).toBeGreaterThan(0);
      for (const origin of probe.upstream) {
        expect(origin).toMatch(/^https:\/\/[^/]+$/);
      }
    }
  });

  it("gives every row a unique name, since the marker is keyed on it", () => {
    const names = PROBES.map((probe) => probe.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("classifying an attempt", () => {
  it("reads a clean exit as unchanged", () => {
    expect(classify(0, true)).toBe(UNCHANGED);
  });

  it("reads a failure with a reachable upstream as moved", () => {
    expect(classify(1, true)).toBe(MOVED);
  });

  it("reads a failure with an unreachable upstream as unreachable", () => {
    // The distinction the exit code cannot make. Both are exit 1; only the
    // runner's own request to the publisher separates them.
    expect(classify(1, false)).toBe(UNREACHABLE);
  });

  it("never reports an unreachable publisher as drift", () => {
    expect(classify(1, false)).not.toBe(MOVED);
  });

  it("trusts a clean exit even if the reachability check failed", () => {
    // A probe that completed and agreed has already proved it reached its
    // publisher. The runner's own check is the less authoritative of the two.
    expect(classify(0, false)).toBe(UNCHANGED);
  });
});

describe("retrying", () => {
  it("believes a clean run first time", () => {
    expect(shouldRetry(UNCHANGED)).toBe(false);
  });

  it("tries again before believing either kind of failure", () => {
    expect(shouldRetry(MOVED)).toBe(true);
    expect(shouldRetry(UNREACHABLE)).toBe(true);
  });
});

describe("deciding whether to file or to comment", () => {
  it("says nothing at all when a probe is clean", () => {
    expect(decide(UNCHANGED, null)).toEqual({ action: NOTHING });
    expect(decide(UNCHANGED, 42)).toEqual({ action: NOTHING });
  });

  it("files the first time a probe moves", () => {
    expect(decide(MOVED, null)).toEqual({ action: CREATE });
  });

  it("comments the second time rather than filing again", () => {
    // A probe still reporting drift next week must not grow the tracker a row
    // a week.
    expect(decide(MOVED, 42)).toEqual({ action: COMMENT, issue: 42 });
  });

  it("reports an unreachable publisher rather than swallowing it", () => {
    // A retired product answering HTTP 400 forever would otherwise never
    // surface.
    expect(decide(UNREACHABLE, null)).toEqual({ action: CREATE });
    expect(decide(UNREACHABLE, 7)).toEqual({ action: COMMENT, issue: 7 });
  });
});

describe("the marker that de-duplicates", () => {
  it("is keyed on the probe, not on anything a person edits", () => {
    expect(marker("grid-cells")).toBe("<!-- probe-drift:grid-cells -->");
  });

  it("differs between probes, so two can be open at once", () => {
    expect(marker("grid-cells")).not.toBe(marker("mop-lines"));
  });

  it("is carried in the body of the issue it files", () => {
    // The body is what the runner searches. If these two ever disagreed, every
    // run would file a fresh issue and the de-duplication would be silent.
    const body = issueBody({
      probe: PROBES[0],
      outcome: MOVED,
      output: "grid-cells.json has moved.",
      measuredOn: "2026-08-27",
    });
    expect(body).toContain(marker("grid-cells"));
  });
});

describe("finding the issue already open for a probe", () => {
  const issue = (number, body) => ({ number, body });

  it("finds the one whose body carries the marker", () => {
    const issues = [
      issue(1, "unrelated"),
      issue(2, `${marker("grid-cells")}\n\nsomething moved`),
    ];
    expect(findOpenIssue(issues, "grid-cells")).toBe(2);
  });

  it("is null when no issue carries it, so the run files one", () => {
    expect(findOpenIssue([issue(1, "unrelated")], "grid-cells")).toBeNull();
  });

  it("does not match another probe's marker", () => {
    const issues = [issue(1, marker("mop-lines"))];
    expect(findOpenIssue(issues, "grid-cells")).toBeNull();
  });

  it("ignores the title entirely", () => {
    // Whoever triages the issue renames it. A match on title text would file a
    // second issue the moment somebody made the first one clearer.
    const issues = [
      { number: 3, title: "probe grid-cells: upstream has moved", body: "" },
    ];
    expect(findOpenIssue(issues, "grid-cells")).toBeNull();
  });

  it("skips pull requests, which the issues endpoint also returns", () => {
    const issues = [
      { number: 4, body: marker("grid-cells"), pull_request: { url: "…" } },
      issue(5, marker("grid-cells")),
    ];
    expect(findOpenIssue(issues, "grid-cells")).toBe(5);
  });

  it("survives an issue with no body at all", () => {
    expect(findOpenIssue([{ number: 6, body: null }], "grid-cells")).toBeNull();
  });
});

describe("the run url", () => {
  it("is built from the workflow's own environment", () => {
    expect(
      runUrlFrom({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "cweber12/wild-coast-kids",
        GITHUB_RUN_ID: "42",
      }),
    ).toBe("https://github.com/cweber12/wild-coast-kids/actions/runs/42");
  });

  it("is null off a workflow, so a local run files no broken link", () => {
    expect(runUrlFrom({})).toBeNull();
    expect(runUrlFrom({ GITHUB_SERVER_URL: "https://github.com" })).toBeNull();
  });
});

describe("the issue it files", () => {
  const REPORT = {
    probe: PROBES[0],
    outcome: MOVED,
    output: "grid-cells.json has moved. Re-run without --check.",
    measuredOn: "2026-08-27",
    runUrl: "https://github.com/cweber12/wild-coast-kids/actions/runs/1",
  };

  it("carries the measurement, verbatim", () => {
    expect(issueBody(REPORT)).toContain(
      "grid-cells.json has moved. Re-run without --check.",
    );
  });

  it("carries the date it was taken", () => {
    expect(issueBody(REPORT)).toContain("2026-08-27");
  });

  it("names the probe, its command and its publishers", () => {
    const body = issueBody(REPORT);
    expect(body).toContain("node scripts/probe-grid-cells.mjs --check");
    expect(body).toContain("https://api.weather.gov");
  });

  it("links the run that produced it", () => {
    expect(issueBody(REPORT)).toContain("/actions/runs/1");
  });

  it("holds together when there is no run url", () => {
    const body = issueBody({ ...REPORT, runUrl: null });
    expect(body).not.toContain("**Run:**");
    expect(body).toContain("grid-cells.json has moved.");
  });

  it("says so rather than showing an empty block when nothing was printed", () => {
    expect(issueBody({ ...REPORT, output: "   " })).toContain(
      "the probe printed nothing",
    );
  });

  it("says an unreachable publisher is not a claim about drift", () => {
    const body = issueBody({ ...REPORT, outcome: UNREACHABLE });
    expect(body).toContain("could not complete a measurement");
    expect(body).toContain("says nothing about whether the data has drifted");
  });

  it("titles the two outcomes differently", () => {
    expect(issueTitle("grid-cells", MOVED)).toContain("has moved");
    expect(issueTitle("grid-cells", UNREACHABLE)).toContain("did not answer");
  });

  it("promises no commit and no pull request, because it makes neither", () => {
    expect(issueBody(REPORT)).toContain("commits nothing");
  });
});

describe("the comment it adds instead", () => {
  it("says the drift is still there, and when it was re-measured", () => {
    const body = commentBody({
      outcome: MOVED,
      output: "still moved",
      measuredOn: "2026-09-03",
    });
    expect(body).toContain("moved");
    expect(body).toContain("2026-09-03");
    expect(body).toContain("still moved");
  });
});

describe("the run's own verdict", () => {
  const result = (name, outcome, action, error = null) => ({
    probe: { name },
    outcome,
    action,
    error,
  });

  it("passes when it found drift and successfully reported it", () => {
    // The decision worth stating: a run that did its job is green even though
    // what it found is not. Otherwise every notification arrives twice, and the
    // red X is the copy nobody can act on.
    const { exitCode } = evaluate([
      result("grid-cells", MOVED, CREATE),
      result("mop-lines", UNCHANGED, NOTHING),
    ]);
    expect(exitCode).toBe(0);
  });

  it("passes on a completely quiet week", () => {
    expect(evaluate([result("grid-cells", UNCHANGED, NOTHING)]).exitCode).toBe(
      0,
    );
  });

  it("fails when the reporting itself failed", () => {
    const { exitCode, rows } = evaluate([
      result("grid-cells", MOVED, CREATE, "HTTP 403 from the issues API"),
      result("mop-lines", UNCHANGED, NOTHING),
    ]);
    expect(exitCode).toBe(1);
    expect(rows.find((row) => row.name === "grid-cells").ok).toBe(false);
  });

  it("reports every probe, including the quiet ones", () => {
    const { rows } = evaluate([
      result("grid-cells", MOVED, CREATE),
      result("mop-lines", UNCHANGED, NOTHING),
      result("observation-stations", UNREACHABLE, COMMENT),
      result("tide-stations", UNCHANGED, NOTHING),
    ]);
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.outcome)).toEqual([
      MOVED,
      UNCHANGED,
      UNREACHABLE,
      UNCHANGED,
    ]);
  });

  it("prints all three outcomes and the reporting failure", () => {
    const printed = formatRows(
      evaluate([
        result("grid-cells", MOVED, CREATE),
        result("mop-lines", UNCHANGED, NOTHING),
        result("observation-stations", UNREACHABLE, COMMENT, "HTTP 403"),
      ]).rows,
    );
    expect(printed).toContain("grid-cells");
    expect(printed).toContain(MOVED);
    expect(printed).toContain(UNCHANGED);
    expect(printed).toContain(UNREACHABLE);
    expect(printed).toContain("REPORTING FAILED: HTTP 403");
    // A clean probe gets a line, not silence.
    expect(printed.split("\n")).toHaveLength(3);
  });

  it("names the action without claiming it already happened", () => {
    // --dry-run decides an action and takes none. A row reading "filed an
    // issue" there would be this output lying to the reader it exists for.
    const printed = formatRows(
      evaluate([
        result("grid-cells", MOVED, CREATE),
        result("mop-lines", UNCHANGED, NOTHING),
      ]).rows,
    );
    expect(printed).toContain(`(${CREATE})`);
    expect(printed).not.toMatch(/filed|created an issue/);
    // A clean probe is not decorated with an action it does not have.
    expect(printed).toMatch(/mop-lines\s+unchanged\s*$/m);
  });
});
