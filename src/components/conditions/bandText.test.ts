import { expect, test } from "vitest";
import {
  bandView,
  heightWords,
  plainWords,
  skyGlyph,
  warmthWord,
  windWords,
  type MeasuredReadings,
} from "./bandText";

/** 2026-08-17, 11:13 AM Pacific. Not a round hour, so a dropped minute shows. */
const WAVE_TAKEN_AT_MS = Date.UTC(2026, 7, 17, 18, 13);
/** 10:48 AM Pacific: 25 minutes behind the buoy, the way the two feeds run. */
const AIR_TAKEN_AT_MS = Date.UTC(2026, 7, 17, 17, 48);

const WAVE_READING = {
  kind: "reading",
  heightFt: 2.62,
  periodS: 5,
  directionDegT: 278,
  waterTempF: 69.98,
  observedAtMs: WAVE_TAKEN_AT_MS,
} as const;

const AIR_READING = {
  kind: "reading",
  airTempF: 71.42,
  windMph: 8.05,
  gustMph: null,
  windDirDegT: 320,
  observedAtMs: AIR_TAKEN_AT_MS,
} as const;

const NEAR_BUOY = { name: "Scripps Nearshore", distanceM: 1400 };
const PIER = { name: "Scripps Pier", distanceM: 1381 };

function readings(
  overrides: {
    waves?: Partial<MeasuredReadings["waves"]>;
    air?: Partial<MeasuredReadings["air"]>;
  } = {},
): MeasuredReadings {
  return {
    waves: {
      beachName: "La Jolla Shores Beach",
      buoy: NEAR_BUOY,
      state: WAVE_READING,
      ...overrides.waves,
    },
    air: {
      beachName: "La Jolla Shores Beach",
      airStation: PIER,
      air: AIR_READING,
      ...overrides.air,
    },
  } as MeasuredReadings;
}

/* =========================================================================
 * What the band is
 * ========================================================================= */

test("two sources are two segments, each with its own figures and words", () => {
  const { segments } = bandView(readings());

  expect(segments).toHaveLength(2);
  expect(segments[0]).toEqual({
    label: "Sea",
    emoji: "🏄",
    text: "2.6 ft · 70°F water",
    gloss: "about waist high.",
  });
  expect(segments[1]).toEqual({
    label: "Air",
    emoji: "💨",
    text: "71°F · 8 mph from the north-west",
    gloss: "Mild, with a gentle breeze.",
  });
});

/**
 * ADR-0010 permits two provenances behind one panel and refuses them behind one
 * sentence. `ReadingCard`'s gloss docstring named this change as the temptation
 * -- "the temptation once the cards are being compressed is to merge them" --
 * so the property is asserted rather than left to whoever edits next.
 */
test("the two plain-words lines are never merged into one sentence", () => {
  const { segments } = bandView(readings());

  const glosses = segments.map((segment) => segment.gloss);
  expect(glosses).toHaveLength(2);
  for (const gloss of glosses) {
    expect(gloss).not.toContain("about waist high, mild");
    expect(gloss).not.toMatch(/high.*breeze/);
  }
});

/**
 * ADR-0015's vocabulary is closed, and the band adds no word to it. A third
 * glyph for the clock was the obvious temptation while making a line scannable.
 */
test("only the two card glyphs appear", () => {
  const { segments } = bandView(readings());

  expect(segments.map((segment) => segment.emoji)).toEqual(["🏄", "💨"]);
});

/* =========================================================================
 * Measurements only
 * ========================================================================= */

/**
 * The count that decided the band's shape: 36 of 51 beaches have no buoy, and
 * ADR-0048 withholds waves from 15 of 18 areas. A wave slot with no reading
 * produces no segment at all -- the sentence explaining why hangs off the
 * modelled height standing in for it (ADR-0055), which is a different region.
 */
test("a beach with no buoy contributes no wave segment", () => {
  const { segments } = bandView(
    readings({
      waves: {
        buoy: null,
        state: {
          kind: "no-buoy",
          reason: "every wave buoy sits out on the open coast",
          modelAnswersInstead: true,
        },
      },
    }),
  );

  expect(segments).toHaveLength(1);
  expect(segments[0].emoji).toBe("💨");
});

