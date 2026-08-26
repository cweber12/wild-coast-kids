import { describe, expect, it } from "vitest";
import inventory from "../src/data/beaches.json" with { type: "json" };
import { SHELTERED, shelteredReason } from "./sheltered.mjs";

describe("shelteredReason", () => {
  it("gives null for a beach no structure closes", () => {
    // Shell Beach is 396 m from Children's Pool and open to the same swell.
    // The criterion must not spread along a coast made largely of coves.
    expect(shelteredReason("shell-beach", "buoy")).toBeNull();
  });

  it("gives null for a beach that is not in the inventory at all", () => {
    expect(shelteredReason(undefined, "buoy")).toBeNull();
  });

  it("composes the structure, the source's clause and the stakes, in that order", () => {
    const reason = shelteredReason("childrens-pool", "buoy");
    expect(reason).toMatch(/^a curved breakwater encloses the cove/);
    expect(reason).toContain("The nearest buoy is 2.50 km away");
    expect(reason).toMatch(/put children in the water\.$/);
  });

  it("still composes exactly what the committed inventory holds", () => {
    // The point of splitting the sentence across two files is that it did not
    // change. This asserts against the shipped copy rather than against a
    // literal repeated here, so a drift shows up as the reader's sentence
    // moving rather than as two strings in this repo disagreeing.
    const beach = inventory.beaches.find((b) => b.slug === "childrens-pool");
    expect(beach.wave_buoy_null_reason).toBe(
      `no buoy describes the water here: ${shelteredReason("childrens-pool", "buoy")}`,
    );
  });

  it("refuses to compose a half-sentence for a join it has no clause for", () => {
    // A join that refuses a beach owes the reader what it refused. Binding the
    // beach instead would ship the wrong number this table exists to prevent,
    // and an undefined in the middle of the sentence would ship half of it.
    expect(() => shelteredReason("childrens-pool", "tide")).toThrow(
      /no clause for the "tide" join/,
    );
  });

  it("keys every clause under a beach that is actually sheltered", () => {
    // The table is hand-written, so a slug typo would silently stop refusing a
    // beach. Every key must name a beach the inventory serves.
    const served = new Set(inventory.beaches.map((b) => b.slug));
    for (const slug of Object.keys(SHELTERED)) {
      expect(served.has(slug)).toBe(true);
    }
  });
});
