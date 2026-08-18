/**
 * Today's lowest tide, for one beach.
 *
 * Presentational and pure: it takes a state and renders it, so every branch is
 * assertable without a network. The panel next door does the fetching.
 *
 * Three decisions in the markup are deliberate.
 *
 * **Timing first, height second.** A parent plans around when to leave the
 * house. The height is what distinguishes a good tidepooling day from an
 * ordinary one, so it stays -- but it is not the number that leads.
 *
 * **The datum is explained once, in words.** A tide of -0.4 ft reads as an error
 * to anyone who has not met mean lower low water, and it is the single most
 * useful figure on the page for a tidepooler. So the sign is explained where it
 * appears and the acronym is named once, at the bottom, rather than beside every
 * figure.
 *
 * **An absent reading is a sentence, not a blank.** A missing number renders as
 * an explanation a reader can act on, with the upstream detail behind a
 * disclosure. A blank or a zero would read as a calm, flat sea.
 */

import type { TideTodayView } from "@/lib/conditions";

export type TideTodayProps = TideTodayView;

function heightSentence(feet: number): string {
  const magnitude = Math.abs(feet).toFixed(1);
  return feet < 0
    ? `${feet.toFixed(1)} ft — the water drops below the average low, so more of the sand and reef is uncovered.`
    : `${magnitude} ft above the average low tide.`;
}

export function TideToday({
  beachName,
  stationName,
  stationRole,
  state,
}: TideTodayProps) {
  return (
    <section aria-labelledby="tide-today-heading" className="max-w-130">
      <h2
        id="tide-today-heading"
        className="text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase"
      >
        Lowest tide today · {beachName}
      </h2>

      {state.kind === "reading" && (
        <>
          <p className="leading-tight mb-2 text-4xl font-black italic">
            {state.timeLabel}
          </p>
          <p className="leading-relaxed mb-4 text-base text-fog">
            {heightSentence(state.feet)}
          </p>
        </>
      )}

      {state.kind === "no-low-today" && (
        <p className="leading-relaxed mb-4 text-base text-fog">
          No low tide falls on today&apos;s date in the range we asked NOAA for.
          That is a gap in our request rather than a calm sea — the tide still
          goes out.
        </p>
      )}

      {state.kind === "unavailable" && (
        <>
          <p className="leading-relaxed mb-4 text-base text-fog">
            We could not get today&apos;s tide prediction from NOAA just now.
            Nothing is wrong with the beach — try again shortly, or check a
            printed tide table.
          </p>
          <details className="mb-4 text-sm text-fog">
            <summary>What went wrong</summary>
            <p className="mt-2">{state.detail}</p>
            {state.drift && (
              <p className="mt-2">
                NOAA&apos;s payload was not the shape this site pins, which is a
                bug here rather than a problem at the station.
              </p>
            )}
          </details>
        </>
      )}

      <p className="text-2xs leading-relaxed text-fog">
        Predicted for {stationName} ({stationRole}), NOAA Tides &amp; Currents.
        Heights are feet above mean lower low water, the average of the lower
        low tide each day. Predictions are astronomy, not a measurement of the
        water on the day, and they are not a safety assessment.
      </p>
    </section>
  );
}
