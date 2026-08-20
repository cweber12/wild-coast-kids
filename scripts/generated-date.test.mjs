import { describe, expect, it } from "vitest";
import { generatedDate } from "./generated-date.mjs";

describe("generatedDate", () => {
  it("is the date where the beaches are, not where the clock is", () => {
    // 01:59 UTC on the 19th is 18:59 on the 18th in San Diego. This is the case
    // that was observed wrong: a file stamped a day that had not started in the
    // county it describes.
    expect(generatedDate(new Date("2026-08-19T01:59:22Z"))).toBe("2026-08-18");
  });

  it("agrees with UTC when the two are the same day", () => {
    expect(generatedDate(new Date("2026-08-18T16:00:00Z"))).toBe("2026-08-18");
  });

  it("follows the offset across daylight saving, not a fixed seven hours", () => {
    // Pacific is UTC-8 in January, so 07:30 UTC is still the previous evening,
    // where UTC-7 would have rolled over. A hand-rolled offset gets exactly one
    // of these two cases right.
    expect(generatedDate(new Date("2026-01-19T07:30:00Z"))).toBe("2026-01-18");
    expect(generatedDate(new Date("2026-07-19T07:30:00Z"))).toBe("2026-07-19");
  });
});
