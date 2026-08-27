/**
 * Reading a National Weather Service gridpoint forecast.
 *
 * Pure and offline, like the four parsers beside it, so a pinned unit or an
 * interval shape is asserted against a committed payload without a network.
 *
 * WHAT THIS FEED PUBLISHES, AND WHAT IT ONLY DECLARES. Every `/gridpoints`
 * payload carries `skyCover`, `visibility` and `ceilingHeight` as keys. Measured
 * 2026-08-26 across the 21 cells covering this inventory, `skyCover` held 34 to
 * 37 entries at every one and the other two held an empty `values` array at
 * every one. **A declared key is not a published variable**, which is why this
 * module reads sky cover and offers no visibility at all, and why
 * `assertPublished` counts entries rather than testing for a key. See
 * `docs/adr/0020-sky-leaves-the-card-for-the-week.md`.
 *
 * TIME ARRIVES AS AN INTERVAL, NOT AN INSTANT. Each entry's `validTime` is
 * `<ISO-8601 instant>/<ISO-8601 duration>` -- `2026-08-26T12:00:00+00:00/PT3H`
 * -- and one entry therefore covers three or six hours. The instants carry an
 * offset, which is what keeps this clear of the hazard ADR-0009 records: a feed
 * whose timestamps have no zone, read as local and tagged UTC, ages every
 * reading by seven or eight hours. This parser refuses an offset-less instant
 * rather than assuming one.
 *
 * ENTRIES ARE EXPANDED TO HOURLY STEPS. A caller selecting the daylight hours
 * of a day cannot do it against three-hour blocks without deciding what a block
 * straddling sunrise means. Expanding here, once, means every caller asks the
 * same question of the same shape -- and it is the parser's job because the
 * duration is part of the payload's contract rather than of anybody's view.
 *
 * FOG IS NOT A SERIES. `weather` carries phenomena as occasional entries, most
 * of them naming nothing: measured across three cells read in full, 12 entries
 * each, six named a phenomenon and the rest were empty. So a day usually has no
 * phenomenon and that is normal rather than missing.
 */

/** What the payload must declare for the one number this module reads. */
const SKY_COVER_UNIT = "wmoUnit:percent";

/** `2026-08-26T12:00:00+00:00/PT3H`. Offset-less would be ADR-0009's hazard. */
const INTERVAL =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\/P(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/;

export class NwsGridpointDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsGridpointDriftError";
  }
}

export class NwsGridpointNoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NwsGridpointNoDataError";
  }
}

/** One hour of the forecast, expanded from the interval that covered it. */
export interface SkyCoverHour {
  /** Start of the hour, epoch milliseconds UTC. */
  atMs: number;
  /** Cloud cover as a percentage, 0 to 100, as the service publishes it. */
  percent: number;
}

/** One hour a phenomenon was forecast for. */
export interface WeatherHour {
  atMs: number;
  /** The phenomenon itself, as published: `fog`, `rain_showers`. */
  weather: string;
  /** `patchy`, `areas`, `chance` -- null when the service names none. */
  coverage: string | null;
}

export interface GridpointForecast {
  /** The cell this was read for, as `office/x,y`. */
  cellId: string;
  /** Every forecast hour, oldest first. */
  skyCover: SkyCoverHour[];
  /** Only the hours a phenomenon was named for, which is most days none. */
  weather: WeatherHour[];
}

/** Hours covered by an ISO-8601 duration of the shape this feed uses. */
function hoursOf(days: string | undefined, hours: string | undefined): number {
  return (
    (days === undefined ? 0 : Number(days) * 24) +
    (hours === undefined ? 0 : Number(hours))
  );
}

/**
 * The start instant and length of one entry's interval.
 *
 * Throws rather than skipping: an interval this parser cannot read is a change
 * in the payload's contract, and silently dropping it would shorten the week by
 * a day nobody noticed.
 */
function intervalOf(
  validTime: unknown,
  cellId: string,
  key: string,
): { startMs: number; hours: number } {
  if (typeof validTime !== "string") {
    throw new NwsGridpointDriftError(
      `${cellId}: a ${key} entry carried validTime ${JSON.stringify(validTime)}, which is ` +
        `not a string.`,
    );
  }

  const match = INTERVAL.exec(validTime);
  if (match === null) {
    throw new NwsGridpointDriftError(
      `${cellId}: a ${key} entry carried validTime ${JSON.stringify(validTime)}. This parser ` +
        `pins <instant>/<duration> with the instant's offset stated; an instant without one ` +
        `would be read as local and tagged UTC, which ages every reading by hours.`,
    );
  }

  const [, instant, days, hours] = match;
  const startMs = Date.parse(instant);
  if (Number.isNaN(startMs)) {
    throw new NwsGridpointDriftError(
      `${cellId}: a ${key} entry's validTime ${JSON.stringify(validTime)} matched the shape ` +
        `and did not parse as an instant.`,
    );
  }

  const span = hoursOf(days, hours);
  if (span <= 0) {
    throw new NwsGridpointDriftError(
      `${cellId}: a ${key} entry's validTime ${JSON.stringify(validTime)} covers no time.`,
    );
  }

  return { startMs, hours: span };
}

