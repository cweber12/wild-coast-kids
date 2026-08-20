/**
 * Every ADR is identified by exactly one number — the `adr-numbers` gate row.
 *
 * Two unrelated decisions were both filed as ADR-0008 for two days (#102), and
 * the fourteen bare `ADR-0008` citations in the repo could not be told apart.
 * Nothing observed it: both halves were written on separate branches that
 * could not see each other, and the gate had nothing to say. See
 * docs/plans/adr-number-gate.md.
 *
 * The verdict is a pure function over a list, so the duplicate case is tested
 * without a duplicate existing in the tree. Only `findAdrs` and
 * `checkAdrNumbers` touch the filesystem (ADR-0002, the same split as
 * built-css.mjs).
 *
 * This reports; it never renumbers. Which of two colliding documents moves is
 * a judgement — #102 moved Supabase because the gallery had the number first —
 * and it rewrites citations across the repo. `docs/adr/` is an input.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Where the decisions live, relative to the repo root. */
export const ADR_ROOT = "docs/adr";

/**
 * `0008-gallery-controls-outside-the-artwork.md` — four digits, then a slug.
 * The slug is not inspected: its casing and wording are style, and a gate that
 * polices them fails an ordinary rename for no benefit.
 */
const FILENAME = /^(\d{4})-.+\.md$/;

/**
 * `# 0008 — The gallery's paging controls sit outside the artwork`.
 *
 * The number alone. All thirteen ADRs spell the separator as an em dash today,
 * but pinning it would make this a style rule and fail a title edit that got
 * the number right.
 */
const HEADING = /^#\s*(\d{4})\b/;

/**
 * @typedef {object} Adr
 * @property {string} file     Path as read, so a failure can be acted on.
 * @property {string|null} number   From the filename; null when it has none.
 * @property {string|null} heading  From the `# NNNN` line; null when it has none.
 */

/**
 * @typedef {object} Audit
 * @property {boolean} ok
 * @property {string[]} lines  What to print, whether it passed or failed.
 */

/**
 * The number a filename claims, or null if it is not shaped like an ADR.
 *
 * @param {string} filename  A bare name, not a path.
 * @returns {string|null}
 */
export function adrNumber(filename) {
  return FILENAME.exec(filename)?.[1] ?? null;
}

/**
 * The number the first heading declares, or null if the document opens with
 * something other than `# NNNN`.
 *
 * Only the first line is read. A `# 0008` deeper in the prose is a citation
 * inside the document, not the document announcing itself.
 *
 * @param {string} text  The whole file.
 * @returns {string|null}
 */
export function headingNumber(text) {
  // `split` always yields at least one element, `""` for empty input, so the
  // first line needs no fallback and a `?? ""` here would be a branch no test
  // could ever reach.
  return HEADING.exec(text.split("\n", 1)[0])?.[1] ?? null;
}

/**
 * Read every expectation against the ADRs found on disk.
 *
 * @param {Adr[]} adrs
 * @returns {Audit}
 */
export function auditAdrs(adrs) {
  // An empty docs/adr/ means the walk found nothing where the decisions are
  // meant to be — a moved directory, or a typo in ADR_ROOT. Passing would make
  // this row green for exactly the state in which it is checking nothing.
  if (adrs.length === 0) {
    return {
      ok: false,
      lines: [`FAIL  no ADRs found in ${ADR_ROOT}/ — is the directory there?`],
    };
  }

  const lines = [];
  const failed = new Set();

  const fail = (file, message) => {
    failed.add(file);
    lines.push(`FAIL  ${message}`);
  };

  const numbered = adrs.filter((adr) => adr.number !== null);

  for (const adr of adrs) {
    if (adr.number === null) {
      fail(adr.file, `${adr.file} is not named NNNN-slug.md`);
    }
  }

  // Grouped rather than compared pairwise so a number claimed three times is
  // reported once, naming all three, instead of as three overlapping pairs.
  const byNumber = new Map();
  for (const adr of numbered) {
    byNumber.set(adr.number, [...(byNumber.get(adr.number) ?? []), adr.file]);
  }

  for (const [number, files] of [...byNumber].sort()) {
    if (files.length > 1) {
      // Both names, because fixing it means choosing which one moves, and that
      // choice needs to see what the other document is about.
      for (const file of files) failed.add(file);
      lines.push(`FAIL  ${number} names ${files.length}: ${files.join(", ")}`);
    }
  }

  for (const adr of numbered) {
    if (adr.heading === null) {
      fail(adr.file, `${adr.file} does not open with "# ${adr.number}"`);
    } else if (adr.heading !== adr.number) {
      // The state a filename-only check passes: renamed, heading not yet
      // caught up. #102 fixed exactly this by hand.
      fail(
        adr.file,
        `${adr.file} opens with "# ${adr.heading}" — renamed but not retitled?`,
      );
    }
  }

  // Only what nothing failed on, and after the failures rather than among
  // them. A colliding file listed as `ok` three lines below its own FAIL
  // reads as though it were the fine one of the two.
  for (const adr of numbered) {
    if (!failed.has(adr.file)) lines.push(`ok    ${adr.number}  ${adr.file}`);
  }

  return { ok: failed.size === 0, lines };
}

/**
 * Every ADR directly in `directory`, in a stable order, with its first line.
 *
 * Flat and markdown-only on purpose: the series is flat, and a stray asset
 * beside it is not a numbering question. Anything skipped says so in the
 * output rather than vanishing. A missing directory yields none, which
 * `auditAdrs` fails on.
 *
 * @param {string} directory
 * @returns {{ adrs: Adr[], skipped: string[] }}
 */
export function findAdrs(directory) {
  if (!existsSync(directory)) return { adrs: [], skipped: [] };

  const adrs = [];
  const skipped = [];

  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = join(directory, entry.name);

    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      skipped.push(path);
      continue;
    }

    adrs.push({
      file: path,
      number: adrNumber(entry.name),
      heading: headingNumber(readFileSync(path, "utf8")),
    });
  }

  return { adrs, skipped };
}

/**
 * @param {string} directory
 * @returns {Audit}
 */
export function checkAdrNumbers(directory) {
  const { adrs, skipped } = findAdrs(directory);
  const { ok, lines } = auditAdrs(adrs);

  return {
    ok,
    lines: [
      ...skipped.map((path) => `note  ${path} not read, not markdown`),
      ...lines,
    ],
  };
}
