"use client";

import { useRouter } from "next/navigation";
import { TOUCH_TARGET } from "./touchTarget";

/**
 * Choosing which beach the conditions view is about.
 *
 * The inventory is too long to scan flat, so it is grouped by region — a
 * display grouping the inventory derives from water class and latitude, and
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
    // No margin of its own: it sits in the page header's flex row now, and the
    // row owns the spacing. Carrying one here would be counted twice.
    <div className="md:shrink-0">
      <label
        className="text-2xs mb-2 block font-extrabold tracking-widest text-ocean uppercase"
        htmlFor="beach"
      >
        Choose a beach
      </label>
      {/*
        `TOUCH_TARGET` rather than the bare py-3 this had: it is the site's
        44px floor below md (ADR-0004), and this is the one control on the
        page. It already measured about that, which is exactly the drift the
        constant exists to stop -- a value that happens to be right is not the
        same as one that stays right.
      */}
      <select
        id="beach"
        name="beach"
        className={`rounded-pill ${TOUCH_TARGET} block w-full border-2 border-lavender bg-white px-5 py-3 text-base font-bold md:w-72`}
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
