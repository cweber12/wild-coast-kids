/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * VARIANT A — ANSWER RAIL.
 *
 * Two columns for the whole page rather than only the header. A sticky rail
 * holds everything answering *now* — scope, the relayed judgement, the
 * instruments — and the flow column holds the time axis. The thesis is that a
 * 1536×639 window is 2.4:1 and every vertical stack spends the axis that is
 * scarce to save the one that is abundant. No surveyed product does this;
 * they are all designed phone-first for tall screens.
 *
 * **The rail is `w-72` (288px) on purpose.** Tailwind breakpoints resolve
 * against the viewport, not the container, so `xl:grid-cols-7` still applies
 * to the week grid inside this narrower column. 1440 − 288 − 32 leaves 1120px,
 * so cells land near 160px — just above the 158.8px the grid's own source
 * records as the tightest it ever is. A wider rail silently drops the
 * sparkline, which looks like a bug rather than a trade.
 *
 * `lg:min-w-0` on the flow column is load-bearing: without it a flex child
 * containing a grid refuses to shrink below its content.
 */

import { Suspense } from "react";
import { inventoryCaveats, inventoryReach } from "@/lib/beaches";
import { AreaBeaches } from "../AreaBeaches";
import { AreaSelector } from "../AreaSelector";
import { ConditionsNotes } from "../ConditionsNotes";
import { DayPanel } from "../DayPanel";
import { MeasuredPanel } from "../MeasuredPanel";
import { RipLevel } from "../RipLevel";
import { WeekPanel } from "../WeekPanel";
import {
  BAND_FALLBACK,
  DAY_FALLBACK,
  prototypeData,
  RIP_FALLBACK,
  STANDING_NOTICE,
  WEEK_FALLBACK,
} from "./data";
import { QUIET_PROSE } from "./quiet";

export function VariantA({
  areaSlug,
  beachSlug,
  quiet = false,
}: {
  areaSlug: string;
  beachSlug: string | null;
  /** Also apply variant C's prose treatment, to test the two together. */
  quiet?: boolean;
}) {
  const { areas, group, reading, scope, bulletin } = prototypeData(
    areaSlug,
    beachSlug,
  );

  return (
    <section
      className={`px-gutter-sm py-section-sm md:px-gutter md:py-section${quiet ? " proto-quiet" : ""}`}
    >
      {quiet && <style>{QUIET_PROSE}</style>}
      <div className="lg:flex lg:items-start lg:gap-8">
        {/*
          THE RAIL: everything true right now, plus the control that says what
          "here" means. Sticky so the scope stays readable once the week has
          scrolled the heading away — scroll-capped rather than fixed, because
          at 200% zoom a fixed rail can exceed the viewport with no way out.
        */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:w-72 lg:shrink-0 lg:overflow-y-auto">
          <h1 className="text-tool-title leading-display mb-2 font-black italic">
            Check <span className="text-ocean">conditions</span> first.
          </h1>

          {/*
            The area's name in the heading block rather than only inside the
            select: scope has to stay readable when the control is scrolled
            past, and in this variant it can be.
          */}
          <p className="mb-5 text-base font-bold tracking-wide uppercase">
            {group.area.name}
          </p>

          <AreaSelector areas={areas} current={areaSlug} />

          {/* The one line that answers whether the kids can go in the water. */}
          <div className="mt-7">
            <Suspense
              fallback={<p className="text-base text-fog">{RIP_FALLBACK}</p>}
            >
              <RipLevel slug={bulletin} />
            </Suspense>
          </div>

          {/* And the instruments, as the evidence under the judgement. */}
          <div className="mt-7">
            <Suspense
              fallback={<p className="text-base text-fog">{BAND_FALLBACK}</p>}
            >
              <MeasuredPanel slug={reading} area={scope} />
            </Suspense>
          </div>

          {group.beaches.length > 1 && (
            <div className="mt-7">
              <AreaBeaches
                areaSlug={group.area.slug}
                areaName={group.area.name}
                beaches={group.beaches.map((beach) => ({
                  slug: beach.slug,
                  name: beach.name,
                }))}
                current={beachSlug}
              />
            </div>
          )}

          <p className="leading-relaxed mt-7 text-sm text-fog">
            {STANDING_NOTICE}
          </p>
        </div>

        {/*
          THE FLOW COLUMN: the time axis, at its two zoom levels, and the notes
          that are true of all of it.
        */}
        <div className="mt-10 lg:mt-0 lg:min-w-0 lg:flex-1">
          <Suspense
            fallback={<p className="text-base text-fog">{WEEK_FALLBACK}</p>}
          >
            <WeekPanel slug={reading} area={scope} />
          </Suspense>

          <div className="mt-9">
            <Suspense
              fallback={<p className="text-base text-fog">{DAY_FALLBACK}</p>}
            >
              <DayPanel slug={reading} area={scope} />
            </Suspense>
          </div>

          <div className="mt-9">
            <ConditionsNotes
              entries={inventoryCaveats()}
              reach={inventoryReach()}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
