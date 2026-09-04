/**
 * The National Weather Service's surf zone forecast for one day.
 *
 * The page's only relayed judgement, and the only thing on it that answers
 * "should my kid go in the water today" rather than handing a reader a number
 * to interpret. Everything else here is an instrument reading or a model.
 *
 * **The words are the publisher's, including the ones that explain the words.**
 * ADR-0009 forbids this site forming a forecaster's judgement, and authoring
 * the sentence that says what "Moderate" means would be forming it one step
 * removed. The bulletin carries its own glossary, so the gloss under the level
 * is quoted from it. Nothing here rewords either.
 *
 * **The headline is scoped to the bulletin and the level is scoped to the
 * day, and they can differ.** Measured 2026-08-28: the office headlined `HIGH
 * RIP CURRENT RISK` over a `TODAY` that read Moderate, because Saturday was the
 * High one. Both are correct, so both are shown and the copy says which is
 * which. Reconciling them here -- taking the worse, or hiding the headline when
 * it disagrees -- would be this site editing a safety product.
 *
 * **The period's own name is printed beside the day.** The bulletin names its
 * periods and never dates them; `resolvePeriodDates` works out which days a
 * period covers, and that is our arithmetic rather than the office's. Showing
 * the name is what keeps the two apart: on an afternoon bulletin a reader sees
 * "THIS AFTERNOON THROUGH WEDNESDAY" against a Wednesday and can tell that one
 * period covers both days.
 *
 * **No colour by level, and that is deliberate rather than unfinished.**
 * ADR-0015 records that a surface on this page is decoration and not a verdict,
 * because ADR-0009 forbids the verdict. A three-step severity palette would be
 * this site choosing what red means, on top of a scale the office already
 * publishes in words. The level is emphasised by size and weight, identically
 * at all three. Whether that is enough emphasis for `High` is a question for a
 * human looking at the page, which is why #217 is `needs-human`.
 */

import type { SurfZoneDay, SurfZoneView } from "@/lib/conditions";
import { localTimeOf } from "@/lib/pacific-time";
import { PAGE_MUTED } from "./cardText";
import { ProvenanceLine } from "./ProvenanceLine";

/**
 * The label register, on the page ground rather than on a card.
 *
 * A card heading rather than a region one: this block sits inside the day
 * panel, whose `<h2>` is the region. ADR-0014 is what makes that distinction
 * load-bearing -- a region, a card inside it and a day inside that were all
 * rendering at the same 10px before it. `text-ocean` because this is the page's
 * ground, where the cards' yellow is measured against `bg-dark` and nothing
 * else.
 */
const BLOCK_HEADING =
  "text-2xs mb-3 font-extrabold tracking-widest text-ocean uppercase";

/** What the office calls this product, as the provenance line names it. */
const SOURCE = "Surf zone forecast, San Diego County Coastal Areas";

export type SurfZoneProps = {
  /** The read's own state: a forecast, a quiet office, or water with no surf zone. */
  state: SurfZoneView["state"];
  /** The day being shown, `YYYY-MM-DD`. */
  localDate: string;
  /** That day, worded for a reader: `Thursday`. Matches the panel's heading. */
  when: string;
  /**
   * The area this block is answering for, or undefined on a beach page.
   *
   * **Only the withheld sentence reads it**, and that is the whole of what an
   * area changes here. The bulletin itself is issued for "San Diego County
   * Coastal Areas" and says nothing about a beach, so a relayed forecast is
   * already true at either scope; what is not true at either scope is "not
   * issued for this beach" printed over an area. See ADR-0050.
   */
  areaName?: string;
};

/** The one sentence a reader gets when there is nothing to relay. */
function Absence({ children }: { children: React.ReactNode }) {
  /*
    `PAGE_MUTED` rather than the card's colour, for the reason `MeasuredToday`
    records: `CARD_MUTED` paints 1.03:1 on this ground and says nothing at all.
    On the 25 sheltered beaches this sentence is what a reader always sees, so
    it is not the rare path.
  */
  return (
    <p className={`leading-relaxed text-base ${PAGE_MUTED}`}>{children}</p>
  );
}

function Reading({ day, when }: { day: SurfZoneDay; when: string }) {
  return (
    <>
      <p className="leading-display mb-1 text-2xl font-black italic">
        {day.level}
      </p>
      {/*
        The publisher's sentence, verbatim. It is the whole reason the level
        word is safe to print at this size: "High" alone is a rating this site
        would then owe a reader an explanation for, and the office already
        wrote one.
      */}
      <p className="leading-relaxed mb-2 max-w-130 text-base">{day.meaning}</p>

      {/*
        The two published figures, under the risk they belong to rather than
        beside the day's swell.

        **Surf height is the evidence for the level, not a surf reading.**
        "High" alone is a bare word; "High -- 3 to 5 feet. Sets to 6 feet." is
        one statement. It deliberately does not sit next to CDIP's swell, which
        the hour chart's swell tab and the map readout both carry: those are
        significant wave height at 10 m depth and this is breaking surf face
        height, so the two disagree by several times over and a reader with both
        in view would take one instrument for broken. Same region, never
        adjacent, and co-visible only when a reader has chosen the swell tab.

        **Both are relayed verbatim, "degrees" included.** This site's own
        figures are °F and feet, and reformatting these to match would edit a
        quoted product to look like our own. They sit under the office's
        attribution, which is what says whose sentence they are. The set height
        is the part a range would drop and the part a parent needs.
      */}
      <dl className="leading-relaxed mb-2 max-w-130 text-base">
        <div className="flex gap-2">
          <dt className={PAGE_MUTED}>Surf</dt>
          <dd>{day.surfHeight}</dd>
        </div>
        {day.waterTemperature !== null && (
          <div className="flex gap-2">
            <dt className={PAGE_MUTED}>Water</dt>
            <dd>{day.waterTemperature}</dd>
          </div>
        )}
      </dl>

      {/*
        No sentence when the water temperature is missing. It is absent from the
        last day of every bulletin -- the office publishes it in the first
        period only, 14 of 14 -- so an absence line would appear on a day out of
        every two or three and would read as a fault that is really a cadence.
        The days that have it show it; the days that do not say nothing.
      */}
      <p className={`leading-relaxed text-sm ${PAGE_MUTED}`}>
        For {when}, from the period the office called &ldquo;{day.periodName}
        &rdquo;.
      </p>
    </>
  );
}

