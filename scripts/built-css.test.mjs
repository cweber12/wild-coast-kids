import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AT_RULES,
  FORBIDDEN,
  REQUIRED,
  atRuleBodies,
  auditStylesheets,
  checkBuiltCss,
  findStylesheets,
  rulesFor,
} from "./built-css.mjs";

// An invented name rather than a real utility, so that what these tests assert
// about the matcher stays true whatever rows the table happens to hold.
const PROBE = "gate-probe";

/** A stylesheet that satisfies every expectation, so tests can break one. */
const compiled = () =>
  [
    ...REQUIRED.map((expectation) => `.${expectation.utility}{color:red}`),
    ...AT_RULES.map(({ prelude }) => `${prelude}{.${PROBE}{color:red}}`),
    ".unrelated{display:block}",
  ].join("");

const sheet = (css) => [{ path: "built.css", css }];

const temporary = [];

/** A throwaway build directory, so the filesystem walk is tested for real. */
const buildDirectory = (files) => {
  const root = mkdtempSync(join(tmpdir(), "built-css-"));
  temporary.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
};

afterEach(() => {
  for (const root of temporary.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("rulesFor", () => {
  test("finds a bare utility and returns the rule as evidence", () => {
    expect(rulesFor(`.${PROBE}{min-height:var(--x)}`, PROBE)).toEqual([
      `.${PROBE}{min-height:var(--x)}`,
    ]);
  });

  // Two of the required utilities are written in src/ only under md:, so this
  // is the real build's shape. A matcher anchored on a leading dot would call
  // a working utility missing.
  test("finds a variant-prefixed utility", () => {
    expect(rulesFor(`.md\\:${PROBE}{min-height:var(--x)}`, PROBE)).toEqual([
      `.md\\:${PROBE}{min-height:var(--x)}`,
    ]);
  });

  test("finds it inside an at-rule", () => {
    expect(rulesFor(`@media (min-width:48rem){.${PROBE}{a:b}}`, PROBE)).toEqual(
      [`.${PROBE}{a:b}`],
    );
  });

  // The false pass the two-sided check exists to remove: the name is in the
  // file, but no rule emits it.
  test("ignores the name in a comment", () => {
    expect(rulesFor(`/* ${PROBE} is a token */.other{a:b}`, PROBE)).toEqual([]);
  });

  test("ignores a rule whose body declares nothing", () => {
    expect(rulesFor(`.${PROBE}{}`, PROBE)).toEqual([]);
  });

  test("does not accept a longer utility that starts with this one", () => {
    expect(rulesFor(`.${PROBE}-2{min-height:1px}`, PROBE)).toEqual([]);
  });

  test("returns every matching rule, not just the first", () => {
    expect(rulesFor(`.${PROBE}{c:d}.md\\:${PROBE}{c:d}`, PROBE)).toEqual([
      `.${PROBE}{c:d}`,
      `.md\\:${PROBE}{c:d}`,
    ]);
  });
});

describe("atRuleBodies", () => {
  const PRELUDE = "@media (min-width:48rem)";

  test("returns the body of a matching at-rule", () => {
    expect(atRuleBodies(`${PRELUDE}{.${PROBE}{a:b}}`, PRELUDE)).toEqual([
      `.${PROBE}{a:b}`,
    ]);
  });

  // The shape the real build emits: the snap classes sit under the variant
  // *inside* a prefers-reduced-motion query. A [^{}]* matcher would stop at
  // the first inner brace and call a working at-rule empty.
  test("keeps a nested at-rule whole", () => {
    const css = `${PRELUDE}{@media (prefers-reduced-motion:no-preference){.${PROBE}{a:b}}}`;
    expect(atRuleBodies(css, PRELUDE)).toEqual([
      `@media (prefers-reduced-motion:no-preference){.${PROBE}{a:b}}`,
    ]);
  });

  test("finds every occurrence, not just the first", () => {
    const css = `${PRELUDE}{.a{c:d}}.x{y:z}${PRELUDE}{.b{c:d}}`;
    expect(atRuleBodies(css, PRELUDE)).toEqual([".a{c:d}", ".b{c:d}"]);
  });

  // A prelude that is a prefix of the emitted one is a different query, and
  // reading it as a match would pass a threshold nobody chose.
  test("does not match a longer prelude that starts with this one", () => {
    const css = `${PRELUDE} and (min-height:45rem){.${PROBE}{a:b}}`;
    expect(atRuleBodies(css, PRELUDE)).toEqual([]);
  });

  test("yields nothing when the prelude is absent", () => {
    expect(atRuleBodies(".other{a:b}", PRELUDE)).toEqual([]);
  });
});

describe("auditStylesheets", () => {
  test("passes when every required utility emits declarations", () => {
    expect(auditStylesheets(sheet(compiled())).ok).toBe(true);
  });

  test("fails when a required utility emits nothing", () => {
    const { utility } = REQUIRED[0];
    const css = compiled().replace(`.${utility}{color:red}`, "");
    const { ok, lines } = auditStylesheets(sheet(css));

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain(
      `FAIL  ${utility} emits no declarations`,
    );
  });

  // Absence has to be asserted as well as presence: a source list that reaches
  // past src/ is how prose gets back into the shipped stylesheet.
  test("fails when a forbidden utility is present", () => {
    const { utility } = FORBIDDEN[0];
    const { ok, lines } = auditStylesheets(
      sheet(`${compiled()}.${utility}{scroll-snap-type:none}`),
    );

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain(`FAIL  ${utility} is in the built CSS`);
  });

  test("fails on a forbidden utility mentioned anywhere, rule or not", () => {
    const { utility } = FORBIDDEN[0];
    expect(auditStylesheets(sheet(`${compiled()}/* ${utility} */`)).ok).toBe(
      false,
    );
  });

  // The failure this row exists for: a grep against a path that no longer
  // exists reads exactly like "the class is absent".
  test("fails, rather than passing vacuously, when there is nothing to read", () => {
    const { ok, lines } = auditStylesheets([]);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("no stylesheet to read");
  });

  test("reads every stylesheet, not only the first", () => {
    const split = [
      ...REQUIRED.map((expectation, index) => ({
        path: `required-${index}.css`,
        css: `.${expectation.utility}{color:red}`,
      })),
      ...AT_RULES.map(({ prelude }, index) => ({
        path: `at-rule-${index}.css`,
        css: `${prelude}{.${PROBE}{color:red}}`,
      })),
    ];

    expect(auditStylesheets(split).ok).toBe(true);
  });

  // The failure this row exists for: an @custom-variant Tailwind never
  // registered emits no query at all, and every class behind it vanishes
  // while its name stays in the markup where the component tests still see it.
  test("fails when a required at-rule is missing entirely", () => {
    const { prelude, why } = AT_RULES[0];
    const css = compiled().replace(`${prelude}{.${PROBE}{color:red}}`, "");
    const { ok, lines } = auditStylesheets(sheet(css));

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain(`FAIL  ${prelude} wraps no rule`);
    expect(lines.join("\n")).toContain(why);
  });

  // Present but empty is the other half: Tailwind emits the query and then
  // compiles nothing into it if no source uses the variant.
  test("fails when a required at-rule wraps nothing that declares anything", () => {
    const { prelude } = AT_RULES[0];
    const css = compiled().replace(
      `${prelude}{.${PROBE}{color:red}}`,
      `${prelude}{.${PROBE}{}}`,
    );

    expect(auditStylesheets(sheet(css)).ok).toBe(false);
  });

  test("prints the selectors a required at-rule wraps, as evidence", () => {
    const { prelude } = AT_RULES[0];
    const { lines } = auditStylesheets(sheet(compiled()));

    expect(lines.join("\n")).toContain(`ok    ${prelude} wraps .${PROBE}`);
  });

  test("names the files it read", () => {
    const { lines } = auditStylesheets(sheet(compiled()));
    expect(lines[0]).toBe("read  built.css");
  });

  // An empty table would make the row green while asserting nothing at all.
  test("every expectation table has rows", () => {
    expect(FORBIDDEN.length).toBeGreaterThan(0);
    expect(REQUIRED.length).toBeGreaterThan(0);
    expect(AT_RULES.length).toBeGreaterThan(0);
  });
});

describe("findStylesheets", () => {
  // The filename is content-hashed and the subdirectory has moved once
  // already, so the walk has to find CSS wherever under the root it landed.
  test("finds css at any depth, in a stable order", () => {
    const root = buildDirectory({
      "chunks/b.css": "",
      "chunks/nested/a.css": "",
      "media/logo.svg": "",
      "chunks/app.js": "",
    });

    expect(findStylesheets(root)).toEqual([
      join(root, "chunks", "b.css"),
      join(root, "chunks", "nested", "a.css"),
    ]);
  });

  test("a missing directory yields nothing rather than throwing", () => {
    expect(
      findStylesheets(join(tmpdir(), "built-css-absent-directory")),
    ).toEqual([]);
  });
});

describe("checkBuiltCss", () => {
  test("passes on a build directory whose css satisfies the table", () => {
    const root = buildDirectory({ "chunks/0-hash.css": compiled() });
    expect(checkBuiltCss(root).ok).toBe(true);
  });

  test("fails on a build directory with no css at all", () => {
    const root = buildDirectory({ "chunks/app.js": "" });
    const { ok, lines } = checkBuiltCss(root);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("no stylesheet to read");
  });
});
