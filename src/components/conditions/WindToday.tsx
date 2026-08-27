/**
 * Air temperature and wind, from the station that measures them at the shore.
 *
 * Presentational and pure, like the two panels beside it.
 *
 * **Temperature leads.** Visibility held the primary slot once and was the
 * worst of the figures for it: METAR stops at ten statute miles and San Diego
 * sits at that ceiling most of the time, so the largest text on the panel
 * usually rendered a constant. The temperature is what a parent deciding what
 * to bring actually reads.
 *
 * **SKY AND VISIBILITY ARE GONE FROM THIS CARD, and they are not coming back
 * here.** They came from the nearest station publishing them, which in this
 * county is always an airport, at a median of 7.9 km and beyond 10 km for 20 of
 * the 45 beaches served. `docs/reference/sensor-representativeness.md` §7 puts
 * ceiling and visibility alone among the surface variables at not transferable,
 * and its §12 names transferring an aerodrome's off-field as an anti-pattern to
 * refuse. Cloud reaches the reader in the week grid instead, as a forecast for
 * this beach's own grid cell, labelled a forecast. No visibility figure is
 * published anywhere: the grid does not carry one. See
 * docs/adr/0020-sky-leaves-the-card-for-the-week.md.
 *
 * **ADR-0010 IS NOT REVERSED BY THAT.** Its argument was that requiring one
 * station for all four values let the scarcest of them decide where the
 * temperature was measured, which bound La Jolla Shores to Miramar ten
 * kilometres inland where the air read 81 °F against the pier's 72 °F. Removing
 * the sky binding keeps that property rather than undoing it -- the station
 * this card names is still the shore station that ADR introduced, and it is now
 * the only one it names.
 *
 * **One provenance line, and it still shows its distance.** The reason for
 * always showing it was that two stations named without distances are
 * incomparable. With one station the comparison is gone, and the distance
 * stays: it is what tells a reader how near the reading was taken, which is the
 * claim this card is making.
 *
 * **The station names arrive ready to print.** `display_name` is hand-written in
 * the station table, so nothing here tries to turn a callsign into prose. This
 * component briefly did, by stripping identifiers and country codes, and it
 * could not reach the two stations that most needed it — "Tidal Linkage" is not
 * something a mechanical rule turns into a place, and "9410230" is a tide
 * station number rather than any part of "Scripps Pier". See #87.
 */

import type { AirView } from "@/lib/conditions";
import { CARD_PROSE } from "./cardText";
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

/**
 * How far the station is, in kilometres, rounded.
 *
 * A decimal under ten kilometres because that is the range this binding lives
 * in -- the air station runs 0.7 km to 7.4 km across the inventory -- and
 * rounding 1.4 km to "1 km" throws away most of what the figure says.
 *
 * The number only. This panel used to append the unit and a reference point
 * too, and it wrote two different ones twenty lines apart -- "from this beach"
 * for the air station and "away" for the sky station it no longer has, which on
 * a beach whose two halves bound to the same station printed the identical fact
 * two ways on one card. `ProvenanceLine` owns that wording now; the rounding
 * stays here, where the reason for it is.
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

export function WindToday({ beachName, airStation, air }: AirView) {
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
        <p className={`leading-relaxed mb-3 text-base ${CARD_PROSE}`}>
          {words}
        </p>
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