export function SurfZone({ state, localDate, when, areaName }: SurfZoneProps) {
  if (state.kind === "no-surf-zone") {
    return (
      <section>
        <h3 className={BLOCK_HEADING}>Rip current risk</h3>
        {/*
          "This forecast", not "no rip current risk". The obvious short lead-in
          -- "none is forecast here" -- reads as *there is no rip current risk
          here*, which is a safety judgement this site is forbidden from making
          (ADR-0009) and which would be worst at exactly these beaches: a lagoon
          is calm until the day it is not. The sentence is about the product's
          coverage and never about the water.

          It also does not repeat the publisher. The reason already names the
          National Weather Service, and a lead-in naming it again put the
          agency twice in one sentence -- caught on the rendered page rather
          than in a fixture, which is why the absence path is worth looking at
          rather than only asserting.
        */}
        {/*
          "any beach in <area>" rather than "this beach" where the block is
          answering for one, and it is a claim rather than a hedge: reaching
          this state on an area page means no member of it is open coast, so
          the reason read through one member is the reason every member gives.
          `surfZoneBeachOf` is what guarantees that -- it returns a member the
          forecast is issued for wherever one exists -- and `areas.test.ts`
          asserts it over the whole table rather than leaving it in this
          comment.
        */}
        <Absence>
          This forecast is not issued for{" "}
          {areaName === undefined ? "this beach" : `any beach in ${areaName}`}:{" "}
          {state.reason}.
        </Absence>
      </section>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <section>
        <h3 className={BLOCK_HEADING}>Rip current risk</h3>
        {/*
          The upstream reason is shown rather than summarised. It is the same
          policy every other panel here follows: a reader owed an absence is
          owed the reason, and "temporarily unavailable" is what a site says
          when it has not looked.
        */}
        <Absence>
          The National Weather Service&apos;s surf zone forecast could not be
          read: {state.detail}
        </Absence>
      </section>
    );
  }

  const day = state.days.find((entry) => entry.localDate === localDate) ?? null;

  return (
    <section>
      <h3 className={BLOCK_HEADING}>Rip current risk</h3>

      {state.headline !== null && (
        /*
          Above the day's level, because it is the office's own emphasis and
          leading with it is what the office did. The scope is spelled out in
          the same breath: this line covers the whole bulletin, so it can name a
          level the day below does not, and a reader who is not told that reads
          the pair as a contradiction.
        */
        <p className="leading-relaxed mb-3 max-w-130 text-base">
          The forecast office headlined this bulletin{" "}
          <strong className="font-black">{state.headline}</strong>. A headline
          covers the whole bulletin rather than one day, so it can name a level
          no single day below it does.
        </p>
      )}

      {state.staleAfterHours !== null && (
        /*
          Stated rather than withheld, which is the opposite of what a stale
          buoy reading gets. `MAX_WAVE_AGE_MINUTES` drops an old measurement
          because a number with no time attached reads as now; a judgement is
          different. The office's last published one is still the best
          information anyone has about this water, and hiding it would leave the
          page silent on the day that matters most. So it stays, and the reader
          is told the office has missed a cycle.

          Above the level, because it changes how everything under it should be
          read.
        */
        <p className="leading-relaxed mb-3 max-w-130 text-base">
          <strong className="font-black">
            This is {state.staleAfterHours} hours old.
          </strong>{" "}
          The National Weather Service issues it twice a day, so a gap this long
          means one has been missed. What it says below was true when it was
          written.
        </p>
      )}

      {day === null ? (
        <Absence>
          This forecast does not reach {when}. It is issued twice a day and
          reaches about two days ahead.
        </Absence>
      ) : (
        <Reading day={day} when={when} />
      )}

      {/*
        `surface="page"`, because this block renders on the page ground and not
        on a card. The issuance is in the note rather than left off: a judgement
        reissued twice a day is one whose age a reader can act on, and this is
        the only place the page says when it was made.
      */}
      <div className="mt-3">
        <ProvenanceLine
          source={SOURCE}
          network="NWS"
          note={`issued ${localTimeOf(state.issuedMs)}`}
          surface="page"
        />
      </div>
    </section>
  );
}
