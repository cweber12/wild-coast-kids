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
 * The drawing space, in user units. 5:1, which puts the rendered height between
 * 25px in the narrowest cell the grid has (125px at 1280) and 44px at 1024's
 * four columns. Uniform scaling, so a mark stays a circle and the shape is
 * never stretched to fit a column width.
 */
const WIDTH = 240;
const HEIGHT = 48;

/**
 * Kept clear at the top and bottom, so the day's own extremes are inside the
 * frame rather than sitting on its edge, and a mark at either is not half
 * clipped by the viewBox.
 */
const PAD = 3;

/** One hour, which is how wide a cloud hour's wash is drawn. */
const HOUR_MS = 3_600_000;

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
    return <p className="mt-1 text-2xs text-fog italic">{absence}</p>;
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
      className="mt-1 block h-auto w-full"
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
