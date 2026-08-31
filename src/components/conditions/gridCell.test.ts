import { describe, expect, test } from "vitest";
import { localMidnightOf } from "@/lib/pacific-time";
import { windFigure, windPeakLabel } from "./gridCell";

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

describe("windPeakLabel", () => {
  /** 6 PM Pacific on a day of the committed week. */
  const sixPm = localMidnightOf("2026-08-17") + 18 * 3_600_000;

  test("carries the day's biggest wind and the hour it happened at", () => {
    // The figure the readout's rows stopped stating when they became an hour
    // instrument. This label is the only place the page states it at all --
    // ADR-0034 thought the week grid did too, and ADR-0035 records that
    // `WeekPanel` declines wind deliberately.
    expect(windPeakLabel({ atMs: sixPm, value: 14 })).toBe(
      "Biggest wind in daylight, 14.0 mph at 6:00 PM",
    );
  });

  test("rounds the figure exactly as the row beside it does", () => {
    // One rounding, two callers. A label that re-rounded would be a second
    // opinion about a figure this page holds once.
    expect(windPeakLabel({ atMs: sixPm, value: 11.52 })).toContain("11.5 mph");
    expect(windFigure(11.52)).toBe("11.5 mph");
  });

  test("names the hour from the instant rather than from an index", () => {
    // The caption over the readout counts hours into the day, because it has to
    // agree with the chart's axis and inherits that arithmetic's DST defect.
    // Nothing here needs an index, so this says what the clock said.
    expect(windPeakLabel({ atMs: sixPm + 30 * 60_000, value: 14 })).toContain(
      "at 6:30 PM",
    );
  });

  test("is the bare superlative where the forecast reached no daylight", () => {
    // There is no figure to state, and the label still has to say which of two
    // provenance lines under one picture is the wind's.
    expect(windPeakLabel(null)).toBe("Biggest wind in daylight");
  });
});
