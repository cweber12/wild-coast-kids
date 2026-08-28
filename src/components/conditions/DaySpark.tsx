/**
 * One day drawn as a shape: the full twenty-four hours, night shaded, cloud
 * washed across, and the model's own published points marked.
 *
 * **This fulfils ADR-0023 rather than reversing it.** That decision dropped the
 * day's own extreme from six cells of seven "until a day view carries them",
 * and kept `allDay` on `TideWeekDay` so this work would be cheap. The figure the
 * cell leads with is still the daylight extreme, selected exactly as ADR-0023
 * set it; this draws the hours that figure was selected *out of*, so the
 * overnight low is visible again as the dip in a curve that is obviously at
 * night. Nothing is restored to the cell as a second figure, which is the thing
 * ADR-0023 measured as not fitting. A reader of this component who sees a
 * reversal has read it backwards.
 *
 * **Presentational and pure.** It takes a series and renders it. No fetch, no
 * clock, no knowledge of what a tide is: `atMs` and `value`, and the two
 * background layers as instants. That is what makes every branch here --
 * including the absent ones -- assertable without a network, and it is what
 * lets the same shape be drawn large in the day chart later without the two
 * drifting apart.
 *
 * **Hand-rolled SVG.** See the ADR this PR carries: three runtime dependencies
 * are a guarded budget, the largest series in this design is 196 points, and
 * this has to render on the server.
 *
 * **The quiet register.** The brief puts the loud half of this site in the
 * chrome -- headings, chips, glyphs -- and asks the data to be drawn like a
 * chart in a field guide. So: one thin stroke, no gridlines, no axes, no
 * legend, no tooltip, no hover affordance of any kind. Hover does not exist on
 * a phone, and this grid's whole argument is that nothing is hidden behind an
 * affordance.
 *
 * **The scale is given, not computed.** Seven of these are small multiples, and
 * small multiples that each pick their own range are seven charts rather than
 * one instrument -- a flat Tuesday would draw the same shape as a dramatic
 * Wednesday. The caller derives one range across every day it is about to draw
 * and passes it to all of them. Points outside it are not clamped, because a
 * clamped point is a drawn lie; they are impossible instead, the range being
 * derived from the same points.
 *
 * **The two background layers name themselves in the DOM.** A `<rect>` is
 * otherwise anonymous, and this plot has three kinds of them; `data-night` and
 * `data-cloud-percent` say which is which, in the markup, for anyone reading
 * the page as well as for the tests. Nothing else here needs one -- the curve
 * is the only `<path>` and a mark is the only `<circle>`.
 *
 * **An empty series is words, never a line at zero.** A curve is a stronger
 * claim than a figure: a flat line at zero says the sea did something, where a
 * named absence says we were not told. This is the same rule `TideWeek` follows
 * for its figures, one register down.
 */

/** One point on a drawn series. */
export type SparkPoint = {
  /** The instant, epoch milliseconds UTC. */
  atMs: number;
  /** The value, in whatever unit the caller's series is in. */
  value: number;
  /**
   * True when the publisher issued a value for this instant.
   *
   * False means the point sits between two that were published, and the curve
   * is interpolating. Only published points are marked, so a reader can see the
   * model's real resolution rather than being told it: the tide is hourly and
   * every point is its own, where CDIP publishes swell every three hours and
   * the curve between them is ours.
   */
  published: boolean;
};

export type DaySparkProps = {
  /** Local midnight this day begins on. The left edge. */
  startMs: number;
  /** Local midnight the next day begins on. The right edge. */
  endMs: number;
  /** The series, in time order. Empty renders `absence`. */
  points: readonly SparkPoint[];
  /** Sunrise; everything before it is shaded as night. */
  sunriseMs: number;
  /** Sunset; everything after it is shaded as night. */
  sunsetMs: number;
  /**
   * The value range shared by every spark in this set. See the header: a
   * per-day range would make seven days incomparable, which is the one job
   * seven small multiples have.
   */
  lowValue: number;
  highValue: number;
  /**
   * Cloud cover per forecast hour, 0 to 100, as a wash behind the series.
   *
   * A layer rather than a series of its own, because it is the condition the
   * selected variable happens in rather than a competitor to it. Empty draws
   * nothing, and an hour the forecast did not reach gets no wash -- which is
   * why the wash has a floor: a published 0% must not render identically to an
   * hour nobody forecast.
   */
  cloud?: readonly SparkPoint[];
  /**
   * The spoken equivalent of this shape.
   *
   * Composed by the caller, which owns the words on this page. `role="img"`
   * with a label is how `DaylightWeek` and `Placeholder` name a thing whose
   * visible content is not its name; this repo does not use `sr-only`, and a
   * `title` tooltip is neither reachable by keyboard nor present on touch.
   */
  description: string;
  /** What to say instead of a plot when `points` is empty. */
  absence: string;
};

