/**
 * The conditions view, at both of its scopes.
 *
 * One section for three routes -- `/conditions`, `/conditions/<area>` and
 * `/conditions/<area>/<beach>` -- so they cannot drift apart. That is the same
 * reason it existed for two.
 *
 * **`beachSlug` is what says which scope.** Null is the area's own page and a
 * slug is one beach inside it. The header, the chooser and the beach list are
 * the same either way; what changes is whether the readings below them answer
 * for a beach or for everything the area's beaches share.
 *
 * **Every panel is handed the same pair**, composed once here: the beach a read
 * is keyed on, and the area scope that says which products may be reported.
 * `undefined` for the scope is the beach page, and it is what makes that path
 * unchanged rather than merely equivalent -- with nothing to withhold, each
 * panel reads and draws exactly what it did before areas existed. See ADR-0048
 * and `areaScope.ts`.
 *
 * The map inside the day region is still one beach's own stretch of coast, and
 * the area page says so where a map would be: the area map is its own slice.
 * See `docs/plans/areas-over-locations.md`.
 */

import { Suspense } from "react";
import { areaBySlug, beachesByArea } from "@/lib/areas";
import { scopeFor } from "./areaScope";
import { inventoryCaveats, inventoryReach } from "@/lib/beaches";
import { TOOL_WORDMARK } from "../ui/headingRank";
import { AreaSelector } from "./AreaSelector";
import { BeachSelector } from "./BeachSelector";
import { ConditionsNotes } from "./ConditionsNotes";
import { DayPanel } from "./DayPanel";
import { MeasuredPanel } from "./MeasuredPanel";
import { RipLevel } from "./RipLevel";
import { WeekPanel } from "./WeekPanel";

