/**
 * What every reading on this page has in common, explained once.
 *
 * The three panels each used to end with a paragraph at 10px carrying two
 * different things: **which station supplied this figure**, and **what the
 * figure means**. The first is specific to a panel and stays there — ADR-0010
 * requires that a reader be able to tell which station supplied which number,
 * and hiding it would be worse than the two lines it costs. The second is the
 * same explanation three times over, and repeating it is what buried the
 * numbers between it.
 *
 * `TideToday` already argued for this arrangement in its own docstring — "the
 * acronym is named once, at the bottom, rather than beside every figure" — and
 * then the page did that once per panel. This is that principle applied at the
 * scale it was actually about.
 *
 * **Nothing was dropped in the move, and one thing changed: the size.** The
 * explanations were `text-2xs`; here they are `text-sm`. A safety qualification
 * set in 10px at the tail of an attribution line is technically present and
 * practically unread, and the whole reason for collecting these is that they
 * become readable.
 *
 * **The wording is general because the block always renders.** A beach with no
 * sky station still gets the sentence about airports, so it says "where they
 * are shown" rather than asserting this beach has them. That is a description
 * of how the page works, not a claim about this shore.
 *
 * **Not the standing safety notice, which now exists.** That slice has landed:
 * `ConditionsSection` carries it in the header row, above the chooser, saying
 * that these are instruments rather than a judgement and that lifeguards and
 * the posted signs are the authority on the day. The entry this block used to
 * carry — "None of it is a safety assessment" — went with it rather than being
 * said twice, and it was never a note about how to read a number, which is the
 * heading it sat under. It left this block rather than being dropped.
 *
 * **Waves take two entries, and the second is what makes the first honest.**
 * The page now shows a measured height from a buoy offshore and a modelled
 * height from a point near the sand, for the same beach on the same day. Two
 * numbers of the same kind that are not the same kind of number is exactly the
 * confusion ADR-0009 refuses to create and ADR-0016 argues is worth creating
 * here — and it is only worth it if the difference is stated where a reader
 * looking at both will find it. The provenance line under the week says which
 * row is which; this says what the difference means.
 */

import type { InventoryReach } from "@/lib/beaches";
import { Caveats } from "./Caveats";
import { REGION_HEADING } from "./headingRank";

/** One thing worth understanding about every figure of its kind. */
const NOTES = [
  {
    term: "Tide heights",
    detail:
      "Feet above mean lower low water — the average of the lower low tide each day. " +
      "A negative number means the water drops below that average, so more of the sand " +
      "and reef is uncovered than usual. Predictions are astronomy rather than a " +
      "measurement of the water on the day.",
  },
  {
    term: "Daylight first",
    detail:
      "The tide and swell figures lead with the lowest and biggest that fall between " +
      "sunrise and sunset, because those are the ones you can be there for. The day's own " +
      "lowest and biggest sit beneath them, marked “all day” — on this coast they " +
      "are usually in the small hours, which is why they are not what leads. Sunrise and " +
      "sunset are computed for this beach; nothing here is a judgement about when you " +
      "should go.",
  },
  {
    term: "Wave heights",
    detail:
      "The height of the swell in open water, measured at a buoy some distance offshore. " +
      "That is not the height of the wave breaking at the shore, and nothing here " +
      "transforms one into the other.",
  },
  {
    term: "The wave forecast",
    detail:
      "The week's swell is modelled rather than measured. CDIP's MOP system, run by the " +
      "Scripps Institution of Oceanography, computes it at 10 m depth close to this shore " +
      "from the directional spectra real buoys report and the way the islands shelter and " +
      "bend the swell on its way in. It steps every three hours, so the time shown is the " +
      "three-hour step that carried the day's biggest swell rather than a peak located to " +
      "the minute — unlike a tide time, which is a turning point. So a beach page carries " +
      "two wave numbers: one an instrument measured out at sea, one a model computed near " +
      "the sand. The lines naming each source say which is which.",
  },
  {
    term: "Cloud by day",
    detail:
      "A forecast for this beach's own square of the National Weather Service's map, about " +
      "2.5 km across, rather than a reading taken anywhere. It averages the forecast hours " +
      "between sunrise and sunset, so it describes the day you would be there rather than " +
      "the cloudiest hour of it, and it names fog on the days fog is expected.",
  },
  {
    term: "Sky and visibility",
    detail:
      "Where they are shown, they come from an airport. Cloud and visibility are only " +
      "published by airports in this county, so that reading is taken further from the " +
      "water than the temperature beside it — and coastal fog is exactly what changes " +
      "across that distance.",
  },
] as const;

export function ConditionsNotes({
  entries,
  reach,
}: {
  entries: readonly string[];
  reach: InventoryReach;
}) {
  return (
    // No top margin: the now-band above carries the gap. Spacing on both is
    // counted twice, which is the failure `SnapSection`'s docstring records.
    <section aria-labelledby="conditions-notes-heading">
      <h2 id="conditions-notes-heading" className={REGION_HEADING}>
        How to read these numbers
      </h2>

      {/*
        A description list rather than paragraphs: each entry is a topic and its
        explanation, and the pairing is what a reader is scanning for. It also
        survives for someone who cannot see the bolding.

        Columns rather than one stacked ribbon, and the cap moves from the list
        to each note. As a single column this block was 520px of prose in a
        1440px section, leaving 920px blank beside it for its full height -- the
        complaint the brief opens with, reproduced in the page's own closing
        section. The notes are independent of each other, so columns cost the
        reader nothing to scan.

        It also reads better rather than merely narrower. Measured at 520px the
        lines ran 83-84 characters at every width, which is past a comfortable
        measure; three columns at 1536 set to about 74 and two at 768 to about
        52. The brief's principle is that prose keeps its measure and is not
        stretched to fill space, and `max-w-130` per note is what holds that --
        on a very wide screen the columns stop growing rather than pulling the
        lines back out to 83.

        Two steps, matching the now-band's `sm:grid-cols-2 lg:grid-cols-3`
        rhythm rather than inventing one. `lg:grid-cols-3` alone would put three
        columns at 1024 where each is 288px, about 47 characters, and this ramp
        never takes prose below roughly 52.
      */}
      <dl className="leading-relaxed text-sm text-fog md:grid md:grid-cols-2 md:gap-x-8 xl:grid-cols-3">
        {NOTES.map(({ term, detail }) => (
          <div key={term} className="mb-3 max-w-130">
            <dt className="font-extrabold text-dark">{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>

      <Caveats entries={entries} reach={reach} />
    </section>
  );
}
