import { expect, test } from "vitest";
import { localMidnightOf } from "@/lib/pacific-time";
import { swellPoints, tidePoints } from "./series";

const START = localMidnightOf("2026-08-17");
const HOUR = 3_600_000;

/** The frame fields both day shapes carry; none of them reaches a plot. */
const FRAME = {
  localDate: "2026-08-17",
  dayLabel: "Mon, Aug 17",
  dateLabel: "Aug 17",
  isToday: true,
};

test("every hour of a tide day is published, because NOAA answers for each one", () => {
  // `interval=h` returns a height per hour rather than a sparse series this
  // site fills in, so there is nothing here for a mark to distinguish. The
  // swell below is the case this flag exists for.
  const points = tidePoints({
    ...FRAME,
    startMs: START,
    endMs: START + 24 * HOUR,
    hours: [
      { atMs: START, feet: 1.2 },
      { atMs: START + HOUR, feet: 1.9 },
    ],
  });

  expect(points).toEqual([
    { atMs: START, value: 1.2, published: true },
    { atMs: START + HOUR, value: 1.9, published: true },
  ]);
});

test("the swell carries the read's own flag rather than a convenient constant", () => {
  // THE ONE THING THIS CONVERTER MUST NOT GET WRONG. Setting `published: true`
  // to match `tidePoints` would make a three-hourly model draw the same
  // twenty-four marks an hourly one does, which is the single fact the marks
  // exist to show. It is not a mistake any assertion about the curve would
  // catch -- the geometry is identical either way.
  const points = swellPoints({
    ...FRAME,
    daylight: null,
    allDay: null,
    hours: [
      { atMs: START, heightFt: 2, published: true },
      { atMs: START + HOUR, heightFt: 3, published: false },
      { atMs: START + 2 * HOUR, heightFt: 4, published: false },
      { atMs: START + 3 * HOUR, heightFt: 5, published: true },
    ],
  });

  expect(points.map((point) => point.published)).toEqual([
    true,
    false,
    false,
    true,
  ]);
  expect(points.map((point) => point.value)).toEqual([2, 3, 4, 5]);
});

test("a day the forecast did not reach converts to nothing, never to a zero", () => {
  // A drawn zero is a stronger claim than a blank figure: a curve says the sea
  // did something, where an empty series lets the plot say we were not told.
  expect(
    swellPoints({ ...FRAME, daylight: null, allDay: null, hours: [] }),
  ).toEqual([]);
});
