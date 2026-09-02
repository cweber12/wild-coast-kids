/**
 * What the built stylesheet must and must not contain, and the reading of it.
 *
 * Tailwind compiles a utility only when it finds the class name in a scanned
 * source, so the built stylesheet is where you learn whether a utility emits
 * real CSS or silently resolves to nothing. That reading only holds while
 * nothing outside the app feeds the scanner, which is what the `source(none)`
 * import in src/app/globals.css is for. Both directions are asserted here:
 * absence alone is also satisfied by a source list that compiled nothing.
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
 * @typedef {object} Expectation
 * @property {string} utility  The class name, as it is written in src/.
 * @property {string} why      Printed with the row, so a failure explains itself.
 */

/** Utilities that must appear nowhere in the built stylesheet. */
/** @type {Expectation[]} */
export const FORBIDDEN = [
  {
    utility: "snap-none",
    why: "in no file under src/. CLAUDE.md's Project invariants names it while stating that prose never reaches the stylesheet, and that sentence is this row's canary: a root Markdown file is exactly what the opt-out arrangement could not exclude, so its return means detection has stopped being opt-in",
  },
];

/**
 * At-rules that must appear *and* wrap at least one rule that declares
 * something.
 *
 * A `REQUIRED` row cannot do this job. An unregistered `@custom-variant` makes
 * every class using it compile to nothing at all, silently, while the class
 * name stays in the markup where jsdom still finds it — so the class contract
 * in the component tests cannot see the failure either. The obvious utility to
 * require instead, `snap-start`, is also written bare on the gallery tiles, so
 * a rule for it exists either way: a false pass. Only the at-rule proves both
 * that Tailwind registered the variant and that it registered *these*
 * conditions.
 *
 * A prelude holds no class name, so unlike the tables above these are plain
 * strings — there is nothing here for Tailwind's scanner to compile.
 *
 * @typedef {object} AtRuleExpectation
 * @property {string} prelude  Verbatim, as the minified build emits it.
 * @property {string} why      Printed with the row, so a failure explains itself.
 */

/** @type {AtRuleExpectation[]} */
export const AT_RULES = [
  {
    prelude: "@media (min-width:64rem) and (min-height:39rem)",
    why: "the `stops` variant gates the landing page's one-screen layout on it; 39rem is the trimmed height a stop needs plus the nav, and it has to stay under the 640px ceiling a 125%-scaled 1080p display imposes — see docs/plans/stop-height-threshold.md",
  },
  {
    prelude: "@container not (min-width:134px)",
    why: "WeekGrid drops the day shape below the width it stops reading at, measured on the built page at 110px of shape plus the 24px of padding around it — the border is outside it because a container query resolves against the content box. The class name stays in the markup whether or not Tailwind registered the container variant, so jsdom cannot see this fail and only the emitted at-rule proves the rule exists. It does not fire today — the narrowest cell the grid renders is 158.8px -- which is exactly why nothing else would notice it going missing",
  },
  {
    prelude: "@media not all and (min-width:40rem)",
    why: "HourChart changes shape rather than size on a phone: below `sm` the plot frame is 2:1 and the drawing stretches to fill it, because its own 3.27:1 renders 72px at 375 against 246px at 1536 — one ratio cannot serve both, measured on the built page. The same at-rule drops a dense series' published-point marks, whose white rings read as gaps in the curve at that width. Both are `max-sm:` classes, and a class name sits in the markup whether or not Tailwind emitted a rule for it, so jsdom finds it either way and only the built stylesheet proves the rule exists",
  },
];

