import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { inventoryCaveats } from "./beaches";

/**
 * The gate that stops a caveat reaching nobody.
 *
 * Every data file may carry an `unresolved` array. The entries are written for
 * the person acting on the number, so one that only a maintainer ever sees has
 * failed at its whole purpose. These assertions walk the data directory rather
 * than a list, so a file added later is discovered instead of forgotten — the
 * failure mode being guarded against is a new file whose caveats nothing loads,
 * which no amount of care prevents and a walk does.
 *
 * The path is resolved from the working directory rather than `import.meta.url`,
 * which is not a `file:` URL under this test environment.
 */
const DATA_DIRECTORY = join(process.cwd(), "src", "data");

function dataFiles(): string[] {
  return readdirSync(DATA_DIRECTORY).filter((name) => name.endsWith(".json"));
}

function unresolvedIn(file: string): string[] {
  const parsed = JSON.parse(readFileSync(join(DATA_DIRECTORY, file), "utf8"));
  const entries = parsed.unresolved;
  if (entries === undefined) return [];
  expect(Array.isArray(entries), `${file}: unresolved must be an array`).toBe(
    true,
  );
  return entries;
}

describe("every data file's caveats", () => {
  test("the walk finds files to check, so a green run is not an empty one", () => {
    // Two-sided: a discovery that found nothing would satisfy every assertion
    // below and assert nothing at all.
    const files = dataFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.flatMap(unresolvedIn).length).toBeGreaterThan(0);
  });

  test("are all loaded, whichever file they are in", () => {
    const loaded = new Set(inventoryCaveats());

    for (const file of dataFiles()) {
      for (const entry of unresolvedIn(file)) {
        expect(
          loaded.has(entry),
          `${file} carries a caveat that nothing loads, so no reader will ever see it:\n  ${entry}`,
        ).toBe(true);
      }
    }
  });

  test("are non-empty strings, since an empty one warns nobody", () => {
    for (const file of dataFiles()) {
      for (const entry of unresolvedIn(file)) {
        expect(typeof entry).toBe("string");
        expect(entry.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("carry nothing the data files do not, so none is invented in code", () => {
    const onDisk = new Set(dataFiles().flatMap(unresolvedIn));
    for (const entry of inventoryCaveats()) {
      expect(
        onDisk.has(entry),
        `a caveat is being shown that no data file carries:\n  ${entry}`,
      ).toBe(true);
    }
  });
});
