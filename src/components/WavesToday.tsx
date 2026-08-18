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
 * **A buoy is offshore, and says so.** These are open-water measurements taken
 * some distance out, not the height of the wave breaking at the shore, and no
 * shoaling transform is applied. Where the buoy is far away the distance is
 * given, for the same reason the tide panel gives it.
 */

import type { WavesView } from "@/lib/conditions";

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
    <section aria-labelledby="waves-today-heading" className="mt-9 max-w-130">
      <h2
        id="waves-today-heading"
        className="text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase"
      >
        Waves and water · {beachName}
      </h2>

      {state.kind === "reading" && (
        <>
          <p className="leading-tight mb-2 text-4xl font-black italic">
            {state.heightFt.toFixed(1)} ft
          </p>
          <p className="leading-relaxed mb-4 text-base text-fog">
            {heightWords(state.heightFt)}
            {state.periodS !== null ? `, ${state.periodS} seconds apart` : ""}.
            {state.waterTempF !== null
              ? ` The water is ${Math.round(state.waterTempF)}°F.`
              : " The buoy reported no water temperature."}
          </p>
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
        <p className="text-2xs leading-relaxed text-fog">
          Measured at NDBC buoy {buoy.name}
          {distantKm !== null ? `, about ${distantKm} km from this beach` : ""}.
          That is the height of the swell in open water, not the height of the
          wave breaking at the shore, and it is not a safety assessment.
        </p>
      )}
    </section>
  );
}
