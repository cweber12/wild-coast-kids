import { describe, expect, it } from "vitest";
import type { GridDaySeries } from "@/lib/conditions";
import {
  gridWindReadings,
  needleFrom,
  peakInDaylight,
  swellReadings,
  swellStepByHour,
  windByHour,
} from "./needles";

/** 2026-08-17 in Pacific: sunrise 06:15, sunset 19:30, as epoch milliseconds. */
const SUNRISE = Date.UTC(2026, 7, 17, 13, 15);
const SUNSET = Date.UTC(2026, 7, 18, 2, 30);
const hour = (utcHour: number) => Date.UTC(2026, 7, 17, utcHour, 0);

function published(
  hours: readonly { atMs: number; value: number }[],
): GridDaySeries {
  return {
    kind: "published",
    hours: hours.map((h) => ({ ...h, published: true })),
  };
}

describe("gridWindReadings", () => {
  it("pairs each direction with the speed published for the same instant", () => {
    const readings = gridWindReadings(
      published([{ atMs: hour(18), value: 281 }]),
      published([{ atMs: hour(18), value: 9 }]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([{ degreesTrue: 281, weight: 9 }]);
  });

  it("pairs by instant and not by position", () => {
    // The two series are gapless in the committed run, so joining by index
    // happens to work today and would put the wrong speed on the wrong bearing
    // the first time one of them is short.
    const readings = gridWindReadings(
      published([
        { atMs: hour(18), value: 281 },
        { atMs: hour(19), value: 20 },
      ]),
      published([{ atMs: hour(19), value: 12 }]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([{ degreesTrue: 20, weight: 12 }]);
  });

  it("keeps only the hours inside the daylight window", () => {
    // The arc is the range the wind swings through during daylight, and the
    // fixture's overnight hours swing across north: 340, 20, 150 in the first
    // three. Including them would draw an arc nobody could have stood in.
    const readings = gridWindReadings(
      published([
        { atMs: hour(9), value: 340 },
        { atMs: hour(18), value: 281 },
        { atMs: hour(23), value: 270 },
      ]),
      published([
        { atMs: hour(9), value: 3 },
        { atMs: hour(18), value: 9 },
        { atMs: hour(23), value: 7 },
      ]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([
      { degreesTrue: 281, weight: 9 },
      { degreesTrue: 270, weight: 7 },
    ]);
  });

  it("drops an hour whose speed the cell did not publish", () => {
    const readings = gridWindReadings(
      published([
        { atMs: hour(18), value: 281 },
        { atMs: hour(19), value: 300 },
      ]),
      published([{ atMs: hour(18), value: 9 }]),
      SUNRISE,
      SUNSET,
    );

    expect(readings).toEqual([{ degreesTrue: 281, weight: 9 }]);
  });

  it("has nothing to read when the cell publishes no direction", () => {
    expect(
      gridWindReadings(
        {
          kind: "absent",
          reason: "the cell declares windDirection and published none",
        },
        published([{ atMs: hour(18), value: 9 }]),
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([]);
  });

  it("has nothing to read when the cell publishes no speed to weight by", () => {
    expect(
      gridWindReadings(
        published([{ atMs: hour(18), value: 281 }]),
        {
          kind: "absent",
          reason: "the cell declares windSpeed and published none",
        },
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([]);
  });
});

describe("needleFrom", () => {
  it("carries the resultant bearing and the arc it swung through", () => {
    const needle = needleFrom([
      { degreesTrue: 260, weight: 6 },
      { degreesTrue: 280, weight: 6 },
    ]);

    expect(needle?.fromDegT).toBeCloseTo(270, 6);
    expect(needle?.spreadDeg).toBeCloseTo(20, 6);
  });

  it("is withheld when there is nothing to draw", () => {
    expect(needleFrom([])).toBeNull();
  });

  it("is withheld when the hours cancel and there is no direction to point", () => {
    // A spread without a bearing is half an instrument: an arc with no needle
    // in it says the wind had a range and declines to say where in it. Both or
    // neither.
    expect(
      needleFrom([
        { degreesTrue: 90, weight: 5 },
        { degreesTrue: 270, weight: 5 },
      ]),
    ).toBeNull();
  });
});

describe("swellReadings", () => {
  const wave = (
    atMs: number,
    heightFt: number,
    directionDegT: number | null,
  ) => ({
    atMs,
    heightFt,
    published: directionDegT !== null,
    periodS: directionDegT === null ? null : 14,
    directionDegT,
  });

  it("weights each of CDIP's bearings by the height that came with it", () => {
    expect(
      swellReadings(
        [wave(hour(18), 3.2, 340), wave(hour(19), 1.5, 300)],
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([
      { degreesTrue: 340, weight: 3.2 },
      { degreesTrue: 300, weight: 1.5 },
    ]);
  });

  it("leaves out the hours this repo drew between CDIP's own", () => {
    // Five hours in every eight of a swell curve are a line drawn between two
    // estimates. They carry a height because a curve needs one and no bearing
    // because a needle does not, and this is where that shows.
    expect(
      swellReadings(
        [wave(hour(18), 3.2, 340), wave(hour(19), 2.8, null)],
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([{ degreesTrue: 340, weight: 3.2 }]);
  });

  it("keeps only the hours inside the daylight window", () => {
    expect(
      swellReadings(
        [wave(hour(9), 4, 200), wave(hour(18), 3.2, 340)],
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([{ degreesTrue: 340, weight: 3.2 }]);
  });

  it("has nothing to read from a day with no estimates in daylight", () => {
    expect(swellReadings([], SUNRISE, SUNSET)).toEqual([]);
  });
});

describe("peakInDaylight", () => {
  it("takes the largest hour a reader could have been there for", () => {
    // The wind's answer to `WaveReading`, and deliberately the same rule: the
    // largest thing the daylight window holds.
    expect(
      peakInDaylight(
        published([
          { atMs: hour(14), value: 6 },
          { atMs: hour(20), value: 11.5 },
          { atMs: hour(23), value: 9 },
        ]),
        SUNRISE,
        SUNSET,
      ),
    ).toEqual({ atMs: hour(20), value: 11.5 });
  });

  it("says which hour it was, because the label that prints it has to", () => {
    // The figure moved into the wind's provenance line, where "biggest in
    // daylight" over a block showing 3 AM is a claim about a different hour. A
    // reader cannot check it against the curve without being told which.
    expect(
      peakInDaylight(
        published([
          { atMs: hour(20), value: 11.5 },
          { atMs: hour(21), value: 11.5 },
        ]),
        SUNRISE,
        SUNSET,
      ),
    ).toEqual({ atMs: hour(20), value: 11.5 });
  });

  it("passes over a bigger hour that falls outside daylight", () => {
    // The whole point of the window. A 2 AM gust is not the day a reader is
    // planning, and reporting it as the day's wind would be reporting weather
    // nobody could stand in.
    expect(
      peakInDaylight(
        published([
          { atMs: hour(3), value: 30 },
          { atMs: hour(20), value: 8 },
        ]),
        SUNRISE,
        SUNSET,
      ),
    ).toEqual({ atMs: hour(20), value: 8 });
  });

  it("has no answer where the cell declared none", () => {
    expect(
      peakInDaylight(
        { kind: "absent", reason: "this cell publishes no wind speed" },
        SUNRISE,
        SUNSET,
      ),
    ).toBeNull();
  });

  it("has no answer on a day the forecast does not reach", () => {
    // Null rather than zero. A ragged row is a forecast doing what forecasts
    // do, and a zero would be a drawn calm nobody predicted.
    expect(
      peakInDaylight(
        published([{ atMs: hour(3), value: 12 }]),
        SUNRISE,
        SUNSET,
      ),
    ).toBeNull();
  });
});

/**
 * Pacific midnight on the day the constants above describe. The grid is UTC and
 * this coast is seven hours behind it, so an hour of this day is `hour(h + 7)`.
 */
const DAY_START = Date.UTC(2026, 7, 17, 7, 0);

describe("windByHour", () => {
  it("keys each hour by its index into the day", () => {
    const byHour = windByHour(
      published([{ atMs: hour(21), value: 281 }]),
      published([{ atMs: hour(21), value: 9 }]),
      DAY_START,
    );

    expect([...byHour]).toEqual([[14, { fromDegT: 281, mph: 9 }]]);
  });

  it("keeps the hours outside daylight, where the wedge's readings do not", () => {
    // The difference between the two halves of this module. The wedge is a
    // statement about a day and is daylight-bound; the arrow is a statement
    // about one hour a reader chose, and a reader who chooses 3 AM is owed
    // 3 AM's wind rather than silence.
    const night = hour(10); // 3 AM Pacific, well before sunrise.

    expect(
      gridWindReadings(
        published([{ atMs: night, value: 281 }]),
        published([{ atMs: night, value: 9 }]),
        SUNRISE,
        SUNSET,
      ),
    ).toEqual([]);
    expect([
      ...windByHour(
        published([{ atMs: night, value: 281 }]),
        published([{ atMs: night, value: 9 }]),
        DAY_START,
      ),
    ]).toEqual([[3, { fromDegT: 281, mph: 9 }]]);
  });

  it("keeps a bearing the cell gave no speed for", () => {
    // An arrow with no figure beside it still says which way the wind was
    // blowing, where a weighted reading with no weight cannot pull a resultant.
    // `windFigure` words the absence.
    const byHour = windByHour(
      published([{ atMs: hour(21), value: 281 }]),
      { kind: "absent", reason: "this cell publishes no wind speed" },
      DAY_START,
    );

    expect([...byHour]).toEqual([[14, { fromDegT: 281, mph: null }]]);
  });

  it("joins on the instant, so a short speed series moves no bearing", () => {
    const byHour = windByHour(
      published([
        { atMs: hour(21), value: 281 },
        { atMs: hour(22), value: 290 },
      ]),
      published([{ atMs: hour(22), value: 9 }]),
      DAY_START,
    );

    expect([...byHour]).toEqual([
      [14, { fromDegT: 281, mph: null }],
      [15, { fromDegT: 290, mph: 9 }],
    ]);
  });

  it("has nothing to say where the cell declared no direction", () => {
    expect([
      ...windByHour(
        { kind: "absent", reason: "this cell publishes no wind direction" },
        published([{ atMs: hour(21), value: 9 }]),
        DAY_START,
      ),
    ]).toEqual([]);
  });
});

describe("swellStepByHour", () => {
  /** CDIP's grid as it lands in Pacific time: 02:00, 05:00, and so on. */
  const step = (localHour: number, heightFt: number) => ({
    atMs: DAY_START + localHour * 3_600_000,
    heightFt,
    published: true,
    periodS: 15,
    directionDegT: 315,
  });

  const drawn = (localHour: number, heightFt: number) => ({
    atMs: DAY_START + localHour * 3_600_000,
    heightFt,
    published: false,
    periodS: null,
    directionDegT: null,
  });

  it("gives an hour the estimate it is inside", () => {
    const byHour = swellStepByHour([step(2, 3.4)], DAY_START);

    expect(byHour.get(2)).toEqual({
      atMs: DAY_START + 2 * 3_600_000,
      heightFt: 3.4,
      periodS: 15,
      directionDegT: 315,
    });
  });

  it("gives the hours either side of an estimate that estimate, whole", () => {
    // Ninety minutes is half of CDIP's three-hour step, so an estimate owns the
    // three hours centred on it. The row states height, period and bearing off
    // that one instant rather than reading them field by field off the hour,
    // which would take the height from here and the bearing from elsewhere.
    const hours = [drawn(1, 3.0), step(2, 3.4), drawn(3, 3.6)];
    const byHour = swellStepByHour(hours, DAY_START);

    expect(byHour.get(1)?.heightFt).toBe(3.4);
    expect(byHour.get(3)?.heightFt).toBe(3.4);
    expect(byHour.get(1)?.periodS).toBe(15);
  });

  it("gives the three hours of one estimate one object, not three copies", () => {
    // What the map sends the browser is one row per estimate rather than one
    // per hour, and that is this identity rather than a claim in a comment.
    const byHour = swellStepByHour(
      [drawn(1, 3.0), step(2, 3.4), drawn(3, 3.6)],
      DAY_START,
    );

    expect(byHour.get(1)).toBe(byHour.get(2));
    expect(byHour.get(3)).toBe(byHour.get(2));
  });

  it("leaves midnight unspoken for, two hours from the day's first estimate", () => {
    // In Pacific time CDIP's grid lands at 02:00 and the previous day's 23:00
    // publication is bucketed to the previous date, so midnight has no estimate
    // within reach on either side. The readout withholds the row there rather
    // than reaching three hours back for one.
    const byHour = swellStepByHour(
      [drawn(0, 2.8), drawn(1, 3.0), step(2, 3.4)],
      DAY_START,
    );

    expect(byHour.has(0)).toBe(false);
    expect(byHour.has(1)).toBe(true);
  });

  it("does not reach across a hole a refused estimate left", () => {
    // `flaggedOut` counts estimates this repo refused, and refusing one leaves a
    // six-hour hole `hourlyWaveHeights` does not bridge either. A map holding a
    // four-and-a-half-hour-old estimate where the chart claims none would be the
    // louder of the two saying the less honest thing.
    const byHour = swellStepByHour([step(2, 3.4), step(8, 4.1)], DAY_START);

    expect(byHour.has(2)).toBe(true);
    expect(byHour.has(5)).toBe(false);
    expect(byHour.has(8)).toBe(true);
  });

  it("takes the nearer of two estimates, and the earlier on a tie", () => {
    // Unreachable on a three-hour grid of whole hours, where an hour is one
    // from the nearer estimate and two from the other. Covered here because a
    // rule with no tie-break is a rule that answers differently depending on
    // the order it was handed its data.
    const byHour = swellStepByHour(
      [step(2, 3.4), drawn(3, 3.5), step(4, 4.4)],
      DAY_START,
    );

    expect(byHour.get(3)?.heightFt).toBe(3.4);
  });

  it("has nothing to say about a day with no published estimate at all", () => {
    expect([...swellStepByHour([drawn(1, 3.0)], DAY_START)]).toEqual([]);
  });

  it("refuses a published hour missing either half of its estimate", () => {
    // Not a state the read produces -- `hourlyWaveHeights` takes both off the
    // row it publishes -- and one `WaveHour`'s type permits, because the drawn
    // hours between estimates carry neither. It is checked here, once, so that
    // what comes out of this function is a whole estimate and nothing
    // downstream re-checks it.
    const halfAStep = {
      atMs: DAY_START + 2 * 3_600_000,
      heightFt: 3.4,
      published: true,
      periodS: null,
      directionDegT: 315,
    };

    expect([...swellStepByHour([halfAStep], DAY_START)]).toEqual([]);
    expect([
      ...swellStepByHour(
        [{ ...halfAStep, periodS: 15, directionDegT: null }],
        DAY_START,
      ),
    ]).toEqual([]);
  });
});
