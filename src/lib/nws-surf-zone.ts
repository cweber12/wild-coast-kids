/**
 * Reading the National Weather Service's surf zone forecast.
 *
 * Pure and offline, like the parsers beside it, so a pinned format is asserted
 * against a committed payload without a network.
 *
 * WHAT THIS PRODUCT IS. `SRF` is a text bulletin, not JSON — the only feed on
 * this page that is. It is not forecaster prose either: the fields are
 * fixed-width with dot leaders, which is what makes reading it a parse rather
 * than a guess.
 *
 *     Rip Current Risk*.............High.
 *
 * THE JUDGEMENT IS RELAYED, NEVER FORMED. ADR-0009 forbids this site deciding
 * whether conditions are safe, and this is the product that decision was
 * written about. The risk word leaves here as the word the forecaster
 * published, and the sentence explaining what it means is the publisher's own:
 * the bulletin carries its glossary in its own body, so nothing in this file
 * has to author "what Moderate means". Anything here that reworded either would
 * be the bug.
 *
 * ONE TEXT CARRIES TWO COUNTIES, AND PICKING THE WRONG ONE FAILS SILENTLY.
 * SGX issues `CAZ043` San Diego County Coastal and `CAZ552` Orange County
 * Coastal in a single bulletin. Measured 2026-09-02: San Diego read 70 to 74
 * degrees and quoted tides at La Jolla, Orange read 71 to 78 and quoted Newport
 * Beach. So the section is selected by zone id and its absence throws. There is
 * deliberately no "first section" fallback — the fallback renders another
 * county's forecast under this county's heading, and looks entirely plausible.
 *
 * A PERIOD IS NOT A DAY, AND THE PUBLISHER NAMES IT RATHER THAN DATING IT.
 * Measured across all 14 issuances SGX held on 2026-09-02, every one carried
 * exactly two periods. A morning issuance (~1 AM PDT) names them `TODAY` then a
 * weekday. An afternoon one (~1 PM PDT) names them `THIS AFTERNOON THROUGH
 * <weekday>` — today's remainder merged with tomorrow — then the day after. So
 * a morning issuance describes two calendar days and an afternoon one describes
 * three, and neither states a date anywhere. `resolvePeriodDates` is what turns
 * the words back into days, and an unrecognised word throws rather than
 * resolving to nothing: a dropped period is a day silently missing from the
 * page, which is the failure this whole feature exists to correct.
 *
 * THE HEADLINE OUTRANKS THE DAY AND MAY DISAGREE WITH IT. The section may open
 * with the office's own emphasis line, present on 11 of the 14 issuances. It is
 * scoped to the bulletin rather than to a period: on 2026-08-28 07:11 it read
 * `HIGH RIP CURRENT RISK` while `TODAY` read Moderate, because `SATURDAY` was
 * the High one. Both are correct at their own scope, so both are carried and
 * neither is reconciled here. It also carries an active Beach Hazards Statement
 * on 3 of 14, which is the only route by which that alert reaches this page.
 *
 * THE ISSUANCE INSTANT IS NOT PARSED OUT OF THE TEXT. The bulletin states it as
 * `1220 PM PDT Tue Sep 1 2026`, and the product listing states the same instant
 * as ISO with its offset. The machine-readable one is used and the human one is
 * ignored, for the hazard ADR-0009 records and `nws-forecast.ts` guards: a
 * timestamp read without its zone ages by seven hours on this coast, which here
 * would resolve every period onto the wrong day.
 */

import { addLocalDays, localDateOf, localWeekdayOf } from "./pacific-time";

export class NwsSurfZoneDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsSurfZoneDriftError";
  }
}

export class NwsSurfZoneNoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsSurfZoneNoDataError";
  }
}

/**
 * The forecast office whose surf zone bulletin covers this inventory.
 *
 * San Diego. Not a per-beach binding and deliberately not a column in
 * `beaches.json` — see `SURF_ZONE_ID`.
 */
export const SURF_ZONE_OFFICE = "SGX";

