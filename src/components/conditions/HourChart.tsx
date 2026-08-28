/**
 * One day at reading size: twenty-four hours across in the site's own tile,
 * night shaded, cloud in a band above the frame, and the model's own published
 * points marked.
 *
 * **The same instrument as `DaySpark`, at the other zoom level.** It takes the
 * same `SparkPoint` series and draws the same night band from the same shared
 * `dayFrame` geometry, so the shape a reader recognises in a week cell is the
 * shape they get when they look closer. That sharing is the design's first
 * principle, and ADR-0025's argument for hand-rolling every plot is what makes
 * it enforceable: there is no library contract in between for the two to
 * satisfy differently.
 *
 * **Cloud is a band above the frame, not a layer inside it, and it took three
 * tries to get there.** ADR-0026 moved the layer here on the grounds that a
 * 21px cell had no room for two grey fields. Drawn as a full-height wash at
 * this size it had exactly the same fault, because the fault was never about
 * height: night and cloud were two greys of similar weight over the same
 * ground. Drawn as a strip inside the top of the frame it still crossed the
 * night band, since night runs the plot's full height. Only lifting it clear of
 * the frame makes the two independent -- cloud is a band about the sky, the
 * plot is a frame about the sea, and no pixel belongs to both.
 *
 * **The band is keyed in percentages and never in words.** ADR-0024 measured
 * this site banding cloud on the National Weather Service's own scale and
 * disagreeing with the National Weather Service on three days of six. The
 * publisher's own wording now prints directly above this chart, so a banded
 * word here would contradict a sentence the reader can see at the same moment.
 * A key to an encoding is not a verdict about the sky.
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
 * **The loud register is the frame; the quiet one is the data.** Reviewed on
 * the page, the first build read as plain and as not belonging to the rest of
 * the site. The brief says where to put that right -- "the loud register
 * belongs to headings, tabs, chips and glyphs; inside the plot frame the page
 * goes quiet" -- so the tile, the ocean band and the "now" chip carry the
 * energy, and inside the frame there are still no gridlines and no legend box.
 * The fill under the curve is the one addition to the data itself, and it is
 * the row's own colour rather than a colour that means anything: `weekTone.ts`
 * records that what makes colour a verdict is *differential* colour, and every
 * hour of every day here takes the same ocean.
 *
 * **The hours are selectable, and that reverses a recorded decision.** The
 * brief listed a hover tooltip under its anti-references and said the plot
 * "carries no hover affordance at any width", on the argument that hover does
 * not exist on touch and the audience is parents on phones. That argument is
 * still right about *hover*, and none is used here: selection is by click, tap
 * or key, the readout is a region of the page rather than a floating panel, and
 * the affordance is announced rather than discovered. What the decision was
 * protecting -- that nothing a reader needs is hidden behind an interaction --
 * is kept by construction: the shape, the night, the cloud, the range and the
 * day's extremes are all still drawn or written before anything is touched.
 * What selection adds is per-hour detail the page never carried at all, so
 * nothing has moved behind a gesture.
 *
 * **Two ways in, because one of them cannot meet the touch floor.** Twenty-four
 * hour columns across an 806px plot are 33.6px each and across a 283px plot are
 * 11.8px, against ADR-0004's 44px. So the columns are the enhancement and a
 * prev/next pair is the guarantee: those are ordinary buttons at `TOUCH_TARGET`
 * and they work at every width, with a keyboard, and with a screen reader.
 *
 * **The controls appear only once they can work.** They are mounted after
 * hydration rather than rendered on the server, so a reader without JavaScript
 * is never given a control that silently does nothing -- which is the failure
 * `BeachSelector`'s `noscript` list exists to prevent. The chart itself still
 * renders on the server, complete, which is what ADR-0025 requires.
 *
 * **The "now" line appears on today and on no other day.** A vertical rule at
 * an instant is a claim about the present, and drawing one on Thursday would
 * say the reader is standing in Thursday. The instant comes from
 * `readDaylightWeek`, which cannot fail and which is where this repo reads the
 * clock -- never from `Date.now()` here, which would be impure during render.
 */

"use client";

import { useState, useSyncExternalStore } from "react";
import { nightBands } from "./dayFrame";
import type { SparkPoint } from "./DaySpark";
import { TOUCH_TARGET } from "../ui/touchTarget";

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
  /**
   * The spoken equivalent of the cloud band.
   *
   * Its own, because the band is its own graphic with its own source: the plot
   * is NOAA's tide and the band is the National Weather Service's sky, and one
   * accessible name covering both would credit the wrong publisher for half of
   * what it described.
   */
  cloudDescription?: string;
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
 * The cloud band, in its own frame above the plot.
 *
 * **Outside the plot rather than inside the top of it, and that is the third
 * arrangement this layer has had.** It was a full-height wash, which put two
 * greys of similar weight over the same ground. It then became a strip inside
 * the frame, which fixed the weight and not the overlap: night runs the full
 * height of the plot, so an hour of cloud drawn inside it still crossed the
 * day/night boundary and a reader still had two shadings to separate at the
 * top of the chart. Lifting it clear of the frame is what finally makes the two
 * independent -- cloud is a band about the sky, the plot is a frame about the
 * sea, and no pixel belongs to both.
 *
 * Its own viewBox rather than a rect in the plot's, so the two cannot drift out
 * of alignment: both are 720 units wide and both map an instant through the
 * same `x`.
 */
