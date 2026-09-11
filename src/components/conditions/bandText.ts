/**
 * The measured band's words, composed: two readings in, one line's worth out.
 *
 * Pure and without JSX, so every state is assertable with no network and no
 * DOM — which matters more here than it did for the cards, because the band has
 * more states than it has lines. `MeasuredBand.tsx` renders what this returns
 * and decides nothing.
 *
 * **Named for the text and not for the component**, like `cardText.ts` beside
 * it, whose two roles this file's ground replaces. It is also the only spelling
 * available: a `measuredBand.ts` next to a `MeasuredBand.tsx` is one file on a
 * case-insensitive filesystem, so the pair typechecks on CI and fails locally
 * with an undefined export.
 *
 * **It reports what was measured and nothing else.** That is the whole shape of
 * the band and it comes from a count: only 15 of the 51 beaches have a wave
 * buoy, and applying ADR-0048 over the areas leaves a measured wave height on
 * 18 of 69 routes. Designing around two figures would have been designing for a
 * quarter of the site. So a wave slot with no reading in it produces **no
 * segment at all** — the sentence explaining why now hangs off the modelled
 * height that stands in for it, in all three places one is drawn (ADR-0055).
 *
 * **Air is the exception, and it is the reason a segment can carry a sentence.**
 * Every one of the 51 beaches binds an air station and all 18 areas share one,
 * so an air slot with no reading is an outage rather than a fact about the
 * place. CLAUDE.md's "nothing fails silently" applies: the band says which
 * station went quiet rather than rendering one figure short.
 *
 * **Two segments, never one merged sentence.** ADR-0010 permits two provenances
 * behind one panel and refuses them behind one sentence, and `ReadingCard`'s
 * `gloss` docstring named this exact change as the temptation: "the temptation
 * once the cards are being compressed is to merge them". "About waist high,
 * mild with a light breeze" is the forbidden shape. Each source keeps its own
 * glyph, its own figures and its own plain-words line.
 *
 * The wording functions came over from `MeasuredToday` unchanged, with their
 * tests. What they say is not this slice's business to reopen.
 */

import type { AirView, SkyNowView, WavesView } from "@/lib/conditions";
import type { NotShared } from "./areaScope";
import { compassWords } from "./bearing";

/** True of a slot the area cannot fill, false of a reading. */
function notShared(slot: WavesView | AirView | NotShared): slot is NotShared {
  return "agreement" in slot;
}

/**
 * The two slots the band is composed from, as `MeasuredPanel` hands them over.
 *
 * Either a read or the reason there is none, per slot, so there is no state
 * where a source has neither and no state where it has both.
 */
export type MeasuredReadings = {
  waves: WavesView | NotShared;
  air: AirView | NotShared;
  /**
   * What the sky is forecast to be doing this hour, for the air segment's mark.
   *
   * **Optional, and absent is a real state rather than a gap.** A beach with no
   * forecast cell, a quiet National Weather Service and an hour the cell did
   * not reach all arrive here as a view with null fields or not at all, and the
   * segment falls back to 💨 — which is what it showed before ADR-0057 and is
   * still a true mark for a card about air.
   */
  sky?: SkyNowView;
};

/**
 * One source's contribution to the band: a glyph, its figures, its words.
 *
 * **`text` is the figures or the sentence standing where they would be**, which
 * is one field rather than two because they occupy one position and never both.
 * A segment with a sentence carries no gloss: there is no figure to put in
 * plain words.
 */
export type BandSegment = {
  /** ADR-0015's closed vocabulary. Never a new glyph — see `MeasuredBand`. */
  emoji: string;
  /** What this source says: `3.0 ft · 72°F water`, or why it says nothing. */
  text: string;
  /** The figures in plain words, or null where there are none to gloss. */
  gloss: string | null;
};

export type BandView = {
  /** Waves first when measured, then air. Never empty: air always speaks. */
  segments: readonly BandSegment[];
  /**
   * The oldest row behind any figure in the band, or null when none is measured.
   *
   * A bound over the whole band rather than one time per source. `MeasuredBand`
   * words it as a bound for that reason — "nothing older than 1:48 PM" is true
   * where "readings from 1:48 PM" is false of the newer source, and a bound over
   * a set attributes nothing to any figure in it (ADR-0054).
   */
  observedAtMs: number | null;
  /** Which instruments answered, in one line. Null when none did. */
  attribution: string | null;
};