/**
 * The zone every beach in this inventory sits in.
 *
 * **This is bound to the inventory, not joined per beach**, which breaks the
 * pattern every other binding here follows. The reason is measured: resolving
 * `api.weather.gov/zones?point=` for both ends of all 51 beaches returned
 * `CAZ043` at both ends for 27, at one end for 14, and **nothing at either end
 * for 10** — every Coronado beach, Border Field State Park, and the inner-bay
 * sites. That says nothing about those beaches. `CAZ043` is a *land* polygon,
 * and a beach coordinate on the water side of the mapped shoreline falls
 * outside it; a containment join fails at the water's edge where this repo's
 * nearest-feature joins degrade gracefully.
 *
 * The zone follows from the inventory's own definition instead — the
 * `County = 'San Diego'` filter recorded in `beaches.json`'s `_inclusion` —
 * so there is one zone for all 51 beaches and nothing to re-join.
 */
export const SURF_ZONE_ID = "CAZ043";

/** The three levels this product publishes, and the only ones accepted. */
export const RISK_LEVELS = ["Low", "Moderate", "High"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

/** One period of the bulletin, as the publisher divided and named it. */
export interface SurfZonePeriod {
  /**
   * The publisher's own label: `TODAY`, `THIS AFTERNOON THROUGH WEDNESDAY`,
   * `THURSDAY`. Carried verbatim because it is what names the period on the
   * page when the resolved dates would be a claim of our own.
   */
  name: string;
  /**
   * Every local calendar date this period describes, `YYYY-MM-DD`, ascending.
   *
   * Usually one. Two when an afternoon issuance merges today's remainder with
   * tomorrow, which is the case the day panel exists to key into.
   */
  localDates: string[];
  /** The published level, one of three. */
  level: RiskLevel;
}

/** One line of the bulletin's own glossary of its risk levels. */
export interface RiskMeaning {
  level: RiskLevel;
  /** The publisher's sentence, verbatim. */
  meaning: string;
}

export interface SurfZoneForecast {
  /** The zone this was read for. */
  zoneId: string;
  /** When the office issued it, epoch milliseconds UTC. */
  issuedMs: number;
  /**
   * The office's own emphasis line with its `...` markers stripped, or null.
   *
   * Scoped to the bulletin, not to a period, and may name a level the first
   * period does not. Null on a quiet issuance — 3 of 14 carried none.
   */
  headline: string | null;
  /** Every period the bulletin issued, in the order it published them. */
  periods: SurfZonePeriod[];
  /** The bulletin's own glossary, so the gloss on the page is the publisher's. */
  meanings: RiskMeaning[];
}

/** The listing of recent bulletins from one office. */
export function surfZoneProductsUrl(office: string = SURF_ZONE_OFFICE): string {
  return `https://api.weather.gov/products/types/SRF/locations/${office}`;
}

/** One bulletin by the id the listing gave it. */
export function surfZoneProductUrl(id: string): string {
  return `https://api.weather.gov/products/${id}`;
}

/** The newest bulletin in a listing: its id and when it was issued. */
export interface SurfZoneProductRef {
  id: string;
  issuedMs: number;
}

/** `2026-09-02T08:54:00+00:00`. Offset-less would be ADR-0009's hazard. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The newest bulletin the office is currently serving.
 *
 * **Newest by stated issuance, not by position.** The listing arrives newest
 * first today, and sorting rather than taking `[0]` costs one comparison and
 * removes an assumption about an order the publisher never documented.
 */
export function parseSurfZoneProductList(
  payload: unknown,
  office: string = SURF_ZONE_OFFICE,
): SurfZoneProductRef {
  const graph =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)["@graph"]
      : undefined;

  if (!Array.isArray(graph)) {
    throw new NwsSurfZoneDriftError(
      `${office}: the surf zone product listing carried no "@graph" array. This parser ` +
        `pins the JSON-LD shape the listing is requested in.`,
    );
  }
  if (graph.length === 0) {
    throw new NwsSurfZoneNoDataError(
      `${office} is serving no surf zone forecast bulletins at all.`,
    );
  }

  const refs: SurfZoneProductRef[] = graph.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const id = row.id;
    const issued = row.issuanceTime;
    if (typeof id !== "string" || id.length === 0) {
      throw new NwsSurfZoneDriftError(
        `${office}: bulletin ${index} in the listing carried id ${JSON.stringify(id)}.`,
      );
    }
    if (typeof issued !== "string" || !INSTANT.test(issued)) {
      throw new NwsSurfZoneDriftError(
        `${office}: bulletin ${id} carried issuanceTime ${JSON.stringify(issued)}. This ` +
          `parser pins an ISO instant with its offset stated; one without would be read as ` +
          `local and tagged UTC, moving the issuance by seven hours and resolving every ` +
          `period onto the wrong day.`,
      );
    }
    return { id, issuedMs: Date.parse(issued) };
  });

  refs.sort((a, b) => b.issuedMs - a.issuedMs);
  return refs[0];
}

