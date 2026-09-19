import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * The stylesheet as text, because that is the only way its rules can be
 * asserted here: jsdom applies no stylesheets (ADR-0001), and the `stylesheet`
 * gate proves a utility compiles rather than what a base rule says.
 *
 * From the working directory rather than `import.meta.url`: vitest serves a
 * test module from a virtual URL that is not `file:`, and `run-vitest.mjs`
 * already pins the working directory to the repo root.
 */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * The site's focus ring is one rule with a selector list, and the list is the
 * contract: an element it does not name gets the browser's own ring, which the
 * rule's docstring calls foreign on this page.
 *
 * `select` and `summary` were missing from it until 2026-09-17. On
 * `/conditions` that was the two primary controls -- the area and beach
 * choosers -- and every disclosure, each drawing a different ring from the
 * pills and tabs beside them. Asserted per element rather than as one string
 * so a later edit that drops one names which.
 */
test("the focus ring names every kind of focusable element the site uses", () => {
  // Comments out first: the rule is introduced by one, and a comma inside it
  // would read as a selector boundary.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = rules.match(/([^{}]+)\{\s*outline:\s*2px solid currentColor/);
  expect(rule).not.toBeNull();

  const selectors = rule![1]
    .split(",")
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0);

  for (const element of ["a", "button", "input", "select", "summary"]) {
    expect(selectors).toContain(`${element}:focus-visible`);
  }
  expect(selectors).toContain("[tabindex]:focus-visible");
});
