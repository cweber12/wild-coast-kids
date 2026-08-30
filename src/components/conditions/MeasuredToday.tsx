/**
 * What was actually measured at this beach, inside the day it belongs to.
 *
 * Presentational and pure, like the three cards it absorbs: it takes two view
 * models and renders them, so every branch is assertable without a network.
 * `MeasuredPanel` next door does the fetching.
 *
 * **This is the whole of what the page measures.** Everything else on
 * `/conditions` is a prediction or a model -- NOAA's harmonic tide, CDIP's
 * swell, the National Weather Service's grid cell. The buoy and the air station
 * are the only instruments this site reports at all, which is why they move
 * into the day rather than being deleted with the slab they sat in.
 *
 * **Today only, and the other six days say so rather than rendering nothing.**
 * A blank where a measurement goes is the failure this whole page is built to
 * avoid, and it is worse here than anywhere: an empty region under a chart full
 * of curves reads as a load that did not finish. The sentence names the day,
 * because the region is any of seven now -- `DayPanel`'s `WORDS` object takes
 * the same `when` for the same reason.
 *
 * **Two cards, not one, and that is ADR-0010 rather than a layout preference.**
 * The buoy and the air station are two provenances, which that decision permits
 * behind one *panel* and refuses behind one *sentence*. Each card carries a
 * plain-words line -- "about waist high", "Warm, with a gentle breeze" -- and
 * merging them would produce exactly the sentence ADR-0010 forbids. Once each
 * source keeps its own sentence it also needs its own lead figure, and
 * `ReadingCard` has one slot for one.
 *
 * **The cards stay `bg-dark` and their colours do not move.** `CARD_PROSE` and
 * `CARD_MUTED` are measured against that surface and against nothing else --
 * white at 55% painted on the page's cream ground is 1.03:1, which is the bug
 * #175's last commit fixed in three places. Keeping the card keeps those
 * figures true, and it makes the distinction brief principle 2 asks for
 * legible before a word is read: a dark block of stated figures beside a light
 * drawn curve.
 *
 * **What did not come with them.** The tide card is gone: its lowest daylight
 * low prints in the week grid's today column, and a predicted extreme in a
 * block titled for measurement would say the opposite of what the block is
 * for. The wave card's MOP forecast block is gone for the same reason -- the
 * chart above draws that whole model, hour by hour, on its own tab. Both of
 * those figures are still on the page; neither is a measurement.
 */

import type { AirView, WavesView } from "@/lib/conditions";
import { compassWords } from "./bearing";
import { CARD_PROSE, PAGE_MUTED } from "./cardText";
import { DISCLOSURE_TARGET } from "./disclosure";
import { ProvenanceLine } from "./ProvenanceLine";
import { ReadingCard } from "./ReadingCard";
import { type Stat, StatGroup } from "./StatGroup";

/** The two reads this block renders, as `MeasuredPanel` hands them over. */
export type MeasuredReadings = {
  waves: WavesView;
  air: AirView;
};

export type MeasuredTodayProps = {
  /**
   * How this day is named inside a sentence: "today", or the grid's own label
   * for one of the other six. Only the absence sentence uses it, because only
   * the other six days have one.
   */
  when: string;
  /** The measurements, or `null` on a day nobody has taken a reading of. */
  readings: MeasuredReadings | null;
};

/* =========================================================================
 * The sea: the buoy's newest observation
 * ========================================================================= */

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

/**
 * The newest wave observation, and the water temperature that comes with it.
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
 * **The `no-buoy` disclosure is a condition of ADR-0019 and it got stronger
 * here rather than weaker.** That decision admits ten beaches whose only wave
 * source is a model, and it says in its own text that if the disclosure "is
 * ever removed or weakened, this decision goes with it". On the card this
 * sentence pointed at the forecast block beneath it and had a second form for
 * when CDIP had not answered. There is no block beneath it now — the model is
 * the chart above and the week above that — so the sentence names where the
 * modelled heights are instead, unconditionally. It can no longer be wrong
 * about whether a forecast arrived, because it no longer asks.
 *
 * **`Measured now` stays on the provenance line, against a different second
 * thing.** ADR-0016 put that label there to separate the buoy from the MOP
 * block below it. The block has gone one region up and become a curve, so the
 * label now separates this figure from the chart rather than from a sibling
 * group — which is the same distinction, drawn between the same two kinds of
 * claim, at the distance the page now puts them.
 */
