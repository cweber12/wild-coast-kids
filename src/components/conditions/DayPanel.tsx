/**
 * The day's own region, below the week.
 *
 * The seam between the network and the markup, and deliberately thin, like the
 * three panels beside it: read, render. Everything with a judgement in it sits
 * on one side or the other, where it can be tested without a network.
 *
 * **It shows today and only today, for now.** The week above becomes the day
 * selector in a later slice of this same pull request; until then the panel is
 * the day a reader is standing in, which is the day it opens on afterwards
 * anyway. That ordering is deliberate rather than incidental -- the panel has
 * to be worth looking at before it is worth switching, and a selector wired to
 * a region nobody has reviewed is two unreviewed things at once.
 *
 * **Which day is today comes from the daylight read, and no clock is read
 * here.** A component that called `Date.now()` would be reading a clock during
 * render, which is impure and which this repo's lint rules refuse -- correctly,
 * and it caught the first version of this file. `readDaylightWeek` is computed
 * from the beach's own coordinates rather than fetched, so it cannot fail and
 * costs no request; `WeekPanel` takes its columns from the same read for the
 * same reason, so the two regions cannot disagree about which day is Tuesday.
 *
 * **What lands here next**, in order: the hourly chart, its four tabs, and
 * today's measured block. The heading and the sky wording are what the region
 * needs to exist at all -- a reader must be told which day they are reading
 * before they are shown anything about it.
 */

import { readDaylightWeek, readSkyWording } from "@/lib/conditions";
import { REGION_HEADING } from "./headingRank";
import { SkyWording } from "./SkyWording";

export async function DayPanel({ slug }: { slug: string }) {
  const daylight = readDaylightWeek(slug);
  const wording = await readSkyWording(slug);

  // `weekOfDays` builds its array from today outward, so the first entry is
  // today by construction. Taking it from the wording read instead would not
  // work: that one is ragged, and drops any day the forecast has not reached.
  const today = daylight.days[0].localDate;

  return (
    <section aria-labelledby="day-panel-heading">
      {/*
        "Today" and not "Today, hour by hour", which is what this will be once
        the chart lands. A heading that names content the region does not have
        yet is the page promising more than it delivers, which is the same
        failure a reserved slot exists to avoid -- and unlike a reserved slot it
        would not be labelled as a promise.
      */}
      <h2 id="day-panel-heading" className={REGION_HEADING}>
        Today
      </h2>
      <SkyWording view={wording} localDate={today} />
    </section>
  );
}
