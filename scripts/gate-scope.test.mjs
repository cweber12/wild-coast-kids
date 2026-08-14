/**
 * The gates must judge this checkout and nothing else.
 *
 * Agent sessions put git worktrees at `.claude/worktrees/<id>/` — full copies
 * of the repo on other branches, inside this one. Every tool that walks the
 * tree has to be told to stay out, and each speaks its own dialect: git has
 * `.gitignore`, vitest has `test.exclude`, eslint has `globalIgnores`. See
 * docs/plans/scope-gates-to-this-checkout.md.
 *
 * Each assertion asks the tool itself rather than reading the config that
 * configures it. A test that greps `.gitignore` for a line passes just as
 * happily once the line has stopped meaning anything. Both directions are
 * checked, because "excludes the worktree" is also satisfied by a rule so broad
 * it excludes the repo.
 *
 * Nothing here may spell a Tailwind utility: this directory feeds the scanner,
 * for the reasons in the addendum to docs/plans/assert-built-stylesheet.md.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * A file in an agent worktree. The id is fake and the file need not exist —
 * `git check-ignore` answers from the rules, not the filesystem — so this
 * asserts the rule without depending on an agent having a session open.
 */
const IN_AGENT_WORKTREE =
  ".claude/worktrees/agent-0000000000000000/src/components/Header.tsx";

/** A file that is part of this checkout and must stay visible to every gate. */
const IN_THIS_CHECKOUT = "src/app/page.tsx";

/**
 * Whether git ignores `path`. This is the mechanism prettier and Tailwind's
 * source detection both consult, so it is what settles the `format` and `build`
 * rows.
 *
 * `git check-ignore --quiet` exits 0 for ignored and 1 for not ignored. Any
 * other status is git failing rather than answering, and is rethrown: reporting
 * a broken git as "not ignored" would turn an unrunnable test into a red one
 * and send the reader after the wrong bug.
 *
 * @param {string} path
 * @returns {boolean}
 */
function gitIgnores(path) {
  try {
    execFileSync("git", ["check-ignore", "--quiet", "--", path], {
      stdio: "ignore",
    });
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

describe("git", () => {
  it("ignores agent worktrees", () => {
    expect(gitIgnores(IN_AGENT_WORKTREE)).toBe(true);
  });

  it("does not ignore this checkout's own source", () => {
    expect(gitIgnores(IN_THIS_CHECKOUT)).toBe(false);
  });
});

/** Where agent sessions live. Created here only if a session has not already. */
const AGENT_DIRECTORY = ".claude";

/** A test file of this checkout's that must stay collected. */
const COLLECTED_HERE = "scripts/gates.test.mjs";

/** @type {(() => void)[]} */
const cleanups = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()();
});

/**
 * Plant a file vitest's default glob would collect, inside the directory the
 * gates are supposed to stay out of, and undo it afterwards.
 *
 * It sits directly under `.claude/` rather than in `.claude/worktrees/`, so it
 * can never be mistaken for a real worktree or collide with one. `.claude/`
 * itself is removed again only if this test created it; a session's own
 * directory is left alone.
 *
 * @returns {string} The planted file's path, slash-separated like vitest's own
 *   output.
 */
function plantForeignTestFile() {
  const agentDirectoryExisted = existsSync(AGENT_DIRECTORY);
  if (!agentDirectoryExisted) mkdirSync(AGENT_DIRECTORY);

  const directory = mkdtempSync(join(AGENT_DIRECTORY, "gate-scope-probe-"));
  cleanups.push(() => {
    rmSync(directory, { recursive: true, force: true });
    if (!agentDirectoryExisted) rmSync(AGENT_DIRECTORY, { force: true });
  });

  const file = join(directory, "probe.test.ts");
  writeFileSync(
    file,
    'import { expect, it } from "vitest";\n' +
      'it("is not this checkout\'s test", () => expect(1).toBe(1));\n',
  );

  return file.replaceAll("\\", "/");
}

/**
 * The test files vitest would run, asked of vitest itself. `list` collects
 * without running, so this costs about a second and cannot recurse into this
 * suite.
 *
 * @returns {string[]}
 */
function collectedTestFiles() {
  const listed = execFileSync(
    process.execPath,
    ["scripts/run-vitest.mjs", "list", "--filesOnly"],
    { encoding: "utf8" },
  );

  return listed
    .split("\n")
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

describe("vitest", () => {
  // The timeout is raised because this spawns a second vitest from a cold
  // start, which the 5s default does not reliably cover on CI.
  it(
    "does not collect test files from agent sessions",
    { timeout: 60_000 },
    () => {
      const planted = plantForeignTestFile();
      const collected = collectedTestFiles();

      expect(collected).not.toContain(planted);
      // Two-sided: an exclusion that collected nothing would also satisfy the
      // line above, and would take the whole suite with it.
      expect(collected).toContain(COLLECTED_HERE);
    },
  );
});