test("a quiet buoy contributes no wave segment either", () => {
  const { segments } = bandView(
    readings({
      waves: {
        state: { kind: "unavailable", detail: "NDBC timed out.", drift: false },
      },
    }),
  );

  expect(segments).toHaveLength(1);
});

/** ADR-0048: an area whose beaches bind different buoys reports no wave figure. */
test("a withheld wave product contributes no segment", () => {
  const { segments } = bandView(
    readings({
      waves: {
        agreement: "mixed",
        areaName: "La Jolla",
        beaches: 10,
        distinct: 2,
        without: 1,
      } as MeasuredReadings["waves"],
    }),
  );

  expect(segments).toHaveLength(1);
});

/* =========================================================================
 * Air always speaks
 * ========================================================================= */

/**
 * All 51 beaches bind a station and all 18 areas share one, so an absence here
 * is an outage rather than a fact about the place. CLAUDE.md: nothing skipped,
 * empty or unusable goes unreported.
 */
test("a quiet station is named rather than leaving the band empty", () => {
  const { segments } = bandView(
    readings({
      waves: {
        buoy: null,
        state: {
          kind: "no-buoy",
          reason: "inside a bay",
          modelAnswersInstead: false,
        },
      },
      air: {
        air: { kind: "unavailable", detail: "504 from NWS", drift: false },
      },
    }),
  );

  expect(segments).toHaveLength(1);
  expect(segments[0].text).toBe("Scripps Pier is not answering just now.");
  expect(segments[0].gloss).toBeNull();
});

/**
 * ADR-0022 routes drift to a GitHub issue, so what is left on the page is the
 * courtesy: not blaming a station for this site's own parser. The upstream
 * error string does not come across -- a diagnostic for us, not prose for a
 * parent.
 */
test("a drifted payload blames this site, not the station", () => {
  const { segments } = bandView(
    readings({
      air: {
        air: {
          kind: "unavailable",
          detail: "expected 6 columns, saw 5",
          drift: true,
        },
      },
    }),
  );

  const air = segments[segments.length - 1];
  expect(air.text).toContain("a bug here, not at the station");
  expect(air.text).not.toContain("expected 6 columns");
});

/**
 * An absence is worded in the gloss, never set as the figure. Until
 * 2026-09-17 a station publishing no temperature led the segment with "No
 * temperature reading" in the bold figure register -- on the default page,
 * the first bold words a reader met were an absence. The wind is the figure
 * that was measured, so it is what leads; the missing temperature is said in
 * the plain-words line, ahead of the words for the wind.
 */
test("a station publishing no temperature leads with the wind, and says so in the gloss", () => {
  const { segments } = bandView(
    readings({ air: { air: { ...AIR_READING, airTempF: null } } }),
  );

  const air = segments[segments.length - 1];
  expect(air.text).toBe("8 mph from the north-west");
  expect(air.text).not.toContain("No temperature reading");
  expect(air.gloss).toBe("No temperature reading. A gentle breeze.");
});

/**
 * The lead still never renders empty. A reading with neither figure is a
 * station that answered with nothing this band prints, and a blank figure
 * reads as a calm day rather than as a silence.
 */
test("a station publishing neither figure says so, once, as the figure", () => {
  const { segments } = bandView(
    readings({
      air: { air: { ...AIR_READING, airTempF: null, windMph: null } },
    }),
  );

  const air = segments[segments.length - 1];
  expect(air.text).toBe("No temperature or wind reading");
  expect(air.gloss).toBeNull();
});

/**
 * Under a knot, a speed and a bearing dress instrument noise as weather -- and
 * the band drops the gust entirely, so "Calm" is what is left of the rule that
 * a calm wind reports no gust.
 */
test("a calm wind is a word, not a speed and a bearing", () => {
  const { segments } = bandView(
    readings({ air: { air: { ...AIR_READING, windMph: 0.4 } } }),
  );

  const air = segments[segments.length - 1];
  expect(air.text).toContain("Calm");
  expect(air.text).not.toContain("0 mph");
  expect(air.gloss).toBe("Mild, with no wind.");
});

