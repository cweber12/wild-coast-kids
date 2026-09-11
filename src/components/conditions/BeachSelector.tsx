"use client";

import { useRouter } from "next/navigation";
import { TOUCH_TARGET } from "../ui/touchTarget";

/**
 * Choosing which **beach** inside the chosen area the readings answer for.
 *
 * The second half of the pair `AreaSelector` starts: that control says which
 * stretch of coast, this one says which place inside it. Together they are the
 * whole of what the page's scope can be, and they sit on one row.
 *
 * **It replaces the list of links `AreaBeaches` drew.** That list was a region
 * of the page — a heading and up to ten wrapped links, about 160px — sitting
 * between the header and the week. A `<select>` of ten beaches and a wrapped
 * row of ten links are the same control twice, and only one of them is
 * reachable without scrolling. See ADR-0060.
 *
 * **The area itself is the first option, not an absence.** A reader who has
 * walked into one beach needs a way back out to the area, and `AreaSelector`
 * cannot do it: choosing the area you are already inside changes nothing. So
 * the empty value is "All of <area>" and navigates to the area's own page.
 *
 * **Not drawn where the area holds one beach.** Six of the eighteen do, and a
 * choice between one thing is not a choice — the same rule `AreaBeaches` had
 * and the same reason `[area]/page.tsx` shows that beach directly instead.
 *
 * The `noscript` list is not decoration, and it is doing more work here than
 * `AreaSelector`'s: with the link list retired, this is the only thing keeping
 * an area's beaches reachable — by a reader with a blocked script, and by
 * anything that reads the page without running it.
 */

export interface SelectableBeach {
  slug: string;
  name: string;
}

export function BeachSelector({
  areaSlug,
  areaName,
  beaches,
  current,
}: {
  areaSlug: string;
  areaName: string;
  beaches: readonly SelectableBeach[];
  /** The beach being shown, or null on the area's own page. */
  current: string | null;
}) {
  const router = useRouter();

  const areaHref = `/conditions/${areaSlug}`;
  const hrefFor = (slug: string) =>
    slug === "" ? areaHref : `${areaHref}/${slug}`;

  return (
    // No margin of its own, for the reason `AreaSelector` carries none: it sits
    // in the page's bar and the row owns the spacing. One carried here would be
    // counted twice.
    <div className="md:shrink-0">
      <label
        className="text-2xs mb-2 block font-extrabold tracking-widest text-ocean uppercase"
        htmlFor="beach"
      >
        Choose a beach
      </label>
      <select
        id="beach"
        name="beach"
        className={`rounded-pill ${TOUCH_TARGET} block w-full border-2 border-lavender bg-white px-5 py-3 text-base font-bold md:w-72`}
        defaultValue={current ?? ""}
        onChange={(event) => router.push(hrefFor(event.target.value))}
      >
        <option value="">All of {areaName}</option>
        {beaches.map((beach) => (
          <option key={beach.slug} value={beach.slug}>
            {beach.name}
          </option>
        ))}
      </select>

      <noscript>
        <ul className="leading-relaxed mt-4 text-base text-fog">
          <li>
            <a href={areaHref}>All of {areaName}</a>
          </li>
          {beaches.map((beach) => (
            <li key={beach.slug}>
              <a href={hrefFor(beach.slug)}>{beach.name}</a>
            </li>
          ))}
        </ul>
      </noscript>
    </div>
  );
}
