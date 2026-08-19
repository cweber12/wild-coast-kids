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

/**
 * A beach a data file records that it does not serve. The same failure mode as
 * an unread caveat and a worse one: a reader cannot notice what they were never
 * shown, so a beach leaving the inventory has to leave a record behind it.
 */
function excludedIn(file: string): {
  slug?: string;
  name?: string;
  why?: string;
}[] {
  const parsed = JSON.parse(readFileSync(join(DATA_DIRECTORY, file), "utf8"));
  const entries = parsed._excluded;
  if (entries === undefined) return [];
  expect(Array.isArray(entries), `${file}: _excluded must be an array`).toBe(
    true,
  );
  return entries;
}

describe("every excluded beach", () => {
  test("the walk finds exclusions to check, so a green run is not an empty one", () => {
    // Two-sided, like the caveat walk below: a discovery that found nothing
    // would satisfy every assertion here and assert nothing at all.
    expect(dataFiles().flatMap(excludedIn).length).toBeGreaterThan(0);
  });

  test("names which beach it was, and why it is not served", () => {
    for (const file of dataFiles()) {
      for (const entry of excludedIn(file)) {
        expect(typeof entry.slug).toBe("string");
        expect(entry.slug?.trim().length ?? 0).toBeGreaterThan(0);
        expect(typeof entry.name).toBe("string");
        expect(entry.name?.trim().length ?? 0).toBeGreaterThan(0);
        expect(
          entry.why?.trim().length ?? 0,
          `${file}: ${entry.slug} was excluded with no reason recorded`,
        ).toBeGreaterThan(0);
      }
    }
  });

  test("is not also served by the same file, which would be a contradiction", () => {
    for (const file of dataFiles()) {
      const parsed = JSON.parse(
        readFileSync(join(DATA_DIRECTORY, file), "utf8"),
      );
      const served = new Set(
        (parsed.beaches ?? []).map((beach: { slug: string }) => beach.slug),
      );
      for (const entry of excludedIn(file)) {
        expect(
          served.has(entry.slug),
          `${file}: ${entry.slug} is both listed and excluded`,
        ).toBe(false);
      }
    }
  });
});

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
