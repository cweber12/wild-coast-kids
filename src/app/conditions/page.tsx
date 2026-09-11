import type { Metadata } from "next";
import { ConditionsVariants } from "@/components/conditions/prototype/ConditionsVariants";
import { DEFAULT_AREA_SLUG, defaultArea } from "@/lib/areas";

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
 * `[area]/page.tsx` and `[area]/[beach]/page.tsx` carry the same number for the
 * same reason, and all three must agree: they render one section, and which URL
 * a reader arrived at should not decide how fresh their answer is.
 */
export const revalidate = 900;

export default async function Conditions({
  searchParams,
}: {
  // Optional only so the existing tests can still call this with no props.
  // The real signature Next passes is always present.
  searchParams?: Promise<{ variant?: string }>;
}) {
  // Asserts the named default is still in areas.json, which is written by hand.
  // A rename there should stop a build rather than render a page about nothing.
  // It opened on a beach until 2026-09-02; the tool is about areas now, so the
  // door it opens is an area's.
  defaultArea();

  // PROTOTYPE SEAM — throwaway. `?variant=` picks a layout and `now` is the
  // page as it ships. Reverting this file and deleting `prototype/` removes
  // the whole experiment. See components/conditions/prototype/NOTES.md.
  const { variant } = (await searchParams) ?? {};

  return (
    <main className="flex-1">
      <ConditionsVariants
        variant={variant}
        areaSlug={DEFAULT_AREA_SLUG}
        beachSlug={null}
      />
    </main>
  );
}
