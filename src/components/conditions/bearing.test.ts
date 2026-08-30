import { describe, expect, it } from "vitest";
import { bearingSpread, compassWords, resultantBearing } from "./bearing";

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

describe("resultantBearing", () => {
  it("returns the one bearing it was given", () => {
    expect(resultantBearing([{ degreesTrue: 281, weight: 9 }])).toBeCloseTo(
      281,
      6,
    );
  });

  it("averages across north rather than through south", () => {
    // The failure this exists to catch: (340 + 20) / 2 is 180, which is due
    // south and the exact opposite of the answer.
    const mean = resultantBearing([
      { degreesTrue: 340, weight: 5 },
      { degreesTrue: 20, weight: 5 },
    ]);
    expect(mean).toBeCloseTo(0, 6);
  });

  it("leans towards the hour that carried the most wind", () => {
    // A 2 mph easterly and a 12 mph westerly are not a southerly average.
    const mean = resultantBearing([
      { degreesTrue: 90, weight: 2 },
      { degreesTrue: 270, weight: 12 },
    ]);
    expect(mean).toBeCloseTo(270, 6);
  });

  it("ignores an hour with no wind in it", () => {
    const withCalm = resultantBearing([
      { degreesTrue: 270, weight: 8 },
      { degreesTrue: 90, weight: 0 },
    ]);
    expect(withCalm).toBeCloseTo(270, 6);
  });

  it("has no answer when the hours cancel exactly", () => {
    expect(
      resultantBearing([
        { degreesTrue: 90, weight: 5 },
        { degreesTrue: 270, weight: 5 },
      ]),
    ).toBeNull();
  });

  it("has no answer when there is nothing to average", () => {
    expect(resultantBearing([])).toBeNull();
    expect(resultantBearing([{ degreesTrue: 90, weight: 0 }])).toBeNull();
  });
});

describe("bearingSpread", () => {
  it("is zero for one bearing", () => {
    expect(bearingSpread([{ degreesTrue: 281, weight: 9 }])).toBe(0);
  });

  it("is zero when every hour blew from the same point", () => {
    expect(
      bearingSpread([
        { degreesTrue: 210, weight: 4 },
        { degreesTrue: 210, weight: 7 },
        { degreesTrue: 210, weight: 2 },
      ]),
    ).toBe(0);
  });

  it("measures the short way round north, not the long way", () => {
    // 350 and 10 are twenty degrees apart. Sorting and subtracting says 340.
    expect(
      bearingSpread([
        { degreesTrue: 350, weight: 6 },
        { degreesTrue: 10, weight: 6 },
      ]),
    ).toBeCloseTo(20, 6);
  });

  it("excludes the widest gap rather than the last step", () => {
    // Three bearings clustered in the west with the whole eastern half empty.
    expect(
      bearingSpread([
        { degreesTrue: 250, weight: 3 },
        { degreesTrue: 270, weight: 3 },
        { degreesTrue: 300, weight: 3 },
      ]),
    ).toBeCloseTo(50, 6);
  });

  it("ignores an hour with no wind in it", () => {
    // A calm hour's published bearing is a number the instrument had to emit,
    // not a direction anybody felt, and it must not widen the arc.
    expect(
      bearingSpread([
        { degreesTrue: 270, weight: 8 },
        { degreesTrue: 280, weight: 4 },
        { degreesTrue: 90, weight: 0 },
      ]),
    ).toBeCloseTo(10, 6);
  });

  it("has no answer when there is nothing to measure", () => {
    expect(bearingSpread([])).toBeNull();
    expect(bearingSpread([{ degreesTrue: 90, weight: 0 }])).toBeNull();
  });
});