function SeaCard({ beachName, buoy, state }: WavesView) {
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
          {/*
            Two beaches reach this branch for opposite reasons, and one sentence
            cannot serve both. At a bay there is no wave figure and there never
            will be. At the ten beaches ADR-0019 admits, the coast is open, the
            swell is real, and what is missing is the instrument -- so telling
            that reader "every wave buoy sits out on the open coast" would state
            the reason their beach is fine as the reason it is not.

            The second sentence is the disclosure ADR-0019 was accepted on. It
            leads rather than sitting in the attribution below, because the card
            has no measured figure at all here and a reader who stops at the
            plain-words line must still learn that nothing on it was measured.
          */}
          <p className={`leading-relaxed mb-4 text-base ${CARD_PROSE}`}>
            {state.modelAnswersInstead ? (
              <>
                No wave buoy reaches this stretch of coast, so nothing here is
                measured. Every wave height this page shows for this beach — on
                the chart above and in the week above that — comes from a model
                of the swell, not from an instrument in the water.
              </>
            ) : (
              <>
                We cannot give a wave height here, and that is what we expect
                rather than a fault. Every wave buoy sits out on the open coast.
              </>
            )}
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

      {buoy !== null && (
        <ProvenanceLine
          label="Measured now"
          source={`Buoy ${buoy.name}`}
          network="NDBC"
          distanceKm={distantKm}
        />
      )}
    </ReadingCard>
  );
}

/* =========================================================================
 * The air: the shore station's newest observation
 * ========================================================================= */

/**
 * Under a knot the wind is calm. Named once because two readers disagree
 * otherwise: `windStats` prints "Calm" and suppresses the gust here, and
 * `windWords` says "no wind" -- a card that said "no wind" above "Gusting
 * 2 mph" would be contradicting itself, which is the bug the gust rule was
 * written to stop.
 */
const CALM_MPH = 1;

/**
 * How far the station is, in kilometres, rounded.
 *
 * A decimal under ten kilometres because that is the range this binding lives
 * in -- the air station runs 0.7 km to 7.4 km across the inventory -- and
 * rounding 1.4 km to "1 km" throws away most of what the figure says.
 *
 * The number only. `ProvenanceLine` owns the unit and the reference point; the
 * rounding stays here, where the reason for it is.
 */
function roundedKm(metres: number): string {
  const km = metres / 1000;
  return km < 10 ? km.toFixed(1) : km.toFixed(0);
}

/**
 * The wind, as figures from the shore station.
 *
 * `null` and *absent* mean different things here, and the difference is
 * deliberate. A null wind speed is a measured absence — the station carries the
 * field and published nothing — so it renders "Not reported". A gust is omitted
 * entirely when there is none, because most stations most of the time are not
 * gusting and a standing "Not reported" would turn ordinary weather into a
 * column of missing data.
 *
 * **A calm wind reports no gust.** Rendering both produced "Wind: Calm /
 * Gusting: 2 mph" on the live page, a card contradicting itself. Under a knot
 * of wind, a gust figure is noise from the instrument rather than weather
 * anybody feels.
 */
function windStats(air: Extract<AirView["air"], { kind: "reading" }>): Stat[] {
  const calm = air.windMph !== null && air.windMph < CALM_MPH;

  const speed =
    air.windMph === null
      ? null
      : calm
        ? "Calm"
        : `${Math.round(air.windMph)} mph` +
          (air.windDirDegT !== null
            ? ` from the ${compassWords(air.windDirDegT)}`
            : "");

  const stats: Stat[] = [{ label: "Wind", value: speed }];
  if (air.gustMph !== null && !calm && air.windMph !== null) {
    stats.push({ label: "Gusting", value: `${Math.round(air.gustMph)} mph` });
  }
  return stats;
}

/** The primary slot never renders empty: an empty one reads as a fault. */
function temperatureWords(air: AirView["air"]): string {
  if (air.kind === "no-station") return "No station near enough";
  if (air.kind === "unavailable") return "No temperature just now";
  return air.airTempF === null
    ? "No temperature reading"
    : `${Math.round(air.airTempF)}°F`;
}

/**
 * The air temperature in plain words.
 *
 * Descriptive rather than advisory, for the reason `heightWords` gives about
 * its own bands: this site relays measurements and does not decide whether
 * anybody should go. "Warm" restates 76 °F; "a good day for it" would be a
 * verdict, and ADR-0009 forbids the site from making one.
 *
 * The bands are this site's own wording for a published figure. Nothing
 * upstream publishes them and they are not a standard.
 */
function warmthWord(fahrenheit: number): string {
  if (fahrenheit < 52) return "Cold";
  if (fahrenheit < 60) return "Chilly";
  if (fahrenheit < 68) return "Cool";
  if (fahrenheit < 75) return "Mild";
  if (fahrenheit < 84) return "Warm";
  return "Hot";
}

/**
 * The wind in plain words, in the Beaufort scale's register.
 *
 * Miles per hour is the figure on this card that most needs translating: a
 * parent reads 76 °F without help and reads 11 mph without knowing whether
 * that is windy.
 *
 * `CALM_MPH` rather than a second threshold, so this and `windStats` cannot
 * come to different conclusions about the same reading.
 */
function windWords(mph: number): string {
  if (mph < CALM_MPH) return "no wind";
  if (mph < 4) return "barely any wind";
  if (mph < 8) return "a light breeze";
  if (mph < 13) return "a gentle breeze";
  if (mph < 19) return "a moderate breeze";
  if (mph < 25) return "a fresh breeze";
  if (mph < 32) return "a strong breeze";
  return "a hard wind";
}

