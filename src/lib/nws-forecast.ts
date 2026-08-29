/**
 * Reading the National Weather Service's own words for the sky.
 *
 * Pure and offline, like the parsers beside it, so a shape or an instant is
 * asserted against a committed payload without a network.
 *
 * WHY THIS IS A SECOND REQUEST AND NOT A FIELD ON THE FIRST. `/gridpoints`
 * publishes numbers; `/gridpoints/{cell}/forecast` publishes the sentence a
 * forecaster wrote about them. They are separate products at separate URLs, so
 * this is a second upstream call with its own outage and its own provenance
 * line -- both required rather than optional, per ADR-0024, which deferred this
 * read and said in as many words that a day view would want it.
 *
 * THE WORDS ARE RELAYED, NEVER COMPUTED. ADR-0009 forbids this site forming a
 * forecaster's judgement, and ADR-0024 measured what happens when it tries:
 * banding the daylight cloud mean on the service's own scale disagreed with the
 * service's own published wording on three days of six. A site that names a
 * source and then contradicts it in that source's vocabulary has said something
 * worse than nothing. So `shortForecast` arrives here as a string and leaves as
 * the same string -- not title-cased, not shortened, not mapped to a vocabulary
 * of ours. Anything in this file that transformed it would be the bug.
 *
 * A PERIOD IS HALF A DAY, AND THE PUBLISHER DECIDES WHICH HALF. Measured
 * 2026-08-28 at `SGX/54,21`: 14 periods, alternating daytime and night, the
 * daytime halves running 06:00 to 18:00 local. That is not this site's daylight
 * window -- which is astronomy, computed per beach, and ran 6:14 AM to 7:32 PM
 * that day -- and the two are deliberately not reconciled. The window is ours
 * and the period is theirs.
 *
 * THE FIRST PERIOD IS NOT TODAY'S. It is whatever half of today has not
 * finished: the captured payload opens on "This Afternoon" because it was taken
 * at 2:25 PM, and the same request at 9 PM opens on "Tonight". A caller that
 * took `periods[0]` would print tonight's fog against tomorrow's date twice a
 * day. Selection is by instant, and it belongs to the caller that knows which
 * Pacific date it is asking about.
 *
 * INSTANTS CARRY THEIR OFFSET, AND THIS PARSER REFUSES ONE THAT DOES NOT. The
 * same hazard ADR-0009 records and `nws-gridpoint.ts` guards: a timestamp with
 * no zone, read as local and tagged UTC, ages every period by seven hours,
 * which here would shift a whole forecast onto the wrong side of midnight.
 */

/** `2026-08-28T14:00:00-07:00`. Offset-less would be ADR-0009's hazard. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

export class NwsForecastDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsForecastDriftError";
  }
}

export class NwsForecastNoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsForecastNoDataError";
  }
}

/** One half of one day, as the National Weather Service divides and names it. */
export interface ForecastPeriod {
  /**
   * The publisher's own name for this period.
   *
   * "Tonight", "Saturday", "Saturday Night", "This Afternoon". Carried rather
   * than derived from the instants, because it is what the forecaster called
   * the period and because deriving it would mean this site deciding when the
   * afternoon starts.
   */
  name: string;
  /** Start of the period, epoch milliseconds UTC. */
  startMs: number;
  /** End of the period, epoch milliseconds UTC. */
  endMs: number;
  /**
   * True for the daylight half of the publisher's own division of the day.
   *
   * Their division, not this site's daylight window. A day panel wants the
   * daytime half because that is when a trip happens, and it falls back to the
   * night half only for a today whose daytime half has already ended.
   */
  isDaytime: boolean;
  /**
   * The forecaster's own words, exactly as published.
   *
   * "Patchy Fog then Mostly Sunny". The transitions are the part a computed
   * band word cannot express and the part a parent plans around, and they are
   * why ADR-0024 deferred this read rather than banding a mean.
   */
  shortForecast: string;
}

export interface SkyWordingForecast {
  /** The cell this was read for, as `office/x,y`. */
  cellId: string;
  /** Every period the publisher issued, oldest first. */
  periods: ForecastPeriod[];
}

