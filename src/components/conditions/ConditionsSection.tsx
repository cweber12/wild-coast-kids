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
import { DayPanel } from "./DayPanel";
import { SelectedDayProvider } from "./selectedDay";
import { WeekPanel } from "./WeekPanel";

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
        THE PAGE OPENS ON THE WEEK, AND THE READINGS ARE INSIDE THE DAY.

        A band of three cards stood here: today's lowest tide, the buoy, the
        air station. It was the right answer while it was the only answer --
        a parent weighing a tide time against a wave height had them three
        screens apart before it, and could not see both at once. What made it
        wrong is what landed under it. The week grid prints today's lowest
        daylight tide in its first column and the day chart draws the whole
        tide, the whole swell and the cell's own wind and temperature, so the
        band and the two regions below it said the same things in two
        registers -- which is the redundancy this brief exists to remove.

        The two measurements that were not duplicated moved rather than went.
        `MeasuredToday` carries them inside the day panel, under the chart, on
        today alone, because the buoy and the shore station are the only
        instruments this site reports and today is the only day anybody took a
        reading of. The other six days say so in a sentence.

        Nothing that was on this page is off it. The tide's daylight low is in
        the week's today column; its overnight low and CDIP's biggest-all-day
        are the dips in the curves the chart draws, which is what the brief
        asked those curves to be for.
      */}
      {/*
        The week and the day are one instrument at two zoom levels, and from
        here on they share a fact: which day is being shown. It is a client
        fact, so it lives in a provider wrapping both -- and both regions are
        still server components, passed through as children, so the reads
        happen exactly where they did and each region keeps its own suspense
        boundary. Five agencies go quiet independently and none may hold up
        another; a shared choice does not change that.
      */}
      <SelectedDayProvider>
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
        The day opens under the week. Its own suspense boundary for the same
        reason every region here has one: this is a second request to the
        National Weather Service — the words, where the week's cloud row reads
        the numbers — and the two fail apart. A quiet forecast endpoint must
        cost this region and not the grid above it.

        The loading line is "Reading the sky in words", which is the same
        phrase the provenance line under the result uses, so the two states of
        this region name the same thing. It got there the hard way: CONTEXT.md's
        `Conditions` entry ends `_Avoid_: weather, forecast, surf report`, and
        the test guarding that refused two earlier wordings — one for
        "forecast", and one for naming the National Weather Service, whose own
        name contains the first banned word.

        It is not the only loading line in this region any more. `DayPanel`
        holds a second boundary of its own around the measured block, whose
        line says "the buoy and the air station" and dodges the same edge the
        same way. The check that catches this cannot see it from here, because
        this file's tests mock `DayPanel` — so it is asserted in that panel's
        own tests instead.
      */}
        <div className="mb-9">
          <Suspense
            fallback={
              <p className="text-base text-fog">Reading the sky in words…</p>
            }
          >
            <DayPanel slug={slug} />
          </Suspense>
        </div>
      </SelectedDayProvider>

      {/*
        One block for everything true of every reading — the datum, what a buoy
        measures, why the sky comes from an airport — plus the caveats, which it
        renders. The three panels above carry only their own attribution now.
      */}
      <ConditionsNotes entries={inventoryCaveats()} reach={inventoryReach()} />
    </section>
  );
}
