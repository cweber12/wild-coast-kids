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
 * IT ALSO PUBLISHES THE WIND, WHICH THIS SITE HAS NEVER FORECAST. Until now the
 * page knew the wind only as a measurement of this minute, from the air
 * station. Captured 2026-08-28 from `SGX/54,21` and committed beside this file:
 * `windSpeed`, `windDirection` and `windGust` each expand to 185 gapless hours,
 * and `temperature` and `apparentTemperature` to 180. `visibility` and
 * `ceilingHeight` were declared and empty again, so ADR-0020 stands unchanged
 * and this module still offers no visibility.
 *
 * FOUR OF THE SIX ARRIVE IN UNITS THIS SITE DOES NOT SHOW -- km/h and Celsius
 * against miles per hour and Fahrenheit. The unit is read off the payload and
 * asserted rather than assumed, and the conversion happens here, once, so that
 * no view can hold a number whose unit it has to guess at.
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

/** Kilometres in a mile, so `km_h-1` becomes the miles per hour the page shows. */
const KM_PER_MILE = 1.609344;

/** How one series is read: what it must declare, what it may hold, what it becomes. */
interface SeriesSpec {
  /**
   * The unit code the payload must declare.
   *
   * Read and asserted, never assumed. Four of the six differ from what this
   * site displays -- km/h against mph, Celsius against Fahrenheit -- so a
   * silent switch upstream would put a plausible wrong number on the page
   * rather than an obviously wrong one. This is the same pinning
   * `nws-observation.ts` does for the same agency's observations.
   */
  unit: string;
  /**
   * The range the declared unit makes a fact, or null where it makes none.
   *
   * A percentage runs 0 to 100 and a bearing 0 to 360 because their units say
   * so, and a speed is not negative because a speed is not negative. Celsius
   * forbids no figure this coast could produce, so temperature is bounded at
   * neither end: a plausible-looking limit here would be this file deciding
   * what the weather is allowed to do.
   */
  min: number | null;
  max: number | null;
  /** From the published unit into the one the page shows. Identity where they agree. */
  toDisplay: (published: number) => number;
}

type SeriesKey =
  | "skyCover"
  | "windSpeed"
  | "windGust"
  | "windDirection"
  | "temperature"
  | "apparentTemperature";

const identity = (published: number): number => published;
const kmhToMph = (kmh: number): number => kmh / KM_PER_MILE;
const degCToDegF = (degC: number): number => degC * 1.8 + 32;

const SERIES: Record<SeriesKey, SeriesSpec> = {
  skyCover: { unit: "wmoUnit:percent", min: 0, max: 100, toDisplay: identity },
  windSpeed: {
    unit: "wmoUnit:km_h-1",
    min: 0,
    max: null,
    toDisplay: kmhToMph,
  },
  windGust: { unit: "wmoUnit:km_h-1", min: 0, max: null, toDisplay: kmhToMph },
  windDirection: {
    unit: "wmoUnit:degree_(angle)",
    min: 0,
    max: 360,
    toDisplay: identity,
  },
  temperature: {
    unit: "wmoUnit:degC",
    min: null,
    max: null,
    toDisplay: degCToDegF,
  },
  apparentTemperature: {
    unit: "wmoUnit:degC",
    min: null,
    max: null,
    toDisplay: degCToDegF,
  },
};

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

/** One hour of a forecast series, expanded from the interval that covered it. */
export interface GridpointHour {
  /** Start of the hour, epoch milliseconds UTC. */
  atMs: number;
  /** The value, in the unit named by the field carrying this series. */
  value: number;
  /**
   * True on the hour an interval began, false on the hours it was held across.
   *
   * **The expansion loses this and a plot needs it back.** The service does not
   * publish hourly: it publishes intervals, and the committed payload carries
   * ten distinct block lengths across the six series -- one hour near the
   * present, three and six further out. Every hour of a six-hour block carries
   * the same figure because that is what the block says, but only the first of
   * them is an instant the office issued, and a chart marking all six would
   * claim this cell forecasts the wind hourly a week out.
   *
   * It is the same flag `SparkPoint` carries and it means the same thing:
   * where the publisher put a point. What it does *not* mean here is that the
   * held hours are guesses -- the block's value covers them, which is a
   * stronger claim than the interpolation between two of CDIP's estimates.
   * What the two share is that the mark is the publisher's resolution.
   */
  published: boolean;
}

