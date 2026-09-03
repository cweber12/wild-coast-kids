import Link from "next/link";
import { TOOL_REGION_HEADING } from "../ui/headingRank";
import { TOUCH_TARGET } from "../ui/touchTarget";

/**
 * The beaches in one area, as links.
 *
 * The chooser offers areas now, so this is how a reader reaches one beach. It
 * is a region of the page and takes `TOOL_REGION_HEADING`, which is ADR-0014's
 * rank as that decision's 2026-09-02 amendment sizes it for this tool.
 *
 * **It is a list and not a picture, and that is measured rather than
 * preferred.** The area map will mark these places, but it cannot be the
 * control that picks between them: four of La Jolla's ten fall within 549 m of
 * one another, 6.7 units of the map's hundred, and giving each of those four a
 * 44px target under ADR-0004 would need the map 2,634px wide. So the marks
 * orient and this list selects. See ADR-0047 and
 * `docs/plans/areas-over-locations.md`.
 *
 * **Ordered north to south**, which is `areas.json`'s own order and the order
 * the whole inventory is in, so the list reads down the coast.
 *
 * The current beach is marked with `aria-current` rather than removed from the
 * list: a list that drops its own entry changes length as you move through it,
 * and the reader loses the place they are comparing from.
 */
export function AreaBeaches({
  areaSlug,
  areaName,
  beaches,
  current,
}: {
  areaSlug: string;
  areaName: string;
  beaches: readonly { slug: string; name: string }[];
  /** The beach being shown, or null on the area's own page. */
  current: string | null;
}) {
  return (
    <section aria-labelledby="area-beaches-heading">
      <h2 id="area-beaches-heading" className={TOOL_REGION_HEADING}>
        {beaches.length === 1 ? "The beach" : "Beaches"} in {areaName}
      </h2>

      <ul className="flex flex-wrap gap-x-6 gap-y-1">
        {beaches.map((beach) => (
          <li key={beach.slug}>
            <Link
              href={`/conditions/${areaSlug}/${beach.slug}`}
              className={`${TOUCH_TARGET} inline-flex items-center text-base ${
                beach.slug === current
                  ? "font-bold text-ocean"
                  : "text-fog underline underline-offset-4"
              }`}
              aria-current={beach.slug === current ? "page" : undefined}
            >
              {beach.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