/** A line naming the zones a section covers: `CAZ043-021015-`. */
function sectionFor(text: string, zoneId: string): string {
  // `$$` ends a zone's section in this product's own markup.
  const sections = text.split(/^\$\$\s*$/m);
  const opensWithZone = new RegExp(`^(?:[A-Z]{3}\\d{3}-)*${zoneId}-`, "m");
  const matching = sections.filter((section) => opensWithZone.test(section));

  if (matching.length === 0) {
    throw new NwsSurfZoneNoDataError(
      `This surf zone bulletin carries no ${zoneId} section. It is not read as whichever ` +
        `section it does carry: SGX issues San Diego (${SURF_ZONE_ID}) and Orange County ` +
        `(CAZ552) in one bulletin with different figures, so a fallback would render ` +
        `another county's forecast under this one's heading.`,
    );
  }
  if (matching.length > 1) {
    throw new NwsSurfZoneDriftError(
      `This surf zone bulletin carries ${matching.length} sections for ${zoneId}. One ` +
        `zone is issued once per bulletin, and choosing between two would be this parser ` +
        `guessing which forecast is current.`,
    );
  }
  return matching[0];
}

/** `...HIGH RIP CURRENT RISK...` → `HIGH RIP CURRENT RISK`, or null. */
function headlineIn(section: string): string | null {
  const match = /^\.\.\.(.+?)\.\.\.\s*$/m.exec(section);
  return match === null ? null : match[1].trim();
}

/** A field's value: everything after the dot leaders, on that line. */
function fieldIn(block: string, label: string): string | null {
  const match = new RegExp(`^${label}\\*?\\.{2,}(.*)$`, "m").exec(block);
  return match === null ? null : match[1].trim();
}

function levelOf(raw: string, periodName: string): RiskLevel {
  const word = raw.replace(/\.\s*$/, "").trim();
  const level = RISK_LEVELS.find((candidate) => candidate === word);
  if (level === undefined) {
    throw new NwsSurfZoneDriftError(
      `The period ${JSON.stringify(periodName)} published a rip current risk of ` +
        `${JSON.stringify(word)}. This parser pins the three levels the bulletin's own ` +
        `glossary defines — ${RISK_LEVELS.join(", ")} — and a fourth is a change in what ` +
        `the office publishes rather than a value to pass through unexplained.`,
    );
  }
  return level;
}

/**
 * Which local dates a period's own label describes.
 *
 * `searchFrom` is where the calendar walk starts: the issuance's local date for
 * the first period, and the day after the previous period for each one after.
 * Without it a bare weekday is ambiguous — `THURSDAY` on a Thursday could be
 * today or a week away — and the ambiguity would land on the wrong day rather
 * than raising.
 *
 * **An unrecognised label throws.** The measured vocabulary is `TODAY`,
 * `THIS AFTERNOON THROUGH <weekday>` and a bare weekday, taken from all 14
 * issuances available on 2026-09-02 — one week of a summer, which is not the
 * whole of what NWS period naming can produce. So the failure is loud: a label
 * this does not know is a bulletin this page cannot place in time, and a
 * silently dropped period is a day missing from the panel with nothing said.
 */
