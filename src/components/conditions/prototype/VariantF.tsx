/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * VARIANT F — STICKY CONDENSED BAR.
 *
 * D's single row, no headline at all, and stuck to the top of the viewport.
 * The claim under test is that scope is worth its pixels *permanently*: this
 * page's figures are meaningless without knowing which place they describe,
 * and once the week has scrolled the bar away the reader is looking at numbers
 * with no label. Every other variant answers that by putting the name back at
 * the top; this one answers it by never letting it leave.
 *
 * **It offsets by the nav's own height, and the first draft did not.** ADR-0003
 * makes the nav `sticky`, not `fixed` -- which means it occupies its own space
 * so no page has to pad for it, but it still pins to the top when scrolled. A
 * bar at `top-0` therefore slides *under* it: at `scrollY` 900 only the
 * provenance line and the judgement were left showing, with the controls and
 * the figures clipped away. `top-nav-sm md:top-nav` are the tokens the nav
 * sets its own `min-h` from, so the two cannot drift apart.
 *
 * **The cost is the honest thing to watch for**: a persistent bar spends its
 * height on every screen rather than only the first, and on a 639px window
 * that is a standing tax. It also collides with zoom — at 200% a bar that
 * wrapped to three rows can eat most of the viewport, which is why it wraps
 * rather than scrolls and carries no `max-height` trickery.
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

export function VariantF({
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

      <div className="top-nav-sm md:top-nav sticky z-30 mb-8 border-b border-lavender bg-cream py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
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
      </div>

      {/*
        The notice leaves the bar here — a sticky element repeating a
        disclaimer on every screen is nagging rather than informing, and it has
        nothing to do with the scope the bar exists to hold.
      */}
      <p className="leading-relaxed mb-8 text-2xs text-fog">
        {STANDING_NOTICE}
      </p>

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