/**
 * What this card's figures mean, in one line.
 *
 * Temperature leads because it is this card's figure; the wind follows as a
 * clause. Either half alone still makes a sentence, because the field each
 * station publishes can be absent on its own.
 *
 * `null` rather than an empty line when neither arrived. `ReadingCard` refuses
 * to render an empty primary because "an empty one reads as a fault", and a
 * blank sentence is the same mistake one row down.
 */
function plainWords(
  air: Extract<AirView["air"], { kind: "reading" }>,
): string | null {
  const warmth = air.airTempF === null ? null : warmthWord(air.airTempF);
  const wind = air.windMph === null ? null : windWords(air.windMph);

  if (warmth !== null && wind !== null) return `${warmth}, with ${wind}.`;
  if (warmth !== null) return `${warmth}.`;
  if (wind === null) return null;
  return `${wind[0].toUpperCase()}${wind.slice(1)}.`;
}

/**
 * Air temperature and wind, from the station that measures them at the shore.
 *
 * **Temperature leads.** Visibility held the primary slot once and was the
 * worst of the figures for it: METAR stops at ten statute miles and San Diego
 * sits at that ceiling most of the time, so the largest text on the panel
 * usually rendered a constant. The temperature is what a parent deciding what
 * to bring actually reads.
 *
 * **SKY AND VISIBILITY ARE GONE FROM THIS CARD, and they are not coming back
 * here.** They came from the nearest station publishing them, which in this
 * county is always an airport, at a median of 7.9 km. Cloud reaches the reader
 * in the week grid and in the chart's own band instead, as a forecast for this
 * beach's own grid cell, labelled a forecast. See ADR-0020.
 *
 * **ADR-0010 IS NOT REVERSED BY THAT.** Its argument was that requiring one
 * station for all four values let the scarcest of them decide where the
 * temperature was measured, which bound La Jolla Shores to Miramar ten
 * kilometres inland where the air read 81 °F against the pier's 72 °F. Removing
 * the sky binding keeps that property rather than undoing it.
 *
 * **The station names arrive ready to print.** `display_name` is hand-written
 * in the station table, so nothing here tries to turn a callsign into prose.
 * This component briefly did, and it could not reach the two stations that most
 * needed it — "Tidal Linkage" is not something a mechanical rule turns into a
 * place, and "9410230" is a tide station number rather than any part of
 * "Scripps Pier". See #87.
 */
function AirCard({ beachName, airStation, air }: AirView) {
  const words = air.kind === "reading" ? plainWords(air) : null;

  return (
    <ReadingCard
      emoji="💨"
      headingId="wind-today-heading"
      title="Air"
      context={beachName}
      figure={temperatureWords(air)}
    >
      {/*
        The plain-words line every card on this page is specified to carry. A
        restatement, never advice: ADR-0009 forbids this site a verdict, so a
        Beaufort-style "a light breeze" is available and "a good day for it" is
        not.
      */}
      {words !== null && (
        <p className={`leading-relaxed mb-3 text-base ${CARD_PROSE}`}>
          {words}
        </p>
      )}

      {air.kind === "reading" && <StatGroup stats={windStats(air)} />}

      {airStation !== null && (
        <ProvenanceLine
          label="Temperature and wind"
          source={airStation.name}
          distanceKm={
            airStation.distanceM !== null
              ? roundedKm(airStation.distanceM)
              : null
          }
        />
      )}

      {air.kind === "no-station" && (
        <details className={`mb-4 text-sm ${CARD_PROSE}`}>
          <summary className={DISCLOSURE_TARGET}>
            Why there is no temperature or wind
          </summary>
          <p className="mt-2">{air.reason}</p>
        </details>
      )}

      {air.kind === "unavailable" && (
        <details className={`mb-4 text-sm ${CARD_PROSE}`}>
          <summary className={DISCLOSURE_TARGET}>
            Why there is no temperature or wind
          </summary>
          <p className="mt-2">{air.detail}</p>
          {air.drift && (
            <p className="mt-2">
              The station&apos;s payload was not the shape this site pins, which
              is a bug here rather than a problem at the station.
            </p>
          )}
        </details>
      )}
    </ReadingCard>
  );
}

/* =========================================================================
 * The block
 * ========================================================================= */

export function MeasuredToday({ when, readings }: MeasuredTodayProps) {
  if (readings === null) {
    return (
      /*
        `PAGE_MUTED`, not the card's colour: this sentence renders straight onto
        the page ground, where `CARD_MUTED` paints 1.03:1 and says nothing at
        all. An absence nobody can see is worse than no absence sentence, and
        this is the one the reader meets on six days of seven.
      */
      <p className={`leading-relaxed text-base ${PAGE_MUTED}`}>
        Nothing has been measured for {when}: the day has not happened. The buoy
        and the air station only ever answer for now, so everything above is a
        prediction or a model.
      </p>
    );
  }

  /*
    Two across from `sm`, which is where the three-card band above the page
    used to go two across as well. `items-stretch` so a quiet buoy beside a
    full air reading leaves one surface rather than two ragged ones -- the
    same reason `ReadingCard` is `h-full flex-col`.
  */
  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2">
      <SeaCard {...readings.waves} />
      <AirCard {...readings.air} />
    </div>
  );
}
