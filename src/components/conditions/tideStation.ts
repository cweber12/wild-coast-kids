/**
 * How a tide station is named, credited and measured for a reader.
 *
 * The third of these, beside `mopLine.ts` and `gridCell.ts`, so the week grid's
 * three rows are attributed from three modules of the same shape rather than
 * two modules and one row's wording spelled inline.
 *
 * **It exists because the tide had no attribution of its own and never
 * needed one.** These facts lived on the tide card, which sat above the grid,
 * shared this station and this request, and was the one place the page named
 * NOAA. When the three-card slab came off in #172 the naming went with it, and
 * every tide figure on the page — seven cells and a twenty-four hour curve —
 * was published by nobody. ADR-0010's guarantee is the sentence it closes on:
 * "No figure is ever shown without the reader being able to see where it came
 * from."
 *
 * It sits beside `cardText.ts` and `disclosure.ts` rather than in `lib/`,
 * because all of them are presentation: what a reader is told a station is,
 * not what the join or the parser knows about it.
 */

/** Who publishes the predictions, as NOAA names the product. */
export const TIDE_NETWORK = "NOAA Tides & Currents";

/**
 * Past this, the station is far enough away that the reader is owed the number.
 *
 * NOAA publishes no delivering tide station on the open coast between La Jolla
 * and Imperial Beach, so some beaches read one tens of kilometres away. Under
 * five kilometres the figure is noise beside the prediction; past it, it is the
 * difference between a prediction for this shore and the nearest one anybody
 * publishes — which is the wording the tide card used and the reason it gave.
 */
const DISTANT_STATION_M = 5000;

/**
 * How far the station stands, in kilometres, rounded — or null when it is near
 * enough that saying so adds nothing.
 *
 * Whole kilometres, unlike `mopLineDistanceKm`'s decimal, and the two are
 * different for a reason rather than by accident: every MOP line is inside a
 * kilometre, so a decimal is the whole of what its figure says, and a tide
 * station this rule prints is always tens of kilometres away, where a decimal
 * would be false precision about a station in the next bay.
 */
export function tideStationDistanceKm(metres: number | null): string | null {
  return metres !== null && metres > DISTANT_STATION_M
    ? (metres / 1000).toFixed(0)
    : null;
}

/**
 * Why this station and not a nearer one — or null when there is nothing to say.
 *
 * Only ever alongside a distance, because on its own it would answer a question
 * a reader had no reason to ask. `water` is the join's own classification and
 * decides which pool the station came from: an open-coast beach binds a shore
 * station, a bay beach binds the nearest of any kind.
 */
export function tideStationNote(
  metres: number | null,
  water: string,
): string | null {
  return tideStationDistanceKm(metres) === null
    ? null
    : `the nearest ${water === "bay" ? "bay" : "open-coast"} station publishing predictions`;
}