/**
 * A series the cell may or may not forecast.
 *
 * **An absence is named rather than empty.** The two facts a reader has to be
 * able to tell apart are "the wind drops to nothing" and "we were not told",
 * and a plot that drew a flat line at zero for the second would make the
 * stronger claim of the two out of the weaker fact. So the absence carries a
 * sentence, and the sentence is the parser's to write rather than a component's
 * to invent: only here is it known whether the key was missing or was declared
 * and empty.
 *
 * **This is a softer treatment than `skyCover` gets, deliberately.** An empty
 * `skyCover` throws, taking the whole read down, and that strictness rests on a
 * measurement -- 21 of 21 cells covering this inventory published it. No such
 * measurement exists for these five, so refusing the cell over one of them
 * would be asserting something nobody checked, and it would let the scarcest
 * series decide for the other four. That is the coupling ADR-0010 and ADR-0020
 * both spent a decision undoing, one layer up.
 */
export type GridpointSeries =
  | { kind: "published"; hours: GridpointHour[] }
  | { kind: "absent"; reason: string };

export interface GridpointForecast {
  /** The cell this was read for, as `office/x,y`. */
  cellId: string;
  /** Every forecast hour, oldest first. */
  skyCover: SkyCoverHour[];
  /** Only the hours a phenomenon was named for, which is most days none. */
  weather: WeatherHour[];
  /** Wind speed in miles per hour, converted from the published km/h. */
  windMph: GridpointSeries;
  /**
   * Gust in miles per hour, converted from the published km/h.
   *
   * Its own series rather than a field on the wind one: the feed publishes the
   * two on their own interval boundaries -- 64 gust entries against 61 of speed
   * in the committed payload -- so pairing them here would mean inventing which
   * gust belongs to which hour of wind.
   */
  gustMph: GridpointSeries;
  /**
   * Wind direction in degrees true, which is the direction the wind blows
   * *from*. Unconverted: the feed publishes degrees and the page shows degrees.
   */
  windDirDegT: GridpointSeries;
  /** Air temperature in Fahrenheit, converted from the published Celsius. */
  airTempF: GridpointSeries;
  /**
   * What the air is forecast to feel like, in Fahrenheit.
   *
   * **Pinned before it is rendered**, which is `mop-forecast.ts`'s treatment of
   * `waveDp` rather than a field nobody asked for: it arrives in the same
   * response at no extra request, and unit-pinning it now means the day it is
   * shown it is already known to be Celsius. It is not the temperature and must
   * never be drawn as though it were.
   */
  apparentTempF: GridpointSeries;
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
 * One series, unit-checked and expanded to hourly steps.
 *
 * The expansion is here rather than in each caller because it is the same
 * treatment for all six: the payload's duration is part of its contract, and a
 * caller selecting the daylight hours of a day cannot do that against blocks
 * of three, six or fourteen hours without inventing a rule for one that
 * straddles sunrise. The committed payload carries ten distinct block lengths
 * across the six series, which is why none of them may assume three.
 *
 * @throws {NwsGridpointDriftError} the shape, the unit or a value moved
 * @throws {NwsGridpointNoDataError} the key is declared and carries nothing
 */
function expandToHours(
  properties: Record<string, unknown>,
  key: SeriesKey,
  cellId: string,
): GridpointHour[] {
  const spec = SERIES[key];

  // `assertPublished` first, and the order matters: it is what turns a key that
  // is missing altogether into a stated drift error. Reaching for `uom` before
  // it would throw a bare TypeError off `undefined` instead, which says nothing
  // about the payload to whoever reads the log.
  const values = assertPublished(properties, key, cellId);
  const declared = (properties[key] as { uom?: unknown }).uom;

  if (declared !== spec.unit) {
    throw new NwsGridpointDriftError(
      `${cellId}: ${key} is declared in ${JSON.stringify(declared)} where this site ` +
        `pins ${spec.unit}. The payload states its own units and a silent change would ` +
        `put a number converted on the old assumption onto the page.`,
    );
  }

  const hours: GridpointHour[] = [];
  for (const entry of values as { validTime?: unknown; value?: unknown }[]) {
    const { startMs, hours: span } = intervalOf(entry.validTime, cellId, key);
    // A null value inside a populated series is one gap rather than a dead
    // cell: the service leaves them where it has not forecast that step, and
    // dropping the step is right where refusing the whole read would not be.
    if (entry.value === null || entry.value === undefined) continue;
    if (typeof entry.value !== "number" || !Number.isFinite(entry.value)) {
      throw new NwsGridpointDriftError(
        `${cellId}: a ${key} entry carried value ${JSON.stringify(entry.value)}, which is ` +
          `not a number.`,
      );
    }
    if (spec.min !== null && spec.max !== null) {
      if (entry.value < spec.min || entry.value > spec.max) {
        throw new NwsGridpointDriftError(
          `${cellId}: a ${key} entry carried ${entry.value}, outside the ${spec.min} to ` +
            `${spec.max} its declared unit allows.`,
        );
      }
    } else if (spec.min !== null && entry.value < spec.min) {
      throw new NwsGridpointDriftError(
        `${cellId}: a ${key} entry carried ${entry.value}, below the ${spec.min} its ` +
          `declared unit allows.`,
      );
    }

    const value = spec.toDisplay(entry.value);
    for (let hour = 0; hour < span; hour += 1) {
      // Only the interval's own instant is the office's. See `published`.
      hours.push({
        atMs: startMs + hour * 3_600_000,
        value,
        published: hour === 0,
      });
    }
  }

  hours.sort((a, b) => a.atMs - b.atMs);
  return hours;
}

/**
 * One series that the cell is allowed not to forecast.
 *
 * Only `NwsGridpointNoDataError` becomes an absence. Drift still propagates and
 * still takes the read down, because a unit that moved or a shape that changed
 * is a fact about the product rather than about this cell -- and a wrong number
 * is worse than no number, which is the whole argument for pinning the units at
 * all.
 *
 * A key missing altogether is drift as well, not an absence: the six arrive as
 * one schema at every cell, so one of them vanishing is the product changing
 * rather than this cell going quiet. What is softened here is only the
 * declared-and-empty case, which is the one `visibility` demonstrates on every
 * single request.
 */
function readOptionalSeries(
  properties: Record<string, unknown>,
  key: SeriesKey,
  cellId: string,
): GridpointSeries {
  try {
    const hours = expandToHours(properties, key, cellId);
    if (hours.length === 0) {
      return {
        kind: "absent",
        reason:
          `${cellId}: every ${key} entry the National Weather Service published was ` +
          `empty, so there is nothing to draw.`,
      };
    }
    return { kind: "published", hours };
  } catch (cause) {
    if (cause instanceof NwsGridpointNoDataError) {
      return { kind: "absent", reason: cause.message };
    }
    throw cause;
  }
}

/**
 * Read one cell's sky cover, present weather, wind and temperature.
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

  /*
    Sky cover stays the one series this read cannot do without, and it keeps
    its own name for its own hours. `SkyCoverHour.percent` is what `readSkyWeek`
    and `SkyWeekDay` are built on; renaming it to the generic `value` would be a
    refactor of the cloud row wearing the clothes of a wind slice.
  */
  const skyCover: SkyCoverHour[] = expandToHours(
    properties,
    "skyCover",
    cellId,
  ).map((hour) => ({ atMs: hour.atMs, percent: hour.value }));

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

  // Sky cover is already in order -- `expandToHours` sorts every series it
  // returns. Present weather is built here and still needs its own.
  weather.sort((a, b) => a.atMs - b.atMs);

  /*
    Four series the page has never had, and one it will not draw yet. Each is
    read on its own so that a cell quiet about the wind still answers about the
    temperature: the alternative is the coupling ADR-0010 spent a decision
    undoing, where the scarcest variable decided for the rest.
  */
  return {
    cellId,
    skyCover,
    weather,
    windMph: readOptionalSeries(properties, "windSpeed", cellId),
    gustMph: readOptionalSeries(properties, "windGust", cellId),
    windDirDegT: readOptionalSeries(properties, "windDirection", cellId),
    airTempF: readOptionalSeries(properties, "temperature", cellId),
    apparentTempF: readOptionalSeries(
      properties,
      "apparentTemperature",
      cellId,
    ),
  };
}

/** The URL one cell's forecast is read from. */
export function gridpointUrl(cellId: string): string {
  return `https://api.weather.gov/gridpoints/${cellId}`;
}
