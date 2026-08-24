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
 * **Not the standing safety notice.** `docs/plans/conditions-tool.md` reserves a
 * prominent notice *above* the readings — instruments rather than judgement,
 * lifeguards and posted signs the authority on the day — for its own slice. This
 * block collects the qualifications that already existed in the page and adds
 * none, so that slice still has something to do.
 */

import type { InventoryReach } from "@/lib/beaches";
import { Caveats } from "./Caveats";

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
    term: "Wave heights",
    detail:
      "The height of the swell in open water, measured at a buoy some distance offshore. " +
      "That is not the height of the wave breaking at the shore, and nothing here " +
      "transforms one into the other.",
  },
  {
    term: "Sky and visibility",
    detail:
      "Where they are shown, they come from an airport. Cloud and visibility are only " +
      "published by airports in this county, so that reading is taken further from the " +
      "water than the temperature beside it — and coastal fog is exactly what changes " +
      "across that distance.",
  },
  {
    term: "None of it is a safety assessment",
    detail:
      "These are readings relayed from public instruments, each shown with the station " +
      "that supplied it and how far away that station is.",
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
      <h2
        id="conditions-notes-heading"
        className="text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase"
      >
        How to read these numbers
      </h2>

      {/*
        A description list rather than paragraphs: each entry is a topic and its
        explanation, and the pairing is what a reader is scanning for. It also
        survives for someone who cannot see the bolding.
      */}
      <dl className="leading-relaxed max-w-130 text-sm text-fog">
        {NOTES.map(({ term, detail }) => (
          <div key={term} className="mb-3">
            <dt className="font-extrabold text-dark">{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>

      <Caveats entries={entries} reach={reach} />
    </section>
  );
}
