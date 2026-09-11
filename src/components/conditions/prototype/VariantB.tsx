/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * VARIANT B — WEEK-FIRST SPINE.
 *
 * The page answers "which day should we go" before it answers anything else.
 * The header row dissolves to a single compressed line so the week grid starts
 * high enough to be wholly visible, and "now" stops being a region of its own:
 * the measured readings and the relayed judgement become strips bracketing the
 * grid, so the three read as one continuous time region at decreasing zoom.
 *
 * **What is approximated, and it matters when reading the result.** The
 * research variant folds the measured figures into *today's column of the
 * grid*, overlaying the observation on the modelled bar the way Surfline's
 * April 2025 "Observation Clarity" release does. That needs surgery inside
 * `WeekGrid`, which is past a prototype's budget — so this tests the
 * structural half of the claim (header dissolved, one time region, week above
 * the fold) and not the cell merge. If this variant wins, the merge is the
 * first thing to build for real, because it is what would keep ADR-0056's
 * measured/modelled boundary visible.
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

export function VariantB({
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
    <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
      {/*
        ONE LINE OF HEADER. The title carries the scope, the chooser sits at
        the end of the same line, and the notice drops to a single small line
        beneath. Everything the old header row spent on a three-column
        arrangement is returned to the grid below.
      */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h1 className="text-tool-title leading-display font-black italic">
          Check <span className="text-ocean">conditions</span> first.{" "}
          <span className="font-bold not-italic text-fog">
            {group.area.name}
          </span>
        </h1>

        <div className="w-72 shrink-0">
          <AreaSelector areas={areas} current={areaSlug} />
        </div>
      </div>

      <p className="leading-relaxed mb-7 text-sm text-fog">{STANDING_NOTICE}</p>

      {/*
        THE TIME REGION. Proximity does the grouping: tight gaps inside, a wide
        one after, so the now-strip, the week and the judgement read as one
        object rather than three stacked slabs.
      */}
      <div className="space-y-4">
        <Suspense
          fallback={<p className="text-base text-fog">{BAND_FALLBACK}</p>}
        >
          <MeasuredPanel slug={reading} area={scope} />
        </Suspense>

        <Suspense
          fallback={<p className="text-base text-fog">{WEEK_FALLBACK}</p>}
        >
          <WeekPanel slug={reading} area={scope} />
        </Suspense>

        {/*
          The judgement is a per-day product, so on a page organised by day it
          belongs on the day axis. Under the grid rather than in it, for the
          same budget reason the band is above rather than inside.
        */}
        <div className="rounded-box bg-mist p-5">
          <Suspense
            fallback={<p className="text-base text-fog">{RIP_FALLBACK}</p>}
          >
            <RipLevel slug={bulletin} />
          </Suspense>
        </div>
      </div>

      {/*
        The chosen day, opened by the week above it. The beach list comes with
        it rather than sitting above the readings: picking a beach is a
        refinement of a chosen day, not a precondition for seeing the week.
      */}
      <div className="mt-12">
        <Suspense
          fallback={<p className="text-base text-fog">{DAY_FALLBACK}</p>}
        >
          <DayPanel slug={reading} area={scope} />
        </Suspense>
      </div>

      {group.beaches.length > 1 && (
        <div className="mt-9">
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

      <div className="mt-9">
        <ConditionsNotes
          entries={inventoryCaveats()}
          reach={inventoryReach()}
        />
      </div>
    </section>
  );
}
