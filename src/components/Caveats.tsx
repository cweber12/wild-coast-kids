/**
 * What this site does not know, on the page where it matters.
 *
 * The data files carry `unresolved` arrays: a station whose water class is an
 * author's judgement, a beach whose coordinates upstream published wrong, a gap
 * in NOAA's own predictions. Those entries exist to be read by the person acting
 * on the number, not by whoever maintains the repo — a caveat that reaches only a
 * maintainer is a caveat nobody was warned by.
 *
 * They sit behind a disclosure rather than on the page, because the reader came
 * for a tide time and a wall of qualifications would bury it. The disclosure is
 * the compromise that lets the list be comprehensive and the page stay readable:
 * a beach whose water-quality station is unresolved can still ship, because the
 * page says it is unresolved.
 *
 * The gate asserts that every entry in every data file arrives here, so a caveat
 * cannot be added to a file and quietly reach no reader.
 */

export function Caveats({ entries }: { entries: readonly string[] }) {
  if (entries.length === 0) return null;

  return (
    <details className="mt-9 max-w-130 text-sm text-fog">
      <summary>What we are unsure about in this data</summary>
      <ul className="leading-relaxed mt-3">
        {entries.map((entry) => (
          <li key={entry} className="mb-3">
            {entry}
          </li>
        ))}
      </ul>
    </details>
  );
}
