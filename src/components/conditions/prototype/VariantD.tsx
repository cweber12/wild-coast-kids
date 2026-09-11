/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * VARIANT D — ONE-ROW TOOLBAR.
 *
 * Scope and now on a single line, closed by a rule: a small "Conditions"
 * wordmark, the two selects, the readings, and the judgement at the end. The
 * page then opens directly on the week.
 *
 * This is the "shorten the headline" option rather than the "omit it" one —
 * `--text-tool-region` instead of `--text-tool-title`, which is 17–22px where
 * the old headline was 24–36px across three words and a full line of its own.
 *
 * The beach list is gone from the page body in all three bar variants: a
 * `select` of ten beaches and a wrapped row of ten links are the same control
 * twice, and the bar is the one a reader can reach without scrolling.
 */

import { Suspense } from "react";
import { inventoryCaveats, inventoryReach } from "@/lib/beaches";
import { ConditionsNotes } from "../ConditionsNotes";
import { DayPanel } from "../DayPanel";
import { RipLevel } from "../RipLevel";
import { WeekPanel } from "../WeekPanel";
import { BareReadout } from "./BareReadout";
import { BarSelect } from "./BarSelect";
import { areaOptions, beachOptions } from "./barOptions";
import {
  BAND_FALLBACK,
  DAY_FALLBACK,
  prototypeData,
  RIP_FALLBACK,
  STANDING_NOTICE,
  WEEK_FALLBACK,
} from "./data";
import { QUIET_PROSE } from "./quiet";

export function VariantD({
  areaSlug,
  beachSlug,
}: {
  areaSlug: string;
  beachSlug: string | null;
}) {
  const data = prototypeData(areaSlug, beachSlug);
  const { reading, scope, bulletin } = data;

  return (
    <section className="proto-quiet px-gutter-sm py-section-sm md:px-gutter md:py-section">
      <style>{QUIET_PROSE}</style>

      <div className="mb-8 border-b border-lavender pb-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <h1 className="text-tool-region leading-display font-black italic">
            <span className="text-ocean">Conditions</span>
          </h1>

          <BarSelect
            id="area"
            label="Area"
            options={areaOptions(data)}
            current={areaSlug}
          />
          <BarSelect
            id="beach"
            label="Beach"
            options={beachOptions(data, areaSlug)}
            current={beachSlug ?? ""}
          />

          {/*
            Pushed to the end of the row only where there is width for it. The
            readings are the thing the bar is for, so below `lg` they wrap onto
            their own line rather than compressing the controls.
          */}
          <div className="lg:ml-auto">
            <Suspense
              fallback={<p className="text-base text-fog">{BAND_FALLBACK}</p>}
            >
              <BareReadout slug={reading} area={scope} shape="inline" />
            </Suspense>
          </div>

          <div className="border-l border-lavender pl-6">
            <Suspense
              fallback={<p className="text-base text-fog">{RIP_FALLBACK}</p>}
            >
              <RipLevel slug={bulletin} />
            </Suspense>
          </div>
        </div>

        <p className="leading-relaxed mt-4 text-2xs text-fog">
          {STANDING_NOTICE}
        </p>
      </div>

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