export function resolvePeriodDates(name: string, searchFrom: string): string[] {
  const label = name.trim().toUpperCase();

  if (label === "TODAY") return [searchFrom];

  const through = /^THIS AFTERNOON THROUGH ([A-Z]+)$/.exec(label);
  if (through !== null) {
    const last = weekdayOnOrAfter(through[1], searchFrom, name);
    const dates: string[] = [];
    for (let day = searchFrom; ; day = addLocalDays(day, 1)) {
      dates.push(day);
      if (day === last) return dates;
    }
  }

  if (/^[A-Z]+$/.test(label)) {
    return [weekdayOnOrAfter(label, searchFrom, name)];
  }

  throw new NwsSurfZoneDriftError(
    `The surf zone bulletin named a period ${JSON.stringify(name)}, which this parser ` +
      `cannot place on the calendar. It reads TODAY, "THIS AFTERNOON THROUGH <weekday>" ` +
      `and a bare weekday. A period it cannot date is not dropped, because a dropped ` +
      `period is a day missing from the page with nothing said about why.`,
  );
}

/** The first date on or after `from` that falls on `weekday`. */
function weekdayOnOrAfter(
  weekday: string,
  from: string,
  periodName: string,
): string {
  const wanted = weekday.trim().toUpperCase();
  // Seven steps reach every weekday exactly once; an eighth would repeat `from`.
  let day = from;
  for (let step = 0; step < 7; step += 1) {
    if (localWeekdayOf(day).toUpperCase() === wanted) return day;
    day = addLocalDays(day, 1);
  }
  throw new NwsSurfZoneDriftError(
    `The surf zone bulletin's period ${JSON.stringify(periodName)} named ` +
      `${JSON.stringify(weekday)}, which is not a weekday. Seven days from ${from} were ` +
      `checked and none matched.`,
  );
}

/** `* Moderate Risk - Life threatening rip currents are possible.` */
function meaningsIn(section: string): RiskMeaning[] {
  const meanings: RiskMeaning[] = [];
  for (const match of section.matchAll(
    /^\*\s*(Low|Moderate|High) Risk\s*-\s*(.+?)\s*$/gm,
  )) {
    meanings.push({ level: match[1] as RiskLevel, meaning: match[2] });
  }
  return meanings;
}

/**
 * One bulletin, read for one zone.
 *
 * `issuedMs` comes from the listing rather than from the bulletin's own
 * `1220 PM PDT Tue Sep 1 2026` line — see this module's header.
 */
export function parseSurfZoneForecast(
  text: string,
  issuedMs: number,
  zoneId: string = SURF_ZONE_ID,
): SurfZoneForecast {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new NwsSurfZoneNoDataError(
      `The surf zone bulletin for ${zoneId} was empty.`,
    );
  }

  const section = sectionFor(text, zoneId);
  const meanings = meaningsIn(section);

  // A period opens on a line of its own: `.THURSDAY...`. The leading dot is
  // what separates it from the `...HEADLINE...` above, whose first character
  // is also a dot but whose second is not a letter.
  const blocks = section.split(/^\.(?=[A-Z])/m).slice(1);
  if (blocks.length === 0) {
    throw new NwsSurfZoneNoDataError(
      `The ${zoneId} section of this surf zone bulletin carries no periods.`,
    );
  }

  const periods: SurfZonePeriod[] = [];
  let searchFrom = localDateOf(issuedMs);

  for (const block of blocks) {
    const name = block.split("...")[0].trim();
    const risk = fieldIn(block, "Rip Current Risk");
    if (risk === null) {
      throw new NwsSurfZoneDriftError(
        `The period ${JSON.stringify(name)} of the ${zoneId} surf zone bulletin published ` +
          `no "Rip Current Risk" field. That field is the reason this page reads this ` +
          `product, and a period without one is a change in the bulletin's shape.`,
      );
    }

    const localDates = resolvePeriodDates(name, searchFrom);
    periods.push({ name, localDates, level: levelOf(risk, name) });
    searchFrom = addLocalDays(localDates[localDates.length - 1], 1);
  }

  return {
    zoneId,
    issuedMs,
    headline: headlineIn(section),
    periods,
    meanings,
  };
}
