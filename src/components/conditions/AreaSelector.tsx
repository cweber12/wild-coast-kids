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
  /**
   * Where choosing this area goes: its default beach's URL when one is named,
   * otherwise its own. Composed by the section from `openingConditionsPath`,
   * so this control navigates and does not decide.
   */
  href: string;
}

export function AreaSelector({
  areas,
  current,
}: {
  areas: readonly SelectableArea[];
  current: string;
}) {
  const router = useRouter();

  // The value a `<select>` reports is one of the options this control drew, so
  // the lookup cannot miss; the fallback is the area's own URL rather than a
  // silent no-op, because a chooser that does nothing is the failure the
  // `noscript` list below exists to prevent.
  const hrefOf = (slug: string) =>
    areas.find((area) => area.slug === slug)?.href ?? `/conditions/${slug}`;

  /*
    THE VISIBLE LABEL IS SHORT AND THE ACCESSIBLE NAME IS NOT.

    Both belong to the bar's width budget. At `--text-2xs` with
    `tracking-widest`, "CHOOSE AN AREA" and "CHOOSE A BEACH" run about 95px
    each; "AREA" and "BEACH" run about 40px. The row carries a wordmark, two
    controls, the readings and the judgement, and at the review viewport the
    long pair puts it past 1440px and wraps it into two rows -- which is the one
    thing a one-row bar cannot afford.

    So the visible label shortens and `aria-label` keeps the sentence. It is not
    a label/name mismatch: WCAG 2.5.3 asks that the accessible name contain the
    visible text, and "Choose an area" contains "Area". Speech still says the
    sentence; sight still sees a label obviously belonging to the control.
  */
  return (
    // No margin of its own: it sits in the page header's flex row, and the row
    // owns the spacing. Carrying one here would be counted twice.
    //
    // `contents`, so the control group and the fallback list are both items
    // of that row rather than of a box of their own. The list used to sit
    // inside the group, and without a script it rendered as an 18-link column
    // with the label and the dead select centred against it, because the
    // group is `items-center`. Rendered and seen on 2026-09-17. The list is
    // `w-full` so it wraps to a row of its own under the controls; with a
    // script it is not rendered at all and the row is what it always was.
    <div className="contents">
      <div className="flex w-full items-center gap-2 md:w-auto md:shrink-0">
        <label
          className="text-2xs font-extrabold tracking-widest text-ocean uppercase"
          htmlFor="area"
        >
          Area
        </label>
        {/*
          `TOUCH_TARGET` rather than a bare py-3: it is the site's 44px floor
          below md (ADR-0004), and this is the one control in the page header. A
          value that happens to be right is not the same as one that stays right.
        */}
        <select
          id="area"
          name="area"
          aria-label="Choose an area"
          className={`rounded-pill ${TOUCH_TARGET} w-full border-2 border-lavender bg-white px-4 py-2 text-base font-bold md:w-auto`}
          defaultValue={current}
          onChange={(event) => router.push(hrefOf(event.target.value))}
        >
          {areas.map((area) => (
            <option key={area.slug} value={area.slug}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <noscript>
        <ul className="leading-relaxed w-full text-base text-fog">
          {areas.map((area) => (
            <li key={area.slug}>
              <a href={area.href}>{area.name}</a>
            </li>
          ))}
        </ul>
      </noscript>
    </div>
  );
}
