/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * VARIANT C — ONE GRID, QUIET PROSE.
 *
 * Keeps the region order it has and attacks the two things that make the page
 * look unlaid-out: it puts every region on one twelve-column grid so nothing
 * is a lonely 520px column in a 1440px field, and it drops the explanatory
 * prose a register so the figures outrank the sentences about the figures.
 *
 * **The quieting is done with a scoped rule rather than by editing the
 * panels**, because the sentences it targets are rendered inside `WeekGrid`
 * and `DayPanel` from `withheldWords`, and reaching in to change them is the
 * real work this prototype exists to decide on. The selector matches the
 * paragraphs that lead a region — which is exactly where the "no one figure
 * for the whole area" lines land. It is a prototype's shortcut and would be a
 * prop in the real thing.
 *
 * Quieted, not hidden: the sentences are the honest part of the page and
 * ADR-0055 puts them where the absence is. The claim under test is only that
 * they should not outweigh what the page *can* say.
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

export function VariantC({
  areaSlug,
  beachSlug,
}: {
  areaSlug: string;
  beachSlug: string | null;
}) {
  const { areas, group, reading, scope, bulletin } = prototypeData(
    areaSlug,
    beachSlug,
  );

  return (
    <section className="proto-quiet px-gutter-sm py-section-sm md:px-gutter md:py-section">
      <style>{QUIET_PROSE}</style>

      {/*
        THE GRID, DECLARED ONCE. Five columns of title, four of instruments,
        three of control — and every region below spans all twelve, so the page
        has one measure instead of four.
      */}
      <div className="mb-9 lg:grid lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="lg:col-span-5">
          <h1 className="text-tool-title leading-display mb-3 font-black italic">
            Check <span className="text-ocean">conditions</span> first.
          </h1>
          <p className="leading-relaxed text-sm text-fog">{STANDING_NOTICE}</p>
        </div>

        <div className="mt-6 lg:col-span-4 lg:mt-0">
          <Suspense
            fallback={<p className="text-base text-fog">{BAND_FALLBACK}</p>}
          >
            <MeasuredPanel slug={reading} area={scope} />
          </Suspense>
        </div>

        <div className="mt-6 lg:col-span-3 lg:mt-0">
          <AreaSelector areas={areas} current={areaSlug} />
          <div className="mt-4">
            <Suspense
              fallback={<p className="text-base text-fog">{RIP_FALLBACK}</p>}
            >
              <RipLevel slug={bulletin} />
            </Suspense>
          </div>
        </div>
      </div>

      {group.beaches.length > 1 && (
        <div className="mb-9">
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

      <div className="mb-9">
        <Suspense
          fallback={<p className="text-base text-fog">{WEEK_FALLBACK}</p>}
        >
          <WeekPanel slug={reading} area={scope} />
        </Suspense>
      </div>

      <div className="mb-9">
        <Suspense
          fallback={<p className="text-base text-fog">{DAY_FALLBACK}</p>}
        >
          <DayPanel slug={reading} area={scope} />
        </Suspense>
      </div>

      <ConditionsNotes entries={inventoryCaveats()} reach={inventoryReach()} />
    </section>
  );
}
