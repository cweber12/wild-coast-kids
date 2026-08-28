/**
 * One day at reading size: twenty-four hours across, night shaded, cloud along
 * the top, and the model's own published points marked.
 *
 * **The same instrument as `DaySpark`, at the other zoom level.** It takes the
 * same `SparkPoint` series and draws the same night band from the same shared
 * `dayFrame` geometry, so the shape a reader recognises in a week cell is the
 * shape they get when they look closer. That sharing is the design's first
 * principle, and ADR-0025's argument for hand-rolling every plot is what makes
 * it enforceable: there is no library contract in between for the two to
 * satisfy differently.
 *
 * **Cloud is a strip along the top, not a wash behind the curve.** ADR-0026
 * moved the layer here on the grounds that a 21px cell had no room for two grey
 * fields. Drawn as a full-height wash at this size it had the same fault for
 * the same reason: night and cloud were two greys of similar weight covering
 * the same ground, and a reader had to work out which was which before the
 * curve said anything. A strip separates them by *position* rather than by
 * shade -- the sky along the top, the sea below it, night crossing both -- and
 * no reader has to tell two greys apart to find the dip.
 *
 * **It draws the whole day, midnight to midnight, and that is what discharges
 * ADR-0023.** That decision dropped the overnight extreme from six cells of
 * seven "until a day view carries them". This is that day view: the 3 AM low
 * the week cannot print is here, inside a band that is visibly night, with the
 * hours around it. Nothing about the week's own figures changes.
 *
 * **Every label is markup, not SVG text.** An SVG `<text>` scales with the
 * viewBox, so a 10-unit label that reads at 1536 renders about 4px at 375 --
 * measured, not assumed. The axis labels are therefore HTML in the site's own
 * type scale, positioned as percentages of the plot, and the SVG holds nothing
 * but geometry. That also keeps the scaling uniform, so a published-point mark
 * stays a circle at every width instead of stretching into an ellipse.
 *
 * **The quiet register.** No gridlines, no legend, no tooltip, no hover
 * affordance -- hover does not exist on a phone and the audience is parents on
 * phones. What the sparkline does without, and this has, is a scale: this plot
 * is meant to be read off rather than recognised, and a curve with no figures
 * beside it is a picture rather than a measurement.
 *
 * **The "now" line appears on today and on no other day.** A vertical rule at
 * an instant is a claim about the present, and drawing one on Thursday would
 * say the reader is standing in Thursday. The instant comes from
 * `readDaylightWeek`, which cannot fail and which is where this repo reads the
 * clock -- never from `Date.now()` here, which would be impure during render.
 */

import { nightBands } from "./dayFrame";
import type { SparkPoint } from "./DaySpark";

export type HourChartProps = {
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
   * Cloud cover per forecast hour, 0 to 100, drawn along the top of the plot.
   *
   * A layer rather than a series of its own: it is the condition the selected
   * variable happens in, not a competitor to it. Empty draws nothing, and an
   * hour the forecast did not reach gets no mark -- which is why the strip has
   * an opacity floor.
   */
  cloud?: readonly SparkPoint[];
  /**
   * Now, when this day is today. Null on every other day.
   *
   * Null rather than an `isToday` flag beside an instant, because those two can
   * disagree and this cannot: there is a line exactly when there is an instant
   * to draw it at.
   */
  nowMs?: number | null;
  /** What the series is, for the figures beneath: "Tide", "Swell". */
  variableLabel: string;
  /** The unit the values are in: "ft", "mph". */
  unitLabel: string;
  /** The spoken equivalent of the whole plot. Composed by the caller. */
  description: string;
  /** What to say instead of a plot when `points` is empty. */
  absence: string;
};

/**
 * The drawing space, in user units.
 *
 * Uniform scaling, so a mark stays a circle whatever width the plot ends up.
 * These numbers set the proportion; the width the plot is allowed to reach is
 * capped in the markup below, because at the full width of a 1536 window a
 * 3.27:1 frame renders 440px tall and a single tide curve does not want a third
 * of a screen. Measured on the built page 2026-08-28.
 */
