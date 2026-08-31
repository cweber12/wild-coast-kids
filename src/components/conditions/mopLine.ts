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
 * A swell estimate as one figure: how big, and how far apart.
 *
 * **Two components print this and they must not disagree**, which is the whole
 * reason it is here rather than inside either. The week grid's wave cell and
 * the shore map's readout both render one `WaveReading` -- the same three-hour
 * step, selected once by `readWaveWeek` -- so the map and the grid printing
 * different numbers for Thursday would be the page contradicting itself about a
 * figure it holds once. `ProvenanceLine`'s docstring records what two call
 * sites each wording one fact cost this repo the last time.
 *
 * **Whole seconds**, because CDIP publishes the peak period as a float --
 * 16.666668 -- as the reciprocal of a spectral frequency bin rather than as a
 * measurement to six decimal places, and the buoy card beside this prints whole
 * seconds because NDBC publishes whole seconds.
 *
 * **An interpunct between the two figures rather than a space.** "0.8 ft 5 s"
 * is two numbers a reader has to separate, and ` · ` is what `ProvenanceLine`
 * already uses to separate facts in running text on this page.
 *
 * `null` in and `null` out, which is `mopLineDistanceKm`'s shape and is here
 * for the same reason: the absence is a fact about a ragged forecast, and a
 * caller that had to branch on it would be the second place deciding what a
 * missing estimate looks like.
 */
export function swellFigure(
  reading: { heightFt: number; periodS: number } | null,
): string | null {
  return reading === null
    ? null
    : `${reading.heightFt.toFixed(1)} ft · ${Math.round(reading.periodS)} s`;
}

/**
 * What the attribution says about *when* an estimate is for.
 *
 * **A three-hour step, not a peak located to the minute.** MOP publishes every
 * three hours, so a `WaveReading` is the step that carried the largest height
 * and the real peak can fall up to ninety minutes either side of the time
 * printed. The tide row's time is a turning point NOAA computed and the two
 * look alike, which is why `ConditionsNotes` says which is which -- and why the
 * word "step" is in this sentence rather than a bare clock time.
 *
 * It sits on the provenance line rather than beside the figure because the
 * shore map's readout has no room for a fifth field, and because when an
 * estimate is for is a fact about the model rather than about the sea.
 *
 * The model clause alone where there is no estimate to time, which is a day the
 * forecast does not reach rather than a fault.
 */
export function swellStepNote(reading: { timeLabel: string } | null): string {
  return reading === null
    ? MOP_MODEL_NOTE
    : `${MOP_MODEL_NOTE}, for the three-hour step at ${reading.timeLabel}`;
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
