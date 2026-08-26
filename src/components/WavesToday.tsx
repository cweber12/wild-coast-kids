/**
 * The newest wave observation, and the water temperature that comes with it.
 *
 * Presentational and pure, like the tide panel beside it.
 *
 * **One fetch, two readings.** Every delivering buoy in this corridor publishes
 * wave height, period, direction and water temperature in the same row, so the
 * surfer's number and the swimmer's number arrive together.
 *
 * **Height is described, not just stated.** "2.6 ft" tells a surfer what they
 * need and tells a parent of an eight-year-old very little, so the figure is
 * given a plain-language companion. The bands are this site's own wording for
 * published measurements, not a judgement about whether anyone should go in.
 *
 * **A buoy is offshore, and says so — once, for the page.** These are open-water
 * measurements taken some distance out, not the height of the wave breaking at
 * the shore, and no shoaling transform is applied. That explanation is the same
 * on every beach, so it lives in `ConditionsNotes` rather than being repeated
 * under each reading. What stays here is what differs per beach: which buoy, and
 * how far away it is when that is far enough to matter.
 *
 * **Two sources on one card, and that is ADR-0016 rather than a layout choice.**
 * The measurement above answers what the water is doing at the buoy this
 * minute; the block beneath it answers when today's biggest swell reaches this
 * shore, from a model at 10 m depth a few hundred metres out. They disagree,
 * routinely and by a lot — at La Jolla Shores on 2026-08-26 the buoy read 0.6 m
 * at 13 s within the hour the model's forecast said 0.20 m at 4.8 s — because
 * Point La Jolla refracts the long southern swell away from this shore, which is
 * the sheltering MOP exists to compute.
 *
 * So the arrangement is the air panel's, and for the same reason: **two groups,
 * each followed by its own attribution, and one `StatGroup` never spanning
 * both.** ADR-0010 turns on a reader being able to tell which source supplied
 * which number, and here the two are the same quantity in the same unit — which
 * makes the grouping load-bearing rather than tidy. The labels name the
 * distinction that matters, which is not distance but kind: measured now
 * against forecast today.
 *
 * **The forecast never becomes the lead figure.** When the buoy is quiet the
 * card leads with nothing rather than promoting the model into the slot a
 * measurement had, which is the one thing ADR-0016 refuses outright.
 */

import type { WavesView } from "@/lib/conditions";
import { CARD_PROSE } from "./cardText";
import { DISCLOSURE_TARGET } from "./disclosure";
import {
  MOP_MODEL_NOTE,
  MOP_NETWORK,
  mopLineDistanceKm,
  mopLineSource,
} from "./mopLine";
import { ProvenanceLine } from "./ProvenanceLine";
import { ReadingCard } from "./ReadingCard";
import { StatGroup } from "./StatGroup";

/**
 * Today's biggest forecast swell, already selected by the caller.
 *
 * Which day of the week a now-card shows is presentation, so `WavePanel` picks
 * it and this renders it. Null when there is none to show — no line bound, CDIP
 * quiet, or a forecast that no longer reaches today — and all three render the
 * same way here, because the week grid below says which it was in words.
 */
export type WaveForecastPeak = {
  /** Which MOP line answered, and how far away it stands. */
  line: { id: string; distanceM: number | null };
  /** Pacific wall-clock time of the day's biggest estimate, already worded. */
  timeLabel: string;
  heightFt: number;
  periodS: number;
};

/** Past this, the buoy is far enough away that the reader is owed the number. */
const DISTANT_BUOY_M = 10_000;

/**
 * Plain words for a published height. Deliberately descriptive rather than
 * advisory: this site relays measurements and does not decide whether the water
 * is suitable for anybody.
 */
function heightWords(feet: number): string {
  if (feet < 1) return "close to flat";
  if (feet < 2) return "about knee to thigh high";
  if (feet < 3) return "about waist high";
  if (feet < 5) return "overhead for a child";
  return "large";
}

