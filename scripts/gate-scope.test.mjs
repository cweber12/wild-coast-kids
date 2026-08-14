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
import { describe, expect, it } from "vitest";

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
