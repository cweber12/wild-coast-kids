/**
 * The seam between the two instruments and the markup: read, render.
 *
 * The same thin shape `WeekPanel` and `DayPanel` keep. Everything with a
 * judgement in it sits on one side or the other,
 * where it can be tested without a network -- composing the readings is
 * `lib/conditions.ts` and the wording is `bandText.ts`.
 *
 * **Three reads, from three networks, made concurrently.** The buoy is NDBC's,
 * the shore station may be on either NDBC's or the National Weather Service's,
 * and the sky mark is the service's gridpoint forecast. They share no outage.
 * None of the three throws: each returns its own `no-station` / `no-buoy` /
 * `unavailable` state or a view with null fields, so a quiet agency costs its
 * own segment and cannot take the others down.
 *
 * The third is a mark rather than a figure and is the one forecast this block
 * touches — see ADR-0057, and `readSkyNow` for why there is no measured sky to
 * use instead.
 *
 * **Three page-level Suspense boundaries became this one, and the trade is
 * worth stating.** The two readings used to paint independently in the band at
 * the top of the page, so a slow buoy left the air card standing. They are one
 * block now and appear together, which means the slower of the two feeds sets
 * when both arrive. What is bought is that the block is a block: two cards
 * about one instant, under the day they describe, rather than two things that
 * turn up at different times in a region that is otherwise finished.
 *
 * **It keeps a boundary of its own inside the day region rather than folding
 * into `DayPanel`'s reads.** Those five feeds draw the chart; these two do not.
 * Putting all seven in one `Promise.all` would let a slow buoy hold up a curve
 * it has nothing to do with, which is the coupling every region on this page is
 * arranged to avoid.
 */

import { readLatestAir, readLatestWaves, readSkyNow } from "@/lib/conditions";
import { type AreaScope, withheldBy } from "./areaScope";
import { MeasuredBand } from "./MeasuredBand";

export async function MeasuredPanel({
  slug,
  area,
}: {
  slug: string;
  /** Present on an area page, absent on a beach's. */
  area?: AreaScope;
}) {
  const withheldWaves = withheldBy(area, "waves");
  const withheldAir = withheldBy(area, "air");

  /*
    Only what will be shown is asked for. A withheld product makes no request:
    there is nothing an area could do with one beach's buoy, and asking would
    spend a reader's wait on a figure this page has already decided not to
    print.
  */
  /*
    Three reads now, and the third costs no upstream request: `readSkyNow` asks
    `fetchGridForecast` for a URL the week grid and the day chart already ask
    for, so the Data Cache serves it and the three share one response and one
    outage. Same argument `RipLevel` makes for the bulletin beside the chooser.

    It is not gated on an area's agreement the way the other two are. The sky is
    a mark rather than a figure, it is read for whichever beach the band is
    keyed on, and it is credited as a forecast for that cell rather than as
    something the area measured -- so there is no member's reading to leak.
  */
  const [waves, air, sky] = await Promise.all([
    withheldWaves ? null : readLatestWaves(slug),
    withheldAir ? null : readLatestAir(slug),
    readSkyNow(slug),
  ]);

  /*
    A shared reading is labelled with the area, not with the beach it was read
    through. Both cards print `beachName` as their context, and leaving the
    member's there would name one beach for a figure the whole area shares --
    "La Jolla Shores Beach" over a station every beach in La Jolla binds, which
    reads as a reading about that one beach. The area's name is the true label
    precisely because the source is shared; where it is not shared, nothing is
    read and there is no label to get wrong.
  */
  const labelled = <V extends { beachName: string }>(view: V): V =>
    area ? { ...view, beachName: area.name } : view;

  return (
    <MeasuredBand
      readings={{
        waves: withheldWaves ?? labelled(waves!),
        air: withheldAir ?? labelled(air!),
        sky,
      }}
    />
  );
}