export function WavesToday({
  beachName,
  buoy,
  state,
  peak = null,
}: WavesView & { peak?: WaveForecastPeak | null }) {
  const distanceM = buoy?.distanceM ?? null;
  const distantKm =
    distanceM !== null && distanceM > DISTANT_BUOY_M
      ? (distanceM / 1000).toFixed(0)
      : null;

  return (
    <ReadingCard
      emoji="🏄"
      headingId="waves-today-heading"
      title="Waves and water"
      context={beachName}
      figure={
        state.kind === "reading" ? `${state.heightFt.toFixed(1)} ft` : null
      }
    >
      {state.kind === "reading" && (
        <>
          <p className={`leading-relaxed mb-3 text-base ${CARD_PROSE}`}>
            {heightWords(state.heightFt)}.
          </p>
          {/*
            Period and water temperature were clauses in the sentence above.
            They are measurements, and a reader scanning for the water
            temperature should not have to read a sentence to find it. The
            plain-language line stays, because it is the half of this card
            written for a parent rather than for a surfer.

            A null is rendered as an absence rather than dropped: a buoy that
            publishes waves and no water temperature is a measured fact about
            that buoy, and an omitted row would read as an oversight.
          */}
          <StatGroup
            stats={[
              {
                label: "Period",
                value: state.periodS !== null ? `${state.periodS} s` : null,
              },
              {
                label: "Water",
                value:
                  state.waterTempF !== null
                    ? `${Math.round(state.waterTempF)}°F`
                    : null,
              },
            ]}
          />
        </>
      )}

      {state.kind === "no-buoy" && (
        <>
          <p className={`leading-relaxed mb-4 text-base ${CARD_PROSE}`}>
            We cannot give a wave height here, and that is what we expect rather
            than a fault. Every wave buoy sits out on the open coast.
          </p>
          <details className={`mb-4 text-sm ${CARD_PROSE}`}>
            <summary className={DISCLOSURE_TARGET}>Why not</summary>
            <p className="mt-2">{state.reason}</p>
          </details>
        </>
      )}

      {state.kind === "unavailable" && (
        <>
          <p className={`leading-relaxed mb-4 text-base ${CARD_PROSE}`}>
            We could not get a wave reading from the buoy just now. Try again
            shortly.
          </p>
          <details className={`mb-4 text-sm ${CARD_PROSE}`}>
            <summary className={DISCLOSURE_TARGET}>What went wrong</summary>
            <p className="mt-2">{state.detail}</p>
            {state.drift && (
              <p className="mt-2">
                NDBC&apos;s payload was not the shape this site pins, which is a
                bug here rather than a problem at the buoy.
              </p>
            )}
          </details>
        </>
      )}

      {/*
        Labelled now that a second source sits beneath it. "Measured now"
        against "Forecast today" names the distinction a reader has to make,
        which is not which is nearer but which is an instrument and which is a
        model. Unlabelled, the two lines read as one attribution split in half.
      */}
      {buoy !== null && (
        <ProvenanceLine
          label="Measured now"
          source={`Buoy ${buoy.name}`}
          network="NDBC"
          distanceKm={distantKm}
        />
      )}

      {/*
        Its own group and its own attribution. One StatGroup never spans two
        sources -- see that component's docstring and ADR-0010 -- and here the
        two groups carry the same quantity in the same unit, so the rule is
        doing more work than it does on the air card.

        `mt-4` matches the gap the air card puts between its two groups, so a
        page carrying two double-source cards separates them the same way twice.

        Measured at 1536x639: this block adds 82px to the card's content, and
        the band grows 18px. The other 64px was already there -- the air card
        carries two groups and two attributions and was the tallest of the
        three, so `items-stretch` was holding that height open for a card that
        was not using it.
      */}
      {peak !== null && (
        <div className="mt-4">
          <StatGroup
            stats={[
              { label: "Biggest at", value: peak.timeLabel },
              { label: "Height", value: `${peak.heightFt.toFixed(1)} ft` },
              { label: "Period", value: `${Math.round(peak.periodS)} s` },
            ]}
          />
          <ProvenanceLine
            label="Forecast today"
            source={mopLineSource(peak.line.id)}
            network={MOP_NETWORK}
            distanceKm={mopLineDistanceKm(peak.line.distanceM)}
            note={MOP_MODEL_NOTE}
          />
        </div>
      )}
    </ReadingCard>
  );
}
