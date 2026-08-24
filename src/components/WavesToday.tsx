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
 */

import type { WavesView } from "@/lib/conditions";
import { ProvenanceLine } from "./ProvenanceLine";
import { ReadingCard } from "./ReadingCard";
import { StatGroup } from "./StatGroup";

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

export function WavesToday({ beachName, buoy, state }: WavesView) {
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
          <p className="leading-relaxed mb-3 text-base text-fog">
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
          <p className="leading-relaxed mb-4 text-base text-fog">
            We cannot give a wave height here, and that is what we expect rather
            than a fault. Every wave buoy sits out on the open coast.
          </p>
          <details className="mb-4 text-sm text-fog">
            <summary>Why not</summary>
            <p className="mt-2">{state.reason}</p>
          </details>
        </>
      )}

      {state.kind === "unavailable" && (
        <>
          <p className="leading-relaxed mb-4 text-base text-fog">
            We could not get a wave reading from the buoy just now. Try again
            shortly.
          </p>
          <details className="mb-4 text-sm text-fog">
            <summary>What went wrong</summary>
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

      {buoy !== null && (
        <ProvenanceLine
          source={`Buoy ${buoy.name}`}
          network="NDBC"
          distance={
            distantKm !== null ? `about ${distantKm} km from this beach` : null
          }
        />
      )}
    </ReadingCard>
  );
}
