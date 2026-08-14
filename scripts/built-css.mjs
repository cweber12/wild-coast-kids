/**
 * What the built stylesheet must and must not contain, and the reading of it.
 *
 * Tailwind compiles a utility only when it finds the class name in a scanned
 * source, so the built stylesheet is where you learn whether a utility emits
 * real CSS or silently resolves to nothing. That reading only holds while
 * nothing outside the app feeds the scanner, which is what the `@source not`
 * lines in src/app/globals.css are for. Both directions are asserted here:
 * absence alone is also satisfied by an exclusion that compiled nothing.
 *
 * The only filesystem call takes the directory to read as an argument, so the
 * whole file is tested against a temp directory rather than a real build. Add
 * an expectation by adding a row. See docs/plans/assert-built-stylesheet.md.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Where `next build` leaves the app's CSS. The chunk filename is
 * content-hashed, and Next 16 moved app CSS from `css/` to `chunks/` inside
 * this directory — which is the drift that made the prose version of this
 * check silently match nothing — so the walk starts one level above both.
 */
export const STYLESHEET_ROOT = ".next/static";

/**
 * An expectation names its utility in segments rather than as a whole class
 * name, and `scripts/` is the reason: Tailwind's automatic source detection
 * scans this directory exactly as it scanned `docs/` before PR #22, so a
 * literal class name written here compiles into the very stylesheet this file
 * reads. That does not merely fail the row, it empties it — the forbidden name
 * would be present because this table names it, and the required ones would
 * emit from this table rather than from the app. No segment below is a
 * Tailwind utility on its own, so nothing compiles from them.
 *
 * `built-css.test.mjs` walks scripts/ and fails if any file spells one of
 * these names, so this stays true without anyone having to remember it.
 *
 * Issue #24 proposes replacing the exclusions with a positive `@source` for
 * `src/`, which inverts detection to opt-in and covers this directory. When it
 * lands, delete that test and make these plain strings.
 *
 * @typedef {object} Expectation
 * @property {string[]} segments  The class name, split so no part is a utility.
 * @property {string} why         Printed with the row, so a failure explains itself.
 */

/** @param {Expectation} expectation @returns {string} */
export function utilityName({ segments }) {
  return segments.join("-");
}

/** Utilities that must appear nowhere in the built stylesheet. */
/** @type {Expectation[]} */
export const FORBIDDEN = [
  {
    segments: ["snap", "none"],
    why: "in no file under src/; only prose in docs/plans/section-snapping.md, so its return means a directory outside the app is feeding Tailwind's scanner",
  },
];

/** Utilities that must appear *and* emit at least one declaration. */
/** @type {Expectation[]} */
export const REQUIRED = [
  {
    segments: ["justify", "center", "safe"],
    why: "SnapSection centres a stop's content with it, and safe centring is what keeps an over-tall section reachable",
  },
  {
    segments: ["min", "h", "footer"],
    why: "Footer takes its height from the --spacing-footer token through it",
  },
  {
    segments: ["scroll", "pt", "nav", "sm"],
    why: "the root element offsets every snap stop by the nav height with it",
  },
];

/** A rule body counts as emitting CSS only if it holds a declaration. */
const DECLARATION = /[\w-]+\s*:\s*\S/;

/**
 * @param {string} text
 * @returns {string}
 */
function escapeForRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every rule in `css` whose selector carries this utility as a class token and
 * whose body holds at least one declaration.
 *
 * The token may be variant-prefixed: two of the required utilities are used in
 * src/ only under `md:`, so the built selector escapes the variant into the
 * class name and a matcher anchored on a leading dot would report a working
 * utility as missing. Matching a bare substring instead would count a mention
 * in a comment as a pass, which is the failure this whole check exists to
 * remove.
 *
 * @param {string} css
 * @param {string} utility
 * @returns {string[]} The matched rules, verbatim, for printing as evidence.
 */
export function rulesFor(css, utility) {
  const rule = new RegExp(
    `\\.[^{}(),\\s]*?${escapeForRegExp(utility)}(?![\\w-])[^{}]*\\{([^{}]*)\\}`,
    "g",
  );

  return [...css.matchAll(rule)]
    .filter((match) => DECLARATION.test(match[1]))
    .map((match) => match[0]);
}

/**
 * @typedef {object} Stylesheet
 * @property {string} path
 * @property {string} css
 */

/**
 * @typedef {object} Audit
 * @property {boolean} ok
 * @property {string[]} lines  What to print, whether it passed or failed.
 */

/**
 * Read every expectation against the stylesheets the build emitted.
 *
 * @param {Stylesheet[]} stylesheets
 * @returns {Audit}
 */
export function auditStylesheets(stylesheets) {
  // Not a skip: this row runs after `build` in the same gate run, so nothing
  // to read means the build produced nothing to read. Reporting it as anything
  // but a failure reproduces the false pass the row exists to eliminate.
  if (stylesheets.length === 0) {
    return {
      ok: false,
      lines: ["FAIL  no stylesheet to read — did `npm run build` produce one?"],
    };
  }

  const css = stylesheets.map((sheet) => sheet.css).join("\n");
  const lines = stylesheets.map((sheet) => `read  ${sheet.path}`);
  let ok = true;

  for (const expectation of FORBIDDEN) {
    const utility = utilityName(expectation);
    if (css.includes(utility)) {
      ok = false;
      lines.push(`FAIL  ${utility} is in the built CSS — ${expectation.why}`);
    } else {
      lines.push(`ok    ${utility} absent`);
    }
  }

  for (const expectation of REQUIRED) {
    const utility = utilityName(expectation);
    const rules = rulesFor(css, utility);
    if (rules.length === 0) {
      ok = false;
      lines.push(`FAIL  ${utility} emits no declarations — ${expectation.why}`);
    } else {
      for (const rule of rules) lines.push(`ok    ${rule}`);
    }
  }

  return { ok, lines };
}

/**
 * Every `.css` file under `directory`, at any depth, in a stable order.
 * A missing directory yields none, which `auditStylesheets` fails on.
 *
 * @param {string} directory
 * @returns {string[]}
 */
export function findStylesheets(directory) {
  if (!existsSync(directory)) return [];

  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findStylesheets(path));
    else if (entry.name.endsWith(".css")) found.push(path);
  }

  return found.sort();
}

/**
 * @param {string} directory
 * @returns {Audit}
 */
export function checkBuiltCss(directory) {
  const stylesheets = findStylesheets(directory).map((path) => ({
    path,
    css: readFileSync(path, "utf8"),
  }));

  return auditStylesheets(stylesheets);
}
