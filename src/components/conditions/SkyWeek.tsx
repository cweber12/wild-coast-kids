/**
 * One day's cloud cover, as the week grid prints it.
 *
 * **The label names the selection, like every row above it, and names a
 * different kind of selection.** `TideWeek` and `WaveWeek` say "Lowest daylight
 * tide" and "Biggest daylight swell" because they show one of a day's estimates
 * and which one is a judgement. This shows all of them, averaged, and "Cloud by
 * day" says that — a reader who reads it as a superlative would be wrong about
 * the number in a way the tide and swell labels are built to prevent.
 *
 * **Why an average where the rows above take an extreme.** ADR-0017 selects for
 * reachability: a lowest low at 3:14 AM is a number nobody planning a trip with
 * children can use, so the row leads with the extreme that falls between
 * sunrise and sunset. Cloud cover has no unreachable hours — the daylight
 * window *is* the trip — so there is no extreme to route around, and taking one
 * anyway would import that ADR's pessimism without its reason. Measured at
 * `SGX/54,21`, the cloudiest daylight step on 2026-08-30 was 62% against a
 * daylight mean of 39%. The plan's 2026-08-27 addendum records the decision.
 *
 * **The phenomenon carries the "when" the percentage cannot.** Every other row
 * in this grid leads with a time. This one has none to lead with, because a
 * mean is about a window rather than an instant — and a parent does not plan
 * around 44% cloud, they plan around fog. So the second line is the phenomenon
 * when one is forecast for a daylight hour, and absent when none is, which is
 * most days. An absent line is an ordinary day rather than a missing reading:
 * the percentage above it still answers.
 *
 * **No visibility figure, and that is the point rather than an omission.** The
 * gridpoint declares `visibility` and publishes nothing for it at any cell
 * covering this inventory, and the fog entry's own 1.6 km figure appears in
 * about a third of entries — a precision the rest of the row cannot match would
 * read as a measurement. ADR-0020.
 *
 * **No cell where the forecast does not reach**, which is the caller's doing:
 * `readSkyWeek` returns only the days it has and `WeekGrid` draws no pair for a
 * day a row has nothing for. A label over a gap would read as an instrument
 * that failed.
 *
 * **No glyph and no attribution here**, for the reasons `WaveWeek` records:
 * ADR-0015 on a full-colour emoji at 10px, and `WeekGrid`'s single provenance
 * line beneath the grid. Which cell this came from is one fact about a feed.
 *
 * **A cell rather than a row**, because the grid is day-major.
 */

import type { SkyWeekDay } from "@/lib/conditions";
import { phenomenonWords } from "./gridCell";

/** What every day of this row shares: the words that name it. */
export const SKY_WEEK_ROW = {
  label: "Cloud by day",
} as const;

export function SkyWeek({
  day,
}: {
  day: Pick<SkyWeekDay, "cloudPercent" | "phenomenon">;
}) {
  return (
    <>
      {/*
        The space between the spans stays, for the reason `DaylightWeek`
        records: two blocks collapse it visually and it is still a text node,
        and without it the accessible text runs together as "44%Patchy fog".
      */}
      <span className="font-extrabold lg:block">{day.cloudPercent}%</span>{" "}
      {day.phenomenon !== null && (
        <span className="text-fog lg:block">
          {phenomenonWords(day.phenomenon)}
        </span>
      )}
    </>
  );
}
