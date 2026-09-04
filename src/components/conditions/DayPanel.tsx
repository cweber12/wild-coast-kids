/**
 * The day's own region, below the week.
 *
 * The seam between the network and the markup, and deliberately thin, like the
 * panels beside it: read, compose, render. Everything with a judgement in it
 * sits on one side or the other, where it can be tested without a network.
 *
 * **It composes all seven days and shows one.** The week grid above is the
 * control that says which; `ChosenDay` is the client half that picks. Every
 * feed here already returns the whole week in one call, so building seven days
 * costs nothing but arithmetic and choosing one costs no request at all --
 * which is the property the brief asked for, on a page whose argument is that
 * the future is what anybody came for.
 *
 * **Four tabs, and the frame belongs to none of them.** The plot draws the
 * tide, the swell, the wind or the air temperature as a foreground swapped
 * inside one frame, which is why the day's ends, the night and the cloud are
 * composed here rather than inside any one series -- and why the frame is
 * arithmetic on the calendar rather than a field of the tide read. It used to
 * be the latter, and that would have let a NOAA outage decide whether CDIP got
 * drawn.
 *
 * **Which day is today comes from the daylight read, and no clock is read
 * here.** A component that called `Date.now()` would be reading a clock during
 * render, which is impure and which this repo's lint rules refuse -- correctly,
 * and it caught the first version of this file. `readDaylightWeek` is computed
 * from the beach's own coordinates rather than fetched, so it cannot fail and
 * costs no request; it carries the instant it was computed from, which is what
 * the chart's "now" line is drawn at. `WeekPanel` takes its columns from the
 * same read, so the two regions cannot disagree about which day is which.
 *
 * **Six reads, made concurrently and failing apart.** The hourly heights come
 * from NOAA, the swell from CDIP, the cloud from the National Weather Service's
 * numbers, the wording from its sentences and the rip current risk from its
 * surf zone bulletin -- six products, six outages. A quiet cloud feed costs the
 * band and not the curve; a quiet NOAA costs the tide tab and not the swell
 * tab; and each tab that is quiet says which publisher went quiet rather than
 * saying only that something is missing.
 *
 * The surf zone read is the odd one of the six twice over. It is the only
 * relayed *judgement* here rather than a measurement or a model, which is what
 * ADR-0009 permits and constrains; and it is the only one that reaches no
 * publisher at all on 25 of the 51 beaches, because a bay, lagoon or inlet has
 * no surf zone to forecast.
 *
 * **Nothing here is measured, and that is the point of where it sits.** Every
 * read in this panel is a model or a prediction. The buoy and the shore
 * station -- the only instruments this site reports at all -- used to arrive
 * here too, on today alone, with a sentence on the other six days saying
 * nothing had been measured about a day that had not happened. They now sit at
 * the top of the page, above `SelectedDayProvider`, because they answer for an
 * instant rather than for a day. See `ConditionsSection`.
 *
 * **It answers for an area as well as for a beach, one tab at a time.** On an
 * area page it is handed an `AreaScope`, and a product the area's beaches do
 * not share is not read and draws no curve -- but keeps its tab, which stands
 * where it stood and carries the area's sentence where the plot would be.
 * `HourSeries` already has that slot: an empty `points` renders `absence`, and
 * that is how a bay with no MOP line has always been told there is no swell
 * curve. See ADR-0048 and ADR-0049.
 *
 * **The tab stays, and dropping it was the alternative.** Four tabs are this
 * region's whole vocabulary for its four products, and an area that showed
 * fewer would be a different control rather than the same one with less in it.
 * La Jolla shares a tide station and nothing else the chart draws, so a bar
 * gated to what it can draw would be one tab wide -- and a reader would never
 * learn the swell exists.
 *
 * **Three products and four tabs, because the wind and the air temperature are
 * one cell.** They are withheld or drawn together, and so are the cloud band
 * behind every tab and the office's own wording above the chart, which come off
 * that same cell.
 *
 * **The map is one beach's, so an area page carries a sentence instead of
 * one.** The area map is its own slice and its own decision; drawing the first
 * member's coast under the area's name is the representative-beach lie ADR-0048
 * refuses. The readout goes with it -- see the note at the map itself.
 */

