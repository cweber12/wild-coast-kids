import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  adrNumber,
  auditAdrs,
  checkAdrNumbers,
  findAdrs,
  headingNumber,
} from "./adr-numbers.mjs";

/** An ADR as `findAdrs` yields it, so tests can break one field at a time. */
const adr = (number, overrides = {}) => ({
  file: `docs/adr/${number}-a-decision.md`,
  number,
  heading: number,
  ...overrides,
});

const temporary = [];

/** A throwaway ADR directory, so the filesystem walk is tested for real. */
const adrDirectory = (files) => {
  const root = mkdtempSync(join(tmpdir(), "adr-numbers-"));
  temporary.push(root);
  for (const [name, contents] of Object.entries(files)) {
    const full = join(root, name);
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

describe("adrNumber", () => {
  test("reads the four digits a filename opens with", () => {
    expect(adrNumber("0008-gallery-controls-outside-the-artwork.md")).toBe(
      "0008",
    );
  });

  // Leading zeros are part of the identifier: ADR-0008 is how it is cited, and
  // a number parsed to 8 would collide with nothing and sort wrongly.
  test("keeps the leading zeros rather than parsing a value", () => {
    expect(adrNumber("0012-sky-and-visibility.md")).toBe("0012");
  });

  test("rejects a name with no number", () => {
    expect(adrNumber("README.md")).toBeNull();
  });

  test("rejects a number that is not four digits", () => {
    expect(adrNumber("12-too-short.md")).toBeNull();
    expect(adrNumber("00012-too-long.md")).toBeNull();
  });

  test("rejects a number with no slug after it", () => {
    expect(adrNumber("0008.md")).toBeNull();
  });
});

describe("headingNumber", () => {
  test("reads the number the first heading declares", () => {
    expect(
      headingNumber("# 0008 — The gallery's paging controls sit outside\n"),
    ).toBe("0008");
  });

  // The separator is not the gate's business, so a title punctuated any other
  // way still reads. Pinning the em dash would fail an ordinary copy edit.
  test("does not care how the number is separated from the title", () => {
    expect(headingNumber("#0008: a decision\n")).toBe("0008");
  });

  // A document citing another ADR in its prose is the common case, and reading
  // past the first line would take that citation for the document's own number.
  test("ignores a number in a heading further down", () => {
    expect(headingNumber("# 0013 — Supabase\n\n## See also\n\n# 0008\n")).toBe(
      "0013",
    );
  });

  test("is null when the document does not open with a number", () => {
    expect(headingNumber("# Supabase is read over plain fetch\n")).toBeNull();
  });
});

describe("auditAdrs", () => {
  test("passes when every number is unique and matches its heading", () => {
    const { ok, lines } = auditAdrs([adr("0001"), adr("0002"), adr("0003")]);
    expect(ok).toBe(true);
    expect(lines).toHaveLength(3);
  });

  // The #102 regression. Two unrelated decisions were filed as 0008 for two
  // days and every gate stayed green; this is the assertion that goes red.
  test("fails when two files share a number, naming both", () => {
    const { ok, lines } = auditAdrs([
      { ...adr("0008"), file: "docs/adr/0008-gallery-controls.md" },
      { ...adr("0008"), file: "docs/adr/0008-supabase-reads.md" },
    ]);

    expect(ok).toBe(false);
    expect(lines).toContainEqual(
      expect.stringContaining("docs/adr/0008-gallery-controls.md"),
    );
    expect(lines).toContainEqual(
      expect.stringContaining("docs/adr/0008-supabase-reads.md"),
    );
  });

  // Found by running the row against a real duplicate: both files were named
  // in the FAIL and then listed again as `ok` further down, which reads as
  // though one of the two were the fine one.
  test("does not also list a colliding file as ok", () => {
    const { lines } = auditAdrs([
      { ...adr("0008"), file: "docs/adr/0008-gallery-controls.md" },
      { ...adr("0008"), file: "docs/adr/0008-supabase-reads.md" },
      adr("0009"),
    ]);

    expect(lines.filter((line) => line.startsWith("ok"))).toEqual([
      expect.stringContaining("0009"),
    ]);
  });

  test("reports a number claimed three times once, not as three pairs", () => {
    const { ok, lines } = auditAdrs([
      { ...adr("0008"), file: "a.md" },
      { ...adr("0008"), file: "b.md" },
      { ...adr("0008"), file: "c.md" },
    ]);

    expect(ok).toBe(false);
    expect(lines.filter((line) => line.startsWith("FAIL"))).toHaveLength(1);
  });

  // The state a filename-only check passes: #102 renamed the file and edited
  // its `# 0008` heading as two separate steps.
  test("fails when the heading disagrees with the filename", () => {
    const { ok, lines } = auditAdrs([adr("0013", { heading: "0008" })]);

    expect(ok).toBe(false);
    expect(lines).toContainEqual(
      expect.stringContaining('opens with "# 0008"'),
    );
  });

  test("fails when a document opens with no number at all", () => {
    const { ok } = auditAdrs([adr("0013", { heading: null })]);
    expect(ok).toBe(false);
  });

  test("fails a file in the directory that is not named NNNN-slug.md", () => {
    const { ok, lines } = auditAdrs([
      { file: "docs/adr/notes.md", number: null, heading: null },
    ]);

    expect(ok).toBe(false);
    expect(lines).toContainEqual(expect.stringContaining("docs/adr/notes.md"));
  });

  // Not a skip: an empty result means the walk found nothing where the
  // decisions are meant to be, and green would mean the row checked nothing.
  test("fails on an empty directory rather than passing vacuously", () => {
    expect(auditAdrs([]).ok).toBe(false);
  });
});

describe("findAdrs", () => {
  test("reads each ADR's number and heading off the disk", () => {
    const root = adrDirectory({
      "0001-test-runner.md": "# 0001 — Vitest as the test runner\n",
      "0002-gate-runner.md": "# 0002 — A Node script with a table\n",
    });

    expect(findAdrs(root).adrs).toEqual([
      {
        file: join(root, "0001-test-runner.md"),
        number: "0001",
        heading: "0001",
      },
      {
        file: join(root, "0002-gate-runner.md"),
        number: "0002",
        heading: "0002",
      },
    ]);
  });

  test("orders by name, so a failure reads the same way twice", () => {
    const root = adrDirectory({
      "0003-c.md": "# 0003\n",
      "0001-a.md": "# 0001\n",
      "0002-b.md": "# 0002\n",
    });

    expect(findAdrs(root).adrs.map((found) => found.number)).toEqual([
      "0001",
      "0002",
      "0003",
    ]);
  });

  // Reported rather than dropped: a stray asset is not a numbering question,
  // but a directory that quietly ignores files is how the next one hides.
  test("names what it did not read instead of ignoring it", () => {
    const root = adrDirectory({
      "0001-a.md": "# 0001\n",
      "diagram.png": "not markdown",
    });

    const { adrs, skipped } = findAdrs(root);
    expect(adrs).toHaveLength(1);
    expect(skipped).toEqual([join(root, "diagram.png")]);
  });

  test("yields nothing for a directory that is not there", () => {
    expect(findAdrs(join(tmpdir(), "adr-numbers-absent")).adrs).toEqual([]);
  });
});

describe("checkAdrNumbers", () => {
  test("passes a well-formed directory", () => {
    const root = adrDirectory({
      "0001-a.md": "# 0001 — A decision\n",
      "0002-b.md": "# 0002 — Another decision\n",
    });

    expect(checkAdrNumbers(root).ok).toBe(true);
  });

  test("fails a directory holding the #102 collision", () => {
    const root = adrDirectory({
      "0008-gallery-controls.md": "# 0008 — Controls outside the artwork\n",
      "0008-supabase-reads.md": "# 0008 — Supabase over plain fetch\n",
    });

    const { ok, lines } = checkAdrNumbers(root);
    expect(ok).toBe(false);
    expect(lines).toContainEqual(expect.stringContaining("0008 names 2"));
  });

  test("carries what was skipped into the output it prints", () => {
    const root = adrDirectory({
      "0001-a.md": "# 0001\n",
      "diagram.png": "not markdown",
    });

    expect(checkAdrNumbers(root).lines).toContainEqual(
      expect.stringContaining("diagram.png"),
    );
  });

  // The gate's real subject. If this ever goes red, two decisions are sharing
  // a number in the repo right now.
  test("passes the repository's own ADRs", () => {
    expect(checkAdrNumbers("docs/adr").ok).toBe(true);
  });
});
