import { describe, expect, it } from "vitest";
import { checkAreaPartition } from "./areas-partition.mjs";
import AREAS from "../src/data/areas.json" with { type: "json" };
import BEACHES from "../src/data/beaches.json" with { type: "json" };

/**
 * Three beaches on one coast, north to south, in two areas. Small enough that
 * every failure below is one edit away from it.
 */
function fabricated() {
  return {
    beaches: [
      { slug: "north-cove", name: "North Cove" },
      { slug: "middle-strand", name: "Middle Strand" },
      { slug: "south-point", name: "South Point" },
    ],
    areas: [
      { slug: "the-north", name: "The North", beaches: ["north-cove"] },
      {
        slug: "the-south",
        name: "The South",
        beaches: ["middle-strand", "south-point"],
      },
    ],
  };
}

describe("checkAreaPartition", () => {
  it("accepts a total, disjoint, north-to-south partition", () => {
    const { ok, lines } = checkAreaPartition(fabricated());

    expect(ok).toBe(true);
    expect(lines.join("\n")).toContain("3 beaches in 2 areas");
  });

  /**
   * The failure the row exists for. `seed-beaches.mjs` rewrites the inventory
   * from an upstream resource, so a beach can arrive without anybody naming its
   * area — and it is then unreachable from the chooser with nothing thrown.
   */
  it("rejects a beach that belongs to no area, and names it", () => {
    const tables = fabricated();
    tables.beaches.push({ slug: "new-upstream-beach", name: "New Beach" });

    const { ok, lines } = checkAreaPartition(tables);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("new-upstream-beach");
    expect(lines.join("\n")).toContain("belongs to no area");
  });

  it("rejects a beach claimed by two areas, and names both", () => {
    const tables = fabricated();
    tables.areas[0].beaches.push("south-point");

    const { ok, lines } = checkAreaPartition(tables);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("claimed by 2 areas");
    expect(lines.join("\n")).toContain('"the-north"');
    expect(lines.join("\n")).toContain('"the-south"');
  });

  it("rejects an area naming a slug the inventory does not have", () => {
    const tables = fabricated();
    tables.areas[1].beaches.push("renamed-upstream");

    const { ok, lines } = checkAreaPartition(tables);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("not in beaches.json");
  });

  it("rejects an empty area", () => {
    const tables = fabricated();
    tables.areas.push({ slug: "nowhere", name: "Nowhere", beaches: [] });

    const { ok, lines } = checkAreaPartition(tables);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("has no beaches");
  });

  it("rejects two areas sharing a slug", () => {
    const tables = fabricated();
    tables.areas[1].slug = "the-north";

    const { ok, lines } = checkAreaPartition(tables);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("used twice");
  });

  it("rejects members listed out of the inventory's order", () => {
    const tables = fabricated();
    tables.areas[1].beaches = ["south-point", "middle-strand"];

    const { ok, lines } = checkAreaPartition(tables);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("Members run north to south");
  });

  it("rejects areas listed out of the inventory's order", () => {
    const tables = fabricated();
    tables.areas.reverse();

    const { ok, lines } = checkAreaPartition(tables);

    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("Areas run north to south");
  });

  /**
   * The committed tables, checked here as well as by the gate row. The row is
   * what fails a build; this is what fails a test run, so a partition broken by
   * an edit to either file is caught without waiting for the slower gate.
   */
  it("holds for the committed inventory", () => {
    const { ok, lines } = checkAreaPartition({
      areas: AREAS.areas,
      beaches: BEACHES.beaches,
    });

    expect(lines.join("\n")).toContain("total and disjoint");
    expect(ok).toBe(true);
  });
});