import {
  readDaylightWeek,
  readGridpointWeek,
  readHourlyTide,
  readSkyWeek,
  readSkyWording,
  readSurfZone,
  readWaveWeek,
  type GridDaySeries,
  type GridpointWeekView,
  type TideHourlyDay,
  type TideHourlyView,
  type WaveWeekDay,
  type WaveWeekView,
} from "@/lib/conditions";
import { beachBySlug } from "@/lib/beaches";
import {
  localMidnightOf,
  addLocalDays,
  localTimeOf,
  hourLabelAt,
} from "@/lib/pacific-time";
import { answer, type AreaScope, withheldBy, withheldWords } from "./areaScope";
import { ChosenDay, type DayView } from "./ChosenDay";
import type { HourSeries } from "./HourChart";
import { ReservedSlot } from "../ui/ReservedSlot";
import type { CompassNeedle } from "./Compass";
import {
  DayCompass,
  DayCompassSources,
  type CompassDay,
  type CompassHour,
} from "./DayCompass";
import { hourOfDay, instantOfHour } from "./dayFrame";
import { SelectedHourProvider } from "./selectedHour";
import {
  GRID_DECIMALS,
  GRID_MODEL_NOTE,
  GRID_NETWORK,
  GRID_SOURCE,
  gridCellCaveat,
  windFigure,
  windPeakLabel,
} from "./gridCell";
import {
  MOP_MODEL_NOTE,
  MOP_NETWORK,
  mopLineDistanceKm,
  mopLineSource,
  swellFigure,
  swellStepNote,
} from "./mopLine";
import {
  gridWindReadings,
  needleFrom,
  peakInDaylight,
  swellReadings,
  swellStepByHour,
  windByHour,
  type HourlyWind,
  type PublishedSwell,
} from "./needles";
import type { ProvenanceFacts } from "./ProvenanceLine";
import { ShoreMap } from "./ShoreMap";
import { SurfZone } from "./SurfZone";
import { shoreViewFor } from "./shore";
import { SkyWording } from "./SkyWording";
import { gridPoints, swellPoints, tidePoints } from "./series";
import {
  TIDE_NETWORK,
  tideStationDistanceKm,
  tideStationNote,
} from "./tideStation";

/**
 * What each tab says when its own feed is the thing that is missing.
 *
 * **Three states and not one sentence.** A beach with no MOP line will never
 * have a swell curve and that is a permanent fact about the place; a feed that
 * did not answer is a fact about this quarter of an hour; a day the forecast
 * does not reach is neither. With one series a reader could work out which had
 * happened from the rest of the page. With four tabs they cannot: "we have no
 * figure" printed four times says nothing about which publisher went quiet.
 *
 * **Every sentence names the day, because the region is no longer always
 * today.** These were written when it was, and "we have no prediction for
 * today" printed under a heading reading `Thu, Aug 27` is not a hedge, it is
 * false. `when` is "today" on today and the grid's own label otherwise, so the
 * two regions name the day the same way.
 *
 * The outage half follows `WeekPanel`'s wording rather than inventing its own,
 * down to the drift clause -- `ProvenanceLine`'s docstring records what a
 * second call site usually costs this repo, and two sentences about the same
 * outage in two registers is that cost.
 */
const WORDS = {
  tide: {
    outOfReach: (when: string) =>
      `We have no hour-by-hour tide prediction for ${when}. The figures on the week above are unaffected.`,
    outage: (when: string) =>
      `We could not get ${when}'s hour-by-hour tide prediction from NOAA just now.`,
    drift:
      "NOAA's payload was not the shape this site pins, which is a bug here rather than a problem at NOAA.",
  },
  swell: {
    outOfReach: (when: string) =>
      `CDIP's forecast for this beach does not reach ${when}. The figures on the week above are unaffected.`,
    outage: (when: string) =>
      `We could not get ${when}'s wave forecast from CDIP just now.`,
    drift:
      "CDIP's payload was not the shape this site pins, which is a bug here rather than a problem with the model.",
  },
  wind: {
    outOfReach: (when: string) =>
      `The National Weather Service's forecast for this cell does not reach ${when}.`,
    outage: (when: string) =>
      `We could not get ${when}'s wind forecast from the National Weather Service just now.`,
    drift:
      "The forecast's payload was not the shape this site pins, which is a bug here rather than a problem at the National Weather Service.",
  },
  temperature: {
    outOfReach: (when: string) =>
      `The National Weather Service's forecast for this cell does not reach ${when}.`,
    outage: (when: string) =>
      `We could not get ${when}'s temperature forecast from the National Weather Service just now.`,
    drift:
      "The forecast's payload was not the shape this site pins, which is a bug here rather than a problem at the National Weather Service.",
  },
} as const;

type Words = (typeof WORDS)[keyof typeof WORDS];

/** Why a tab has no curve, said about that tab's own publisher. */
function absenceFor(
  view: TideHourlyView | WaveWeekView | GridpointWeekView,
  words: Words,
  when: string,
): string {
  if (view.state.kind === "week") return words.outOfReach(when);
  if (view.state.kind === "unavailable") {
    return (
      `${words.outage(when)} ${view.state.detail}` +
      (view.state.drift ? ` ${words.drift}` : "")
    );
  }
  // `no-station`, `no-line` and `no-cell`: the join's own reason, which names
  // the distance that refused the binding. It is already a sentence and
  // rewording it here would lose the figure in it.
  return view.state.reason;
}

/**
 * The same, one level further in, for a cell that answered without one of its
 * series.
 *
 * **A fourth state the other two products do not have.** A tide station either
 * exists or does not; a forecast cell can answer, cover the day, and still say
 * nothing at all about the wind — which is exactly what `visibility` does at
 * every cell on every request, and the reason `GridpointSeries` carries a
 * reason rather than being empty. That sentence is the parser's, because only
 * there is it known whether the key was missing or was declared and empty.
 */