export function ConditionsSection({
  areaSlug,
  beachSlug,
}: {
  areaSlug: string;
  /** One beach in the area, or null for the area's own page. */
  beachSlug: string | null;
}) {
  const groups = beachesByArea();
  const areas = groups.map((group) => ({
    slug: group.area.slug,
    name: group.area.name,
  }));

  // Never undefined from a route: both pages resolve the slug against the same
  // table before rendering. Thrown rather than defaulted, because a section
  // about an area that is not in the table has nothing true to say.
  const group = groups.find((entry) => entry.area.slug === areaSlug);
  if (!group || !areaBySlug(areaSlug)) {
    throw new Error(
      `ConditionsSection was given ${areaSlug}, which names no area in areas.json.`,
    );
  }

  /*
    The two things every panel below is handed, composed once because two of
    them now take both and a third is coming.

    `reading` is the beach a read is keyed on -- every function in
    `lib/conditions.ts` takes a slug -- and on an area page it is the first
    member. Which member cannot matter: a product is read only where every beach
    in the area binds the same source for it, which is what `areaSources` calls
    shared and what `areas.test.ts` asserts over the whole table. A product they
    do not share is not read at all, so no one beach's figure can arrive
    labelled as the area's.

    `scope` is undefined on a beach page, and that is what keeps the beach-scoped
    path exactly as it was: with no scope nothing is withheld, so every panel
    reads and draws what it always did.
  */
  const reading = beachSlug ?? group.beaches[0].slug;
  const scope = beachSlug === null ? scopeFor(group.area) : undefined;

  /*
    And the member the surf zone bulletin is read through, which is a different
    question from `reading` and sometimes a different beach.

    Every other product on this page is a point measurement, and an area
    publishes one only where all its beaches are served by the same source. The
    bulletin is not: the National Weather Service issues one for "San Diego
    County Coastal Areas", a unit larger than any area in this table, so what it
    needs is not a member they agree about but a member it is *issued* for. See
    ADR-0050.
  */
  const bulletin = scope === undefined ? reading : scope.bulletinBeach;

  return (
    <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
      {/*
        THE BAR: WHERE, AND WHAT IS TRUE THERE NOW.

        One row across the top holding everything that answers *which place* and
        *this instant*, closed by a rule. Everything below it is a prediction or
        a model scoped to a day the reader chooses, so the rule is a real
        boundary and not a decoration.

        It was a three-column header: a 36px headline over a liability sentence,
        the readings in a middle column, and the chooser stacked over the rip
        level in a 288px one -- about 100px tall, with a 160px list of beach
        links beneath it and the week starting at 459px. The wordmark
        (ADR-0058), the two controls (ADR-0060) and the ungrounded readings
        (ADR-0059) each gave back enough height to put all of it on one line.

        **`flex-wrap`, not a grid.** The row's items are of unequal and
        unpredictable width -- an area name is "Del Mar" or "Mission Bay -
        West", a wind bearing is "from the west" or "from the
        north-north-west" -- so a column that fitted one area would leave a gap
        at the next. Wrapping puts each on its own line at a phone width, which
        is where 375px cannot hold two of them.

        **`items-center`, not `items-end`.** The old row bottom-aligned two
        columns of stacked content so they finished on the same line. These are
        single-line items of differing height, and a shared centre is what makes
        them read as one bar rather than as things resting on a shelf.
      */}
      <div className="mb-8 border-b border-lavender pb-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {/*
            **The `<h1>` is a wordmark, not a headline.** It read "Check
            conditions first." at 36px across a line of its own -- telling a
            reader who had just clicked "Conditions" in the nav what they had
            chosen. One word in the label register says it and returns the line.
            It is smaller than the region headings beneath it on purpose;
            `TOOL_WORDMARK` carries the argument and ADR-0058 the decision.

            The lead paragraph that stood here is not lost: the `metadata`
            export in ../../app/conditions/page.tsx carries it verbatim as the
            description, which is where a sentence introducing this page to
            somebody who has *not* arrived is actually read, and
            `ConditionsTeaser` carries the other copy for the reader who has not
            clicked yet.
          */}
          <h1 className={TOOL_WORDMARK}>Conditions</h1>

          {/*
            WHICH PLACE, AT BOTH GRAINS.

            The area decides what every figure on the page means; the beach
            narrows it. They sit together because they are one question asked
            twice, and they sit first because nothing to their right means
            anything until they are answered.

            The beach control is not drawn where the area holds one beach, which
            six of the eighteen do: a choice between one thing is not a choice.
            Those areas show their beach directly -- `[area]/page.tsx` passes it
            as `beachSlug`. See ADR-0060.
          */}
          <AreaSelector areas={areas} current={areaSlug} />
          {group.beaches.length > 1 && (
            <BeachSelector
              areaSlug={group.area.slug}
              areaName={group.area.name}
              beaches={group.beaches.map((beach) => ({
                slug: beach.slug,
                name: beach.name,
              }))}
              current={beachSlug}
            />
          )}

          {/*
            WHAT THE INSTRUMENTS READ, RIGHT NOW.

            The buoy and the shore station are the only instruments this site
            reports and they answer for one instant. One thing in the block is a
            forecast and it is a mark rather than a figure: the glyph on the air
            segment is the sky forecast for this hour, credited as one on the
            block's own attribution (ADR-0057).

            **It sits OUTSIDE `SelectedDayProvider`**, which is structural
            rather than a convention: frozen to the present is this block's
            whole contract, and with no day in scope here a later change cannot
            quietly make these figures follow Thursday. The provider is in
            `app/conditions/layout.tsx`, one level out.

            `lg:ml-auto` rather than a width: it is the only item in this row
            that can take whatever is left, so it ends the row where there is
            room and wraps under it where there is not.

            Its own Suspense boundary, like every region on this page: five
            agencies go quiet independently and a slow buoy must not hold up the
            chooser, which needs no network at all.

            On an area page this reads through the area's first beach, and which
            beach cannot matter: a product is only read here when every beach in
            the area binds the same source for it. Air is shared by all eighteen
            areas and a buoy by three, so on fifteen area pages this is one
            segment -- what the air station read, and nothing about the sea.
            That is not a hole; the sentence saying why lives beside the
            modelled heights the week and the chart draw (ADR-0055).
          */}
          <div className="lg:ml-auto">
            <Suspense
              fallback={
                <p className="text-base text-fog">
                  Reading the buoy and the air station…
                </p>
              }
            >
              <MeasuredPanel slug={reading} area={scope} />
            </Suspense>
          </div>

          {/*
            The one relayed judgement on this page, and the one product an area
            reports without its beaches agreeing about a source. It is on the
            area page as well as the beach page for that reason: withholding it
            from an area would apply a rule about point measurements to
            something that is not one, and it is the single line here that
            answers whether to put children in the water.

            Last in the row, behind a rule: it is the only item that is neither
            a control nor a measurement, and the rule says so without giving it
            a box.

            **The rule is `lg` and up, because it is a fact about a row.** This
            row wraps, and a stacked item carrying a left border paints a stray
            vertical tick beside itself that reads as an indent. Seen at 375px,
            where every item in the bar is on its own line.

            Its own Suspense boundary, because it is a sixth publisher and the
            bulletin going quiet must not hold up the chooser.
          */}
          <div className="lg:border-l lg:border-lavender lg:pl-6">
            <Suspense
              fallback={
                <p className="text-base text-fog">
                  Reading the rip current risk…
                </p>
              }
            >
              <RipLevel slug={bulletin} />
            </Suspense>
          </div>
        </div>

        {/*
          The standing notice ADR-0009 turns on: that decision rejects an embed
          partly because "the host page is asserting something it does not
          control", and this sentence is the assertion.

          **Under the bar rather than in it, and at body size.** The prototype
          this layout came from put it in the row at `--text-2xs`, which would
          have made the one sentence the site asserts on its own behalf the
          smallest type in the system. It qualifies everything the bar states,
          so it sits beneath the whole of it -- and it is prose, where the row
          above is controls and figures.

          One sentence rather than two, and both claims kept: instrument
          readings are not a safety assessment, and the authority on the day is
          someone else. `ConditionsSection.test.tsx` asserts each half
          separately so a later tightening cannot quietly drop the liability
          one, and asserts the size so a later compression cannot quietly shrink
          it.
        */}
        <p className="leading-relaxed mt-4 max-w-130 text-base text-fog">
          Instrument readings, not a safety assessment — lifeguards and the
          signs posted at the beach are the authority on the day.
        </p>
      </div>

      {/*
        The week and the day are one instrument at two zoom levels, and from
        here on they share a fact: which day is being shown. It is a client
        fact, and the provider holding it is in `app/conditions/layout.tsx` --
        one level further out than it used to be, so the choice survives a move
        between an area and one of its beaches. Both regions are still server
        components and each keeps its own suspense boundary: five agencies go
        quiet independently and none may hold up another; a shared choice does
        not change that.
      */}
      <div className="mb-9">
        <Suspense
          fallback={
            <p className="text-base text-fog">Reading the week from NOAA…</p>
          }
        >
          {/*
            The same scope the measured block above takes, and for the same
            reason: a row is drawn only where every beach in the area binds one
            source for it, and a row that is not drawn says so in the notes
            under the grid. Sixteen areas share a tide station and eleven a
            forecast cell, so this is where most of an area's forecast arrives.
          */}
          <WeekPanel slug={reading} area={scope} />
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
          {/*
            The same pair again, and the last region to take it. A tab whose
            product the area's beaches do not share keeps its place in the bar
            and says so where the curve would be, which is the slot this chart
            already uses for a beach with no MOP line.
          */}
          <DayPanel slug={reading} area={scope} />
        </Suspense>
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