/* =========================================================================
 * The sea
 * ========================================================================= */

/** Past this, the buoy is far enough away that the reader is owed the number. */
const DISTANT_BUOY_M = 10_000;

/**
 * Plain words for a published height. Deliberately descriptive rather than
 * advisory: this site relays measurements and does not decide whether the water
 * is suitable for anybody.
 */
export function heightWords(feet: number): string {
  if (feet < 1) return "close to flat";
  if (feet < 2) return "about knee to thigh high";
  if (feet < 3) return "about waist high";
  if (feet < 5) return "overhead for a child";
  return "large";
}

/**
 * The wave segment, or null where nothing was measured.
 *
 * **Period and gust did not come across, and that is a loss taken knowingly.**
 * Both need their own label to mean anything to a parent — "6 s" is not a
 * figure, "6 s period" is — and both are the most surfer-specific values on the
 * block. Nothing else on this page carries a measured period or gust, so they
 * leave the site. See ADR-0056.
 *
 * **A null water temperature is omitted rather than stated.** `StatGroup` made
 * the opposite choice and was right to: in a table a blank cell where a
 * measurement goes reads as a calm sea. In a run of interpuncts there is no cell
 * to leave blank, and "72°F water" carries its own noun, so its absence is an
 * absence rather than a gap.
 */
function wavesSegment(slot: WavesView | NotShared): BandSegment | null {
  if (notShared(slot) || slot.state.kind !== "reading") return null;
  const { heightFt, waterTempF } = slot.state;

  const figures = [
    `${heightFt.toFixed(1)} ft`,
    waterTempF === null ? null : `${Math.round(waterTempF)}°F water`,
  ].filter((part): part is string => part !== null);

  return {
    emoji: "🏄",
    text: figures.join(" · "),
    gloss: `${heightWords(heightFt)}.`,
  };
}

/* =========================================================================
 * The air
 * ========================================================================= */

/**
 * Under a knot the wind is calm. Named once because two readers disagree
 * otherwise: the figures print "Calm" and suppress the gust, and `windWords`
 * says "no wind" — a band that said "no wind" beside "gusting 2 mph" would be
 * contradicting itself, which is the bug the gust rule was written to stop.
 */
const CALM_MPH = 1;

/**
 * How far the station is, in kilometres, rounded.
 *
 * A decimal under ten kilometres because that is the range this binding lives
 * in — the air station runs 0.7 km to 7.4 km across the inventory — and
 * rounding 1.4 km to "1 km" throws away most of what the figure says.
 */
function roundedKm(metres: number): string {
  const km = metres / 1000;
  return km < 10 ? km.toFixed(1) : km.toFixed(0);
}

/**
 * The air temperature in plain words.
 *
 * Descriptive rather than advisory, for the reason `heightWords` gives about
 * its own bands: this site relays measurements and does not decide whether
 * anybody should go. "Warm" restates 76 °F; "a good day for it" would be a
 * verdict, and ADR-0009 forbids the site from making one.
 */
export function warmthWord(fahrenheit: number): string {
  if (fahrenheit < 52) return "Cold";
  if (fahrenheit < 60) return "Chilly";
  if (fahrenheit < 68) return "Cool";
  if (fahrenheit < 75) return "Mild";
  if (fahrenheit < 84) return "Warm";
  return "Hot";
}

/**
 * The wind in plain words, in the Beaufort scale's register.
 *
 * Miles per hour is the figure here that most needs translating: a parent reads
 * 76 °F without help and reads 11 mph without knowing whether that is windy.
 *
 * `CALM_MPH` rather than a second threshold, so this and the figures cannot come
 * to different conclusions about the same reading.
 */
export function windWords(mph: number): string {
  if (mph < CALM_MPH) return "no wind";
  if (mph < 4) return "barely any wind";
  if (mph < 8) return "a light breeze";
  if (mph < 13) return "a gentle breeze";
  if (mph < 19) return "a moderate breeze";
  if (mph < 25) return "a fresh breeze";
  if (mph < 32) return "a strong breeze";
  return "a hard wind";
}

/**
 * What the air figures mean, in one line.
 *
 * Temperature leads because it is this source's figure; the wind follows as a
 * clause. Either half alone still makes a sentence, because the field each
 * station publishes can be absent on its own.
 *
 * `null` rather than an empty line when neither arrived — a blank gloss is the
 * same mistake as an empty lead figure.
 */
