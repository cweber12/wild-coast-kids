import { describe, expect, test } from "vitest";
import { localMidnightOf } from "@/lib/pacific-time";
import { windFigure, windPeakLabel } from "./gridCell";

describe("windFigure", () => {
  test("whole miles per hour, which is the resolution the office issues", () => {
    // 11.52 mph is ten knots, and whole knots are what the National Weather
    // Service publishes for this cell -- so a tenth here would be a precision
    // this repo produced in converting km/h rather than one anybody forecast.
    // ADR-0042.
    expect(windFigure(11.52)).toBe("12 mph");
  });

  test("no trailing zero, because none of the six statements carries one", () => {
    // This kept a ".0" while the axis printed one, on the argument that "14
    // mph" and "14.0 mph" claim different precisions. Still true about the
    // claim; the axis no longer makes it.
    expect(windFigure(14)).toBe("14 mph");
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
      "Biggest wind in daylight, 14 mph at 6:00 PM",
    );
  });

  test("rounds the figure exactly as the row beside it does", () => {
    // One rounding, two callers. A label that re-rounded would be a second
    // opinion about a figure this page holds once.
    expect(windPeakLabel({ atMs: sixPm, value: 11.52 })).toContain("12 mph");
    expect(windFigure(11.52)).toBe("12 mph");
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
