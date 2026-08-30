import { describe, expect, it } from "vitest";
import { compassWords } from "./bearing";

describe("compassWords", () => {
  it("names each of the eight points at its own bearing", () => {
    expect(compassWords(0)).toBe("north");
    expect(compassWords(45)).toBe("north-east");
    expect(compassWords(90)).toBe("east");
    expect(compassWords(135)).toBe("south-east");
    expect(compassWords(180)).toBe("south");
    expect(compassWords(225)).toBe("south-west");
    expect(compassWords(270)).toBe("west");
    expect(compassWords(315)).toBe("north-west");
  });

  it("wraps past the last point back to north rather than off the end", () => {
    // 359 rounds to the ninth bucket, which is north again. Without the
    // modulo this reads `undefined` and prints "from the undefined".
    expect(compassWords(359)).toBe("north");
    expect(compassWords(360)).toBe("north");
  });

  it("splits a bucket at its half-way bearing", () => {
    // The boundary rather than the middle, because the middle passes under any
    // rounding rule and the boundary is where an off-by-one shows up.
    expect(compassWords(22)).toBe("north");
    expect(compassWords(23)).toBe("north-east");
  });
});