function gridAbsenceFor(
  view: GridpointWeekView,
  series: GridDaySeries | undefined,
  words: Words,
  when: string,
): string {
  if (series !== undefined && series.kind === "absent") return series.reason;
  return absenceFor(view, words, when);
}

/**
 * How many decimals the water's two products print to, which is one.
 *
 * **A coarsening of both, which is what makes it honest.** NOAA publishes its
 * tide predictions to thousandths of a foot and CDIP's model publishes a wave
 * height to eight decimal places of metres; a tenth of a foot claims less than
 * either issued rather than more. That is the whole difference between these
 * two and the forecast cell, whose own `GRID_DECIMALS` is none because the
 * National Weather Service issues whole knots. ADR-0042.
 *
 * One constant for two publishers, because they arrive at the same figure
 * through the same argument -- a source finer than a reader can use, cut to
 * what a reader can. A third product finer still would share it; one issued
 * coarsely would not.
 */
const WATER_DECIMALS = 1;

/**
 * What a reader who cannot see the plot is told instead.
 *
 * **The extremes are named as the lowest and highest *hour*, not as the day's
 * low and high** -- the same care `WeekPanel`'s description takes, and for the
 * same reason. These are hourly samples of a continuous curve, so the real
 * turning point is lower than any of them and falls between two, which is why
 * this page asks NOAA for the turning points separately.
 *
 * The precision is the caller's rather than this function's, which is
 * ADR-0042: it has to be the one the axis prints, and only the caller knows
 * which series this is.
 */
function chartDescription(
  day: TideHourlyDay,
  when: string,
  sunriseLabel: string,
  sunsetLabel: string,
  decimals: number,
): string {
  const feet = day.hours.map((hour) => hour.feet);
  const low = Math.min(...feet).toFixed(decimals);
  const high = Math.max(...feet).toFixed(decimals);
  return (
    `Tide ${when}, hour by hour from midnight to midnight: ${low} ft at its lowest hour, ` +
    `${high} ft at its highest. Night is shaded; the sun is up from ${sunriseLabel} to ` +
    `${sunsetLabel}.`
  );
}

/**
 * The same, for the swell, and it says the cadence out loud.
 *
 * The plot shows CDIP's three-hour grid by marking the eight points it issued
 * and leaving the sixteen between them bare. A reader who cannot see the plot
 * gets no marks, so the sentence has to carry the fact instead -- otherwise the
 * one thing this design added to distinguish an hourly model from a
 * three-hourly one would be visual only, which is the failure ADR-0025's
 * argument against a canvas turns on.
 *
 * The precision is the caller's, for `chartDescription`'s reason.
 */
function swellDescription(
  day: WaveWeekDay,
  when: string,
  sunriseLabel: string,
  sunsetLabel: string,
  decimals: number,
): string {
  const heights = day.hours.map((hour) => hour.heightFt);
  const published = day.hours.filter((hour) => hour.published).length;
  const low = Math.min(...heights).toFixed(decimals);
  const high = Math.max(...heights).toFixed(decimals);
  return (
    `Swell ${when}, from ${low} ft to ${high} ft. CDIP publishes every three hours and ` +
    `issued ${published} estimates for it; the curve between them is drawn here rather ` +
    `than forecast. Night is shaded; the sun is up from ${sunriseLabel} to ${sunsetLabel}.`
  );
}

/**
 * The same again for the cell's own series, and it says its cadence too.
 *
 * **The block count is the honest figure here, the way the estimate count is
 * for the swell.** The National Weather Service does not publish hourly: it
 * publishes intervals, one hour near the present and three or six further out,
 * and the plot marks the instant each block began. A reader who cannot see the
 * marks would otherwise be told a forecast is hourly when a day of it is four
 * numbers.
 *
 * **The precision is the caller's, and this is the function that proves why.**
 * It used to round to whole units while the chart beside it kept a tenth, and
 * the two only ever disagreed on the wind -- #191, where the same reader was
 * told the day tops at 12 mph and then, on arrowing to the hour it happens at,
 * that it is 11.5. Both figures were defensible and the pair was not, because
 * a range and the hour inside it are one statement. ADR-0042 settles which
 * number is right; taking it as an argument is what stops there being two.
 */
function gridDescription(
  name: string,
  unit: string,
  series: GridDaySeries | undefined,
  when: string,
  sunriseLabel: string,
  sunsetLabel: string,
  outOfReach: string,
  decimals: number,
): string {
  if (series === undefined) return outOfReach;
  if (series.kind === "absent") return series.reason;
  if (series.hours.length === 0) return outOfReach;

  const values = series.hours.map((hour) => hour.value);
  const blocks = series.hours.filter((hour) => hour.published).length;
  const low = Math.min(...values).toFixed(decimals);
  const high = Math.max(...values).toFixed(decimals);
  return (
    `${name} ${when}, from ${low} to ${high} ${unit}. The National Weather Service forecasts ` +
    `this cell in blocks rather than by the hour, and this day's is made of ${blocks} of them; ` +
    `each block's own hour is marked. Night is shaded; the sun is up from ${sunriseLabel} to ` +
    `${sunsetLabel}.`
  );
}

