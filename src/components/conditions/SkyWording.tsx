/**
 * What the National Weather Service says about the sky, in its own words.
 *
 * Presentational and pure: it takes a state and renders it, so every branch is
 * assertable without a network. The panel next door does the fetching.
 *
 * **The words are relayed, never formed.** ADR-0009 forbids this site making a
 * forecaster's judgement, and this component is the closest the page comes to
 * the line. So nothing here rewrites, shortens, re-cases or bands the string:
 * it arrives from `readSkyWording` as the publisher issued it and is printed.
 * The only text this file writes is the period's name, which is also the
 * publisher's, and the sentence for when there are no words at all.
 *
 * **ADR-0024 is why this exists.** That decision put three cloud means on the
 * week grid and deliberately computed no band word to go with them, because
 * banding the mean on the service's own scale contradicted the service's own
 * published wording on three days of six -- "we would print Partly cloudy;
 * its forecast endpoint says Mostly Sunny". It named this field as the right
 * answer and deferred it to a day view. This is that view, and these are those
 * words.
 *
 * **The period name is not decoration.** The publisher divides a day in two and
 * the forecast does not run backwards, so by evening today's daytime half has
 * dropped out of the payload and only "Tonight" remains. `readSkyWording` falls
 * back to it rather than going silent, and printing the name is the whole of
 * what makes that fallback honest: a reader is told they are reading tonight's
 * forecast rather than being shown fog against an afternoon.
 *
 * **An outage says so and stops.** The one thing this component must never do
 * is reach for the cloud percentages beside it and turn them into a word --
 * that is precisely the computation ADR-0024 rejected on measurement, and a
 * fallback is exactly where it would look reasonable.
 */

import { PAGE_MUTED } from "./cardText";
import { GRID_MODEL_NOTE, GRID_NETWORK, GRID_SOURCE } from "./gridCell";
import { gridCellCaveat } from "./gridCell";
import { ProvenanceLine } from "./ProvenanceLine";
import type { SkyWordingDay, SkyWordingView } from "@/lib/conditions";

export type SkyWordingProps = {
  view: SkyWordingView;
  /** The Pacific date the panel is showing, as `YYYY-MM-DD`. */
  localDate: string;
};

/**
 * Either this day's words, or the reason there are none.
 *
 * **One decision and one lookup**, rather than a helper that answers "is there
 * an absence" and a caller that then finds the day again. The first shape of
 * this file did that, and it left three branches the code could never take --
 * a re-narrowed state, a second `undefined` check, and a null cell beside a
 * populated week. The coverage floor refused them, correctly: they were dead
 * code wearing the clothes of defensiveness.
 *
 * **Three different silences, and they are not interchangeable.** A beach
 * outside the grid will never have words; a cell the request could not reach
 * may have them within the hour; a day past the product's reach has none yet.
 * The same distinction `TideToday` draws between `no-station` and
 * `unavailable`, and for the same reason -- collapsing them tells a reader to
 * come back later about something that will never work, or the reverse.
 */
type Resolved =
  | {
      kind: "words";
      day: SkyWordingDay;
      /** Carried out of the narrowing, so the caller needs no null check. */
      elevationM: number | null;
    }
  | { kind: "absent"; reason: string };

function resolve(view: SkyWordingView, localDate: string): Resolved {
  // Narrowed on the cell rather than on `state.kind`, though the union makes
  // them the same case: this is the one that also narrows `cell` itself, so the
  // elevation can be read below without a second check that could never fail.
  if (view.cell === null) {
    return {
      kind: "absent",
      reason:
        "The National Weather Service publishes no forecast cell for this beach, so there " +
        "are no words for the sky here.",
    };
  }
  if (view.state.kind === "unavailable") {
    return {
      kind: "absent",
      reason:
        "We could not get the National Weather Service's forecast wording just now. The " +
        "cloud figures on the week above come from a separate request and are unaffected.",
    };
  }

  const day = view.state.days.find((each) => each.localDate === localDate);
  return day === undefined
    ? {
        kind: "absent",
        reason:
          "The National Weather Service's forecast does not reach this day yet.",
      }
    : { kind: "words", day, elevationM: view.cell.elevationM };
}

export function SkyWording({ view, localDate }: SkyWordingProps) {
  const resolved = resolve(view, localDate);

  if (resolved.kind === "absent") {
    return (
      /* PAGE_MUTED, not the card's: this panel renders straight onto the
         page ground, and the card's colour paints 1.03:1 there. An absence
         nobody can see is the silent failure this whole component exists to
         avoid -- it would say why there are no words in text the colour of
         the paper. */
      <p className={`leading-relaxed text-base ${PAGE_MUTED}`}>
        {resolved.reason}
      </p>
    );
  }

  const day = resolved.day;

  return (
    <div>
      <p className="leading-relaxed text-base">
        {/*
          The period's own name leads, in the label register the day headings
          above already use, so "Tonight" is visibly a scope on the words rather
          than part of them. Two facts, and the reader can see which is which.
        */}
        <span className="text-2xs font-extrabold tracking-widest text-ocean uppercase">
          {day.periodName}
        </span>{" "}
        <span data-sky-wording>{day.words}</span>
      </p>

      {/*
        Its own provenance line, beside rather than folded into the cloud row's.
        ADR-0024 named "a second provenance line" as one of the three costs of
        taking this read, and this is that cost paid rather than avoided: the
        numbers and the words are separate products at separate URLs that fail
        separately, and one line covering both would tell a reader the page had
        asked once.
      */}
      <ProvenanceLine
        surface="page"
        label="Sky, in words"
        source={GRID_SOURCE}
        network={GRID_NETWORK}
        note={[GRID_MODEL_NOTE, gridCellCaveat(resolved.elevationM)]
          .filter((part): part is string => part !== null)
          .join("; ")}
      />
    </div>
  );
}
