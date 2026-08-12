import { describe, expect, test } from "vitest";
import {
  GATES,
  PASSED,
  FAILED,
  SKIPPED,
  evaluate,
  formatRows,
  judge,
} from "./gates.mjs";

const gate = (overrides = {}) => ({
  name: "example",
  command: "true",
  ...overrides,
});

describe("judge", () => {
  test("an ordinary gate that passed is ok", () => {
    expect(judge(gate(), PASSED)).toMatchObject({ label: "PASS", ok: true });
  });

  test("an ordinary gate that failed is not ok", () => {
    expect(judge(gate(), FAILED)).toMatchObject({ label: "FAIL", ok: false });
  });

  test("a MUST FAIL gate that failed is ok", () => {
    expect(judge(gate({ mustFail: true }), FAILED)).toMatchObject({
      label: "PASS",
      ok: true,
    });
  });

  // The case the whole MUST FAIL mechanism exists for: a regression test that
  // stopped reproducing its bug has to fail the run, not sail through.
  test("a MUST FAIL gate that passed is not ok", () => {
    expect(judge(gate({ mustFail: true }), PASSED)).toMatchObject({
      label: "FAIL",
      ok: false,
    });
  });

  // A skipped gate must never be reported as PASS. If it were, disabling a gate
  // would look identical to satisfying it.
  test("a skipped gate is reported as skipped, not as a pass", () => {
    const row = judge(gate({ skip: "needs a display" }), SKIPPED);
    expect(row.label).toBe("SKIP");
    expect(row.note).toBe("needs a display");
  });
});

describe("evaluate", () => {
  test("exits zero when every gate is ok", () => {
    const { exitCode } = evaluate([
      { gate: gate({ name: "a" }), status: PASSED },
      { gate: gate({ name: "b", skip: "needs credentials" }), status: SKIPPED },
    ]);

    expect(exitCode).toBe(0);
  });

  test("exits non-zero when any gate failed", () => {
    const { exitCode } = evaluate([
      { gate: gate({ name: "a" }), status: PASSED },
      { gate: gate({ name: "b" }), status: FAILED },
    ]);

    expect(exitCode).toBe(1);
  });

  test("exits non-zero when a MUST FAIL gate passed", () => {
    const { exitCode } = evaluate([
      { gate: gate({ name: "a", mustFail: true }), status: PASSED },
    ]);

    expect(exitCode).toBe(1);
  });

  test("reports every failing gate, not just the first", () => {
    const { rows } = evaluate([
      { gate: gate({ name: "a" }), status: FAILED },
      { gate: gate({ name: "b" }), status: FAILED },
    ]);

    expect(rows.filter((row) => !row.ok).map((row) => row.name)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("formatRows", () => {
  test("aligns names and shows the reason a gate was skipped", () => {
    const { rows } = evaluate([
      { gate: gate({ name: "lint" }), status: PASSED },
      { gate: gate({ name: "typecheck" }), status: FAILED },
      { gate: gate({ name: "e2e", skip: "needs a display" }), status: SKIPPED },
    ]);

    expect(formatRows(rows).split("\n")).toEqual([
      "  PASS  lint",
      "  FAIL  typecheck",
      "  SKIP  e2e        (needs a display)",
    ]);
  });
});

describe("the gate table", () => {
  test("gate names are unique, since output is matched back to them by name", () => {
    const names = GATES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
