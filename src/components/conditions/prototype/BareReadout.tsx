/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * The measured readings with no background and no border.
 *
 * `MeasuredBand` cannot be reused here: its whole presentation is a dark
 * `rounded-card` slab with white text, and light-on-dark type does not simply
 * become dark-on-light — the muted registers it uses (`CARD_MUTED`,
 * `CARD_PROSE`) are tuned for that ground. So this repeats `MeasuredPanel`'s
 * three reads and re-typesets `bandView`'s output on the page's own ground.
 *
 * **The figures stay at `text-base` extrabold**, which is what the band
 * already uses and what the rest of the site uses for a figure. What makes
 * this read as an instrument readout rather than a slab is not bigger type —
 * it is the micro-label naming each source, the rule between them, and the
 * provenance dropping to `text-2xs` on a line of its own.
 *
 * **The labels come from `bandView`'s documented order** — "Waves first when
 * measured, then air", and air always speaks — never from parsing the figure
 * strings. A label guessed from `"3.0 ft · 72°F water"` would be a fabrication
 * with a plausible shape.
 *
 * **Both shapes put the provenance on its own line**, which is what keeps the
 * inline shape usable in a single-row bar: the first draft ran the clock and
 * the attribution in the same flex row as the figures, and at 1440px the bar
 * could not hold wordmark, two selects, readings, provenance and judgement, so
 * it silently wrapped into a second row and lost the thing it was testing.
 *
 * The sky glyph stays. It is not decoration: ADR-0057 makes the mark on the
 * air segment the sky forecast for this hour, credited as one on the
 * attribution line. Dropping it would remove a product, not a flourish.
 */

import { readLatestAir, readLatestWaves, readSkyNow } from "@/lib/conditions";
import { type AreaScope, withheldBy } from "../areaScope";
import { bandView } from "../bandText";
import { NowClock } from "../NowClock";
import { localTimeOf } from "@/lib/pacific-time";

/** Whether the sources sit on one line or as labelled columns. */
export type ReadoutShape = "inline" | "columns";

export async function BareReadout({
  slug,
  area,
  shape,
}: {
  slug: string;
  area?: AreaScope;
  shape: ReadoutShape;
}) {
  const withheldWaves = withheldBy(area, "waves");
  const withheldAir = withheldBy(area, "air");

  const [waves, air, sky] = await Promise.all([
    withheldWaves ? null : readLatestWaves(slug),
    withheldAir ? null : readLatestAir(slug),
    readSkyNow(slug),
  ]);

  const labelled = <V extends { beachName: string }>(view: V): V =>
    area ? { ...view, beachName: area.name } : view;

  const { segments, observedAtMs, attribution } = bandView({
    waves: withheldWaves ?? labelled(waves!),
    air: withheldAir ?? labelled(air!),
    sky,
  });

  // Two segments means the sea answered and is first; one means air alone,
  // which is the case on fifteen of the eighteen areas.
  const labelAt = (index: number) =>
    segments.length === 2 && index === 0 ? "Sea" : "Air";

  const label = (index: number) => (
    <span className="text-2xs font-extrabold tracking-widest text-ocean uppercase">
      {labelAt(index)}
    </span>
  );

  const figures = (segment: (typeof segments)[number]) => (
    <>
      <span aria-hidden="true" className="text-base leading-none">
        {segment.emoji}
      </span>
      <span className="text-base font-extrabold text-dark">{segment.text}</span>
      {segment.gloss !== null && (
        <span className="leading-relaxed text-base text-fog">
          {segment.gloss}
        </span>
      )}
    </>
  );

  return (
    <section aria-label="Measured now">
      {shape === "inline" ? (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {segments.map((segment, index) => (
            <p
              key={segment.emoji}
              className={`flex flex-wrap items-baseline gap-x-2 ${
                // A rule instead of a box: it separates without enclosing,
                // which is the whole point of taking the slab off.
                index > 0 ? "border-l border-lavender pl-5" : ""
              }`}
            >
              {label(index)}
              {figures(segment)}
            </p>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
          {segments.map((segment, index) => (
            <div
              key={segment.emoji}
              className={
                index > 0 ? "border-l border-lavender pl-6" : undefined
              }
            >
              <p className="mb-1">{label(index)}</p>
              <p className="flex flex-wrap items-baseline gap-x-2">
                {figures(segment)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/*
        Provenance, in the quietest register the page has. Same two questions
        `MeasuredBand` separates — when it was taken, and what took it — and
        the same bound wording, because up to three rows sit behind these
        figures and "nothing older than" is the only claim true of all of them
        (ADR-0054).
      */}
      <p className="text-2xs leading-relaxed mt-2 text-fog">
        <NowClock trailing={observedAtMs !== null} />
        {observedAtMs !== null && (
          <span>nothing older than {localTimeOf(observedAtMs)}</span>
        )}
        {attribution !== null && <span className="block">{attribution}</span>}
      </p>
    </section>
  );
}
