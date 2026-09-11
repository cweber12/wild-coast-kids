/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * VARIANT E — TWO-TIER INSTRUMENT READOUT.
 *
 * The bar is two rows: controls and the judgement on the first, the readings
 * as labelled columns on the second. This is the "omit the headline
 * completely" option, and the most deliberately instrument-like of the three
 * — each source gets a micro-label above its figures, rules separate them,
 * and the provenance runs under the whole readout rather than inside a slab.
 *
 * **The `<h1>` is still here, visually hidden.** Omitting the headline is a
 * visual decision; omitting the heading is an accessibility regression. A page
 * with no level-one heading gives a screen-reader user nothing to land on and
 * breaks the heading outline every other region on this page hangs off. `sr
 * -only` costs no pixels and keeps the document honest.
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

export function VariantE({
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

      <h1 className="sr-only">Conditions</h1>

      <div className="mb-8 border-b border-lavender pb-5">
        {/* Tier one: what place, and the one relayed judgement about it. */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
          </div>

          <Suspense
            fallback={<p className="text-base text-fog">{RIP_FALLBACK}</p>}
          >
            <RipLevel slug={bulletin} />
          </Suspense>
        </div>

        {/* Tier two: what the instruments read, given room to be columns. */}
        <Suspense
          fallback={<p className="text-base text-fog">{BAND_FALLBACK}</p>}
        >
          <BareReadout slug={reading} area={scope} shape="columns" />
        </Suspense>

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
