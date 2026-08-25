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
import {
  beachesByRegion,
  inventoryCaveats,
  inventoryReach,
} from "@/lib/beaches";
import { BeachSelector } from "./BeachSelector";
import { ConditionsNotes } from "./ConditionsNotes";
import { ReservedSlot } from "./ReservedSlot";
import { TidePanel } from "./TidePanel";
import { WavePanel } from "./WavePanel";
import { WeekPanel } from "./WeekPanel";
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
      {/*
        The chooser sits beside the title rather than under the lead paragraph,
        and the move is worth about 103px of the first screen — enough to decide
        whether the readings land above the fold on a 639px window or below it.

        It is also where the control belongs. It decides what every figure on
        the page means, and it was the fourth element down, under a paragraph,
        with a 13px label. Bottom-aligned so the two columns finish on the same
        line; stacked below `md`, where there is no width to share.
      */}
      <div className="mb-9 md:flex md:items-end md:justify-between md:gap-10">
        <div>
          <p className="mb-5 text-2xs font-extrabold tracking-widest text-ocean uppercase">
            Surf · Tide · Wind · Visibility
          </p>
          <h1 className="text-title leading-display mb-4 font-black italic">
            Check <span className="text-ocean">conditions</span> first.
          </h1>
          <p className="leading-relaxed max-w-130 text-base text-fog">
            Real-time surf, tide, wind and visibility for San Diego&apos;s coast
            — built by a local, for families planning tidepool visits and hikes.
            Know before you go.
          </p>
        </div>

        {/*
          The standing notice ADR-0009 turns on: that decision rejects an embed
          partly because "the host page is asserting something it does not
          control", and this sentence is the assertion. It said less than this
          and sat fourth of four at the bottom of a 2171px page until now.

          Here rather than in a band of its own above the readings, and the
          reason is measured. The row is `md:items-end`, so this column is
          bottom-aligned to a taller one and 85px sat empty in it; the notice
          fills waste and costs the first screen 25px, where a band above the
          readings cost 63px and put the air card's second attribution below
          the fold. ADR-0010 turns on those two distances being comparable at a
          glance. See the 2026-08-25 addendum in docs/plans/conditions-tool.md
          for the three placements and their numbers.

          Above the chooser, not below it, so it is read before the control
          rather than as a footnote to it.
        */}
        <div className="mt-7 md:mt-0 md:w-72">
          <p className="leading-relaxed mb-4 text-base text-fog">
            These are readings from public instruments, not a safety assessment.
            Lifeguards and the signs posted at the beach are the authority on
            the day.
          </p>
          <BeachSelector groups={groups} current={slug} />
        </div>
      </div>

      {/*
        The now-band: what the beach is doing at this moment, three readings
        across. This is what the page was missing rather than a way of filling
        space — a parent weighing a tide time against a wave height had them
        three screens apart in reading order, and could not see both at once.

        Each keeps its own suspense boundary inside the grid. Three agencies go
        quiet independently and none may hold up the other two; making the grid
        the boundary instead would have traded that away for one line of markup.

        Two columns from `sm` rather than three: below `lg` three cards leave the
        stat labels wrapping, and a wrapped 10px uppercase label is harder to
        read than a card further down the page.
      */}
      <div className="mb-9 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Suspense
          fallback={
            <p className="text-base text-fog">
              Reading today&apos;s tide from NOAA…
            </p>
          }
        >
          <TidePanel slug={slug} />
        </Suspense>

        <Suspense
          fallback={<p className="text-base text-fog">Reading the buoy…</p>}
        >
          <WavePanel slug={slug} />
        </Suspense>

        {/*
          The fallback names one station where the panel reads two, which is
          issue #94 and not this slice's to fix.
        */}
        <Suspense
          fallback={
            <p className="text-base text-fog">Reading the weather station…</p>
          }
        >
          <WindPanel slug={slug} />
        </Suspense>
      </div>

      {/*
        The page turns from now to planning. The week reads from the same NOAA
        request the tide card above already makes — one URL, one call — so it
        gets its own suspense boundary for the same reason the three cards do
        rather than because it costs a second fetch.
      */}
      <div className="mb-9">
        <Suspense
          fallback={
            <p className="text-base text-fog">Reading the week from NOAA…</p>
          }
        >
          <WeekPanel slug={slug} />
        </Suspense>
      </div>

      {/*
        The sighting map is specified in #121 and deferred, so the page says
        what lands here rather than being silent about it — the standing use of
        a reserved slot in this repo. It comes out in the slice that fills it,
        because a slot removed early leaves the page promising less than it did.

        Sized into the space the map will occupy, so the layout around it is
        designed rather than discovered when the map arrives.
      */}
      <div className="mb-9">
        <ReservedSlot
          emoji="🗺️"
          headline="A map of what people have found here is coming."
          detail="Will show octopus, nudibranchs, sea hares and leopard sharks logged near this beach in the past week — reported by naturalists, not surveyed by us."
        />
      </div>

      {/*
        One block for everything true of every reading — the datum, what a buoy
        measures, why the sky comes from an airport — plus the caveats, which it
        renders. The three panels above carry only their own attribution now.
      */}
      <ConditionsNotes entries={inventoryCaveats()} reach={inventoryReach()} />
    </section>
  );
}