const WIDTH = 720;
const HEIGHT = 220;

/**
 * The cloud strip, along the top.
 *
 * Deep enough to read as a band rather than a hairline, shallow enough that the
 * curve keeps the frame. The curve is plotted below it, so the two layers never
 * occupy the same ground -- which is the whole reason the wash became a strip.
 */
const CLOUD_H = 18;

/** Kept clear top and bottom so an extreme is inside the frame, not on its edge. */
const PAD = 8;

/** One hour, which is how wide a cloud hour is drawn. */
const HOUR_MS = 3_600_000;

/**
 * Hours the axis names, and which of them survive a narrow screen.
 *
 * Every three hours is right at 1536 and collides at 375: eight labels at 10px
 * need about 35px each and a 283px plot gives them 35px exactly, so "12 PM"
 * touches its neighbours. Measured on the built page rather than guessed. The
 * quarter-day hours are kept at every width and the rest appear from `sm`,
 * which is the same degrade-before-you-lie rule the sparkline follows when its
 * cell gets too narrow to read.
 */
const LABELLED_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const QUARTER_DAY_HOURS = new Set([0, 6, 12, 18]);

/**
 * Cloud opacity, floored.
 *
 * The floor is the honest part, and it is the same rule the sparkline used
 * before ADR-0026 moved the layer here. Cloud is drawn as a weight, so a
 * cleanly-forecast 0% would render at zero opacity and be indistinguishable
 * from an hour the forecast never reached. They are different facts -- one is a
 * clear sky, the other is silence -- and this page does not let an absence pass
 * for a reading.
 */
function cloudOpacity(percent: number): number {
  return 0.12 + 0.55 * (Math.min(100, Math.max(0, percent)) / 100);
}

