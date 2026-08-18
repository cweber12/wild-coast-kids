/**
 * The conditions view: the same section whether it is reached at /conditions or
 * at /conditions/<beach>.
 *
 * It exists so the two routes cannot drift apart. The default route is the
 * inventory's first entry that has a station, so the page always opens on
 * something that can answer rather than on whichever beach happens to sort
 * first.
 */

import { Suspense } from "react";
import { beachesByRegion, inventoryCaveats } from "@/lib/beaches";
import { BeachSelector } from "./BeachSelector";
import { Caveats } from "./Caveats";
import { TidePanel } from "./TidePanel";
import { WavePanel } from "./WavePanel";
import { WindPanel } from "./WindPanel";

export function ConditionsSection({ slug }: { slug: string }) {
  const groups = beachesByRegion().map((group) => ({
    region: group.region,
    beaches: group.beaches.map((beach) => ({
      slug: beach.slug,
      name: beach.name,
    })),
  }));

  return (
    <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
      <p className="mb-7 text-2xs font-extrabold tracking-widest text-ocean uppercase">
        Surf · Tide · Wind · Visibility
      </p>
      <h1 className="text-title leading-display mb-4 font-black italic">
        Check <span className="text-ocean">conditions</span> first.
      </h1>
      <p className="leading-relaxed mb-9 max-w-130 text-base text-fog">
        Real-time surf, tide, wind and visibility for San Diego&apos;s coast —
        built by a local, for families planning tidepool visits and hikes. Know
        before you go.
      </p>

      <BeachSelector groups={groups} current={slug} />

      <Suspense
        fallback={
          <p className="text-base text-fog">
            Reading today&apos;s tide from NOAA…
          </p>
        }
      >
        <TidePanel slug={slug} />
      </Suspense>

      {/*
        Its own boundary, so a slow buoy cannot hold up the tide time. The two
        readings come from different agencies and fail independently.
      */}
      <Suspense
        fallback={<p className="mt-9 text-base text-fog">Reading the buoy…</p>}
      >
        <WavePanel slug={slug} />
      </Suspense>

      {/*
        Its own boundary again. Three agencies, three failure modes: NOAA's tide
        service, NDBC's buoys and the National Weather Service's stations all go
        quiet independently, and none of them should hold up the other two.
      */}
      <Suspense
        fallback={
          <p className="mt-9 text-base text-fog">
            Reading the weather station…
          </p>
        }
      >
        <WindPanel slug={slug} />
      </Suspense>

      <Caveats entries={inventoryCaveats()} />
    </section>
  );
}
