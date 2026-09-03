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
 * for a beach or, once PR 3 lands, for everything the area's beaches share.
 *
 * Until then the area page carries its header and its list and says plainly
 * that the readings are one level down, which is true rather than a placeholder:
 * an area reports only what all its beaches share, and working out what that is
 * for eighteen areas is its own slice. See
 * `docs/plans/areas-over-locations.md`.
 */

import { Suspense } from "react";
import { areaBySlug, beachesByArea } from "@/lib/areas";
import { inventoryCaveats, inventoryReach } from "@/lib/beaches";
import { AreaBeaches } from "./AreaBeaches";
import { AreaSelector } from "./AreaSelector";
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

  return (
    <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
      {/*
        THE PAGE INTRODUCES ITSELF IN ONE LINE, BECAUSE THE READER ARRIVED ON
        PURPOSE.

        The chooser sits beside the title rather than under it, and it decides
        what every figure on the page means: it was the fourth element down,
        under a paragraph, with a 13px label. Bottom-aligned so the two columns
        finish on the same line; stacked below `md`, where there is no width to
        share.

        An eyebrow reading "Surf · Tide · Wind · Visibility" and a paragraph
        saying the site is real-time surf, tide, wind and visibility for San
        Diego's coast stood above this. Both described the page to somebody who
        had just clicked "Conditions" to reach it, and together with a 56px
        headline they meant the first measurement on a page about measurements
        was off a 639px window entirely.

        The lead paragraph is not lost, it is where it was always doing the
        work: the `metadata` export in ../../app/conditions/page.tsx carries it
        verbatim as the description, which is the place a sentence introducing
        this page to somebody who has *not* arrived at it is actually read.
        `ConditionsTeaser` on the landing page carries the other copy of it, for
        the reader who has not clicked yet.

        The `<h1>` keeps the site's voice and drops a register: `--text-tool-
        title`, not `--text-title`. See the token's own note -- six other pages
        take the larger one and none of them opens on a figure.
      */}
      <div className="mb-7 md:flex md:items-end md:justify-between md:gap-10">
        <div>
          <h1 className="text-tool-title leading-display mb-3 font-black italic">
            Check <span className="text-ocean">conditions</span> first.
          </h1>

          {/*
            The standing notice ADR-0009 turns on: that decision rejects an
            embed partly because "the host page is asserting something it does
            not control", and this sentence is the assertion. It said less than
            this and sat fourth of four at the bottom of a 2171px page until
            2026-08-25.

            It moved from the chooser's column to the title's when the lead
            paragraph came out, and the move is what keeps the row balanced: the
            row is `md:items-end`, so with nothing under the title this column
            was a lone heading bottom-aligned against a two-element one. The
            notice is now the thing the title sits above, which is also the
            reading order ADR-0009 wants -- the qualification arrives with the
            page's name rather than as a footnote to the control.

            One sentence rather than two, and both claims kept: instrument
            readings are not a safety assessment, and the authority on the day
            is someone else. Those two halves are what the ADR names, and
            `ConditionsSection.test.tsx` asserts each of them separately so a
            later tightening cannot quietly drop the liability half.
          */}
          <p className="leading-relaxed max-w-130 text-base text-fog">
            Instrument readings, not a safety assessment — lifeguards and the
            signs posted at the beach are the authority on the day.
          </p>
        </div>

        {/*
          The chooser's column, and the rip level under it.

          Reading order: choose the beach, then the one relayed judgement about
          it. And it is nearly free here -- the row is `md:items-end`, so this
          column is bottom-aligned against a taller one and the space above the
          chooser was already empty. The same measurement put the standing
          notice in this column once.

          Its own Suspense boundary, because it is a sixth publisher and the
          bulletin going quiet must not hold up the chooser, which needs no
          network at all.
        */}
        <div className="mt-6 md:mt-0 md:w-72">
          <AreaSelector areas={areas} current={areaSlug} />
          {/*
            The bulletin is scoped to a beach here, so it waits for one. It is
            the single product an area may report without its beaches agreeing
            -- the National Weather Service issues it for "San Diego County
            Coastal Areas", a unit larger than any area in this table, so the
            intersection rule is a category error against it. That exception
            lands with the area's readings in PR 3 and gets its own decision.
          */}
          {beachSlug !== null && (
            <Suspense
              fallback={
                <p className="mt-4 text-base text-fog">
                  Reading the rip current risk…
                </p>
              }
            >
              <RipLevel slug={beachSlug} />
            </Suspense>
          )}
        </div>
      </div>

      {/*
        WHICH PLACES THIS AREA HOLDS, BEFORE ANY READING ABOUT ONE OF THEM.

        The chooser above picks an area; this is how a reader reaches one beach
        inside it. It sits above the readings on both pages rather than only on
        the area's, so moving between beaches does not mean scrolling past a
        page of figures to find the list you moved with.

        **Not drawn at all where the area holds one beach**, which six of the
        eighteen do. A list of one is a choice that is not a choice, and a
        heading over it reads as though something were missing. Those areas show
        their beach directly instead -- `[area]/page.tsx` passes it as
        `beachSlug` -- so the reader who picked Sunset Cliffs gets Sunset Cliffs
        Park's readings rather than a link to them.
      */}
      {group.beaches.length > 1 && (
        <div className="mb-9">
          <AreaBeaches
            areaSlug={group.area.slug}
            areaName={group.area.name}
            beaches={group.beaches.map((beach) => ({
              slug: beach.slug,
              name: beach.name,
            }))}
            current={beachSlug}
          />
        </div>
      )}

      {/*
        WHAT IS TRUE NOW, BEFORE ANYTHING THAT IS TRUE OF A DAY.

        The buoy and the shore station are the only instruments this site
        reports, and they answer for one instant: now. Everything below this
        point is a prediction or a model, and everything below this point is
        scoped to a day a reader chooses.

        That is why the block sits here and, more to the point, why it sits
        OUTSIDE `SelectedDayProvider`. Frozen to the present is the whole
        contract of this region, and putting it outside the provider is what
        makes that structural rather than a convention: there is no day in
        scope here to accidentally read. A later change cannot quietly make
        these figures follow Thursday, because there is nothing to follow.

        It used to live inside the day panel, under the chart, rendered on
        today alone -- with a sentence on the other six days explaining that
        nothing had been measured about a day that had not happened. That
        sentence is gone with the move. It existed because the block sat in a
        position where its absence would have read as an outage; no measured
        block lives down there now, so there is no gap left to explain, and
        this band says which instant it means.

        A band of three cards stood in this spot once -- today's lowest tide,
        the buoy, the air station -- and was removed as redundant against the
        week grid and the day chart, which print the tide and the swell
        themselves. The two readings here are the half of that band that was
        never duplicated: nothing else on this page is measured.

        Its own Suspense boundary, like every region on this page. Five
        agencies go quiet independently and a slow buoy must not hold up the
        week.
      */}
      {beachSlug === null ? (
        <p className="leading-relaxed max-w-130 mb-9 text-base text-fog">
          Choose one of these beaches for its tide, swell and wind. An area
          reports only the readings every beach in it shares, and which those
          are is measured rather than assumed — so they are not here yet.
        </p>
      ) : (
        <div className="mb-9">
          <Suspense
            fallback={
              <p className="text-base text-fog">
                Reading the buoy and the air station…
              </p>
            }
          >
            <MeasuredPanel slug={beachSlug} />
          </Suspense>
        </div>
      )}

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
      {beachSlug !== null && (
        <>
          <div className="mb-9">
            <Suspense
              fallback={
                <p className="text-base text-fog">
                  Reading the week from NOAA…
                </p>
              }
            >
              <WeekPanel slug={beachSlug} />
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
              <DayPanel slug={beachSlug} />
            </Suspense>
          </div>
        </>
      )}

      {/*
        One block for everything true of every reading — the datum, what a buoy
        measures, why the sky comes from an airport — plus the caveats, which it
        renders. The three panels above carry only their own attribution now.
      */}
      <ConditionsNotes entries={inventoryCaveats()} reach={inventoryReach()} />
    </section>
  );
}