/** `0` to "12 AM", `13` to "1 PM". The axis speaks the reader's clock. */
function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function HourChart({
  startMs,
  endMs,
  points,
  sunriseMs,
  sunsetMs,
  cloud = [],
  nowMs = null,
  variableLabel,
  unitLabel,
  description,
  absence,
}: HourChartProps) {
  if (points.length === 0) {
    return <p className="leading-relaxed text-base text-fog">{absence}</p>;
  }

  const spanMs = endMs - startMs;

  /**
   * The range is this day's own, unlike the sparkline's.
   *
   * Seven small multiples must share a range or they stop being comparable; one
   * chart has nothing to be comparable *with*, and a shared range would flatten
   * a calm day into a line across the middle of an empty frame for no gain. The
   * figures beside the plot state the range, so nothing is hidden by it moving.
   */
  const values = points.map((point) => point.value);
  const lowValue = Math.min(...values);
  const highValue = Math.max(...values);
  const spanValue = highValue - lowValue;

  const x = (atMs: number): number => ((atMs - startMs) / spanMs) * WIDTH;

  /**
   * A flat day would divide by zero, and every point in it is the same value --
   * so the honest place for the line is the middle of the frame. Drawing it at
   * the bottom would say "as low as it gets", which the data does not claim.
   */
  const y = (value: number): number => {
    const top = CLOUD_H + PAD;
    const bottom = HEIGHT - PAD;
    return spanValue === 0
      ? (top + bottom) / 2
      : bottom - ((value - lowValue) / spanValue) * (bottom - top);
  };

  const bands = nightBands({ startMs, endMs, sunriseMs, sunsetMs }, x, WIDTH);

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${x(point.atMs).toFixed(2)} ${y(point.value).toFixed(2)}`,
    )
    .join(" ");

  /** The now line, only when this day is today and the instant is inside it. */
  const nowX =
    nowMs !== null && nowMs >= startMs && nowMs < endMs ? x(nowMs) : null;

  return (
    <div className="max-w-4xl">
      <div className="flex gap-2">
        {/*
          The value scale, in markup rather than in the SVG, so it stays in the
          site's own type scale at every width. Top and bottom of the range and
          nothing between: gridlines were considered and left out, because the
          brief asks for a chart in a field guide and a reader taking a figure
          off this plot has it written beneath as well.
        */}
        <div className="text-2xs flex w-9 shrink-0 flex-col justify-between py-px text-right text-fog">
          <span data-axis="high">
            {highValue.toFixed(1)} {unitLabel}
          </span>
          <span data-axis="low">
            {lowValue.toFixed(1)} {unitLabel}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <svg
            role="img"
            aria-label={description}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-auto w-full"
          >
            {/*
              Night first and full height, so it reads as the ground the whole
              day is drawn on. Cloud sits on top of it in its own strip: a
              cloudy night is still night, and separating the two by position
              means neither has to be told apart from the other by shade.
            */}
            {bands.map((band) => (
              <rect
                key={band.side}
                x={band.x}
                width={band.width}
                y={0}
                height={HEIGHT}
                className="fill-dark/12"
                data-night={band.side}
              />
            ))}

            {/*
              One rect per forecast hour rather than one across the run. An hour
              the forecast did not reach draws nothing, where a rect stretched
              to the next point it *did* reach would claim cloud for hours
              nobody published.
            */}
            {cloud.map((hour) => {
              const from = Math.max(x(hour.atMs), 0);
              const to = Math.min(x(hour.atMs + HOUR_MS), WIDTH);
              return to <= from ? null : (
                <rect
                  key={hour.atMs}
                  x={from}
                  width={to - from}
                  y={0}
                  height={CLOUD_H}
                  className="fill-fog"
                  fillOpacity={cloudOpacity(hour.value)}
                  data-cloud-percent={hour.value}
                />
              );
            })}

            <path
              d={path}
              fill="none"
              className="stroke-ocean"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/*
              Marks on what the publisher issued, and nothing on what was drawn
              between. This is where the mechanism starts earning its keep: an
              hourly tide marks 24 points and a three-hourly swell marks 8, so
              the two models cannot look alike at this size the way they did at
              the sparkline's.
            */}
            {points
              .filter((point) => point.published)
              .map((point) => (
                <circle
                  key={point.atMs}
                  cx={x(point.atMs)}
                  cy={y(point.value)}
                  r={2.5}
                  className="fill-ocean"
                />
              ))}

            {/*
              Now, and only on today. Dashed rather than solid so it reads as a
              marker on the plot rather than as another series, and
              distinguishable from the curve by more than its colour.
            */}
            {nowX !== null && (
              <line
                x1={nowX}
                x2={nowX}
                y1={0}
                y2={HEIGHT}
                className="stroke-dark"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                data-now
              />
            )}
          </svg>
        </div>
      </div>

      {/*
        The hour scale, positioned as a percentage of the plot so it stays in
        step with the curve above it at any width. Markup rather than SVG text,
        for the reason in the header: an SVG label that reads at 1536 is about
        4px at 375.

        Outside the row above rather than inside its right-hand column, so the
        value scale is as tall as the plot and no longer stretches down to sit
        level with these -- which put "-0.1 ft" on top of "12 AM". Indented by
        the value column's own width plus the row's gap so the two still line up.
      */}
      <div className="relative mt-1 ml-11 h-4">
        {LABELLED_HOURS.map((hour) => (
          <span
            key={hour}
            className={`text-2xs absolute text-fog ${
              hour === 0 ? "" : "-translate-x-1/2"
            } ${QUARTER_DAY_HOURS.has(hour) ? "" : "hidden sm:inline"}`}
            style={{ left: `${(hour / 24) * 100}%` }}
            data-axis-hour={hour}
          >
            {hourLabel(hour)}
          </span>
        ))}
      </div>

      {/*
        The figures, in text. The plot is data rather than decoration, so what a
        reader would take off it is also stated -- for anyone who cannot see the
        curve, and for anyone whose images have not painted.
      */}
      <p className="text-2xs leading-relaxed mt-4 text-fog">
        {variableLabel} today: low {lowValue.toFixed(1)} {unitLabel}, high{" "}
        {highValue.toFixed(1)} {unitLabel}. Night is shaded; cloud runs along
        the top.
      </p>
    </div>
  );
}
