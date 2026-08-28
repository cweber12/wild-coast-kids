/**
 * One day's cloud cover, as the week grid prints it: the phenomenon, then the
 * day in three parts.
 *
 * **The label is "Cloud cover", and it names a different kind of selection from
 * the two rows above it.** `TideWeek` and `WaveWeek` each show one of a day's
 * estimates, and which one is a judgement the day header now states for all
 * three. These are means. That difference used to live in the label — "Cloud by
 * day" against two superlatives — and after ADR-0023 shortened those, the
 * distinction has nowhere to be drawn in three words. `ConditionsNotes` carries
 * it instead, which is where the page already explains that a tide time and a
 * swell time are different kinds of figure. A reader who took these for peaks
 * would be wrong about the number, and that is the risk this paragraph exists
 * to flag to whoever changes the wording next.
 *
 * "Cover" rather than "coverage": it is the term the National Weather Service
 * uses for the quantity this reads, and at 100px it leaves a quarter of the
 * 133px cell spare where "cloud coverage" is 128px and leaves five.
 *
 * **Three figures rather than one, because on this coast one was misleading.**
 * The row shipped a single daylight mean, and measured against the live cell on
 * 2026-08-28 every one of seven days was a marine-layer burn-off — Sunday ran
 * 65% / 32% / 31% and averaged to 46%, which describes neither half of the day.
 * The mean is gone rather than kept beside the parts: it was the misleading
 * figure, and printing it next to three that do not obviously average to it
 * would be noise defending a number nobody should read. ADR-0024.
 *
 * **No band word, and that is a finding rather than an omission.** "46% Partly
 * cloudy" was the obvious companion fix and it was tested before it was built:
 * banding the daylight mean on the National Weather Service's own sky-condition
 * scale contradicts the National Weather Service's own published wording on
 * three of six measured days — we would print "Partly cloudy" where its
 * forecast endpoint says "Mostly Sunny". A site that names a source and then
 * disagrees with it has said something worse than nothing. The words exist and
 * they are theirs to give: `shortForecast` on `/gridpoints/{cell}/forecast`
 * carries them, transitions included ("Patchy Fog then Mostly Sunny"), and that
 * is a second upstream read with its own outage rather than something to
 * compute here.
 *
 * **The phenomenon still leads, and still carries the "when" the numbers
 * cannot.** Every other row in this grid opens with a time. This one has none,
 * because a mean is about a window rather than an instant — and a parent does
 * not plan around 44% cloud, they plan around fog. It is absent on most days,
 * which is an ordinary day rather than a missing reading: the three figures
 * below still answer.
 *
 * **Nothing here wraps, and the phenomenon is why that took work.** It is the
 * only free text in the cell -- "Patchy fog" is 69px and "Slight chance rain
 * showers" is 174px at the value register, against 133px of cell at 1280 and
 * 169px at 1536. It wrapped at every seven-column width the grid has, and a
 * cell one line taller than its neighbours puts its own rows out of line with
 * theirs, which is the misalignment this grid exists to prevent. The line takes
 * the subordinate size and truncates rather than reflowing; the words
 * themselves cannot shorten, for the reason `phenomenonWords` records.
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

import type { SkyThirds, SkyWeekDay } from "@/lib/conditions";
import { phenomenonWords } from "./gridCell";
import { CLOUD_TONE } from "./weekTone";

/** What every day of this row shares: the words that name it, and its colour. */
export const SKY_WEEK_ROW = {
  label: "Cloud cover",
  tone: CLOUD_TONE,
} as const;

/**
 * What each third is called, in reading order.
 *
 * **"Mid" rather than "PM"**, because the third part is also PM and a column
 * headed "PM" beside one headed "Eve" reads as a contradiction rather than as a
 * sequence.
 *
 * Three short words rather than "Morning / Midday / Evening": each column is
 * about 42px wide at 1280 and "Morning" alone is wider than that at the label
 * register, so the full words would wrap. They are set in `text-2xs`, the size
 * every label on this page uses, rather than a new smaller token -- 10px is
 * already the floor here and going under it to fit a word is how a size scale
 * stops being one. The long form belongs in the day view, where there is room
 * to say what a third is.
 *
 * They are approximations on purpose. A third of a 13-hour August window runs
 * to about 10:40, which is late for "AM" — but the alternative is naming clock
 * hours, and a boundary at 11 AM would be this site inventing a fact about the
 * sky. `SkyThirds` records why the window is the divisor.
 */
const THIRDS: readonly { key: keyof SkyThirds; label: string }[] = [
  { key: "am", label: "AM" },
  { key: "mid", label: "Mid" },
  { key: "eve", label: "Eve" },
];

export function SkyWeek({
  day,
}: {
  day: Pick<SkyWeekDay, "thirds" | "phenomenon">;
}) {
  return (
    <>
      {/*
        **One line, always, and the words are not shortened to get there.**
        `phenomenonWords` records why they cannot be: they are the National
        Weather Service's own plain-language rendering, and rewording them
        would be this site forming a forecaster's judgement rather than
        relaying one -- ADR-0009's rule.

        So the line takes the subordinate size and truncates. `Slight chance
        rain showers` is the longest string this inventory publishes and
        measures 174px at 13px, against 133px of cell at 1280 and 169px at
        1536: it wrapped at every seven-column width, and a cell one line
        taller than its neighbours is the misalignment this grid is built to
        prevent. At 11px it is 147px and sets whole from about 1400 up.

        `truncate` is the guarantee rather than the plan. Below roughly 1400
        the longest phenomenon ends in an ellipsis, which is a visible signal
        that there is more rather than a silent trim -- and the National
        Weather Service's vocabulary is an open enumeration, so a combination
        longer than anything measured here must degrade rather than reflow.
      */}
      {day.phenomenon !== null && (
        <span className="text-xs block truncate text-fog">
          {phenomenonWords(day.phenomenon)}
        </span>
      )}

      {/*
        A row of three rather than a sentence, because the figures are being
        compared to each other and a reader scanning for the burn-off wants
        them in a line. `text-center` on equal columns is what makes the
        comparison visual: 65 / 32 / 31 reads as a slope, "65% then 32% then
        31%" reads as three facts.
      */}
      <span className="mt-0.5 flex gap-1.5">
        {THIRDS.map(({ key, label }) => (
          <span key={key} className="flex-1 text-center">
            <span className="text-2xs block font-extrabold tracking-wide text-fog uppercase">
              {label}
            </span>
            {/*
              An em dash rather than a zero where the forecast did not reach.
              The product does not run backwards, so on the day the reader is
              standing in the first third is usually gone -- and a 0% there
              would report a cloudless morning that nobody observed.
            */}
            <span className="block font-extrabold">
              {day.thirds[key] === null ? (
                <span className="text-fog">&mdash;</span>
              ) : (
                `${day.thirds[key]}%`
              )}
            </span>
          </span>
        ))}
      </span>
    </>
  );
}
