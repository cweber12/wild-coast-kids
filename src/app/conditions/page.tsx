import type { Metadata } from "next";
import { Suspense } from "react";
import { TidePanel } from "@/components/TidePanel";

export const metadata: Metadata = {
  title: "Conditions",
  description:
    "Real-time surf, tide, wind and visibility for San Diego's coast — built by a local, for families planning tidepool visits and hikes.",
};

/**
 * Fifteen minutes, and the reason is the calendar rather than the tide.
 *
 * The predictions themselves are cached for six hours in `lib/upstream.ts`,
 * because they are astronomical and do not change between requests. What changes
 * is which day it is: this page names *today's* lowest tide, and a page
 * prerendered yesterday would name yesterday's. Page revalidation and fetch
 * revalidation are separate caches, so re-rendering four times an hour costs no
 * upstream requests — NOAA is still asked four times a day.
 *
 * The cost is a window of up to fifteen minutes after local midnight where the
 * page still names the previous day. That is a bounded, stated error in the
 * quietest quarter-hour of the day for anyone planning a beach trip. Forcing the
 * route dynamic would remove it and would also, in this version of Next,
 * override every fetch to `no-store` and reach NOAA on every request.
 *
 * The value must be statically analyzable, so it is a literal: 900, not 15 * 60.
 */
export const revalidate = 900;

export default function Conditions() {
  return (
    <main className="flex-1">
      <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
        <p className="mb-7 text-2xs font-extrabold tracking-widest text-ocean uppercase">
          Surf · Tide · Wind · Visibility
        </p>
        <h1 className="text-title leading-display mb-4 font-black italic">
          Check <span className="text-ocean">conditions</span> first.
        </h1>
        <p className="leading-relaxed mb-9 max-w-130 text-base text-fog">
          Real-time surf, tide, wind and visibility for San Diego&apos;s coast —
          built by a local, for families planning tidepool visits and hikes.
          Know before you go.
        </p>
        {/*
          The slot this page used to carry is gone, because there is now something
          to put in its place. The landing-page teaser keeps its slot until the
          slice that fills it.
        */}
        <Suspense
          fallback={
            <p className="text-base text-fog">
              Reading today&apos;s tide from NOAA…
            </p>
          }
        >
          <TidePanel slug="la-jolla-shores" />
        </Suspense>
      </section>
    </main>
  );
}
