/**
 * The seam between the two instruments and the markup: read, render.
 *
 * The same thin shape `WeekPanel` and `DayPanel` keep. Everything with a
 * judgement in it sits on one side or the other,
 * where it can be tested without a network -- composing the readings is
 * `lib/conditions.ts` and the wording is `MeasuredToday`.
 *
 * **Two reads, from two networks, made concurrently.** The buoy is NDBC's and
 * the shore station may be on either NDBC's or the National Weather Service's,
 * and they share no outage. Neither read throws: each returns its own
 * `no-station` / `no-buoy` / `unavailable` state, so a quiet agency costs its
 * own card and cannot take the other down.
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

import { readLatestAir, readLatestWaves } from "@/lib/conditions";
import { type AreaScope, withheldBy } from "./areaScope";
import { MeasuredToday } from "./MeasuredToday";

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
  const [waves, air] = await Promise.all([
    withheldWaves ? null : readLatestWaves(slug),
    withheldAir ? null : readLatestAir(slug),
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
    <MeasuredToday
      readings={{
        waves: withheldWaves ?? labelled(waves!),
        air: withheldAir ?? labelled(air!),
      }}
    />
  );
}
