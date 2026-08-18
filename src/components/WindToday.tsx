/**
 * Wind, visibility, air temperature and sky at the bound observation station.
 *
 * Presentational and pure, like the two panels beside it.
 *
 * **Four values, one station.** The join binds a station that publishes
 * visibility, and that same station supplies the wind, the temperature and the
 * sky. Several stations sit nearer each beach and publish wind without
 * visibility; binding those separately would put two provenances behind one
 * heading, which is the thing this site does not do.
 *
 * **Ten miles is a ceiling, not a measurement.** METAR stops there, so the top
 * of the range is rendered "10 miles or more". Reading it as exactly ten would
 * be a precision upstream never claimed.
 *
 * **The station is an airport, and says so.** Every station in the county that
 * publishes visibility is an airport, inland of the beach it is bound to — a
 * median of 7.3 km and up to 16.8 km. Coastal fog is exactly what changes across
 * that distance, so the distance is given for the same reason the buoy's is.
 */

import type { AirView } from "@/lib/conditions";

/** Past this, the station is far enough away that the reader is owed the number. */
const DISTANT_STATION_M = 5_000;

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

export function WindToday({ beachName, station, state }: AirView) {
  const distanceM = station?.distanceM ?? null;
  const distantKm =
    distanceM !== null && distanceM > DISTANT_STATION_M
      ? (distanceM / 1000).toFixed(0)
      : null;

  return (
    <section aria-labelledby="wind-today-heading" className="mt-9 max-w-130">
      <h2
        id="wind-today-heading"
        className="text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase"
      >
        Wind and visibility · {beachName}
      </h2>

      {state.kind === "reading" && (
        <>
          <p className="leading-tight mb-2 text-4xl font-black italic">
            {state.visibilityMi === null
              ? "No visibility reading"
              : visibilityWords(state.visibilityMi, state.visibilityAtCeiling)}
          </p>
          <p className="leading-relaxed mb-4 text-base text-fog">
            {state.windMph === null
              ? "The station reported no wind speed."
              : state.windMph < 1
                ? "The wind is calm."
                : `Wind ${Math.round(state.windMph)} mph` +
                  (state.windDirDegT !== null
                    ? ` from the ${compassWords(state.windDirDegT)}`
                    : "") +
                  (state.gustMph !== null
                    ? `, gusting ${Math.round(state.gustMph)}`
                    : "") +
                  "."}
            {state.airTempF !== null
              ? ` The air is ${Math.round(state.airTempF)}°F.`
              : ""}
            {state.sky !== null ? ` Sky: ${state.sky.toLowerCase()}.` : ""}
          </p>
        </>
      )}

      {state.kind === "no-station" && (
        <>
          <p className="leading-relaxed mb-4 text-base text-fog">
            We cannot give wind or visibility here, and that is a gap in what is
            published rather than a fault at the beach.
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
            We could not get a weather reading just now. Try again shortly.
          </p>
          <details className="mb-4 text-sm text-fog">
            <summary>What went wrong</summary>
            <p className="mt-2">{state.detail}</p>
            {state.drift && (
              <p className="mt-2">
                The National Weather Service&apos;s payload was not the shape
                this site pins, which is a bug here rather than a problem at the
                station.
              </p>
            )}
          </details>
        </>
      )}

      {station !== null && (
        <p className="text-2xs leading-relaxed text-fog">
          Measured at {station.name}
          {distantKm !== null ? `, about ${distantKm} km from this beach` : ""}.
          That is an airport reading, not a reading taken at the shore, and
          coastal fog can differ across that distance.
        </p>
      )}
    </section>
  );
}
