/**
 * One day's cloud cover, as the week grid prints it.
 *
 * **The label is "Cloud cover", and it names a different kind of selection from
 * the two rows above it.** "Cloud cover" rather than "cloud coverage": it is the
 * term the National Weather Service uses for the quantity this reads, and at
 * 100px it leaves a quarter of the 133px cell spare where "cloud coverage"
 * would leave 5px. `TideWeek` and `WaveWeek` each show one of a day's
 * estimates, and which one is a judgement the day header now states for all
 * three. This shows all of them, averaged. That difference used to live in the
 * label — "Cloud by day" against two superlatives — and after ADR-0023 the
 * superlatives are gone from the labels too, so the distinction has nowhere to
 * be drawn in three words. It is drawn in `ConditionsNotes` instead, which is
 * where the page already explains that a tide time and a swell time are
 * different kinds of figure. A reader who took this for a peak would be wrong
 * about the number, and that is the risk this paragraph exists to flag to
 * whoever changes the wording next.
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
 * around 44% cloud, they plan around fog. So the phenomenon follows the
 * percentage when one is forecast for a daylight hour, and is absent when none
 * is, which is most days. An absent phenomenon is an ordinary day rather than a
 * missing reading: the percentage still answers.
 *
 * **This is the row allowed to wrap, and it is last for that reason.** The
 * phenomenon is the only free text in the cell: "Patchy fog" is 101px and
 * "Slight chance rain showers" is 203px, against 125px in the narrowest
 * seven-column cell. It used to be forced onto its own line at `lg` so the
 * columns stayed in step, which cost the height on every day to protect rows
 * that no longer exist beneath it. Nothing follows this row, the day blocks are
 * grid items and stay equal height regardless, so a second line here makes one
 * column's text taller and misaligns nothing.
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
import { CLOUD_TONE } from "./weekTone";

/** What every day of this row shares: the words that name it, and its colour. */
export const SKY_WEEK_ROW = {
  label: "Cloud cover",
  tone: CLOUD_TONE,
} as const;

export function SkyWeek({
  day,
}: {
  day: Pick<SkyWeekDay, "cloudPercent" | "phenomenon">;
}) {
  return (
    <>
      {/*
        The space between the spans stays a text node. Without it the
        accessible text runs together as "44%Patchy fog" -- the concatenation
        `ReadingCard` records hitting in the accessible-name algorithm.
      */}
      <span className="font-extrabold">{day.cloudPercent}%</span>{" "}
      {day.phenomenon !== null && (
        <span className="text-fog">{phenomenonWords(day.phenomenon)}</span>
      )}
    </>
  );
}
