"use client";

import { useRouter } from "next/navigation";

/**
 * Choosing which beach the conditions view is about.
 *
 * Seventy-three entries is too many to scan flat, so they are grouped by region
 * — a display grouping the inventory derives from water class and latitude, and
 * never a join input. Bays, lagoons and inlets group together regardless of
 * where they are, because that is how someone looks for them.
 *
 * The `noscript` list is not decoration. Selecting with a `select` needs
 * JavaScript to navigate, and a family checking the tide on a phone with a
 * blocked script would otherwise get a control that silently does nothing. The
 * fallback is the same inventory as plain links, so the page works either way.
 */

export interface SelectableBeach {
  slug: string;
  name: string;
}

export interface BeachGroup {
  region: string;
  beaches: readonly SelectableBeach[];
}

export function BeachSelector({
  groups,
  current,
}: {
  groups: readonly BeachGroup[];
  current: string;
}) {
  const router = useRouter();

  return (
    <div className="mb-9">
      <label className="leading-relaxed text-base text-fog" htmlFor="beach">
        Choose a beach
      </label>
      <select
        id="beach"
        name="beach"
        className="rounded-pill mt-2 block w-full max-w-130 border-2 border-lavender bg-white px-5 py-3 text-base"
        defaultValue={current}
        onChange={(event) => router.push(`/conditions/${event.target.value}`)}
      >
        {groups.map((group) => (
          <optgroup key={group.region} label={group.region}>
            {group.beaches.map((beach) => (
              <option key={beach.slug} value={beach.slug}>
                {beach.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <noscript>
        {groups.map((group) => (
          <div key={group.region} className="mt-4">
            <p className="text-2xs font-extrabold tracking-widest text-ocean uppercase">
              {group.region}
            </p>
            <ul className="leading-relaxed text-base text-fog">
              {group.beaches.map((beach) => (
                <li key={beach.slug}>
                  <a href={`/conditions/${beach.slug}`}>{beach.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </noscript>
    </div>
  );
}