export function plainWords(
  air: Extract<AirView["air"], { kind: "reading" }>,
): string | null {
  const warmth = air.airTempF === null ? null : warmthWord(air.airTempF);
  const wind = air.windMph === null ? null : windWords(air.windMph);

  if (warmth !== null && wind !== null) return `${warmth}, with ${wind}.`;
  if (warmth !== null) return `${warmth}.`;
  if (wind === null) return null;
  return `${wind[0].toUpperCase()}${wind.slice(1)}.`;
}

/**
 * The air figures: temperature, then wind with its bearing.
 *
 * **A calm wind reports no gust — and the band reports no gust at all**, so
 * what survives of that rule is the word "Calm" itself. Rendering a speed and a
 * direction under a knot would dress instrument noise as weather.
 *
 * The lead never renders empty: a station that published no temperature says so
 * rather than opening the segment on a wind speed, because an empty lead reads
 * as a fault.
 */
function airFigures(air: Extract<AirView["air"], { kind: "reading" }>): string {
  const calm = air.windMph !== null && air.windMph < CALM_MPH;

  const temperature =
    air.airTempF === null
      ? "No temperature reading"
      : `${Math.round(air.airTempF)}°F`;

  const wind =
    air.windMph === null
      ? null
      : calm
        ? "Calm"
        : `${Math.round(air.windMph)} mph` +
          (air.windDirDegT !== null
            ? ` from the ${compassWords(air.windDirDegT)}`
            : "");

  return [temperature, wind]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/**
 * The mark on the air segment: what it is like out there, at a glance.
 *
 * **This is the one thing on the band that was not measured**, and ADR-0057 is
 * the decision to take it anyway. There is no measured sky at any of these
 * beaches — ADR-0020 records that the only stations publishing cloud in this
 * county are airports — so the choice was a forecast mark or the fixed 💨 puff,
 * which told a reader nothing about the day. The figures beside it are still
 * instruments, and `attributionFor` names the sky as a forecast so the mark
 * cannot be read as one of them.
 *
 * **A phenomenon outranks the cloud**, because it is what a parent plans
 * around: a 40% sky with fog in it is a foggy morning, not a bright one. Only
 * the families the National Weather Service actually publishes for this
 * corridor are matched, and anything unrecognised falls through to the cloud
 * ladder rather than picking a wrong picture confidently.
 *
 * **Night is not a dark version of day.** A sun over a clear night is worse
 * than no mark, so the ladder splits: the moon takes the clear half and the
 * cloud glyphs are shared, since a cloud looks like a cloud at either hour.
 *
 * **The vocabulary grows and stays closed**, which is the whole of ADR-0015's
 * rule. These seven are the roster; a glyph outside it is not available to a
 * later caller, and the fallback is the band's own 💨 rather than an eighth.
 */
export function skyGlyph(sky: SkyNowView | undefined): string | null {
  if (sky === undefined) return null;

  const phenomenon = sky.weather;
  if (phenomenon !== null) {
    if (phenomenon.includes("thunderstorm")) return "⛈️";
    if (phenomenon.includes("rain") || phenomenon.includes("drizzle"))
      return "🌧️";
    if (phenomenon.includes("fog") || phenomenon.includes("haze")) return "🌫️";
  }

  const percent = sky.percent;
  if (percent === null) return null;

  // The National Weather Service's own sky-cover bands, which is why these are
  // not round numbers of this repo's choosing: clear/mostly clear ends at 25,
  // partly cloudy at 55, mostly cloudy at 87.
  if (percent < 25) return sky.daylight ? "☀️" : "🌙";
  if (percent < 55) return sky.daylight ? "🌤️" : "🌙";
  if (percent < 87) return "⛅";
  return "☁️";
}

/**
 * The air segment, which is always present.
 *
 * All 51 beaches bind a station and all 18 areas share one, so an absence here
 * is an outage rather than a fact about the place — and CLAUDE.md's "nothing
 * fails silently" means the band names the station that went quiet rather than
 * rendering one figure short.
 *
 * **Drift gets its own sentence rather than a disclosure.** ADR-0022 routes
 * drift to a GitHub issue, so what is left on the page is a courtesy: not
 * blaming a station for this site's parser. One line says it; the upstream
 * error string does not come across, being a diagnostic for us rather than
 * prose for a parent.
 */
function airSegment(
  slot: AirView | NotShared,
  sky: SkyNowView | undefined,
): BandSegment {
  const emoji = skyGlyph(sky) ?? "💨";
  if (notShared(slot)) {
    // Unreachable from the routes -- air is shared by all eighteen areas, which
    // `areas.test.ts` asserts. Worded rather than thrown: a band that crashed
    // on a state the type permits would be worse than one that says less.
    return { emoji, text: "No air reading for this area.", gloss: null };
  }

  const { airStation, air } = slot;
  const station = airStation?.name ?? "The air station";

  if (air.kind === "reading") {
    return { emoji, text: airFigures(air), gloss: plainWords(air) };
  }

  if (air.kind === "unavailable") {
    return {
      emoji,
      text: air.drift
        ? `${station} answered in a shape this site could not read — a bug here, not at the station.`
        : `${station} is not answering just now.`,
      gloss: null,
    };
  }

  return { emoji, text: "No air station near enough to read.", gloss: null };
}

/* =========================================================================
 * The band
 * ========================================================================= */

/**
 * Which instruments answered, in one line, on the band's own ground.
 *
 * **ADR-0010's guarantee, kept at its full strength and not behind a
 * disclosure.** That decision's closing claim is that "no figure is ever shown
 * without the reader being able to see where it came from"; moving this into
 * `ConditionsNotes` would have put it at the page's foot inside a `<details>`
 * that is closed by default. One line costs about twenty pixels and keeps both
 * sources named beside their figures.
 *
 * Two thresholds survive from the cards because each has its reason recorded
 * where it is made: a buoy is named without a distance under 10 km, and an air
 * station always carries one, to a decimal below 10 km.
 *
 * **The sky is here and is not an instrument**, which is the whole reason it is
 * worded differently: "sky forecast for this cell" rather than a station and a
 * distance. A cell is a 2.5 km square with the beach somewhere inside it, so a
 * distance would be a figure about nothing — the omission `WeekPanel`'s cloud
 * row already makes for the same reason.
 */
function attributionFor(readings: MeasuredReadings): string | null {
  const parts: string[] = [];

  const { waves, air } = readings;

  if (
    !notShared(waves) &&
    waves.buoy !== null &&
    waves.state.kind === "reading"
  ) {
    const distanceM = waves.buoy.distanceM;
    const far =
      distanceM !== null && distanceM > DISTANT_BUOY_M
        ? `, ${(distanceM / 1000).toFixed(0)} km away`
        : "";
    parts.push(`waves from Buoy ${waves.buoy.name} (NDBC)${far}`);
  }

  if (!notShared(air) && air.airStation !== null) {
    const distanceM = air.airStation.distanceM;
    const away = distanceM === null ? "" : `, ${roundedKm(distanceM)} km away`;
    parts.push(`air from ${air.airStation.name}${away}`);
  }

  /*
    The sky is named separately and named as a forecast, because it is the one
    mark on this band that no instrument produced (ADR-0057). Only when a glyph
    was actually drawn from it: a cell that answered nothing leaves the segment
    on 💨, and crediting a forecast that did not arrive would be worse than
    crediting nothing.
  */
  if (skyGlyph(readings.sky) !== null) {
    parts.push("sky forecast for this cell");
  }

  if (parts.length === 0) return null;
  return `${parts[0][0].toUpperCase()}${parts[0].slice(1)}${parts
    .slice(1)
    .map((part) => ` · ${part}`)
    .join("")}`;
}

/**
 * The oldest row behind any figure in the band.
 *
 * Only sources that actually printed a figure contribute. A quiet buoy has no
 * row, and bounding the band by a time nothing on it came from would report the
 * band as older than everything in it.
 */
function observedAtMsFor(readings: MeasuredReadings): number | null {
  const times: number[] = [];
  const { waves, air } = readings;

  if (!notShared(waves) && waves.state.kind === "reading") {
    times.push(waves.state.observedAtMs);
  }
  if (!notShared(air) && air.air.kind === "reading") {
    times.push(air.air.observedAtMs);
  }

  return times.length === 0 ? null : Math.min(...times);
}

/** Everything the band renders, decided here so the markup decides nothing. */
export function bandView(readings: MeasuredReadings): BandView {
  const waves = wavesSegment(readings.waves);

  return {
    segments:
      waves === null
        ? [airSegment(readings.air, readings.sky)]
        : [waves, airSegment(readings.air, readings.sky)],
    observedAtMs: observedAtMsFor(readings),
    attribution: attributionFor(readings),
  };
}