/** Utilities that must appear *and* emit at least one declaration. */
/** @type {Expectation[]} */
export const REQUIRED = [
  {
    utility: "justify-center-safe",
    why: "SnapSection centres a stop's content with it, and safe centring is what keeps an over-tall section reachable",
  },
  {
    utility: "min-h-footer",
    why: "Footer takes its height from the --spacing-footer token through it",
  },
  {
    utility: "scroll-pt-nav-sm",
    why: "the root element offsets every snap stop by the nav height with it",
  },
  {
    utility: "scroll-pl-gutter-sm",
    why: "GalleryRow keeps its snapport off its own gutter with it; resolving to nothing puts the row back to resting one gutter in, which the class contract cannot see because the class name stays in the markup either way",
  },
  {
    utility: "scroll-pl-gutter",
    why: "the same, at the width where the gutter is 48px. Written in src/ only as md:scroll-pl-gutter, so this is the bare form for the reason min-h-footer above is — the built selector escapes the variant into the class name. The trailing boundary is what keeps it off scroll-pl-gutter-sm's rule",
  },
  {
    utility: "text-tool-title",
    why: "the /conditions <h1> takes its size from the --text-tool-title token through it. The tool register exists because six other pages take --text-title and none of them opens on a figure, so nothing outside that page would notice the token going: the class name stays in the markup either way and jsdom applies no stylesheets, which leaves a 56px headline silently becoming an inherited 16px one",
  },
  {
    utility: "text-tool-region",
    why: "the same, one rank down: TOOL_REGION_HEADING sets the three /conditions region headings from --text-tool-region. This one fails more quietly still — losing the token drops the headings to inherited size, which reads as a spacing regression rather than as a missing rule, and the class contract in headingRank's tests asserts the reference rather than the rendered rank",
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
 * The token may be variant-prefixed, and one of the required utilities has no
 * other form: `min-h-footer` is written in src/ only as `md:min-h-footer`, so
 * the built selector escapes the variant into the class name and a matcher
 * anchored on a leading dot would report a working utility as missing.
 * Matching a bare substring instead would count a mention in a comment as a
 * pass, which is the failure this whole check exists to remove.
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
 * Every rule inside `css` that has a selector and declares something, as
 * `selector{body}` pairs. Used to read an at-rule's contents as evidence.
 *
 * @param {string} css
 * @returns {string[]} The selectors, in source order.
 */
function selectorsIn(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => DECLARATION.test(match[2]))
    .map((match) => match[1].trim())
    .filter((selector) => !selector.startsWith("@"));
}

/**
 * The body of every at-rule in `css` with this prelude.
 *
 * Brace-balanced rather than matched with a regex: the `stops` variant nests
 * inside `@media (prefers-reduced-motion:no-preference)` for the snap classes,
 * and `[^{}]*` would stop at the first inner brace and report an at-rule that
 * wraps working rules as empty.
 *
 * @param {string} css
 * @param {string} prelude
 * @returns {string[]}
 */
export function atRuleBodies(css, prelude) {
  const bodies = [];
  const opener = `${prelude}{`;

  for (let from = 0; ;) {
    const start = css.indexOf(opener, from);
    if (start === -1) return bodies;

    let depth = 0;
    let end = start + prelude.length;
    for (; end < css.length; end += 1) {
      if (css[end] === "{") depth += 1;
      else if (css[end] === "}" && (depth -= 1) === 0) break;
    }

    bodies.push(css.slice(start + opener.length, end));
    from = end + 1;
  }
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

  for (const { utility, why } of FORBIDDEN) {
    if (css.includes(utility)) {
      ok = false;
      lines.push(`FAIL  ${utility} is in the built CSS — ${why}`);
    } else {
      lines.push(`ok    ${utility} absent`);
    }
  }

  for (const { utility, why } of REQUIRED) {
    const rules = rulesFor(css, utility);
    if (rules.length === 0) {
      ok = false;
      lines.push(`FAIL  ${utility} emits no declarations — ${why}`);
    } else {
      for (const rule of rules) lines.push(`ok    ${rule}`);
    }
  }

  for (const { prelude, why } of AT_RULES) {
    const wrapped = atRuleBodies(css, prelude).flatMap(selectorsIn);
    if (wrapped.length === 0) {
      ok = false;
      lines.push(
        `FAIL  ${prelude} wraps no rule that declares anything — ${why}`,
      );
    } else {
      lines.push(`ok    ${prelude} wraps ${wrapped.join(" ")}`);
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