/**
 * The spoken equivalent of the cloud band, which is its own graphic.
 *
 * Separate from the plot's because the two credit different publishers: the
 * curve is NOAA's tide and the band is the National Weather Service's sky. It
 * states the range in percentages and never in words -- ADR-0024 measured a
 * banded word contradicting the very sentence this panel prints above the
 * chart, and a screen reader hearing "mostly sunny" while the page said
 * something else would be the same contradiction with no way to see it.
 */
function cloudBandDescription(
  hours: readonly { percent: number }[],
  when: string,
): string | undefined {
  if (hours.length === 0) return undefined;
  const values = hours.map((hour) => hour.percent);
  return (
    `Cloud cover through ${when}, hour by hour: ${Math.min(...values)} to ` +
    `${Math.max(...values)} per cent. Darker is more cloud.`
  );
}

/**
 * The spoken equivalent of the whole map.
 *
 * Says what the picture is and nothing about what the shape of the coast
 * means. A reader hearing this should learn the same thing a reader seeing it
 * does: where this beach is on its own coast, and which side the water is on.
 * The readout's own bearings are spoken separately, in its own rows, because
 * they change with the day and this does not.
 */
function mapDescription(beachName: string): string {
  return (
    `A map of ${beachName}: its own stretch of coast drawn heavier than the ` +
    `shore either side of it, and the open water shaded.`
  );
}

