/**
 * Today's lowest tide, for one beach.
 *
 * Presentational and pure: it takes a state and renders it, so every branch is
 * assertable without a network. The panel next door does the fetching.
 *
 * Four decisions in the markup are deliberate.
 *
 * **Timing first, height second.** A parent plans around when to leave the
 * house. The height is what distinguishes a good tidepooling day from an
 * ordinary one, so it stays -- but it is not the number that leads.
 *
 * **The daylight low leads, and the day's lowest sits beside it.** This card
 * used to answer "how low does it get today", which on this coast in summer is
 * a figure from before sunrise on most days. It now answers "how low does it
 * get while the sun is up", and keeps the other as a supporting figure rather
 * than dropping it -- a tidepooler willing to set an alarm still wants to know
 * a -0.2 ft exists at 3:14 AM.
 *
 * **Both figures are one group and one attribution**, unlike the wave card
 * beside it. `StatGroup`'s rule is that a group is one provenance, and these
 * two lows come from one station and one request -- the same run of predicted
 * extremes, read twice with different windows. Splitting them would imply a
 * second source that does not exist.
 *
 * **The datum is explained once, in words.** A tide of -0.4 ft reads as an error
 * to anyone who has not met mean lower low water, and it is the single most
 * useful figure on the page for a tidepooler. So the sign is explained where it
 * appears — `heightSentence` still says what a negative number means — and the
 * acronym is named once rather than beside every figure. That naming now lives
 * in `ConditionsNotes`, one block for the whole page, because this panel was
 * making the argument and then two panels beside it repeated their own version
 * of it. What stays here is the attribution: which station, and how far.
 *
 * **An absent reading is a sentence, not a blank.** A missing number renders as
 * an explanation a reader can act on, with the upstream detail behind a
 * disclosure. A blank or a zero would read as a calm, flat sea. The four states
 * stay distinct, and the two that look alike are the ones most worth separating:
 * no station will ever exist for this beach, against a station that could not be
 * reached just now.
 *
 * **A distant station says so.** NOAA publishes no delivering tide station on the
 * open coast between La Jolla and Imperial Beach, so some beaches read one tens
 * of kilometres away. That is disclosed where the number is given rather than
 * buried, because it is the difference between a prediction for this shore and
 * the nearest one anybody publishes.
 */

import type { TideTodayView } from "@/lib/conditions";
import { CARD_PROSE } from "./cardText";
import { DISCLOSURE_TARGET } from "./disclosure";
import { ProvenanceLine } from "./ProvenanceLine";
import { ReadingCard } from "./ReadingCard";
import { StatGroup } from "./StatGroup";

export type TideTodayProps = TideTodayView;

/** Past this, the station is far enough away that the reader is owed the number. */
const DISTANT_STATION_M = 5000;

/**
 * What the height means, without restating the height.
 *
 * The number moved to a figure of its own beside this sentence — it is the
 * measurement a tidepooler reads most closely and it was the last one on the
 * page still dissolved in prose. What stays here is the part a number cannot
 * carry: that a minus sign is a lower tide rather than an error, which this
 * panel has always held to be the single most useful thing it says.
 */
function heightSentence(feet: number): string {
  return feet < 0
    ? "Below the average low tide — more of the sand and reef is uncovered than usual."
    : "Above the average low tide.";
}

export function TideToday({ beachName, station, state }: TideTodayProps) {
  const distanceM = station?.distanceM ?? null;
  const distantKm =
    distanceM !== null && distanceM > DISTANT_STATION_M
      ? (distanceM / 1000).toFixed(0)
      : null;

  return (
    <ReadingCard
      emoji="🐚"
      headingId="tide-today-heading"
      title="Lowest daylight tide"
      context={beachName}
      figure={
        state.kind === "reading" ? (state.daylight?.timeLabel ?? null) : null
      }
    >
      {state.kind === "reading" && (
        <>
          <p className={`leading-relaxed mb-3 text-base ${CARD_PROSE}`}>
            {state.daylight === null
              ? "No low tide falls between sunrise and sunset today. The day's lowest is below."
              : heightSentence(state.daylight.feet)}
          </p>
          {/*
            The height as a figure. It was the last measurement on the page
            still dissolved in prose, and beside two cards whose supporting
            numbers are figures it read as the one that had been forgotten. It
            is also the number a tidepooler reads most closely: how much reef
            comes out of the water.

            The day's lowest joins it as a second figure rather than a second
            group, because it is the same station and the same request read
            through a different window. Its time and height are one value: what
            a reader wants is the pair, and two labels for one fact would leave
            "Lowest all day" sitting over a height with no time beside it.
          */}
          <StatGroup
            stats={[
              {
                label: "Height",
                value:
                  state.daylight === null
                    ? null
                    : `${state.daylight.feet.toFixed(1)} ft`,
              },
              {
                label: "Lowest all day",
                value:
                  state.allDay === null
                    ? "None lower"
                    : `${state.allDay.timeLabel} · ${state.allDay.feet.toFixed(1)} ft`,
              },
            ]}
          />
        </>
      )}

      {state.kind === "no-low-today" && (
        <p className={`leading-relaxed mb-4 text-base ${CARD_PROSE}`}>
          No low tide falls on today&apos;s date in the range we asked NOAA for.
          That is a gap in our request rather than a calm sea — the tide still
          goes out.
        </p>
      )}

      {state.kind === "no-station" && (
        <>
          <p className={`leading-relaxed mb-4 text-base ${CARD_PROSE}`}>
            We cannot give a tide time for this beach. No tide station could be
            matched to it, so there is nothing to predict from — the tide here
            is not different, we simply have no published figure for it.
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
            We could not get today&apos;s tide prediction from NOAA just now.
            Nothing is wrong with the beach — try again shortly, or check a
            printed tide table.
          </p>
          <details className={`mb-4 text-sm ${CARD_PROSE}`}>
            <summary className={DISCLOSURE_TARGET}>What went wrong</summary>
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

      {/*
        The network name carries a plain ampersand rather than `&amp;`: it is a
        string attribute, and JSX decodes entities in text children but not in
        those. Written as `&amp;` it would reach the reader verbatim.
      */}
      {station !== null && (
        <ProvenanceLine
          source={station.name}
          network="NOAA Tides & Currents"
          distanceKm={distantKm}
          note={
            distantKm !== null
              ? `the nearest ${station.water === "bay" ? "bay" : "open-coast"} station publishing predictions`
              : null
          }
        />
      )}
    </ReadingCard>
  );
}
