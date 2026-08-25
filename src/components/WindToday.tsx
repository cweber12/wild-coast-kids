/**
 * Air temperature, wind, sky and visibility — from the two stations that
 * measure them.
 *
 * Presentational and pure, like the two panels beside it.
 *
 * **Temperature leads.** Visibility held the primary slot and was the worst of
 * the four figures for it: METAR stops at ten statute miles and San Diego sits
 * at that ceiling most of the time, so the largest text on the panel usually
 * rendered a constant. The temperature is what a parent deciding what to bring
 * actually reads.
 *
 * **Two provenances, named separately.** Temperature and wind come from the
 * nearest station standing in the marine layer at the shoreline — often a pier
 * on the NDBC network. Sky and visibility come from the nearest station
 * publishing them, which in this county is always an airport, because cloud and
 * visibility are METAR products. Requiring one station for all four is what
 * bound La Jolla Shores to Miramar ten kilometres inland, where the air read
 * 81 °F against the pier's 72 °F. See
 * docs/adr/0010-two-provenances-in-the-air-panel.md.
 *
 * The cost of that decision is a second attribution line, and it is deliberately
 * not hidden: a reader who cannot tell which station supplied which figure is
 * worse off than one who has to read two lines. Both lines stay here for that
 * reason. What left is the explanation of *why* the sky is an airport reading,
 * which is true of every beach on the site and now sits once in
 * `ConditionsNotes` instead of under one panel out of three.
 *
 * **Both distances are always shown**, which the single-station version did not
 * do — it hid anything under five kilometres. With two stations named, showing
 * one distance and hiding the other leaves them incomparable, and comparing them
 * is exactly what tells a reader why the sky is less local than the temperature.
 *
 * **The halves fail separately.** A missing sky never blanks the temperature and
 * a missing temperature never blanks the sky, because the two are separate
 * fetches to separate networks and a reader wants whichever arrived.
 *
 * **Ten miles is a ceiling, not a measurement.** METAR stops there, so the top
 * of the range is rendered "10 miles or more". Reading it as exactly ten would
 * be a precision upstream never claimed.
 *
 * **The station names arrive ready to print.** `display_name` is hand-written in
 * the station table, so nothing here tries to turn a callsign into prose. This
 * component briefly did, by stripping identifiers and country codes, and it
 * could not reach the two stations that most needed it — "Tidal Linkage" is not
 * something a mechanical rule turns into a place, and "9410230" is a tide
 * station number rather than any part of "Scripps Pier". See #87.
 */

import type { AirView } from "@/lib/conditions";
import { DISCLOSURE_TARGET } from "./disclosure";
import { ProvenanceLine } from "./ProvenanceLine";
import { ReadingCard } from "./ReadingCard";
import { type Stat, StatGroup } from "./StatGroup";

/**
 * Under a knot the wind is calm. Named once because two readers disagree
 * otherwise: `windStats` prints "Calm" and suppresses the gust here, and
 * `windWords` says "no wind" -- a card that said "no wind" above "Gusting
 * 2 mph" would be contradicting itself, which is the bug the gust rule was
 * written to stop.
 */
const CALM_MPH = 1;

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

/**
 * Plain words for a direction in degrees true.
 *
 * METAR publishes the direction the wind blows *from*, which is why the caller
 * says "from the". Naming it as the direction it blows towards would reverse
 * every reading on the page.
 */
function compassWords(degreesTrue: number): string {
  return COMPASS[Math.round(degreesTrue / 45) % 8];
}

/** Whole miles read better than a decimal that upstream did not measure to. */
function visibilityWords(miles: number, atCeiling: boolean): string {
  if (atCeiling) return "10 miles or more";
  const rounded = miles < 1 ? miles.toFixed(1) : String(Math.round(miles));
  return `${rounded} ${rounded === "1" ? "mile" : "miles"}`;
}

/**
 * How far the station is, in kilometres, rounded.
 *
 * A decimal under ten kilometres because that is the range these two bindings
 * differ across: an air station at 1.4 km and a sky station at 10.4 km is the
 * whole point, and rounding the first to "1 km" throws away the comparison.
 *
 * The number only. This panel used to append the unit and a reference point
 * too, and it wrote two different ones twenty lines apart -- "from this beach"
 * for the air station and "away" for the sky station, which on a beach whose
 * two halves bind to the same station printed the identical fact two ways on
 * one card. `ProvenanceLine` owns that wording now; the rounding stays here,
 * where the reason for it is.
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
 * column of missing data. That matches what this panel already did: it appended
 * ", gusting N" only when there was one, and said nothing otherwise.
 *
 * **A calm wind reports no gust**, which is the other half of what the sentence
 * this replaced already did — it returned at "The wind is calm" and never
 * reached the gust clause. Rendering both produced "Wind: Calm / Gusting: 2 mph"
 * on the live page, a card contradicting itself. Under a knot of wind, a gust
 * figure is noise from the instrument rather than weather anybody feels.
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

/**
 * Sky and visibility, as figures from the airport.
 *
 * Same distinction, and the same two behaviours this panel already had: a
 * station publishing no sky simply goes unsaid, while an airport publishing no
 * visibility says so. The asymmetry is upstream's — a missing sky layer is not
 * a reading anyone attempted, and a missing visibility is.
 */
