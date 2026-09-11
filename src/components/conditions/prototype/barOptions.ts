/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * The two option lists the top bar's controls need. Data, not layout, so all
 * three bar variants share it and disagree only about arrangement.
 *
 * **The beach control changes scope, not just focus.** Choosing a beach
 * navigates to `/conditions/<area>/<beach>`, where `ConditionsSection` passes
 * no `AreaScope` — so nothing is withheld and the week and day draw every row.
 * That is a real consequence: the "no one figure for the whole area"
 * sentences, which were ruled out of scope as a *layout* question, stop
 * appearing the moment a reader uses this control. Worth knowing when judging
 * the bar, because it makes the bar partly an answer to a problem we agreed
 * not to solve here.
 *
 * The empty value is the area itself, kept first so the control opens on what
 * the page is currently showing.
 */

import type { PrototypeData } from "./data";
import type { BarOption } from "./BarSelect";

export function areaOptions(data: PrototypeData): BarOption[] {
  return data.areas.map((area) => ({
    value: area.slug,
    label: area.name,
    href: `/conditions/${area.slug}`,
  }));
}

export function beachOptions(
  data: PrototypeData,
  areaSlug: string,
): BarOption[] {
  return [
    {
      value: "",
      label: `All of ${data.group.area.name}`,
      href: `/conditions/${areaSlug}`,
    },
    ...data.group.beaches.map((beach) => ({
      value: beach.slug,
      label: beach.name,
      href: `/conditions/${areaSlug}/${beach.slug}`,
    })),
  ];
}