/**
 * One period's instant, with its offset required.
 *
 * Throws rather than skipping. A period this parser cannot place in time is a
 * change in the payload's contract, and dropping it would take a day of the
 * week off the panel with nothing said about why.
 */
function instantOf(
  raw: unknown,
  field: string,
  cellId: string,
  periodName: string,
): number {
  if (typeof raw !== "string" || !INSTANT.test(raw)) {
    throw new NwsForecastDriftError(
      `${cellId}: the period ${JSON.stringify(periodName)} carried ${field} ` +
        `${JSON.stringify(raw)}. This parser pins an ISO instant with its offset stated; ` +
        `one without an offset would be read as local and tagged UTC, moving every period ` +
        `by seven hours.`,
    );
  }

  const atMs = Date.parse(raw);
  if (Number.isNaN(atMs)) {
    throw new NwsForecastDriftError(
      `${cellId}: the period ${JSON.stringify(periodName)} carried ${field} ` +
        `${JSON.stringify(raw)}, which matched the shape and did not parse as an instant.`,
    );
  }

  return atMs;
}

/**
 * Read one cell's day-and-night forecast periods.
 *
 * @throws {NwsForecastDriftError} the payload's shape moved, or a period is
 *   missing the words that are the whole product
 * @throws {NwsForecastNoDataError} the cell answered with no periods at all
 */
export function parseSkyWording(
  payload: unknown,
  cellId: string,
): SkyWordingForecast {
  const properties = (payload as { properties?: Record<string, unknown> })
    ?.properties;
  if (!properties || typeof properties !== "object") {
    throw new NwsForecastDriftError(
      `${cellId}: the response carried no properties object.`,
    );
  }

  const raw = properties.periods;
  if (!Array.isArray(raw)) {
    throw new NwsForecastDriftError(
      `${cellId}: periods was ${JSON.stringify(raw)} where an array was expected.`,
    );
  }

  if (raw.length === 0) {
    // Not drift. A cell that answers and has not been forecast is a quiet
    // office, and the panel says so rather than showing a computed word.
    throw new NwsForecastNoDataError(
      `${cellId}: the National Weather Service published no forecast periods for this ` +
        `cell. It answers and has no words for the sky here.`,
    );
  }

  const periods: ForecastPeriod[] = [];
  for (const entry of raw as Record<string, unknown>[]) {
    const name = typeof entry?.name === "string" ? entry.name : "";
    if (name === "") {
      throw new NwsForecastDriftError(
        `${cellId}: a period carried name ${JSON.stringify(entry?.name)}. The name is what ` +
          `the panel prints beside the words, and it is the publisher's to give.`,
      );
    }

    if (typeof entry.isDaytime !== "boolean") {
      throw new NwsForecastDriftError(
        `${cellId}: the period ${JSON.stringify(name)} carried isDaytime ` +
          `${JSON.stringify(entry.isDaytime)}, which is not a boolean. Guessing it from the ` +
          `clock would be this site deciding where the publisher's day ends.`,
      );
    }

    // The whole reason this module exists. A period without words is not a
    // quiet period -- it is the one field this product is for, gone missing.
    if (typeof entry.shortForecast !== "string" || entry.shortForecast === "") {
      throw new NwsForecastDriftError(
        `${cellId}: the period ${JSON.stringify(name)} carried shortForecast ` +
          `${JSON.stringify(entry.shortForecast)}. That field is the entire product this ` +
          `request is made for, and there is no second wording to fall back to.`,
      );
    }

    const startMs = instantOf(entry.startTime, "startTime", cellId, name);
    const endMs = instantOf(entry.endTime, "endTime", cellId, name);
    if (endMs <= startMs) {
      throw new NwsForecastDriftError(
        `${cellId}: the period ${JSON.stringify(name)} ends at or before it starts.`,
      );
    }

    periods.push({
      name,
      startMs,
      endMs,
      isDaytime: entry.isDaytime,
      shortForecast: entry.shortForecast,
    });
  }

  periods.sort((a, b) => a.startMs - b.startMs);

  return { cellId, periods };
}

/** The URL one cell's worded forecast is read from. */
export function skyWordingUrl(cellId: string): string {
  return `https://api.weather.gov/gridpoints/${cellId}/forecast`;
}
