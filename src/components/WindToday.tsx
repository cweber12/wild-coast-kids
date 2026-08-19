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
 * worse off than one who has to read two lines.
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
 */

import type { AirView } from "@/lib/conditions";

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
 * How far the station is, in words.
 *
 * A decimal under ten kilometres because that is the range these two bindings
 * differ across: an air station at 1.4 km and a sky station at 10.4 km is the
 * whole point, and rounding the first to "1 km" throws away the comparison.
 */
function distanceWords(metres: number): string {
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : km.toFixed(0)} km`;
}

/**
 * The station's name with the parts that are not a name taken off.
 *
 * The table stores what each network publishes, unedited, because it is a
 * record of what upstream said. Airports are named in prose there and the rest
 * are not: the mesonet publishes "EW9951 San Diego Shelter Island   CA US" and
 * the tide network publishes "9410230 - La Jolla, CA". Until this panel bound a
 * second station only airports ever reached a reader, so this is new work rather
 * than a tidy-up.
 *
 * Three removals, each of something that is an identifier or a country rather
 * than a place: a leading callsign-style token, a trailing "CA US", and the runs
 * of padding whitespace. Nothing is added — a name that is already prose comes
 * through untouched, and a name this cannot improve is shown as published rather
 * than replaced with something invented.
 */
function stationWords(name: string): string {
  return name
    .replace(/^[A-Z]{1,2}\d{4,7}\s+/, "")
    .replace(/^\d{7}\s*-\s*/, "")
    .replace(/\s+CA\s+US$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The wind, as a sentence, or the reason there is not one. */
function windSentence(air: AirView["air"]): string {
  if (air.kind !== "reading") return "";
  if (air.windMph === null) return " The station reported no wind speed.";
  if (air.windMph < 1) return " The wind is calm.";
  return (
    ` Wind ${Math.round(air.windMph)} mph` +
    (air.windDirDegT !== null
      ? ` from the ${compassWords(air.windDirDegT)}`
      : "") +
    (air.gustMph !== null ? `, gusting ${Math.round(air.gustMph)}` : "") +
    "."
  );
}

/** Sky then visibility, from the other station, or nothing at all. */
function skySentence(sky: AirView["sky"]): string {
  if (sky.kind !== "reading") return "";
  return (
    (sky.sky !== null ? ` Sky: ${sky.sky.toLowerCase()}.` : "") +
    (sky.visibilityMi === null
      ? " The airport reported no visibility."
      : ` Visibility ${visibilityWords(sky.visibilityMi, sky.visibilityAtCeiling)}.`)
  );
}

/** The primary slot never renders empty: an empty one reads as a fault. */
function temperatureWords(air: AirView["air"]): string {
  if (air.kind === "no-station") return "No station near enough";
  if (air.kind === "unavailable") return "No temperature just now";
  return air.airTempF === null
    ? "No temperature reading"
    : `${Math.round(air.airTempF)}°F`;
}

export function WindToday({
  beachName,
  airStation,
  skyStation,
  air,
  sky,
}: AirView) {
  const secondary = `${windSentence(air)}${skySentence(sky)}`.trim();

  return (
    <section aria-labelledby="wind-today-heading" className="mt-9 max-w-130">
      <h2
        id="wind-today-heading"
        className="text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase"
      >
        Air · {beachName}
      </h2>

      <p className="leading-tight mb-2 text-4xl font-black italic">
        {temperatureWords(air)}
      </p>

      {secondary !== "" && (
        <p className="leading-relaxed mb-4 text-base text-fog">{secondary}</p>
      )}

      {air.kind === "no-station" && (
        <details className="mb-4 text-sm text-fog">
          <summary>Why there is no temperature or wind</summary>
          <p className="mt-2">{air.reason}</p>
        </details>
      )}

      {air.kind === "unavailable" && (
        <details className="mb-4 text-sm text-fog">
          <summary>Why there is no temperature or wind</summary>
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
          <summary>Why there is no sky or visibility</summary>
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
          <summary>Why there is no sky or visibility</summary>
          <p className="mt-2">{sky.reason}</p>
        </details>
      )}

      <div className="text-2xs leading-relaxed text-fog">
        {airStation !== null && (
          <p>
            Temperature and wind measured at {stationWords(airStation.name)}
            {airStation.distanceM !== null
              ? `, ${distanceWords(airStation.distanceM)} from this beach`
              : ""}
            .
          </p>
        )}
        {skyStation !== null && (
          <p>
            Sky and visibility at {stationWords(skyStation.name)}
            {skyStation.distanceM !== null
              ? `, ${distanceWords(skyStation.distanceM)} away`
              : ""}
            . That is an airport reading rather than one taken at the shore:
            cloud and visibility are only published by airports, and coastal fog
            is exactly what changes across that distance.
          </p>
        )}
      </div>
    </section>
  );
}
