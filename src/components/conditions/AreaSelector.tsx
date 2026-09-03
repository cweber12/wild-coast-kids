"use client";

import { useRouter } from "next/navigation";
import { TOUCH_TARGET } from "../ui/touchTarget";

/**
 * Choosing which **area** the conditions view is about.
 *
 * It chose a beach until 2026-09-02, from a list of 51 grouped under headings.
 * The area is what a reader has a name for — Del Mar, La Jolla, Mission Bay –
 * West — and it is the thing this tool is now about, so it is the thing this
 * control offers. Eighteen entries, north to south, flat: there is nothing to
 * group eighteen places by that a reader would recognise, and a grouping over a
 * scannable list is a heading nobody needs.
 *
 * **The beaches are not lost, they moved to the page.** An area lists its own,
 * which is where a list of ten places belongs when nine of them are inside one
 * neighbourhood — and it is the same list that will drive the area map, whose
 * marks are too crowded to be tapped (ADR-0047).
 *
 * The `noscript` list is not decoration. Selecting with a `select` needs
 * JavaScript to navigate, and a family checking the tide on a phone with a
 * blocked script would otherwise get a control that silently does nothing. The
 * fallback is the same list as plain links, so the page works either way.
 */

export interface SelectableArea {
  slug: string;
  name: string;
}

export function AreaSelector({
  areas,
  current,
}: {
  areas: readonly SelectableArea[];
  current: string;
}) {
  const router = useRouter();

  return (
    // No margin of its own: it sits in the page header's flex row, and the row
    // owns the spacing. Carrying one here would be counted twice.
    <div className="md:shrink-0">
      <label
        className="text-2xs mb-2 block font-extrabold tracking-widest text-ocean uppercase"
        htmlFor="area"
      >
        Choose an area
      </label>
      {/*
        `TOUCH_TARGET` rather than a bare py-3: it is the site's 44px floor
        below md (ADR-0004), and this is the one control in the page header. A
        value that happens to be right is not the same as one that stays right.
      */}
      <select
        id="area"
        name="area"
        className={`rounded-pill ${TOUCH_TARGET} block w-full border-2 border-lavender bg-white px-5 py-3 text-base font-bold md:w-72`}
        defaultValue={current}
        onChange={(event) => router.push(`/conditions/${event.target.value}`)}
      >
        {areas.map((area) => (
          <option key={area.slug} value={area.slug}>
            {area.name}
          </option>
        ))}
      </select>

      <noscript>
        <ul className="leading-relaxed mt-4 text-base text-fog">
          {areas.map((area) => (
            <li key={area.slug}>
              <a href={`/conditions/${area.slug}`}>{area.name}</a>
            </li>
          ))}
        </ul>
      </noscript>
    </div>
  );
}
