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
 * **The distance is worded here, and rounded by the caller.** Those are two
 * decisions and they were handed out as one. `distance` arrived "already
 * worded by the caller", which is right for the rounding -- the buoy's 10 km
 * threshold and the air station's sub-10 km decimal each have a reason
 * recorded where they are made -- and wrong for the phrasing, which drifted
 * immediately into four wordings of one fact across three components. On
 * `fiesta-island`, where air and sky bound to the same station,
 * one card printed "San Diego Airport · 4.7 km from this beach" and "San Diego
 * Airport · 4.7 km away" 80px apart. So this takes the number and prints the
 * sentence: same drift `ReadingCard` and `ReservedSlot` both cite in their
 * docstrings as the reason to share a component at all.
 *
 * **The note is not decoration.** Some sources are far enough away that the
 * distance alone understates the situation. The tide card recorded why that is
 * disclosed rather than buried -- it "is the difference between a prediction for
 * this shore and the nearest one anybody publishes" -- and the MOP line's own
 * clause carries the same weight now that the card has gone. A caller passes
 * that clause here rather than dropping it.
 */

import { CARD_MUTED, PAGE_MUTED } from "./cardText";

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
  /**
   * How far the station stands, in kilometres and already rounded. `null`
   * withholds it, which is what a caller under its own threshold does.
   *
   * The number and nothing else: a string rather than a number so the caller's
   * rounding survives verbatim, since "4.7" and "12" are decisions made
   * upstream for reasons recorded there. Everything around it -- the hedge,
   * the unit and the reference point -- belongs to this component.
   */
  distanceKm?: string | null;
  /** Why this source and not a nearer one, when there is something to say. */
  note?: string | null;
  /** What these figures are, when a card carries more than one source. */
  label?: string | null;
  /**
   * Which ground this line is printed on, because the colour differs and this
   * component cannot see where it was rendered.
   *
   * **It is asked for rather than inferred, and that is the whole of the fix
   * for a line nobody could read.** This printed `CARD_MUTED` unconditionally
   * -- white at 55%, measured against the reading card's `bg-dark` -- and two
   * callers render it straight onto `--color-cream`, where it paints 1.03:1.
   * Nothing failed: the markup was right, the attribution was right, and the
   * text was the colour of the paper.
   *
   * `"card"` by default because that is where this component started and where
   * the measured block still renders it, and a default that changed those would
   * trade a visible bug for a quiet one. A caller outside a card says so, and
   * two of the four call sites now do.
   */
  surface?: "card" | "page";
};

/**
 * Everything this line says about a source, less the ground it is printed on.
 *
 * **Two things a caller knows and one it does not.** Which station answered,
 * who publishes it and how far away it stands are facts about the data, and
 * travel with it: `HourSeries` carries a set of these per tab, composed where
 * the read is. Which surface it lands on is a fact about the markup and is
 * known only at the call site, so it stays out of here -- a series that carried
 * its own `surface` would be a data structure with an opinion about where it
 * would be rendered, and the whole reason this prop exists is that the last
 * component to guess that got it wrong at 1.03:1.
 */
export type ProvenanceFacts = Omit<ProvenanceLineProps, "surface">;

export function ProvenanceLine({
  source,
  network = null,
  distanceKm = null,
  note = null,
  label = null,
  surface = "card",
}: ProvenanceLineProps) {
  return (
    <p
      className={`text-2xs leading-relaxed ${surface === "page" ? PAGE_MUTED : CARD_MUTED}`}
    >
      {label !== null && <span className="font-extrabold">{label} </span>}
      {source}
      {network !== null ? ` · ${network}` : ""}
      {distanceKm !== null ? ` · about ${distanceKm} km from this beach` : ""}
      {note !== null ? ` — ${note}` : ""}
    </p>
  );
}
