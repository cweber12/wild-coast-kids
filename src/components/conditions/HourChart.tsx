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
 * **Four products, one frame, and the tabs are additive too.** Tide, swell,
 * wind and temperature share the day, the night band and the cloud above it;
 * only the foreground changes. That the tabs are mutually exclusive is worth
 * being exact about against ADR-0027's "only additively" condition, because it
 * looks like a violation and is not: three of these four series were never on
 * this page in any form, and the fourth -- the tide -- is the tab the server
 * draws and the one a reader is on until they choose otherwise. Nothing that
 * was drawn or written has gone behind a gesture; three things that were
 * nowhere have arrived behind one.
 *
 * The alternative was four stacked charts, which is four times 246px of one
 * screen for a page whose whole complaint was that it was tall and said the
 * same thing twice.
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

import { useId, useState } from "react";
import { nightBands } from "./dayFrame";
import { useHydrated } from "./hydrated";
import type { SparkPoint } from "./DaySpark";
import { ProvenanceLine, type ProvenanceFacts } from "./ProvenanceLine";
import { TOUCH_TARGET } from "../ui/touchTarget";

/**
 * One product this chart can draw, and one tab in the bar above it.
 *
 * **A tab is a whole series and its words, not a key into four parallel
 * arrays.** The unit, the spoken description and the sentence for an absence
 * all differ per product and all have to move together: a swell tab drawing
 * feet under a heading that says mph is the failure this shape makes
 * impossible.
 */
export type HourSeries = {
  /** Stable identity, for the tab's DOM id and for React's key. */
  key: string;
  /** The tab's word, and the product's name: "Tide", "Swell". */
  label: string;
  /** The unit the values are in: "ft", "mph". */
  unitLabel: string;
  /** The series, in time order. Empty renders `absence` in place of the plot. */
  points: readonly SparkPoint[];
  /** The spoken equivalent of this plot. Composed by the caller. */
  description: string;
  /**
   * What to say instead of a plot when `points` is empty.
   *
   * **Its own sentence per product rather than one for the chart**, because
   * the reasons differ and a reader is owed the real one: a beach with no MOP
   * line will never have a swell curve, where a cell that answered without a
   * wind series is a fact about one forecast run.
   */
  absence: string;
  /**
   * Who published this curve, printed beneath the plot when there is one.
   *
   * **Per series, because the four tabs are three publishers.** The tide is
   * NOAA's, the swell is CDIP's model and the wind and the air temperature are
   * the National Weather Service's cell — so one line for the chart would be
   * wrong on at least two tabs, and the nearest line above the plot already is:
   * it names the cell, and a reader who takes it for the plot's source is
   * misinformed whenever the tide or the swell is drawn. ADR-0029 licenses the
   * modelled swell sitting a few pixels above the buoy's measured height
   * *on condition that each is attributed*, which is this field.
   *
   * **Required and nullable rather than optional.** `null` is a real state and
   * not an omission: 26 of 51 beaches bind no MOP line, and a beach with no
   * tide station or no forecast cell has nothing to name either. Making the
   * field required is what stops the fifth series being composed without one,
   * which is exactly how these four came to be drawn by nobody.
   */
  provenance: ProvenanceFacts | null;
};