/* =========================================================================
 * What was dropped, deliberately
 * ========================================================================= */

/**
 * Both need their own label to mean anything -- "6 s" is not a figure, "6 s
 * period" is -- and both are the most surfer-specific values on the block.
 * Asserted rather than left implicit, because they are a real loss: nothing
 * else on the page carries a measured period or gust. ADR-0056.
 */
test("period and gust do not appear", () => {
  const { segments } = bandView(
    readings({ air: { air: { ...AIR_READING, gustMph: 14.2 } } }),
  );

  const text = segments.map((segment) => segment.text).join(" ");
  expect(text).not.toContain("5 s");
  expect(text).not.toContain("14 mph");
});

/**
 * `StatGroup` printed "Not reported" for a null, and was right to: in a table a
 * blank cell where a measurement goes reads as a calm sea. In a run of
 * interpuncts there is no cell to leave blank, and "70°F water" carries its own
 * noun -- so the absence is an absence rather than a gap.
 */
test("a buoy with no water temperature prints the height alone", () => {
  const { segments } = bandView(
    readings({ waves: { state: { ...WAVE_READING, waterTempF: null } } }),
  );

  expect(segments[0].text).toBe("2.6 ft");
  expect(segments[0].text).not.toContain("Not reported");
});

/* =========================================================================
 * The bound, and the attribution
 * ========================================================================= */

/**
 * The oldest row behind any figure, not the newest. The newest would let a
 * fresh wind vouch for a temperature 25 minutes behind it -- which is the shape
 * these two feeds actually have. ADR-0054.
 */
test("the bound is the oldest row behind any figure on the band", () => {
  expect(bandView(readings()).observedAtMs).toBe(AIR_TAKEN_AT_MS);
  expect(bandView(readings()).observedAtMs).not.toBe(WAVE_TAKEN_AT_MS);
});

test("a source that printed no figure does not bound the band", () => {
  // A quiet buoy has no row. Bounding the band by a time nothing on it came
  // from would report the band as older than everything in it.
  const view = bandView(
    readings({
      waves: {
        state: { kind: "unavailable", detail: "NDBC timed out.", drift: false },
      },
    }),
  );

  expect(view.observedAtMs).toBe(AIR_TAKEN_AT_MS);
});

test("nothing measured means nothing to bound", () => {
  const view = bandView(
    readings({
      waves: {
        buoy: null,
        state: {
          kind: "no-buoy",
          reason: "inside a bay",
          modelAnswersInstead: false,
        },
      },
      air: { air: { kind: "unavailable", detail: "504", drift: false } },
    }),
  );

  expect(view.observedAtMs).toBeNull();
});

/**
 * ADR-0010's closing guarantee: "no figure is ever shown without the reader
 * being able to see where it came from". One line, both sources, on the band
 * itself rather than inside `ConditionsNotes`, which is a `<details>` closed by
 * default at the foot of the page.
 */
test("both instruments are named where their figures are", () => {
  const { attribution } = bandView(readings());

  expect(attribution).toBe(
    "Waves from Buoy Scripps Nearshore (NDBC) · air from Scripps Pier, 1.4 km away",
  );
});

test("a source with no figure is not credited with one", () => {
  const { attribution } = bandView(
    readings({
      waves: {
        state: { kind: "unavailable", detail: "NDBC timed out.", drift: false },
      },
    }),
  );

  expect(attribution).toBe("Air from Scripps Pier, 1.4 km away");
});

/** A buoy is named without a distance under 10 km; the threshold has its reason
 *  recorded where it is made, and came across from the card unchanged. */
test("a distant buoy discloses how far away it is", () => {
  const { attribution } = bandView(
    readings({
      waves: { buoy: { name: "Point Loma South", distanceM: 34_159 } },
    }),
  );

  expect(attribution).toContain("Point Loma South (NDBC), 34 km away");
});

test("a nearby buoy is credited without a distance", () => {
  expect(bandView(readings()).attribution).toContain(
    "Buoy Scripps Nearshore (NDBC) ·",
  );
});

/* =========================================================================
 * The wording bands
 * ========================================================================= */

