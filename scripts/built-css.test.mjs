import { afterEach, describe, expect, test } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FORBIDDEN,
  REQUIRED,
  auditStylesheets,
  checkBuiltCss,
  findStylesheets,
  rulesFor,
  utilityName,
} from "./built-css.mjs";

// Utilities are named in segments in the table under test, so the literals
// here are invented ones that Tailwind compiles to nothing. Spelling a real
// one would put it in the shipped stylesheet — see the guard test at the foot
// of this file.
const PROBE = "gate-probe";

/** A stylesheet that satisfies every expectation, so tests can break one. */
const compiled = () =>
  [
    ...REQUIRED.map((expectation) => `.${utilityName(expectation)}{color:red}`),
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

describe("auditStylesheets", () => {
  test("passes when every required utility emits declarations", () => {
    expect(auditStylesheets(sheet(compiled())).ok).toBe(true);
  });

  test("fails when a required utility emits nothing", () => {
    const utility = utilityName(REQUIRED[0]);
    const css = compiled().replace(`.${utility}{color:red}`, "");
    const { ok, lines } = auditStylesheets(sheet(css));

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain(
      `FAIL  ${utility} emits no declarations`,
    );
  });

  // Absence has to be asserted as well as presence: a broken exclusion is how
  // prose gets back into the shipped stylesheet.
  test("fails when a forbidden utility is present", () => {
    const utility = utilityName(FORBIDDEN[0]);
    const { ok, lines } = auditStylesheets(
      sheet(`${compiled()}.${utility}{scroll-snap-type:none}`),
    );

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain(`FAIL  ${utility} is in the built CSS`);
  });

  test("fails on a forbidden utility mentioned anywhere, rule or not", () => {
    const utility = utilityName(FORBIDDEN[0]);
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
    const split = REQUIRED.map((expectation, index) => ({
      path: `${index}.css`,
      css: `.${utilityName(expectation)}{color:red}`,
    }));

    expect(auditStylesheets(split).ok).toBe(true);
  });

  test("names the files it read", () => {
    const { lines } = auditStylesheets(sheet(compiled()));
    expect(lines[0]).toBe("read  built.css");
  });

  // An empty table would make the row green while asserting nothing at all.
  test("both expectation tables have rows", () => {
    expect(FORBIDDEN.length).toBeGreaterThan(0);
    expect(REQUIRED.length).toBeGreaterThan(0);
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

// The regression that made this row assert nothing on its first run: Tailwind
// scans scripts/, so a utility named here in full compiles into the stylesheet
// this row reads. The forbidden one then always fails and the required ones
// always pass, whatever the app does. Names are built at runtime for the same
// reason. Delete this once issue #24 makes source detection opt-in for src/.
describe("the checker's own sources", () => {
  test("no file under scripts/ spells a utility the table checks", () => {
    // import.meta.dirname, not a URL derived from import.meta.url: the jsdom
    // environment shadows the global URL, and Node's fileURLToPath rejects
    // what jsdom's constructor returns for a file: URL.
    const directory = import.meta.dirname;
    const utilities = [...FORBIDDEN, ...REQUIRED].map(utilityName);
    const offenders = [];

    for (const name of readdirSync(directory)) {
      if (!name.endsWith(".mjs")) continue;
      const source = readFileSync(join(directory, name), "utf8");
      for (const utility of utilities) {
        if (source.includes(utility)) offenders.push(`${name}: ${utility}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