export type HourChartProps = {
  /** Local midnight this day begins on. The left edge. */
  startMs: number;
  /** Local midnight the next day begins on. The right edge. */
  endMs: number;
  /**
   * What this chart can draw, in tab order. At least one.
   *
   * The first is what the server renders and what a reader without JavaScript
   * gets, so the caller puts the page's lead product first rather than the one
   * that happens to have data. Choosing a different tab on the reader's behalf
   * would be a rule nobody could see, and the tab that is quiet says why.
   */
  series: readonly HourSeries[];
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
  /**
   * The spoken equivalent of the cloud band.
   *
   * Its own, because the band is its own graphic with its own source: the plot
   * is NOAA's tide and the band is the National Weather Service's sky, and one
   * accessible name covering both would credit the wrong publisher for half of
   * what it described.
   */
  cloudDescription?: string;
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

/**
 * The plot frame's shape on a phone, where its own is too flat to read.
 *
 * **One aspect ratio cannot serve both ends of this range, and that is a
 * measurement rather than a judgement.** The frame is 3.27:1, so its height is
 * whatever its width divides to. Measured on the built page 2026-08-28, before
 * and after the tabs, at four widths:
 *
 * | viewport | plot      |
 * | -------- | --------- |
 * | 1536     | 806 × 246 |
 * | 768      | 582 × 178 |
 * | 375      | 237 × 72  |
 * | 320      | 182 × 56  |
 *
 * A ratio flat enough to keep 246px at 806 wide gives 72px at 237 wide, and a
 * ratio tall enough to give a phone a chart draws a third of a laptop screen.
 * `docs/plans/conditions-day-view.md` recorded the 375 figure rather than
 * fixing it and left the decision to this slice.
 *
 * **So the frame changes shape below `sm` and the drawing stretches to fill
 * it.** 2:1, which renders 118px at 375 and 91px at 320. Above `sm` nothing
 * happens: `h-auto` takes the box's height from the viewBox, so the box's
 * aspect already *is* the drawing's and `preserveAspectRatio="none"` has
 * nothing to do. The frame a reader reviewed at 1536 is untouched.
 *
 * **What the stretch costs is that a mark stops being a circle, and it costs
 * less than it sounds.** This file's own note says uniform scaling keeps a
 * published point round; below `sm` a mark of r=3 renders about 2px across and
 * 3.3px tall instead of 2px square. At two pixels that is not a shape anybody
 * reads, and the alternative -- a 72px frame -- loses the curve itself. The
 * band above the plot has drawn with `preserveAspectRatio="none"` since it was
 * built; what is new is that the plot does so at one end of its range.
 *
 * Written out rather than derived from `WIDTH` and `HEIGHT`, because Tailwind
 * scans source text and a composed class name compiles to nothing (ADR-0006).
 * It deliberately does **not** have to match them: it applies only where the
 * stretch is wanted.
 */
export const NARROW_FRAME = "max-sm:aspect-[2/1]";

/**
 * How many published points a phone can separate, above which they are not
 * drawn there at all.
 *
 * **A mark is a ring, not a dot, and the ring is what runs out of room.** It is
 * `r=3` in a viewBox 720 wide with a 1.5px non-scaling stroke, so at 237px of
 * plot it renders about 2px across inside a white halo about 5px across. Two
 * dozen of those at 9.9px apart do not read as marks on a curve; they read as
 * gaps in it, and the curve comes out looking dashed -- which on this plot
 * already means something else, since the "now" rule is dashed exactly so it
 * cannot be mistaken for a series.
 *
 * **Twelve, because that is the count the spacing allows**, and the arithmetic
 * is the same at both narrow widths measured: 237px of plot gives 19.8px per
 * mark at twelve and 9.9px at twenty-four; 182px at 320 gives 15.2px and 7.6px.
 * A five-pixel ring wants the former.
 *
 * **It drops them exactly where they say least, which is why this is a
 * degrade rather than a loss.** The series that trip it are the hourly ones,
 * whose twenty-four marks say "hourly" -- the least surprising cadence on the
 * page. The swell's eight and a gridpoint block's four are under the threshold
 * and keep their marks at every width, so the distinction a reader actually
 * needs, between an hourly model and a coarser one, is the one that survives.
 * The spoken description states the cadence in words on every tab regardless.
 */
const MARKS_FIT_NARROW = 12;

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

/** `0` to "12 AM", `13` to "1 PM". The axis speaks the reader's clock. */
function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function HourChart({
  startMs,
  endMs,
  series,
  sunriseMs,
  sunsetMs,
  cloud = [],
  cloudDescription = "Cloud cover through the day.",
  nowMs = null,
}: HourChartProps) {
  /**
   * The chosen hour, held as an instant rather than as an index into `points`.
   *
   * **So that switching tabs keeps the hour.** An index means something
   * different in each series -- the tide has twenty-four points and a swell
   * that ran out at teatime has fewer -- so index 9 would land on 9 AM in one
   * and mid-afternoon in another. An instant means the same thing in all four,
   * and a tab with no point at that instant simply has nothing selected, which
   * is the honest answer rather than the nearest one.
   */
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const [tab, setTab] = useState(0);
  const tabIds = useId();

  /*
    The controls exist only once they can work. Rendered on the server they
    would be dead buttons for a reader without JavaScript, which is the failure
    `BeachSelector`'s `noscript` list exists to prevent -- and here there is
    nothing to fall back *to*, because the detail they reveal is not on the page
    in any other form. So the honest fallback is no control at all.

    The tab bar is the same case and takes the same treatment: without a script
    it would be four words that look like controls and are not, so the band
    prints the one series that was drawn instead. The other three are not lost
    to that reader -- they were never on the page, which is what makes this
    additive under ADR-0027 rather than a concealment.

    `useHydrated` is how, and its own docstring is where the mechanism is
    written down -- it has a second caller now that the week chooses a day.
  */
  const mounted = useHydrated();

  // The first series on the server and until a tab is chosen, always. See the
  // prop's docstring: picking the first one with data would be a rule a reader
  // could not see.
  const active = series[mounted ? tab : 0] ?? series[0];
  const { points, unitLabel, description, absence, provenance } = active;

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    const last = series.length - 1;
    if (event.key in moves) {
      event.preventDefault();
      setTab((current) =>
        Math.min(last, Math.max(0, current + moves[event.key])),
      );
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setTab(event.key === "Home" ? 0 : last);
    }
  };

  const panelId = `${tabIds}panel`;
  const tabId = (index: number) => `${tabIds}tab-${series[index].key}`;

  /*
    The furniture, and the reason it is here: reviewed on the page, the chart
    read as plain and as not belonging to the rest of the site. The brief's
    aesthetic direction is what says where to put that right -- "the loud
    register belongs to headings, tabs, chips and glyphs; inside the plot frame
    the page goes quiet". So the energy goes into the frame and the chrome, and
    the data stays a chart in a field guide.

    This band is the week grid's own today-cell header reused rather than
    invented: `border-ocean bg-ocean` with the label register in white, already
    measured there. The day panel *is* today, so it takes today's treatment and
    the two regions read as one instrument.

    The tabs are the loudest thing on the page for the same reason, and they
    are chrome rather than data: the selected one takes the site's own pill,
    which is a change of *shape* and not only of colour -- a filled ground
    against bare words -- so the selection survives a reader who cannot tell
    white from white-on-ocean.

    Without a script the bar is not rendered at all and the band prints the one
    series that was drawn, per the note on `mounted` above.
  */
  const band = mounted ? (
    <div
      role="tablist"
      aria-label="What to plot for this day"
      aria-orientation="horizontal"
      className="flex gap-1"
      onKeyDown={onTabKeyDown}
      data-series-tabs
    >
      {series.map((option, index) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          id={tabId(index)}
          aria-selected={index === tab}
          aria-controls={panelId}
          tabIndex={index === tab ? 0 : -1}
          onClick={() => setTab(index)}
          className={`text-2xs ${TOUCH_TARGET} md:min-h-0 min-w-0 flex-1 cursor-pointer rounded-pill px-2 py-1 font-extrabold tracking-widest uppercase ${
            index === tab ? "bg-white text-ocean" : "text-white/75"
          }`}
          data-series-tab={option.key}
        >
          {option.label}
        </button>
      ))}
    </div>
  ) : (
    <p className="text-2xs font-extrabold tracking-widest text-white uppercase">
      {active.label}
      <span className="text-white/70"> · {unitLabel}</span>
    </p>
  );

  /*
    The tile, drawn the same whether this tab has a series or not.

    **A quiet tab keeps its bar.** The absence used to replace the whole
    component, which was right when there was one series and would strand a
    reader now: they would have chosen a tab and lost the control that got them
    there. What the absence replaces is the plot, and nothing else -- including
    the cloud band, which is context for a frame that is not being drawn.
  */
  const shell = (body: React.ReactNode) => (
    /*
      `xl:max-w-none` because from that width the day row puts the map beside
      this and the column is the constraint. The cap still does its job below
      `xl`, where an uncapped chart on a full-width column drew 440px tall.
    */
    <div className="max-w-4xl overflow-hidden rounded-box border-[1.5px] border-ocean bg-white/60 xl:max-w-none">
      <div className="border-b-[1.5px] border-ocean bg-ocean px-4 py-2">
        {band}
      </div>
      <div className="p-4">{body}</div>
    </div>
  );

  if (points.length === 0) {
    return shell(
      <p
        className="leading-relaxed text-base text-fog"
        id={mounted ? panelId : undefined}
        role={mounted ? "tabpanel" : undefined}
        aria-labelledby={mounted ? tabId(tab) : undefined}
      >
        {absence}
      </p>,
    );
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
  /** What the publisher issued, which is what gets a mark. See `MARKS_FIT_NARROW`. */
  const publishedPoints = points.filter((point) => point.published);

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

  /**
   * Where the chosen instant falls in *this* series, or -1 when it does not.
   *
   * Exact rather than nearest. A swell tab whose forecast ran out at teatime
   * has no 8 PM, and quietly selecting 5 PM instead would put a figure under a
   * heading the reader chose for a different hour.
   */
  const selected =
    selectedMs === null
      ? -1
      : points.findIndex((point) => point.atMs === selectedMs);

  const selectedPoint = selected === -1 ? null : (points[selected] ?? null);
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

  /** Select by position in this series, which is how both controls move. */
  const selectAt = (index: number) => {
    const point = points[Math.min(points.length - 1, Math.max(0, index))];
    if (point !== undefined) setSelectedMs(point.atMs);
  };

  /** Move the selection, wrapping at neither end: a day has two ends and they hold. */
  const step = (delta: number) => {
    selectAt(selected === -1 ? 0 : selected + delta);
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
      selectAt(event.key === "Home" ? 0 : points.length - 1);
    }
  };

  return shell(
    <>
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

      {/*
        What the chosen tab draws, and the region the tabs point at. The cloud
        band is deliberately outside it: the sky is the condition all four
        series happen in rather than one of them, so it does not change when a
        tab does and does not belong to any one tab's panel.

        The roles only exist once the bar does. A `tabpanel` with no tablist is
        a promise to a screen reader that nothing on the page keeps.
      */}
      <div
        id={mounted ? panelId : undefined}
        role={mounted ? "tabpanel" : undefined}
        aria-labelledby={mounted ? tabId(tab) : undefined}
        data-series-panel
      >
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

          <div className={`relative min-w-0 flex-1 ${NARROW_FRAME}`}>
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
              /*
                `preserveAspectRatio="none"` so the frame above can be a
                different shape below `sm` -- see `NARROW_FRAME`. From `sm` up
                the box's aspect is the viewBox's own, derived from `h-auto`, so
                there is nothing to stretch and this attribute does nothing at
                all at the width the chart was reviewed on.
              */
              preserveAspectRatio="none"
              className="block h-auto w-full max-sm:h-full"
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

              A dense series drops its marks on a phone, and drops them where
              they say least -- see `MARKS_FIT_NARROW`.
            */}
              <g
                className={
                  publishedPoints.length > MARKS_FIT_NARROW
                    ? "max-sm:hidden"
                    : ""
                }
                data-marks
              >
                {publishedPoints.map((point) => (
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
              </g>

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
                aria-label={`Hours of the day. Choose one to read its ${active.label.toLowerCase()}.`}
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
                      tabIndex={index === Math.max(selected, 0) ? 0 : -1}
                      aria-pressed={index === selected}
                      onClick={() => selectAt(index)}
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

        {/*
          Who published the curve, and it changes with the tab.

          **Last, and beneath the summary, because it is the most subordinate
          thing here** -- the same place `WeekGrid` puts its three. It is also
          the reading order the fault needs: a reader arriving at the plot from
          above has just passed a line naming the forecast cell, and this is the
          first thing after the plot that says whose the plot actually is.

          **Labelled, though the tab bar is four inches away and says the same
          word.** Two sources are inside this frame -- the curve and the cloud
          band above it, which is the National Weather Service's sky whatever
          tab is selected -- so an unlabelled "MOP line D0481 · CDIP" under the
          whole thing would credit CDIP with the weather. `WeekGrid` labels its
          lines for exactly this reason and records it. The label is the series'
          own word in full rather than the tab's: "Temp" is a tab shortened to
          fit four across a 375px screen, and this line is not paying for that
          width.

          **`surface="page"`, and it is not a preference.** The chart's shell is
          `bg-white/60`; the default paints `CARD_MUTED`, white at 55%, which on
          this ground is the colour of the ground. `ProvenanceLine`'s own
          docstring records two callers that shipped exactly that at 1.03:1.

          Only where there is a plot. A quiet tab prints its `absence` instead,
          and every one of those sentences already names the publisher that went
          quiet -- which is what `WORDS` in `DayPanel` exists to do.
        */}
        {provenance !== null && (
          <div className="mt-2" data-series-provenance>
            <ProvenanceLine {...provenance} surface="page" />
          </div>
        )}
      </div>
    </>,
  );
}