function skyStats(sky: Extract<AirView["sky"], { kind: "reading" }>): Stat[] {
  const stats: Stat[] = [];
  if (sky.sky !== null) stats.push({ label: "Sky", value: sky.sky });
  stats.push({
    label: "Visibility",
    value:
      sky.visibilityMi === null
        ? null
        : visibilityWords(sky.visibilityMi, sky.visibilityAtCeiling),
  });
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
 * Descriptive rather than advisory, for the reason `WavesToday`'s `heightWords`
 * gives about its own bands: this site relays measurements and does not decide
 * whether anybody should go. "Warm" restates 76 °F; "a good day for it" would
 * be a verdict, and ADR-0009 forbids the site from making one. That ADR's own
 * wording is the licence for this line -- "facts get described in plain
 * language" -- and the boundary it draws is inference, not description.
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
 * that is windy. So the wind earns a clause even though the temperature leads,
 * the same way `TideToday`'s sentence explains the height while the figure is
 * the time.
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
 * The brief specifies this line as card anatomy in three places -- "leads with
 * one big number, says what it means in plain words" under Solution, "emoji
 * header, lead figure, plain-language line, stat groups, attribution" in
 * `ReadingCard`'s inventory row, and "the lead figure, the plain-language line
 * and the stat groups are all present without interaction" under Key
 * Interactions. Two of the three cards shipped with it: `TASKS.md` slices 2 and
 * 3 each preserve their card's line explicitly and slice 4 does not mention
 * one, which is where this card's was dropped. Without it nothing below the
 * lead figure aligned across the band, so three instances of one component read
 * as three different layouts.
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

export function WindToday({
  beachName,
  airStation,
  skyStation,
  air,
  sky,
}: AirView) {
  const words = air.kind === "reading" ? plainWords(air) : null;

  return (
    <ReadingCard
      emoji="🌡️"
      headingId="wind-today-heading"
      title="Air"
      context={beachName}
      figure={temperatureWords(air)}
    >
      {/*
        The plain-words line every card on this page is specified to carry, and
        the one this card shipped without. Measured row tops across the band:
        tide and waves align on all seven rows, and air matched for three and
        then diverged, because where the others say what the number means it
        went straight from 76°F to WIND.

        A restatement, never advice. ADR-0009 forbids this site a verdict, so a
        Beaufort-style "a light breeze" is available and "a good day for it" is
        not.
      */}
      {words !== null && (
        <p className="leading-relaxed mb-3 text-base text-fog">{words}</p>
      )}

      {/*
        Two groups, each followed by its own attribution, and that arrangement
        IS ADR-0010 rather than a layout preference. The four figures come from
        two stations at very different distances, and a reader who cannot tell
        which supplied which is worse off than one who reads two lines. As one
        paragraph of prose the distinction was technically present and
        practically invisible; grouped, it is the first thing the card shows.

        One StatGroup never spans two sources.
      */}
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

      {sky.kind === "reading" && (
        <div className="mt-4">
          <StatGroup stats={skyStats(sky)} />
        </div>
      )}

      {skyStation !== null && (
        <ProvenanceLine
          label="Sky and visibility"
          source={skyStation.name}
          distanceKm={
            skyStation.distanceM !== null
              ? roundedKm(skyStation.distanceM)
              : null
          }
        />
      )}

      {air.kind === "no-station" && (
        <details className="mb-4 text-sm text-fog">
          <summary className={DISCLOSURE_TARGET}>
            Why there is no temperature or wind
          </summary>
          <p className="mt-2">{air.reason}</p>
        </details>
      )}

      {air.kind === "unavailable" && (
        <details className="mb-4 text-sm text-fog">
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

      {sky.kind === "unavailable" && (
        <details className="mb-4 text-sm text-fog">
          <summary className={DISCLOSURE_TARGET}>
            Why there is no sky or visibility
          </summary>
          <p className="mt-2">{sky.detail}</p>
          {sky.drift && (
            <p className="mt-2">
              The National Weather Service&apos;s payload was not the shape this
              site pins, which is a bug here rather than a problem at the
              station.
            </p>
          )}
        </details>
      )}

      {sky.kind === "no-station" && (
        <details className="mb-4 text-sm text-fog">
          <summary className={DISCLOSURE_TARGET}>
            Why there is no sky or visibility
          </summary>
          <p className="mt-2">{sky.reason}</p>
        </details>
      )}
    </ReadingCard>
  );
}
