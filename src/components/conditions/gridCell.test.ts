import { describe, expect, test } from "vitest";
import { windFigure } from "./gridCell";

describe("windFigure", () => {
  test("one decimal, which is the precision the day chart states", () => {
    // Four of the five places this page prints a wind figure use one decimal
    // and the fifth uses none, which is issue #191: the same reader is told the
    // day tops at 12 mph and then, on reaching the hour it happens at, that it
    // is 11.5. A sixth statement of that figure joins the four.
    expect(windFigure(11.52)).toBe("11.5 mph");
  });

  test("keeps a trailing zero on a whole number", () => {
    // "14 mph" and "14.0 mph" claim different precisions, and the axis this
    // figure has to agree with prints the second.
    expect(windFigure(14)).toBe("14.0 mph");
  });

  test("no speed is no figure, rather than a drawn calm", () => {
    // A cell that published a direction and no speed is a ragged forecast, not
    // a fault, and `mopLineDistanceKm` has the same shape for the same reason.
    expect(windFigure(null)).toBeNull();
  });
});
