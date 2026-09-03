"use client";

import { useRouter } from "next/navigation";
import { TOUCH_TARGET } from "../ui/touchTarget";

/**
 * Choosing which beach the conditions view is about.
 *
 * The inventory is too long to scan flat, so it is grouped by **area** — Del
 * Mar, La Jolla, Mission Bay – West — which is a place a reader already has a
 * name for. It replaced a grouping derived from water class and latitude, whose
 * bay band held `Childrens Pool` and a wildlife refuge 19 km away because both
 * sit in sheltered water.
 *
 * The areas run north to south and their members run north to south inside
 * them, which is what makes the list read down the coast. Those two properties
 * are all that hold: the areas interleave, so the flattened order is not the
 * inventory's. `src/lib/areas.ts` carries the reason.
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
  /** The area's display name, which labels the group. */
  area: string;
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
          <optgroup key={group.area} label={group.area}>
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
          <div key={group.area} className="mt-4">
            <p className="text-2xs font-extrabold tracking-widest text-ocean uppercase">
              {group.area}
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