/**
 * These three sets of bands are this site's own wording for published figures.
 * Nothing upstream defines them and they are not a standard, so this file is
 * the only place they can be asserted -- a point `MeasuredToday`'s tests made
 * before they came across with the functions they cover.
 *
 * Both ends of every scale, not just the middle. Flat water and a large sea are
 * the readings a parent is most likely to be checking for, and they were the
 * two that went unasserted the last time these bands moved.
 */
test("every wave height band has its own words", () => {
  const bands: [number, string][] = [
    [0.4, "close to flat"],
    [1.5, "about knee to thigh high"],
    [2.62, "about waist high"],
    [3.8, "overhead for a child"],
    [6.2, "large"],
  ];

  for (const [heightFt, words] of bands) {
    expect(heightWords(heightFt), `${heightFt} ft`).toBe(words);
  }
});

test("every warmth band has its own word", () => {
  const bands: [number, string][] = [
    [44, "Cold"],
    [55, "Chilly"],
    [63, "Cool"],
    [71, "Mild"],
    [79, "Warm"],
    [92, "Hot"],
  ];

  for (const [fahrenheit, word] of bands) {
    expect(warmthWord(fahrenheit), `${fahrenheit}°F`).toBe(word);
  }
});

/**
 * Miles per hour is the figure here that most needs translating: a parent reads
 * 76 °F without help and reads 11 mph without knowing whether that is windy.
 */
test("every wind band has its own words", () => {
  const bands: [number, string][] = [
    [0.4, "no wind"],
    [2.5, "barely any wind"],
    [6, "a light breeze"],
    [10, "a gentle breeze"],
    [15, "a moderate breeze"],
    [22, "a fresh breeze"],
    [28, "a strong breeze"],
    [40, "a hard wind"],
  ];

  for (const [mph, words] of bands) {
    expect(windWords(mph), `${mph} mph`).toBe(words);
  }
});

/**
 * Either half alone still makes a sentence, because the field each station
 * publishes can be absent on its own -- and a wind-only line is capitalised,
 * since it is leading a sentence rather than following a comma.
 */
test("a gloss survives either half going missing, and none at all is null", () => {
  const base = {
    kind: "reading",
    gustMph: null,
    windDirDegT: 320,
    observedAtMs: 0,
  } as const;

  expect(plainWords({ ...base, airTempF: 71.42, windMph: null })).toBe("Mild.");
  expect(plainWords({ ...base, airTempF: null, windMph: 8.05 })).toBe(
    "A gentle breeze.",
  );
  expect(plainWords({ ...base, airTempF: null, windMph: null })).toBeNull();
});

/**
 * Air is shared by all eighteen areas, which `areas.test.ts` asserts, so this
 * is unreachable from the routes -- but the type permits it, and a band that
 * crashed on a state its own type allows would be worse than one that says
 * less.
 */
test("a withheld air product is worded rather than thrown", () => {
  const { segments, attribution, observedAtMs } = bandView(
    readings({
      air: {
        agreement: "absent",
        areaName: "Mission Bay – West",
        beaches: 8,
        distinct: 0,
        without: 8,
      } as MeasuredReadings["air"],
    }),
  );

  expect(segments[segments.length - 1].text).toBe(
    "No air reading for this area.",
  );
  expect(attribution).toBe("Waves from Buoy Scripps Nearshore (NDBC)");
  expect(observedAtMs).toBe(WAVE_TAKEN_AT_MS);
});

test("a beach with no station near enough says so", () => {
  const { segments } = bandView(
    readings({
      air: {
        airStation: null,
        air: { kind: "no-station", reason: "nothing within range" },
      },
    }),
  );

  expect(segments[segments.length - 1].text).toBe(
    "No air station near enough to read.",
  );
});

/* =========================================================================
 * The sky mark
 * ========================================================================= */

const sky = (over: Partial<Parameters<typeof skyGlyph>[0] & object> = {}) => ({
  percent: 10,
  weather: null,
  coverage: null,
  daylight: true,
  ...over,
});

/**
 * The National Weather Service's own sky-cover bands, which is why these are
 * not round numbers of this repo's choosing. Both ends of the ladder asserted,
 * not just the middle -- a clear sky and an overcast one are the two a reader
 * checks at a glance.
 */