/**
 * The `values` array of a series that must actually carry values.
 *
 * The whole reason this function exists rather than a property access: the key
 * is always there. `visibility` and `ceilingHeight` prove it on every request.
 */
function assertPublished(
  properties: Record<string, unknown>,
  key: string,
  cellId: string,
): unknown[] {
  const series = properties[key] as { values?: unknown } | undefined;
  if (series === undefined || series === null) {
    throw new NwsGridpointDriftError(
      `${cellId}: the payload declares no ${key} at all. Every gridpoint response has ` +
        `carried one, so its absence is a change in the product rather than a quiet cell.`,
    );
  }

  const values = series.values;
  if (!Array.isArray(values)) {
    throw new NwsGridpointDriftError(
      `${cellId}: ${key} carried ${JSON.stringify(values)} where an array of values was ` +
        `expected.`,
    );
  }

  if (values.length === 0) {
    // Not drift. This is exactly what visibility and ceilingHeight do at every
    // cell, and what a real cell does when the office has not run the product.
    throw new NwsGridpointNoDataError(
      `${cellId}: the National Weather Service declares ${key} and published no values for ` +
        `it. The cell answers and does not forecast this.`,
    );
  }

  return values;
}

/**
 * Read one cell's sky cover and present weather.
 *
 * @throws {NwsGridpointDriftError} the payload's shape or unit moved
 * @throws {NwsGridpointNoDataError} the cell published no sky cover
 */
export function parseGridpointForecast(
  payload: unknown,
  cellId: string,
): GridpointForecast {
  const properties = (payload as { properties?: Record<string, unknown> })
    ?.properties;
  if (!properties || typeof properties !== "object") {
    throw new NwsGridpointDriftError(
      `${cellId}: the response carried no properties object.`,
    );
  }

  const skyCoverSeries = properties.skyCover as { uom?: unknown };
  const values = assertPublished(properties, "skyCover", cellId);

  if (skyCoverSeries.uom !== SKY_COVER_UNIT) {
    throw new NwsGridpointDriftError(
      `${cellId}: skyCover is declared in ${JSON.stringify(skyCoverSeries.uom)} where this ` +
        `site pins ${SKY_COVER_UNIT}. A silent unit change would put a fraction on the page ` +
        `as a percentage.`,
    );
  }

  const skyCover: SkyCoverHour[] = [];
  for (const entry of values as { validTime?: unknown; value?: unknown }[]) {
    const { startMs, hours } = intervalOf(entry.validTime, cellId, "skyCover");
    // A null value inside a populated series is one gap rather than a dead
    // cell: the service leaves them where it has not forecast that step, and
    // dropping the step is right where refusing the whole read would not be.
    if (entry.value === null || entry.value === undefined) continue;
    if (typeof entry.value !== "number" || !Number.isFinite(entry.value)) {
      throw new NwsGridpointDriftError(
        `${cellId}: a skyCover entry carried value ${JSON.stringify(entry.value)}, which is ` +
          `not a number.`,
      );
    }
    if (entry.value < 0 || entry.value > 100) {
      throw new NwsGridpointDriftError(
        `${cellId}: a skyCover entry carried ${entry.value}, outside the 0 to 100 its ` +
          `declared unit allows.`,
      );
    }
    for (let hour = 0; hour < hours; hour += 1) {
      skyCover.push({
        atMs: startMs + hour * 3_600_000,
        percent: entry.value,
      });
    }
  }

  if (skyCover.length === 0) {
    throw new NwsGridpointNoDataError(
      `${cellId}: every skyCover entry the National Weather Service published was empty, so ` +
        `there is no cloud cover to show.`,
    );
  }

  // Present weather is optional in a way sky cover is not: a week with no fog
  // and no showers forecast is an ordinary week, not a failure.
  const weather: WeatherHour[] = [];
  const weatherSeries = properties.weather as { values?: unknown } | undefined;
  if (weatherSeries && Array.isArray(weatherSeries.values)) {
    for (const entry of weatherSeries.values as {
      validTime?: unknown;
      value?: unknown;
    }[]) {
      if (!Array.isArray(entry.value)) continue;
      const named = (
        entry.value as { weather?: unknown; coverage?: unknown }[]
      ).find(
        (item) => typeof item?.weather === "string" && item.weather !== "",
      );
      if (named === undefined) continue;
      const { startMs, hours } = intervalOf(entry.validTime, cellId, "weather");
      for (let hour = 0; hour < hours; hour += 1) {
        weather.push({
          atMs: startMs + hour * 3_600_000,
          weather: named.weather as string,
          coverage: typeof named.coverage === "string" ? named.coverage : null,
        });
      }
    }
  }

  skyCover.sort((a, b) => a.atMs - b.atMs);
  weather.sort((a, b) => a.atMs - b.atMs);

  return { cellId, skyCover, weather };
}

/** The URL one cell's forecast is read from. */
export function gridpointUrl(cellId: string): string {
  return `https://api.weather.gov/gridpoints/${cellId}`;
}
