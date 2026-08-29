/**
 * How a MOP line is named, credited and measured for a reader.
 *
 * Four facts, in one place, because two components are about to state them: the
 * week grid's wave row and the wave card's forecast block. `ProvenanceLine`'s
 * own docstring records what happens otherwise — on `fiesta-island`, where two
 * bindings resolved to one station, the page printed "San Diego Airport · 4.7 km
 * from this beach" and "San Diego Airport · 4.7 km away" eighty pixels apart.
 * That drift came from two call sites each wording one fact, which is exactly
 * the shape this file exists to prevent for a third source.
 *
 * It sits beside `cardText.ts` and `disclosure.ts` rather than in `lib/`,
 * because all four are presentation: what a reader is told a line is, not what
 * the join or the parser knows about it.
 */

/**
 * Who publishes the forecast, credited as CDIP asks to be.
 *
 * Both names, not just the acronym. "CDIP" alone is an identifier a reader has
 * no way to expand, and the institution behind it is the thing that makes the
 * number worth trusting — the same argument `ObservationStation.display_name`
 * makes about publishing callsigns.
 */
export const MOP_NETWORK = "CDIP, Scripps Institution of Oceanography";

/**
 * What the figure is, said in the attribution rather than left to be inferred.
 *
 * The page carries a measured wave height and a modelled one, and ADR-0016
 * turns on a reader being able to tell them apart. This clause is where that
 * happens on the line itself; `ConditionsNotes` explains what the difference
 * means.
 */
export const MOP_MODEL_NOTE =
  "a model of the swell at 10 m depth, not a measurement";

/**
 * What the page calls a line.
 *
 * "MOP line D0498" rather than a name, because CDIP gives these no name: they
 * are numbered south to north behind a county prefix, so the id is the whole
 * identity. Naming what the identifier IS keeps it from reading as a callsign
 * turned into prose, which is the failure #87 records.
 */
export function mopLineSource(lineId: string): string {
  return `MOP line ${lineId}`;
}

/**
 * How far the line stands, in kilometres, rounded — or null when the binding
 * recorded no distance.
 *
 * One decimal, always, and no threshold under which it is withheld. The two
 * measured cards have one — the buoy is not named with a distance under
 * 10 km — because a distance small enough not
 * to change the reading is noise beside it. This distance is never large: every
 * bound line is between 117 m and 910 m away, so rounding to whole kilometres
 * would print "1 km" or "0 km" for all fifteen and say nothing.
 *
 * It is shown rather than withheld because it is the answer to the question the
 * forecast invites. A modelled height sitting beside a measured one is only
 * readable if a reader can see that the model's point is the nearer of the two,
 * and this is the number that says so.
 */
export function mopLineDistanceKm(metres: number | null): string | null {
  return metres === null ? null : (metres / 1000).toFixed(1);
}