test("the cloud ladder follows the published bands", () => {
  expect(skyGlyph(sky({ percent: 0 }))).toBe("☀️");
  expect(skyGlyph(sky({ percent: 24 }))).toBe("☀️");
  expect(skyGlyph(sky({ percent: 25 }))).toBe("🌤️");
  expect(skyGlyph(sky({ percent: 54 }))).toBe("🌤️");
  expect(skyGlyph(sky({ percent: 55 }))).toBe("⛅");
  expect(skyGlyph(sky({ percent: 86 }))).toBe("⛅");
  expect(skyGlyph(sky({ percent: 87 }))).toBe("☁️");
  expect(skyGlyph(sky({ percent: 100 }))).toBe("☁️");
});

/** A sun over a clear night is worse than no mark at all. */
test("night takes the moon and shares the clouds", () => {
  expect(skyGlyph(sky({ percent: 0, daylight: false }))).toBe("🌙");
  expect(skyGlyph(sky({ percent: 40, daylight: false }))).toBe("🌙");
  // A cloud looks like a cloud at either hour.
  expect(skyGlyph(sky({ percent: 90, daylight: false }))).toBe("☁️");
});

/**
 * A 40% sky with fog in it is a foggy morning, not a bright one -- and the
 * phenomenon is what a parent plans around, which is the same argument
 * `SkyWeekDay.phenomenon` makes for carrying it beside the percentages.
 */
test("a phenomenon outranks the cloud beneath it", () => {
  expect(skyGlyph(sky({ percent: 5, weather: "fog" }))).toBe("🌫️");
  expect(skyGlyph(sky({ percent: 5, weather: "rain_showers" }))).toBe("🌧️");
  expect(skyGlyph(sky({ percent: 5, weather: "drizzle" }))).toBe("🌧️");
  expect(skyGlyph(sky({ percent: 5, weather: "thunderstorms" }))).toBe("⛈️");
});

/**
 * Anything unrecognised falls through to the cloud rather than picking a wrong
 * picture confidently. The published vocabulary is longer than the four
 * families matched here and will grow again.
 */
test("an unrecognised phenomenon falls through rather than guessing", () => {
  expect(skyGlyph(sky({ percent: 5, weather: "blowing_dust" }))).toBe("☀️");
  expect(skyGlyph(sky({ percent: 95, weather: "smoke" }))).toBe("☁️");
});

/**
 * Three states arrive as no mark: a beach with no forecast cell, a quiet feed
 * and an hour the cell did not reach. The band falls back to 💨, which is what
 * it showed before ADR-0057 and is still true of a segment about air.
 */
test("no forecast means no mark, and the band keeps its own glyph", () => {
  expect(skyGlyph(undefined)).toBeNull();
  expect(skyGlyph(sky({ percent: null }))).toBeNull();

  const { segments } = bandView(readings());
  expect(segments[segments.length - 1].emoji).toBe("💨");
});

test("a forecast mark replaces the puff on the air segment", () => {
  const { segments } = bandView({ ...readings(), sky: sky({ percent: 90 }) });

  expect(segments[segments.length - 1].emoji).toBe("☁️");
  // And the wave segment keeps its own: ADR-0015's vocabulary, one glyph per
  // product, and the sea is not the sky.
  expect(segments[0].emoji).toBe("🏄");
});

/**
 * The mark is the one thing on this band no instrument produced, so it is
 * credited -- and credited as a forecast for a cell rather than as a station
 * with a distance, because a cell is a 2.5 km square with the beach somewhere
 * inside it. ADR-0057.
 */
test("a drawn sky mark is credited as a forecast", () => {
  const withSky = bandView({ ...readings(), sky: sky({ percent: 90 }) });
  expect(withSky.attribution).toContain("sky forecast for this cell");

  // And a cell that answered nothing is not credited: crediting a forecast
  // that did not arrive is worse than crediting nothing.
  const without = bandView({ ...readings(), sky: sky({ percent: null }) });
  expect(without.attribution).not.toContain("sky forecast");
});
