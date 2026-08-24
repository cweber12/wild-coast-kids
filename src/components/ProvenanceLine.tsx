/**
 * Which instrument answered, who publishes it, and how far away it stands.
 *
 * **This is the half of the old attribution paragraph that stayed.** The other
 * half — what the figure means — went to `ConditionsNotes`, because it was the
 * same three times. This half differs per beach and must not move: ADR-0010
 * turns on a reader being able to tell which station supplied which number, and
 * the air panel names two of them precisely so the two can be compared.
 *
 * **Separated rather than written as a sentence.** The three panels each wrote
 * their own clause — "Predicted for X", "Measured at NDBC buoy Y", "Temperature
 * and wind measured at Z" — and a reader comparing two stations had to parse
 * three different sentence shapes to do it. Interpuncts make the same facts
 * scannable and let two of these stack legibly under one card, which is what the
 * air panel needs.
 *
 * **The note is not decoration.** Some stations are far enough away that the
 * distance alone understates the situation, and `TideToday` records why that is
 * disclosed rather than buried: it "is the difference between a prediction for
 * this shore and the nearest one anybody publishes". A caller passes that
 * clause here rather than dropping it.
 */

type ProvenanceLineProps = {
  /** What the figure names it, ready to print. Never a callsign turned into prose — see #87. */
  source: string;
  /**
   * Who publishes it, so two readings from two networks are distinguishable.
   *
   * Optional because the air panel genuinely does not know. `StationBinding`
   * carries a name and a distance and no network, and the panel has never named
   * one — an air station may be on either the NWS or the NDBC network, so there
   * is no constant to fall back on. Rendering a guess would be worse than
   * rendering nothing, and threading the field through the view model is a data
   * change rather than a presentation one.
   */
  network?: string | null;
  /** Already worded by the caller, which owns the rounding. `null` withholds it. */
  distance?: string | null;
  /** Why this source and not a nearer one, when there is something to say. */
  note?: string | null;
  /** What these figures are, when a card carries more than one source. */
  label?: string | null;
};

export function ProvenanceLine({
  source,
  network = null,
  distance = null,
  note = null,
  label = null,
}: ProvenanceLineProps) {
  return (
    <p className="text-2xs leading-relaxed text-fog">
      {label !== null && <span className="font-extrabold">{label} </span>}
      {source}
      {network !== null ? ` · ${network}` : ""}
      {distance !== null ? ` · ${distance}` : ""}
      {note !== null ? ` — ${note}` : ""}
    </p>
  );
}
