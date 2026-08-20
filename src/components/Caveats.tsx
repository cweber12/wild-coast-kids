/**
 * What this site does not know, and what it does not cover, on the page where
 * both matter.
 *
 * The data files carry `unresolved` arrays: a station whose water class is an
 * author's judgement, a beach whose coordinates upstream published wrong, a gap
 * in NOAA's own predictions. Those entries exist to be read by the person acting
 * on the number, not by whoever maintains the repo — a caveat that reaches only a
 * maintainer is a caveat nobody was warned by.
 *
 * The inventory's reach is the same obligation pointed the other way. The chooser
 * offers the beaches this site can measure at, which is fewer than the county
 * lists, and a parent looking for one that is missing cannot tell whether the
 * county never listed it or this site left it out. That sentence sits outside the
 * disclosures, because it is the one thing here a reader may need before they
 * have a question.
 *
 * Everything else sits behind a disclosure: the reader came for a tide time and a
 * wall of qualifications would bury it. The disclosure is the compromise that lets
 * the list be comprehensive and the page stay readable — a beach whose
 * water-quality station is unresolved can still ship, because the page says it is
 * unresolved.
 *
 * The gate asserts that every entry in every data file arrives here, so a caveat
 * cannot be added to a file and quietly reach no reader.
 */

import type { InventoryReach } from "@/lib/beaches";

export function Caveats({
  entries,
  reach,
}: {
  entries: readonly string[];
  reach: InventoryReach;
}) {
  return (
    <div className="mt-9 max-w-130 text-sm text-fog">
      <p className="leading-relaxed">
        This site answers for {reach.served} of the {reach.listed} beaches San
        Diego County lists.
      </p>

      {reach.excluded.length > 0 && (
        <details className="mt-3">
          <summary>Why the other {reach.excluded.length} are not here</summary>
          <p className="leading-relaxed mt-3">
            A beach is left out rather than answered with a reading measured
            somewhere else — a station further away than we would publish a
            reading from, or coordinates published upstream that cannot be used
            at all.
          </p>
          <ul className="leading-relaxed mt-3">
            {reach.excluded.map((beach) => (
              <li key={beach.slug} className="mb-3">
                <strong>{beach.name}</strong> — {beach.why}.
              </li>
            ))}
          </ul>
        </details>
      )}

      {entries.length > 0 && (
        <details className="mt-3">
          <summary>What we are unsure about in this data</summary>
          <ul className="leading-relaxed mt-3">
            {entries.map((entry) => (
              <li key={entry} className="mb-3">
                {entry}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