const CLOUD_H = 14;

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
 * The percentages the key puts a swatch against.
 *
 * Three, not five: the band is a background layer and a reader needs to know
 * roughly what a shade is worth, not to read a value off it. The hours
 * themselves are what carry the figures.
 */
const CLOUD_KEY_STOPS: readonly number[] = [0, 50, 100];

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

/**
 * The three halves of the "is this the client yet" store.
 *
 * Module scope so their identities are stable across renders, which is what
 * `useSyncExternalStore` requires of `subscribe`.
 */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

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
  cloudDescription = "Cloud cover through the day.",
  nowMs = null,
  variableLabel,
  unitLabel,
  description,
  absence,
}: HourChartProps) {
  const [selected, setSelected] = useState<number | null>(null);

  /*
    The controls exist only once they can work. Rendered on the server they
    would be dead buttons for a reader without JavaScript, which is the failure
    `BeachSelector`'s `noscript` list exists to prevent -- and here there is
    nothing to fall back *to*, because the detail they reveal is not on the page
    in any other form. So the honest fallback is no control at all.

    `useSyncExternalStore` rather than an effect that sets state: this repo's
    lint rules refuse `setState` inside an effect, correctly, and this is what
    React offers instead for a value that differs between the server render and
    the client. The store never changes, so `subscribe` returns a no-op and the
    two snapshots are constants.
  */
  const mounted = useSyncExternalStore(neverChanges, onClient, onServer);

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
    const top = PAD;
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

  /**
   * The same curve, closed to the foot of the frame.
   *
   * **Weight, not a second reading.** The line alone left the plot reading as an
   * empty field with a thread across it, which is the "plain" the review
   * objected to. A fill gives the series body and makes the shape legible at a
   * glance rather than only on inspection.
   *
   * It is the row's own colour at a low opacity, which is what keeps it clear of
   * ADR-0009: `weekTone.ts` records that what makes colour a verdict is
   * *differential* colour, a green day beside a red one. Every hour of every day
   * takes the same ocean whatever the tide is doing, so this asserts nothing
   * about the water.
   */
  const areaPath =
    points.length < 2
      ? null
      : `${path} L${x(points[points.length - 1].atMs).toFixed(2)} ${HEIGHT} ` +
        `L${x(points[0].atMs).toFixed(2)} ${HEIGHT} Z`;

  /** The now line, only when this day is today and the instant is inside it. */
  const nowX =
    nowMs !== null && nowMs >= startMs && nowMs < endMs ? x(nowMs) : null;

  /** Cloud by the hour it covers, so a readout can name the sky at that hour. */
  const cloudByHour = new Map(
    cloud.map((hour) => [
      Math.round((hour.atMs - startMs) / HOUR_MS),
      hour.value,
    ]),
  );

  const selectedPoint = selected === null ? null : (points[selected] ?? null);
  const selectedHour =
    selectedPoint === null
      ? null
      : Math.round((selectedPoint.atMs - startMs) / HOUR_MS);

  /**
   * What one hour says when it is chosen.
   *
   * Every clause is a fact this page already holds: the hour, the value, the
   * cloud the National Weather Service published for it, and whether the sun
   * was up -- which is astronomy and cannot fail. Nothing is computed about
   * whether the hour is *good*, which is ADR-0009's line and the one an
   * interactive readout is most likely to cross.
   */
  const readout = (): string | null => {
    if (selectedPoint === null || selectedHour === null) return null;
    const cloudAt = cloudByHour.get(selectedHour);
    const dark =
      selectedPoint.atMs < sunriseMs || selectedPoint.atMs > sunsetMs;
    return [
      hourLabel(selectedHour),
      `${selectedPoint.value.toFixed(1)} ${unitLabel}`,
      cloudAt === undefined ? "no cloud forecast" : `${cloudAt}% cloud`,
      dark ? "before sunrise or after sunset" : "in daylight",
      selectedPoint.published ? null : "between published points",
    ]
      .filter((part): part is string => part !== null)
      .join(" · ");
  };

  /** Move the selection, wrapping at neither end: a day has two ends and they hold. */
  const step = (delta: number) => {
    setSelected((current) => {
      const next = current === null ? 0 : current + delta;
      return Math.min(points.length - 1, Math.max(0, next));
    });
  };

  const onColumnKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in moves) {
      event.preventDefault();
      step(moves[event.key]);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setSelected(event.key === "Home" ? 0 : points.length - 1);
    }
  };

  return (
    <div className="max-w-4xl overflow-hidden rounded-box border-[1.5px] border-ocean bg-white/60">
      {/*
        The furniture, and the reason it is here: reviewed on the page, the
        chart read as plain and as not belonging to the rest of the site. The
        brief's aesthetic direction is what says where to put that right --
        "the loud register belongs to headings, tabs, chips and glyphs; inside
        the plot frame the page goes quiet". So the energy goes into the frame
        and the chrome, and the data stays a chart in a field guide.

        This band is the week grid's own today-cell header reused rather than
        invented: `border-ocean bg-ocean` with the label register in white,
        already measured there. The day panel *is* today, so it takes today's
        treatment and the two regions read as one instrument.

        It is also where the four tabs will sit, which is why the variable is
        named here rather than only in the sentence at the foot.
      */}
      <div className="border-b-[1.5px] border-ocean bg-ocean px-4 py-2">
        <p className="text-2xs font-extrabold tracking-widest text-white uppercase">
          {variableLabel}
          <span className="text-white/70"> · {unitLabel}</span>
        </p>
      </div>

      <div className="p-4">
        {/*
        The cloud band, above the plot and outside it. Labelled to the left in
        the same register the week grid labels its rows, so a reader meets the
        word before the shading rather than after it.
      */}
        {cloud.length > 0 && (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xs w-12 shrink-0 text-right font-extrabold tracking-widest text-fog uppercase">
                Cloud
              </span>
              <svg
                role="img"
                aria-label={cloudDescription}
                viewBox={`0 0 ${WIDTH} ${CLOUD_H}`}
                preserveAspectRatio="none"
                className="block h-3 min-w-0 flex-1 rounded-sm"
              >
                {/*
                One rect per forecast hour rather than one across the run. An
                hour the forecast did not reach draws nothing, where a rect
                stretched to the next point it *did* reach would claim cloud for
                hours nobody published.

                `preserveAspectRatio="none"` is safe here and nowhere else on
                this page: the band holds only axis-aligned rectangles, which
                stretch without distorting, where the plot below holds circles
                that would become ellipses.
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
              </svg>
            </div>

            {/*
            The key, and it states percentages rather than words.

            **Naming the bands "sunny" and "cloudy" would reverse ADR-0024.**
            That decision measured this site banding cloud cover on the National
            Weather Service's own sky-condition scale and disagreeing with the
            National Weather Service on three days of six -- "we would print
            Partly cloudy; its forecast endpoint says Mostly Sunny". The
            publisher's own wording is now printed directly above this chart, so
            a banded word here would not merely risk contradicting a source: it
            would contradict a sentence a reader can see at the same time.

            A key to the encoding is a different thing from a verdict about the
            sky, and this is the first. It says what a shade is worth, and the
            words for the day stay the forecaster's.
          */}
            <div
              className="text-2xs mb-3 ml-14 flex items-center gap-1.5 text-fog"
              data-cloud-key
            >
              <span>Cloud cover</span>
              {CLOUD_KEY_STOPS.map((percent) => (
                <span key={percent} className="flex items-center gap-1">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-4 rounded-xs bg-fog"
                    style={{ opacity: cloudOpacity(percent) }}
                  />
                  {percent}%
                </span>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2">
          {/*
          The value scale, in markup rather than in the SVG, so it stays in the
          site's own type scale at every width. Top and bottom of the range and
          nothing between: gridlines were considered and left out, because the
          brief asks for a chart in a field guide and a reader taking a figure
          off this plot has it written beneath as well.
        */}
          <div className="text-2xs flex w-12 shrink-0 flex-col justify-between py-px text-right text-fog">
            <span data-axis="high">
              {highValue.toFixed(1)} {unitLabel}
            </span>
            <span data-axis="low">
              {lowValue.toFixed(1)} {unitLabel}
            </span>
          </div>

          <div className="relative min-w-0 flex-1">
            {/*
            The "now" chip, which names the dashed rule rather than leaving a
            reader to work out what a vertical line means. Chrome, so it takes
            the loud register the brief reserves for chrome: a pill in the
            site's own shape, not a label drawn inside the plot.
          */}
            {nowX !== null && (
              <span
                className="text-2xs absolute -top-1 z-10 -translate-x-1/2 rounded-pill bg-dark px-1.5 py-0.5 font-extrabold tracking-widest text-white uppercase"
                style={{ left: `${(nowX / WIDTH) * 100}%` }}
                data-now-chip
              >
                Now
              </span>
            )}
            <svg
              role="img"
              aria-label={description}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="block h-auto w-full"
            >
              {/*
              Night, full height, the ground the whole day is drawn on. It is
              the only shading inside this frame: cloud has its own band above,
              so nothing here has to be told apart from anything else by shade.
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

              {areaPath !== null && (
                <path
                  d={areaPath}
                  className="fill-ocean"
                  fillOpacity={0.12}
                  stroke="none"
                  data-area
                />
              )}

              <path
                d={path}
                fill="none"
                className="stroke-ocean"
                data-curve
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
                    r={3}
                    className="fill-ocean stroke-white"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

              {/*
              The chosen hour: a guide down the plot and a bigger mark on the
              curve, drawn after everything else so neither is buried. Two
              channels rather than one -- the mark changes size as well as
              weight, so the selection never rests on colour alone.
            */}
              {selectedPoint !== null && (
                <>
                  <line
                    x1={x(selectedPoint.atMs)}
                    x2={x(selectedPoint.atMs)}
                    y1={0}
                    y2={HEIGHT}
                    className="stroke-ocean"
                    strokeWidth={1}
                    strokeOpacity={0.45}
                    vectorEffect="non-scaling-stroke"
                    data-selected-guide
                  />
                  <circle
                    cx={x(selectedPoint.atMs)}
                    cy={y(selectedPoint.value)}
                    r={6}
                    className="fill-ocean stroke-white"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    data-selected-mark
                  />
                </>
              )}

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

            {/*
            One column per hour, laid over the plot. Transparent: the plot is
            already the picture, and a visible grid of hit areas would be the
            gridlines the brief's anti-references name.

            A roving tabindex rather than twenty-four tab stops -- one stop for
            the group, then arrow keys, which is how a radio group behaves and
            what a keyboard reader expects. The focus ring is the site's own,
            inherited from `globals.css` rather than redefined here.
          */}
            {mounted && (
              <div
                role="group"
                aria-label={`Hours of the day. Choose one to read its ${variableLabel.toLowerCase()}.`}
                className="absolute inset-0 flex"
                onKeyDown={onColumnKeyDown}
                data-hour-columns
              >
                {points.map((point, index) => {
                  const hour = Math.round((point.atMs - startMs) / HOUR_MS);
                  const cloudAt = cloudByHour.get(hour);
                  return (
                    <button
                      key={point.atMs}
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer"
                      tabIndex={index === (selected ?? 0) ? 0 : -1}
                      aria-pressed={index === selected}
                      onClick={() => setSelected(index)}
                      data-hour-column={hour}
                    >
                      {/*
                      The whole label, not a number: a screen reader landing on
                      one of these gets the hour, the reading and the sky
                      without having to move to the readout to find out what it
                      has just selected.
                    */}
                      <span className="absolute -m-px h-px w-px overflow-hidden">
                        {hourLabel(hour)}, {point.value.toFixed(1)} {unitLabel}
                        {cloudAt === undefined ? "" : `, ${cloudAt}% cloud`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
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
        the left gutter's own width plus the row's gap so the three scales --
        cloud, value and hour -- all line up on the same left edge.
      */}
        <div className="relative mt-1 ml-14 h-4">
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
        {/*
          The readout, and the summary under it.

          **The summary never goes away.** It is the plot's text equivalent and
          the thing a reader has without touching anything, so it stays put
          whether or not an hour is chosen. The readout is additive: per-hour
          detail this page did not carry at all before, which is why adding it
          hides nothing.

          `aria-live="polite"` because the change is the whole point and a
          reader moving through the hours with the arrow keys is not looking at
          this line. A reserved minimum height keeps the page from jumping when
          the first hour is chosen.
        */}
        {mounted && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={selected === 0}
                className={`rounded-pill ${TOUCH_TARGET} md:min-h-0 border-[1.5px] border-lavender bg-white px-3 py-1 text-2xs font-extrabold tracking-widest text-ocean uppercase disabled:opacity-40`}
                data-hour-prev
              >
                ← Earlier
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={selected === points.length - 1}
                className={`rounded-pill ${TOUCH_TARGET} md:min-h-0 border-[1.5px] border-lavender bg-white px-3 py-1 text-2xs font-extrabold tracking-widest text-ocean uppercase disabled:opacity-40`}
                data-hour-next
              >
                Later →
              </button>
            </div>
            <p
              className="text-2xs leading-relaxed min-h-4 flex-1 text-ocean"
              aria-live="polite"
              data-hour-readout
            >
              {readout() ?? "Pick an hour to read it."}
            </p>
          </div>
        )}

        <p className="text-2xs leading-relaxed mt-3 text-fog">
          Low {lowValue.toFixed(1)} {unitLabel}, high {highValue.toFixed(1)}{" "}
          {unitLabel} today. Night is shaded; cloud is the band above.
        </p>
      </div>
    </div>
  );
}
