/**
 * The one day of the seven this region is showing.
 *
 * **It holds no reads and makes no choices about the data.** `DayPanel` does
 * every read on the server and hands over seven finished days -- their series,
 * their words and their absences. This picks one. That split is what lets the
 * whole week ship from the first render, which is the point: choosing Thursday
 * costs no request, because every feed here already returns the week in one
 * call and the page has been holding it since it loaded.
 *
 * **Nothing in this region is measured.** The buoy and the shore station sit
 * at the top of the page now, outside the provider this component reads,
 * because they answer for an instant rather than for a day.
 *
 * **Seven days of series is what this costs, and it is the trade the brief
 * asked for.** Four products of twenty-four points across seven days is a few
 * hundred numbers in the payload against a network round trip per click. The
 * alternative -- fetching a day when it is chosen -- would also make the choice
 * a loading state, on a page whose whole argument is that the future is what
 * anybody came for.
 *
 * **The chart is not keyed on the day, deliberately.** Changing the day keeps
 * the same `HourChart` mounted, so the tab a reader chose stays chosen as they
 * move across the week -- which is the comparison the tabs exist for.
 *
 * **The hour survives too, and it did not always.** It used to fall out of
 * `HourChart` holding the selection as an instant: an instant on Tuesday
 * matches no point in Thursday, so the selection cleared itself. That was
 * recorded here as a virtue and it was not one. The hour is now the page's
 * rather than the chart's -- `selectedHour.tsx` -- and it is held as an hour of
 * the day, so it resolves against whichever day is showing. A reader comparing
 * 5 PM across the week is doing the same thing with the hour that the tabs let
 * them do with the product, on the region this file already says the week
 * selector exists to make comparable.
 *
 * **The heading names the day, because the region no longer always means
 * today.** It says "Today, hour by hour" on arrival and on today, and the
 * grid's own label for the day otherwise, so the two regions call Thursday the
 * same thing.
 *
 * **There is a day control in here now.** `DayStrip`, under the heading, which
 * writes to the same provider the week grid does. It is here because the grid
 * is ~290px of cells above the chart, so changing the day used to mean
 * scrolling away from the thing being changed. See that file for why a second
 * control over one fact is worth having.
 */

"use client";

import type { ReactNode } from "react";
import { DayStrip } from "./DayStrip";
import { HourChart, type HourSeries } from "./HourChart";
import { TOOL_REGION_HEADING } from "../ui/headingRank";
import { resolveSelected, useSelectedDay } from "./selectedDay";
import type { SparkPoint } from "./DaySpark";

/** One day, ready to draw. Everything with a judgement in it happened upstream. */
export type DayView = {
  /** `YYYY-MM-DD` in Pacific. What the week grid chooses by. */
  localDate: string;
  /** This day's name in the heading: "Today", "Thu, Aug 27". */
  dayName: string;
  /**
   * The same day inside a sentence: "today", "on Thu, Aug 27".
   *
   * A second form rather than `dayName` lowercased, because lowercasing a date
   * gives "thu, aug 27" — and a third form of one fact is what three positions
   * genuinely want. `DayPanel` composes all of them in one place, next to the
   * `when` its absence sentences take.
   */
  chartWhen: string;
  /** Local midnight this day begins on, and the next. The plot's two edges. */
  startMs: number;
  endMs: number;
  sunriseMs: number;
  sunsetMs: number;
  /** The instant to draw a "now" line at, and null on the six days that are not today. */
  nowMs: number | null;
  cloud: SparkPoint[];
  cloudDescription?: string;
  /** The four tabs, in tab order, tide first. */
  series: HourSeries[];
  /** The publisher's own wording for this day, already rendered. */
  wording: ReactNode;
  /**
   * The National Weather Service's relayed judgement for this day, already
   * rendered: the risk on the days the bulletin reaches, a sentence on the
   * days it does not, and on a sheltered beach a sentence saying the product
   * is not about this water at all.
   *
   * A finished node for the reason `wording` is one -- a server read handed to
   * a client component -- and present on all seven days rather than only on the
   * ones the forecast reaches, so that stepping across the week never leaves a
   * reader wondering whether the block failed or the day is simply beyond the
   * horizon.
   */
  surfZone: ReactNode;
};