/**
 * The drawing space, in user units. Uniform scaling, so a mark stays a circle
 * and the shape is never stretched to fit a column width.
 *
 * **8:1, and it was 5:1 for one review.** At 5:1 the shape rendered 34px tall
 * in the review viewport and read as a second chart sitting above the figures
 * -- which, with a full day chart coming below the grid, is a duplication the
 * brief's first principle exists to avoid. 8:1 renders 21px there and reads as
 * an annotation on the row instead: the same information, at the weight a
 * sparkline is supposed to carry. Measured 2026-08-28 against the built page:
 *
 * | viewport | cell | shape        | grid height |
 * | -------- | ---- | ------------ | ----------- |
 * | 1536     | 168  | 169 x 21.2   | 275.0       |
 * | 1280     | 132  | 133 x 16.6   | 270.4       |
 * | 1024     | 196  | 197 x 24.6   | 568.9       |
 * | 375      | 300  | 301 x 37.6   | 1753.1      |
 *
 * The vertical range costs real resolution -- 24 user units of swing where
 * there were 42 -- and that is the trade, not an oversight. What a reader takes
 * from seven of these is which day is calmer and whether the dip is at night,
 * and both survive at this height. Reading a value off one was never possible
 * and is the day chart's job.
 */
const WIDTH = 240;
const HEIGHT = 30;

/**
 * Kept clear at the top and bottom, so the day's own extremes are inside the
 * frame rather than sitting on its edge, and a mark at either is not half
 * clipped by the viewBox.
 */
const PAD = 3;

/** One hour, which is how wide a cloud hour's wash is drawn. */
const HOUR_MS = 3_600_000;

/**
 * Narrower than this and the shape stops being a shape.
 *
 * **Measured on the built page 2026-08-28**, rendering the shipped markup at a
 * ladder of widths. What has to survive is not the curve -- that reads a long
 * way down -- but the *layers*: a reader has to be able to see that the dip is
 * inside the night band, because that is the figure ADR-0023 dropped and this
 * is what carries it.
 *
 * | width | px/hour | what survives                                    |
 * | ----- | ------- | ------------------------------------------------ |
 * | 197   | 8.2     | everything, cloud steps individually separable   |
 * | 169   | 7.0     | everything                                       |
 * | 133   | 5.5     | everything; both dips and both night bands clear |
 * | 110   | 4.6     | night bands still separable from the cloud wash  |
 * | 88    | 3.7     | curve survives, layers do not -- the bands merge |
 * | 72    | 3.0     | one bump; the second dip is gone                 |
 * | 56    | 2.3     | noise                                            |
 *
 * So 110, which is the last row where the shading still reads. The brief
 * guessed the floor would be about one pixel per published point; at 24 hourly
 * points that would be 24px, and the measurement says the layers fail at four
 * times that. The guess was about the curve and the answer is about the bands.
 *
 * **It does not bind today**, and that is a measurement rather than a hope: the
 * narrowest cell this grid renders is 133px, at exactly 1280 where seven
 * columns begin. `WeekGrid` carries that figure and the rule that enforces
 * this, because the breakpoints that could invalidate it are its.
 */
export const MIN_USEFUL_SPARK_WIDTH_PX = 110;

/**
 * Cloud opacity, floored.
 *
 * The floor is the honest part. Cloud is drawn as a wash whose weight is the
 * percentage, so a cleanly-forecast 0% would render at zero opacity and be
 * indistinguishable from an hour the forecast never reached. They are different
 * facts -- one is a clear sky, the other is silence -- and this page does not
 * let an absence pass for a reading.
 */
