/**
 * The one day of the seven this region is showing.
 *
 * **It holds no reads and makes no choices about the data.** `DayPanel` does
 * all five reads on the server and hands over seven finished days -- their
 * series, their words, their absences. This picks one. That split is what lets
 * the whole week ship from the first render, which is the point: choosing
 * Thursday costs no request, because every feed here already returns the week
 * in one call and the page has been holding it since it loaded.
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
 * move across the week -- which is the comparison the tabs exist for. The
 * *hour* they chose does not survive, and that also falls out rather than being
 * arranged: `HourChart` holds the selection as an instant, and an instant on
 * Tuesday matches no point in Thursday.
 *
 * **The heading names the day, because the region no longer always means
 * today.** It says "Today, hour by hour" on arrival and on today, and the
 * grid's own label for the day otherwise, so the two regions call Thursday the
 * same thing.
 */

"use client";

import type { ReactNode } from "react";
import { HourChart, type HourSeries } from "./HourChart";
import { REGION_HEADING } from "./headingRank";
import { resolveSelected, useSelectedDay } from "./selectedDay";
import type { SparkPoint } from "./DaySpark";

/** One day, ready to draw. Everything with a judgement in it happened upstream. */
export type DayView = {
  /** `YYYY-MM-DD` in Pacific. What the week grid chooses by. */
  localDate: string;
  /** This day's name in the heading: "Today", "Thu, Aug 27". */
  dayName: string;
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
};

export function ChosenDay({ days }: { days: readonly DayView[] }) {
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
      <h2 id="day-panel-heading" className={REGION_HEADING}>
        {day.dayName}, hour by hour
      </h2>

      <div className="mb-4">{day.wording}</div>

      {/*
        The plot draws the whole day rather than the daylight window, which is
        what discharges ADR-0023's overnight debt: the 3 AM low the week grid
        cannot print a label for is here, inside a band that is visibly night.

        Every tab draws that same day against the same night and the same cloud.
        Only the foreground changes, which is what makes the four one instrument
        rather than four charts sharing a tile.
      */}
      <HourChart
        startMs={day.startMs}
        endMs={day.endMs}
        series={day.series}
        sunriseMs={day.sunriseMs}
        sunsetMs={day.sunsetMs}
        cloud={day.cloud}
        cloudDescription={day.cloudDescription}
        nowMs={day.nowMs}
      />
    </>
  );
}