export function ChosenDay({
  days,
  map,
}: {
  days: readonly DayView[];
  /**
   * The shore map, already rendered.
   *
   * Outside `DayView` and not inside it, because the map does not change when a
   * reader picks a different day: the beach, its coast and the four places its
   * figures come from are the same on all seven. Seven copies of one picture
   * would say the opposite, and would redraw it on every click.
   */
  map: ReactNode;
}) {
  const { selected } = useSelectedDay();
  const showing = resolveSelected(
    selected,
    days.map((day) => day.localDate),
  );
  const day = days.find((each) => each.localDate === showing) ?? days[0];

  // Seven days come from the daylight read, which is computed rather than
  // fetched and cannot fail, so this is unreachable rather than defensive --
  // and it is here because a region that rendered nothing would be the silent
  // failure this repo is built to avoid.
  if (day === undefined) {
    return (
      <p className="leading-relaxed text-base text-fog">
        We have no days to show for this beach, which is a fault here rather
        than a quiet feed.
      </p>
    );
  }

  return (
    <>
      <h2 id="day-panel-heading" className={TOOL_REGION_HEADING}>
        {day.dayName}, hour by hour
      </h2>

      {/*
        The control, directly under the heading that names what it changed.

        Above the wording rather than below it, though the chart is what it is
        really for: the office's sentences run one to three lines depending on
        the day, so a control under them would move as a reader stepped across
        the week. This region already orders itself on that rule -- it is why
        the rip block and the measured block sat below the chart rather than
        above it -- and a control is the element that can least afford to move.
      */}
      <DayStrip days={days} />

      <div className="mb-4">{day.wording}</div>

      {/*
        The plot draws the whole day rather than the daylight window, which is
        what discharges ADR-0023's overnight debt: the 3 AM low the week grid
        cannot print a label for is here, inside a band that is visibly night.

        Every tab draws that same day against the same night and the same cloud.
        Only the foreground changes, which is what makes the four one instrument
        rather than four charts sharing a tile.
      */}
      {/*
        When and where, side by side, which is the brief's third principle as a
        layout: "time on the left, place on the right". Two thirds and one third
        from `xl`, because the chart plots twenty-four hours and needs the width
        while the map is square.

        Below `xl` they stack, chart first. The map does not go full width when
        it does: it is square, so a 1,184px column would draw a 1,184px-tall
        picture and push the rip current block off the screen entirely. Capping
        the width is what "the map beneath at a reduced height" comes to for a
        shape that is as tall as it is wide.
      */}
      <div className="xl:flex xl:items-start xl:gap-6">
        <div className="min-w-0 xl:basis-2/3">
          <HourChart
            startMs={day.startMs}
            endMs={day.endMs}
            series={day.series}
            sunriseMs={day.sunriseMs}
            sunsetMs={day.sunsetMs}
            when={day.chartWhen}
            cloud={day.cloud}
            cloudDescription={day.cloudDescription}
            nowMs={day.nowMs}
          />
        </div>
        <div className="mx-auto mt-6 w-full max-w-sm min-w-0 xl:mt-0 xl:max-w-none xl:basis-1/3">
          {map}
        </div>
      </div>

      {/*
        Last, which is reading order rather than layout convenience: the sky in
        words, then the day's shape, then what the forecaster judges. The
        instruments are no longer below it -- they are at the top of the page,
        ahead of all three, which is what the standing notice beside them
        already implies: the numbers are not a safety assessment and the
        authority is someone else's.

        Below the chart and not above it, because this is several lines on the
        days the bulletin reaches and one line on the days it does not, so
        putting it above would move the plot up and down the page as a reader
        steps across the week.
      */}
      <div className="mt-6">{day.surfZone}</div>
    </>
  );
}