export async function DayPanel({
  slug,
  area,
}: {
  slug: string;
  /** Present on an area page, absent on a beach's. */
  area?: AreaScope;
}) {
  /*
    Which of the three products this area may draw, asked before anything is
    fetched. Null on a beach page, where nothing is withheld and this whole
    region behaves as it did before areas existed.

    Three and not four, because the four tabs are three publishers: the wind and
    the air temperature are both the forecast cell's, so they are withheld or
    drawn together. The cloud band behind every tab and the office's own wording
    above the chart are that same cell's, and go with them.
  */
  const withheldTide = withheldBy(area, "tide");
  const withheldSwell = withheldBy(area, "swell");
  const withheldSky = withheldBy(area, "sky");

  const daylight = readDaylightWeek(slug);
  const [hourly, waves, sky, grid, wording, surfZone] = await Promise.all([
    answer(withheldTide, () => readHourlyTide(slug)),
    answer(withheldSwell, () => readWaveWeek(slug)),
    answer(withheldSky, () => readSkyWeek(slug)),
    answer(withheldSky, () => readGridpointWeek(slug)),
    answer(withheldSky, () => readSkyWording(slug)),
    // A sixth read and a third publisher's product, joining the others for the
    // reason they are all here: five agencies go quiet independently, and the
    // surf zone bulletin failing must cost its own block and nothing else. It
    // is the only one of the six that reaches no network at all on 25 of the
    // 51 beaches, because a bay has no surf zone to forecast.
    //
    // Not answered against the area's scope, and that is the exception rather
    // than an omission: it is one bulletin for "San Diego County Coastal
    // Areas", a unit larger than any area in this table, so an intersection
    // rule designed for point measurements asks it a question it has no answer
    // to. What it needs is a member the forecast is *issued* for, which is a
    // different member from the one everything else here is read through
    // wherever an area's first beach is sheltered. See ADR-0050.
    readSurfZone(area?.bulletinBeach ?? slug),
  ]);

  /*
    Who published each curve, composed once for the week rather than per day.

    A tide station, a model line and a forecast cell are bound to the beach and
    never to the day: all seven days of a tab carry the same publisher, so
    building these inside the loop would be seven copies of one fact. Every word
    comes from `tideStation.ts`, `mopLine.ts` and `gridCell.ts` -- three modules
    that exist because two call sites wording one fact is how `ProvenanceLine`
    came to print one station two ways on one card.

    `null` where the beach binds no such source, which is the same condition
    under which that tab has no curve to attribute: each of the three fields is
    null exactly when its own read's state is `no-station`, `no-line` or
    `no-cell`, and none of those states reaches a plot.
  */
  const cellNote = [
    GRID_MODEL_NOTE,
    gridCellCaveat(grid.view?.cell?.elevationM ?? null),
  ]
    .filter((part): part is string => part !== null)
    .join("; ");

  const station = hourly.view?.station ?? null;
  const tideProvenance: ProvenanceFacts | null =
    station === null
      ? null
      : {
          label: "Tide",
          source: station.name,
          network: TIDE_NETWORK,
          distanceKm: tideStationDistanceKm(station.distanceM),
          note: tideStationNote(station.distanceM, station.water),
        };

  const swellProvenance: ProvenanceFacts | null =
    waves.view === null || waves.view.line === null
      ? null
      : {
          label: "Swell",
          source: mopLineSource(waves.view.line.id),
          network: MOP_NETWORK,
          distanceKm: mopLineDistanceKm(waves.view.line.distanceM),
          note: MOP_MODEL_NOTE,
        };

  /*
    One cell and two tabs, so two lines rather than one shared: the label is
    what says which curve is being attributed, and it is the only field of the
    two that differs.

    No distance, which is the omission `WeekPanel`'s cloud row already makes. A
    cell is a 2.5 km square of map with the beach somewhere inside it, so "about
    n km from this beach" would be a figure about nothing -- unlike a station or
    a model line, which stand at a point.
  */
  const cellProvenance = (label: string): ProvenanceFacts | null =>
    grid.view === null || grid.view.cell === null
      ? null
      : { label, source: GRID_SOURCE, network: GRID_NETWORK, note: cellNote };

  /*
    The seven days come from the daylight read, which is the same choice
    `WeekPanel` makes one region up: it is computed from the beach's own
    coordinates rather than fetched, so it cannot fail and costs no request.
    Every other read here is ragged in its own way and any of them can go
    quiet, so building the spine from one of those would let an outage decide
    how many days a reader may choose between.

    Both regions build from `weekOfDays`, so their columns are the same seven
    days in the same order and the two cannot disagree about which is Tuesday.
  */
  const days: DayView[] = daylight.days.map((day) => {
    /*
      Three forms of one day, because three positions want three.

      `when` goes where a noun or a preposition already precedes it -- "for
      today", "Tide Thu, Aug 27, hour by hour" -- and is the form every absence
      sentence and every spoken description takes. `dayName` heads the region,
      where it is capitalised. `chartWhen` closes the chart's summary line,
      which ends on the day rather than continuing past it: "high 5.3 ft today"
      needs no preposition and "high 5.3 ft Thu, Aug 27" reads as "5.3 ft Thu"
      and then a stray "Aug 27", because the comma inside the label collides
      with the sentence.

      All three are composed here, in one expression each, rather than derived
      from one another downstream. `dayName` is not `when` capitalised and
      `chartWhen` is not `dayName` lowercased: lowercasing a date gives "thu,
      aug 27". A component deriving one from another would be inventing a
      calendar rule at a call site, which is the drift `ProvenanceLine`'s
      docstring records for a different fact.
    */
    const when = day.isToday ? "today" : day.dayLabel;
    const chartWhen = day.isToday ? "today" : `on ${day.dayLabel}`;

    const tideDay =
      hourly.view?.state.kind === "week"
        ? hourly.view.state.days.find(
            (each) => each.localDate === day.localDate,
          )
        : undefined;

    const waveDay =
      waves.view?.state.kind === "week"
        ? waves.view.state.days.find((each) => each.localDate === day.localDate)
        : undefined;

    const cloudHours =
      sky.view?.state.kind === "week"
        ? (sky.view.state.days.find((each) => each.localDate === day.localDate)
            ?.hours ?? [])
        : [];

    const gridDay =
      grid.view?.state.kind === "week"
        ? grid.view.state.days.find((each) => each.localDate === day.localDate)
        : undefined;

    /*
      Tide first, always, and the order is the tab order.

      It is the page's lead product -- the first row of the week above -- and it
      is what a reader without a script gets, since the server renders the first
      tab. Reordering to put a series with data first
      would be a rule nobody could see from the page.
    */
    const series: HourSeries[] = [
      {
        key: "tide",
        label: "Tide",
        unitLabel: "ft",
        decimals: WATER_DECIMALS,
        points: tideDay === undefined ? [] : tidePoints(tideDay),
        description:
          tideDay === undefined
            ? WORDS.tide.outOfReach(when)
            : chartDescription(
                tideDay,
                when,
                day.sunriseLabel,
                day.sunsetLabel,
                WATER_DECIMALS,
              ),
        absence:
          hourly.view === null
            ? withheldWords(hourly.withheld, "an hour-by-hour tide prediction")
            : absenceFor(hourly.view, WORDS.tide, when),
        provenance: tideProvenance,
      },
      {
        key: "swell",
        label: "Swell",
        unitLabel: "ft",
        decimals: WATER_DECIMALS,
        points: waveDay === undefined ? [] : swellPoints(waveDay),
        description:
          waveDay === undefined
            ? WORDS.swell.outOfReach(when)
            : swellDescription(
                waveDay,
                when,
                day.sunriseLabel,
                day.sunsetLabel,
                WATER_DECIMALS,
              ),
        absence:
          waves.view === null
            ? withheldWords(waves.withheld, "a swell forecast")
            : absenceFor(waves.view, WORDS.swell, when),
        provenance: swellProvenance,
      },
      {
        key: "wind",
        label: "Wind",
        unitLabel: "mph",
        decimals: GRID_DECIMALS,
        points: gridDay === undefined ? [] : gridPoints(gridDay.windMph),
        description: gridDescription(
          "Wind",
          "mph",
          gridDay?.windMph,
          when,
          day.sunriseLabel,
          day.sunsetLabel,
          WORDS.wind.outOfReach(when),
          GRID_DECIMALS,
        ),
        absence:
          grid.view === null
            ? withheldWords(grid.withheld, "a wind forecast")
            : gridAbsenceFor(grid.view, gridDay?.windMph, WORDS.wind, when),
        provenance: cellProvenance("Wind"),
      },
      {
        /*
          "Temp" rather than "Temperature", and the shortening is measured: four
          tabs across a 375px screen are about 71px each, where "TEMPERATURE" at
          this site's label register is about 90px. It is the same trade
          ADR-0024 made when it labelled a third of the day "Mid".

          It is not ambiguous with the water, and that is worth saying because
          this page carries both: water temperature is a measured figure and
          never a curve, so there is no second temperature in this bar for a
          reader to confuse it with. The spoken description and the sentence
          under the plot both say "air" in full.
        */
        key: "temperature",
        label: "Temp",
        unitLabel: "°F",
        decimals: GRID_DECIMALS,
        points: gridDay === undefined ? [] : gridPoints(gridDay.airTempF),
        description: gridDescription(
          "Air temperature",
          "°F",
          gridDay?.airTempF,
          when,
          day.sunriseLabel,
          day.sunsetLabel,
          WORDS.temperature.outOfReach(when),
          GRID_DECIMALS,
        ),
        absence:
          grid.view === null
            ? withheldWords(grid.withheld, "an air temperature forecast")
            : gridAbsenceFor(
                grid.view,
                gridDay?.airTempF,
                WORDS.temperature,
                when,
              ),
        // The word the tab drops, put back. Same rule as the spoken
        // description and the sentence under the plot: "Temp" buys width on a
        // 375px tab bar, and nothing else on this page pays for it.
        provenance: cellProvenance("Air temperature"),
      },
    ];

    return {
      localDate: day.localDate,
      // "Today" at the head of a heading, the grid's own label otherwise.
      dayName: day.isToday ? "Today" : day.dayLabel,
      chartWhen,
      /*
        The frame comes from the calendar, not from a feed.

        It used to be the tide read's own `startMs` and `endMs`, which was
        right when the tide was the only series: no tide, no chart, no frame
        needed. With four products in one frame that would let NOAA's outage
        decide whether CDIP gets drawn. `localMidnightOf` is arithmetic on the
        beach's own zone and cannot fail, and it steps by date rather than by
        adding twenty-four hours, because twice a year on this coast a day is
        twenty-three or twenty-five.
      */
      startMs: localMidnightOf(day.localDate),
      endMs: localMidnightOf(addLocalDays(day.localDate, 1)),
      sunriseMs: day.sunriseMs,
      sunsetMs: day.sunsetMs,
      /*
        A vertical rule at an instant is a claim about the present, so it is
        drawn on today and nowhere else. Six of the seven carry null, and that
        is the whole of what stops Thursday claiming a reader is standing in it.
      */
      nowMs: day.isToday ? daylight.atMs : null,
      cloud: cloudHours.map((hour) => ({
        atMs: hour.atMs,
        value: hour.percent,
        published: true,
      })),
      cloudDescription: cloudBandDescription(cloudHours, when),
      series,
      /*
        The office's own sentences about this day, and they are the forecast
        cell's like the wind and the temperature are. An area whose beaches read
        different cells gets the area's sentence in their place rather than one
        member's wording under the whole area's name.
      */
      wording:
        wording.view === null ? (
          <p className="leading-relaxed mb-4 text-base text-fog">
            {withheldWords(wording.withheld, "a forecast in words")}
          </p>
        ) : (
          <SkyWording view={wording.view} localDate={day.localDate} />
        ),
      /*
        Rendered here and handed over finished, the precedent `wording` sets:
        the read is the server's and `ChosenDay` is a client component.

        Not behind a Suspense boundary of its own: it is already resolved by
        the `Promise.all` above, so a boundary here would render a loading line
        that never shows.

        The same `state` on all seven days and only `localDate` varying, which
        is what lets one bulletin answer for every day it reaches without being
        read seven times.
      */
      surfZone: (
        <SurfZone
          state={surfZone.state}
          localDate={day.localDate}
          when={when}
          areaName={area?.name}
        />
      ),
    };
  });

  /*
    The map is built once and handed over, outside the seven days, because it
    is the same picture on all seven: this beach, its own stretch of coast, and
    the water beside it. Only the readout laid over it changes with the day, and
    that travels separately. It is also the one thing in this region that reads
    no feed -- `beaches.json` and `mop-lines.json` are committed -- so it cannot
    go quiet and does not belong behind a Suspense boundary.
  */
  /*
    **No map on an area page, and a sentence in its place.**

    The map draws one beach's own stretch of coast, heavier than the shore
    either side of it. There is no such run for an area -- the area map, with a
    tick per member and a frame taking the bbox's own aspect, is its own slice
    and its own decision, because ADR-0033 says the map draws a place and not an
    inventory and a mark per beach amends that. Drawing the first member's coast
    here in the meantime is exactly the representative-beach lie ADR-0048
    refuses: it would put one beach's shoreline under the area's name.

    The readout goes with it, and that is the part worth stating. ADR-0034's
    surviving clause has the readout rendered on every beach including the ones
    with no coast, so a bearing dial without a shoreline is a shape this page
    already permits -- but `ShoreMap` owns the coupling ADR-0038 settled, one
    `hasReadout` gating the block and its sources together, and hoisting it out
    would be a second change to a contract that decision has just finished
    drawing. It arrives with the area map, over the area's own coast, which is
    the frame that makes a wind bearing mean anything.

    A beach the inventory does not hold is not this component's error to invent
    a map for: the route already answered that question before rendering, and
    `beachBySlug` returning null here would mean the page is showing a beach it
    does not have.
  */
  const beach = area ? null : beachBySlug(slug);
  const shore = beach === null ? null : shoreViewFor(beach);

  /*
    Seven days of needles, built beside the seven days of series rather than
    inside them.

    The map is one picture for the whole week and the needles are not, so they
    travel separately: `DayCompass` is the client island that picks the chosen
    day's pair out of these, and the coast underneath stays a single
    server-rendered drawing. Putting them inside `DayView` would mean seven
    copies of the map to vary two numbers.

    The window is this day's own daylight, which is the design brief's word for
    it and is load-bearing rather than decorative: the committed run swings
    across north in its first three hours, and a day measured end to end
    reports an arc nobody could have stood in.
  */
  const compassDays: CompassDay[] = daylight.days.map((day) => {
    const gridDay =
      grid.view?.state.kind === "week"
        ? grid.view.state.days.find((each) => each.localDate === day.localDate)
        : undefined;

    const swellDay =
      waves.view?.state.kind === "week"
        ? waves.view.state.days.find((each) => each.localDate === day.localDate)
        : undefined;

    const line = waves.view?.line ?? null;
    const dayStartMs = localMidnightOf(day.localDate);

    /*
      The wedges, and they stay the day's on all seven days rather than becoming
      the hour's. A wedge that meant daylight sometimes and midnight to midnight
      at other times would be the ambiguity ADR-0035 took out of the arrow, put
      back behind it. So at a night hour the arrow can sit outside its own
      wedge, which is a true statement about that hour: the wind came from a
      direction it never came from while the sun was up.
    */
    const wind =
      gridDay === undefined
        ? null
        : needleFrom(
            gridWindReadings(
              gridDay.windDirDegT,
              gridDay.windMph,
              day.sunriseMs,
              day.sunsetMs,
            ),
          );

    const swell =
      swellDay === undefined || line === null
        ? null
        : needleFrom(
            swellReadings(swellDay.hours, day.sunriseMs, day.sunsetMs),
          );

    /*
      And the arrows, which are each hour's own. The whole day rather than its
      daylight half: a reader who steps to 3 AM is owed 3 AM's wind, and this
      block is the only place on the page that hour's wind is stated at all.
    */
    const windHours =
      gridDay === undefined
        ? new Map<number, HourlyWind>()
        : windByHour(gridDay.windDirDegT, gridDay.windMph, dayStartMs);

    /*
      One attribution for the wind, shared by every hour, because nothing in it
      varies by hour: the cell is the cell, and the label states the day's
      biggest wind with the hour it happened at.

      **That figure is why this line changed shape.** It used to be the row's
      own figure, and the rows now state an hour. The page has nowhere else to
      put it -- ADR-0034 thought the week grid stated it too and ADR-0035
      records that it does not -- so it moves here rather than being lost, which
      is what ADR-0027's "only additively" condition asks. The provenance lines
      sit outside the readout's box, so this costs none of the width that is the
      block's whole constraint.
    */
    const windSource: ProvenanceFacts = {
      label: windPeakLabel(
        gridDay === undefined
          ? null
          : peakInDaylight(gridDay.windMph, day.sunriseMs, day.sunsetMs),
      ),
      source: GRID_SOURCE,
      network: GRID_NETWORK,
      /*
        No distance, which is the omission the cloud row and the chart's own
        cell line already make: a cell is a 2.5 km square of map with the beach
        somewhere inside it, so "about n km from this beach" would be a figure
        about nothing.
      */
      note: cellNote,
    };

    /*
      One swell row per published estimate rather than one per hour, shared by
      the three hours that estimate speaks for. They are that one estimate
      rather than three copies of it: the same height, the same period, the same
      bearing and the same attribution, built once and handed to each.

      **Its label lost the superlative the wind's kept**, which is not an
      inconsistency between the two rows. The wind's line states the day's
      biggest because nothing else on this page does; the day's biggest swell is
      the week grid's own row, still there and still labelled. What this row
      states is one estimate, and `swellStepNote` says which three hours it is
      for -- so the bare word is not the unqualified figure `WaveWeek` warns
      about, it is a figure whose own line names the step behind it.
    */
    const swellRowByHour = new Map<number, CompassNeedle>();
    if (swellDay !== undefined && line !== null) {
      const rows = new Map<PublishedSwell, CompassNeedle>();
      for (const [hour, step] of swellStepByHour(swellDay.hours, dayStartMs)) {
        let row = rows.get(step);
        if (row === undefined) {
          row = {
            kind: "swell",
            label: "Swell",
            fromDegT: step.directionDegT,
            swing: swell,
            figure: swellFigure(step),
            provenance: {
              label: "Swell",
              source: mopLineSource(line.id),
              network: MOP_NETWORK,
              distanceKm: mopLineDistanceKm(line.distanceM),
              note: swellStepNote({ timeLabel: localTimeOf(step.atMs) }),
            },
          };
          rows.set(step, row);
        }
        swellRowByHour.set(hour, row);
      }
    }

    /*
      Every hour either source can speak for, in the order a day runs. An hour
      neither reaches is not an entry at all: a caption over two empty rows
      would be a readout claiming to have said something.

      Wind first within an hour, and the order is the reading order rather than
      an accident. It is the one a reader can feel standing on the sand, it is
      the needle that changes most from hour to hour, and it is the one whose
      relationship to the coast decides whether the water is choppy or glassy.
    */
    const hours: CompassHour[] = [
      ...new Set([...windHours.keys(), ...swellRowByHour.keys()]),
    ]
      .sort((first, second) => first - second)
      .map((hour) => {
        const needles: CompassNeedle[] = [];

        const windAt = windHours.get(hour);
        if (windAt !== undefined) {
          needles.push({
            kind: "wind",
            label: "Wind",
            fromDegT: windAt.fromDegT,
            swing: wind,
            /*
              **`windFigure`, so this is the same rounding as the chart's own
              and not a sixth opinion about one number.** All six statements of
              a wind speed on this page now print whole miles per hour, which
              is the resolution the office issues -- ADR-0042, and #191 is what
              the page read like while five of them agreed and the sixth did
              not.
            */
            figure: windFigure(windAt.mph),
            provenance: windSource,
          });
        }

        const swellRow = swellRowByHour.get(hour);
        if (swellRow !== undefined) needles.push(swellRow);

        /*
          The caption, worded through the same `hourLabelAt` the chart's readout
          and axis use. One hour named twice on one screen has to be named the
          same way, which is what ADR-0035 arranged and what would break first
          if only the chart were fixed: the two regions would disagree on
          exactly the two days that decision was written to make them agree on.

          `instantOfHour` because the rows are keyed by position -- `needles.ts`
          buckets by `hourOfDay` and keeps no instant -- and a position is the
          one thing this must not name itself from.
        */
        return {
          hour,
          caption: hourLabelAt(instantOfHour(hour, dayStartMs)),
          needles,
        };
      });

    return { localDate: day.localDate, hours };
  });

  /*
    Which hour it is now, as an index into any of the seven days.

    Computed here rather than in the client, because the page carries
    `revalidate = 900` and a client reading its own clock would disagree with a
    fifteen-minute-old cached render across an hour boundary and hydrate wrong.
    It is the same reason `nowMs` is a prop rather than a `Date.now()` in the
    plot, and the value comes from the same read, so the chart's now-line and
    the hour it arrives on cannot name different hours.

    `isToday` from the daylight read rather than `nowMs !== null` on the built
    days, which is the distinction `nowMs`'s own comment above draws: six days
    carry null and reading that as a contract would be reading a coincidence of
    construction. `undefined` is unreachable -- `weekOfDays` is built from this
    same instant, so exactly one of the seven is today -- and it is answered
    with null rather than a made-up hour, because a page whose read went wrong
    should select nothing visibly rather than midnight plausibly.
  */
  const today = daylight.days.find((day) => day.isToday);
  const currentHour =
    today === undefined
      ? null
      : hourOfDay(daylight.atMs, localMidnightOf(today.localDate));

  return (
    <section aria-labelledby="day-panel-heading">
      <SelectedHourProvider currentHour={currentHour}>
        <ChosenDay
          days={days}
          map={
            area ? (
              <p className="leading-relaxed text-base text-fog">
                The map draws one beach&apos;s own stretch of coast, with the
                day&apos;s wind and swell laid under it. Choose a beach above
                for {area.name}&apos;s.
              </p>
            ) : shore === null ? null : (
              <>
                <ShoreMap
                  {...shore}
                  description={mapDescription(beach!.name)}
                  absence="We cannot place this beach on a map: the coordinates we hold for it are all one point."
                  noCoast="The coastline this site traces does not reach this beach."
                  coastCredit={`Shore traced from CDFW's ecoregion boundary, which follows this county's own coastline linework — close to the sand, but no tide level is published for it, so the edge is drawn where the land is mapped rather than where the water is today.`}
                  readout={<DayCompass days={compassDays} />}
                  readoutSources={<DayCompassSources days={compassDays} />}
                />
                {/*
                The sighting layer from #121, reserved *on* the map rather than
                instead of it. Until this slice the slot stood where a map would
                go and said a map was coming; the map is here, so what is
                reserved is the layer drawn on it, and the copy says that.

                The three claims this copy has always had to make are unchanged.
                iNaturalist records where people with phones went rather than
                where animals are, so the slot promises a record of reports and
                never a survey; and it says what the layer *will* show rather
                than what was found, because no such report exists yet. Those
                are asserted in this panel's tests now rather than the section's,
                which mocks this component and would pass while the slot said
                nothing at all. No issue number, per the standing rule.
              */}
                <div className="mt-4">
                  <ReservedSlot
                    emoji="🐙"
                    headline="Sightings will be drawn on this map."
                    detail="Will show octopus, nudibranchs, sea hares and leopard sharks logged near this beach in the past week — reported by naturalists, not surveyed by us."
                    density="row"
                  />
                </div>
              </>
            )
          }
        />
      </SelectedHourProvider>
    </section>
  );
}