function cloudOpacity(percent: number): number {
  return 0.05 + 0.3 * (Math.min(100, Math.max(0, percent)) / 100);
}

export function DaySpark({
  startMs,
  endMs,
  points,
  sunriseMs,
  sunsetMs,
  lowValue,
  highValue,
  cloud = [],
  description,
  absence,
}: DaySparkProps) {
  if (points.length === 0) {
    return <p className="text-2xs text-fog italic">{absence}</p>;
  }

  const spanMs = endMs - startMs;
  const spanValue = highValue - lowValue;

  const x = (atMs: number): number => ((atMs - startMs) / spanMs) * WIDTH;

  /**
   * A flat range would divide by zero, and every point in it is the same value
   * -- so the honest place for the line is the middle of the frame. Drawing it
   * at the bottom would say "as low as it gets", which is a claim the data does
   * not make.
   */
  const y = (value: number): number =>
    spanValue === 0
      ? HEIGHT / 2
      : HEIGHT - PAD - ((value - lowValue) / spanValue) * (HEIGHT - 2 * PAD);

  /** Clipped to the day, so a band starting before dawn does not run off the frame. */
  const band = (fromMs: number, toMs: number) => {
    const from = Math.max(x(fromMs), 0);
    const to = Math.min(x(toMs), WIDTH);
    return to <= from ? null : { x: from, width: to - from };
  };

  const beforeDawn = band(startMs, sunriseMs);
  const afterDusk = band(sunsetMs, endMs);

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${x(point.atMs).toFixed(2)} ${y(point.value).toFixed(2)}`,
    )
    .join(" ");

  return (
    <svg
      role="img"
      aria-label={description}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full"
    >
      {/*
        Cloud first, night over it. A cloudy night is still night, so the shade
        sits on top of the wash rather than beside it -- two layers that both
        lightened the frame would say the small hours were the clearest part of
        the day.

        One rect per forecast hour rather than one across the run. An hour the
        forecast did not reach then draws nothing, where a rect stretched to the
        next point it *did* reach would claim cloud for hours nobody published.
      */}
      {cloud.map((hour) => {
        const rect = band(hour.atMs, hour.atMs + HOUR_MS);
        return rect === null ? null : (
          <rect
            key={hour.atMs}
            x={rect.x}
            width={rect.width}
            y={0}
            height={HEIGHT}
            className="fill-fog"
            fillOpacity={cloudOpacity(hour.value)}
            data-cloud-percent={hour.value}
          />
        );
      })}

      {/*
        Night is astronomy and cannot fail, which is why it is drawn rather than
        labelled: the dip a reader is looking for is the one ADR-0023 had to
        drop, and "it is at night" is the whole reason it was dropped. Two bands
        rather than one, because a day starts and ends in the dark.
      */}
      {beforeDawn !== null && (
        <rect
          x={beforeDawn.x}
          width={beforeDawn.width}
          y={0}
          height={HEIGHT}
          className="fill-dark/12"
          data-night="before-dawn"
        />
      )}
      {afterDusk !== null && (
        <rect
          x={afterDusk.x}
          width={afterDusk.width}
          y={0}
          height={HEIGHT}
          className="fill-dark/12"
          data-night="after-dusk"
        />
      )}

      {/*
        `TIDE_TONE`'s ocean, measured at 8.5:1 on this cell in `weekTone.ts` --
        far past the 3:1 a graphical object owes. It is the row's own colour, so
        the curve and the figure above it are visibly one reading rather than
        two.

        `vector-effect="non-scaling-stroke"` keeps the line 1.4px whether the
        cell is 125px or 221px. Without it the stroke thickens with the column
        and the four-column layout draws a heavier instrument than the
        seven-column one.
      */}
      <path
        d={path}
        fill="none"
        className="stroke-ocean"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/*
        Marks on what the publisher issued, and nothing on what we drew between.
        This is the design's second principle in its smallest form: the model's
        real resolution is shown rather than written, so an hourly series and a
        three-hourly one cannot look alike.
      */}
      {points
        .filter((point) => point.published)
        .map((point) => (
          <circle
            key={point.atMs}
            cx={x(point.atMs)}
            cy={y(point.value)}
            r={1.5}
            className="fill-ocean"
          />
        ))}
    </svg>
  );
}
