/**
 * How a forecast cell is named, credited and qualified for a reader.
 *
 * The same job `mopLine.ts` does for a MOP line, and here for the same reason:
 * more than one place is about to state these facts, and `ProvenanceLine`'s
 * docstring records what happens when two call sites each word one — the page
 * printed "San Diego Airport · 4.7 km from this beach" and "San Diego Airport ·
 * 4.7 km away" eighty pixels apart.
 *
 * Presentation, so it sits here rather than in `lib/`: what a reader is told a
 * cell is, not what the join knows about it.
 */

/** How far above sea level a cell may average before the page says so. */
const BLUFF_ELEVATION_M = 50;

/**
 * Who publishes the forecast.
 *
 * The office rather than the agency alone. "National Weather Service" is the
 * publisher a reader knows, and San Diego is which of its offices issued this
 * grid — the same reason `MOP_NETWORK` carries Scripps as well as CDIP.
 */
export const GRID_NETWORK = "National Weather Service, San Diego";

/**
 * What the figure is, said on the line rather than left to be inferred.
 *
 * The page has no measured sky on it at all after ADR-0020, so unlike the wave
 * card there is no measurement beside this for a reader to confuse it with. The
 * clause is here anyway, because the row sits under a tide row of astronomical
 * predictions and beside a wave row of model output, and "forecast" is the word
 * that separates all three from the readings on the cards above.
 */
export const GRID_MODEL_NOTE = "a forecast, not a reading taken at the beach";

/**
 * What the page calls a cell.
 *
 * "this beach's own grid cell" rather than `SGX/54,21`. The identifier is how
 * the National Weather Service addresses a square of the map and means nothing
 * to a reader — and the whole point of this row is *whose* sky it is, which the
 * identifier states worse than the words do. #87 is the record of what happens
 * when a callsign is printed as prose.
 */
export const GRID_SOURCE = "this beach's own grid cell";

/**
 * The sentence a cell that spans the shoreline and the bluff above it owes.
 *
 * Three beaches read one: Torrey Pines State, Torrey Pines City and La Jolla
 * Cove, whose cells average 102 m, 117 m and 106 m against a median of 2.1 m
 * across the inventory. ADR-0020 serves them rather than withholding, on the
 * grounds that terrain is a weaker proxy than an instrument distance and that
 * blanking three of this coast's most-visited beaches costs a reader more than
 * the caveat does. This is the caveat, and the decision is conditional on it.
 *
 * Returns null for a cell at the shore, so the ordinary case says nothing extra.
 */
export function gridCellCaveat(elevationM: number | null): string | null {
  if (elevationM === null || elevationM <= BLUFF_ELEVATION_M) return null;
  return (
    `this cell averages ${Math.round(elevationM)} m of elevation, so it covers the bluff ` +
    `above this beach as well as the shore`
  );
}

/**
 * A forecast phenomenon in the register the page already writes in.
 *
 * The service publishes `fog` with coverage `patchy`, and its own plain-language
 * product renders that "Patchy Fog". So the words are upstream's and the only
 * thing done here is the underscore and the capital — nothing is added, which
 * is ADR-0009's rule that this site relays a forecaster's judgement rather than
 * forming one. "Chance rain showers" reads oddly and is what the National
 * Weather Service itself says; inventing "a chance of rain showers" would be
 * this site wording someone else's forecast.
 */
export function phenomenonWords(phenomenon: {
  weather: string;
  coverage: string | null;
}): string {
  const words = [phenomenon.coverage, phenomenon.weather]
    .filter((part): part is string => part !== null && part !== "")
    .join(" ")
    .replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
