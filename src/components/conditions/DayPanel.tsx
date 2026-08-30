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
 * **Five reads, made concurrently and failing apart.** The hourly heights come
 * from NOAA, the swell from CDIP, the cloud from the National Weather Service's
 * numbers and the wording from its sentences -- five products, five outages. A
 * quiet cloud feed costs the band and not the curve; a quiet NOAA costs the
 * tide tab and not the swell tab; and each tab that is quiet says which
 * publisher went quiet rather than saying only that something is missing.
 *
 * **And, on today alone, what was measured.** Every read above is a model or a
 * prediction; the buoy and the shore station are the only instruments this
 * site reports at all. They arrive through `MeasuredPanel` on a Suspense
 * boundary of their own rather than joining the five above, because they draw
 * no part of the chart and a slow buoy must not hold up a curve it has nothing
 * to do with. The other six days get a sentence instead, naming the day, for
 * the reason `WORDS` below takes a `when` at all.
 */

import { Suspense } from "react";
import {
  readDaylightWeek,
  readGridpointWeek,
  readHourlyTide,
  readSkyWeek,
  readSkyWording,
  readWaveWeek,
  type GridDaySeries,
  type GridpointWeekView,
  type TideHourlyDay,
  type TideHourlyView,
  type WaveWeekDay,
  type WaveWeekView,
} from "@/lib/conditions";
import { beachBySlug } from "@/lib/beaches";
import { localMidnightOf, addLocalDays } from "@/lib/pacific-time";
import { ChosenDay, type DayView } from "./ChosenDay";
import type { HourSeries } from "./HourChart";
import { MeasuredPanel } from "./MeasuredPanel";
import { MeasuredToday } from "./MeasuredToday";
import { ShoreMap } from "./ShoreMap";
import { shoreViewFor } from "./shore";
import { SkyWording } from "./SkyWording";
import { gridPoints, swellPoints, tidePoints } from "./series";

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
 * What a reader who cannot see the plot is told instead.
 *
 * **The extremes are named as the lowest and highest *hour*, not as the day's
 * low and high** -- the same care `WeekPanel`'s description takes, and for the
 * same reason. These are hourly samples of a continuous curve, so the real
 * turning point is lower than any of them and falls between two, which is why
 * this page asks NOAA for the turning points separately.
 */
function chartDescription(
  day: TideHourlyDay,
  when: string,
  sunriseLabel: string,
  sunsetLabel: string,
): string {
  const feet = day.hours.map((hour) => hour.feet);
  const low = Math.min(...feet).toFixed(1);
  const high = Math.max(...feet).toFixed(1);
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
 */
function swellDescription(
  day: WaveWeekDay,
  when: string,
  sunriseLabel: string,
  sunsetLabel: string,
): string {
  const heights = day.hours.map((hour) => hour.heightFt);
  const published = day.hours.filter((hour) => hour.published).length;
  const low = Math.min(...heights).toFixed(1);
  const high = Math.max(...heights).toFixed(1);
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
 */
function gridDescription(
  name: string,
  unit: string,
  series: GridDaySeries | undefined,
  when: string,
  sunriseLabel: string,
  sunsetLabel: string,
  outOfReach: string,
): string {
  if (series === undefined) return outOfReach;
  if (series.kind === "absent") return series.reason;
  if (series.hours.length === 0) return outOfReach;

  const values = series.hours.map((hour) => hour.value);
  const blocks = series.hours.filter((hour) => hour.published).length;
  const low = Math.min(...values).toFixed(0);
  const high = Math.max(...values).toFixed(0);
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
 * Says what the picture is and how many sources are on it, and nothing about
 * what the shape of the coast means. A reader hearing this should learn the
 * same thing a reader seeing it does: that these figures come from places, and
 * roughly how many.
 */
function mapDescription(beachName: string, sources: number): string {
  return (
    `A map of ${beachName} and the ${sources} ` +
    `${sources === 1 ? "place" : "places"} the figures on this page come from, ` +
    `each drawn at its real distance from the beach.`
  );
}

export async function DayPanel({ slug }: { slug: string }) {
  const daylight = readDaylightWeek(slug);
  const [hourly, waves, sky, grid, wording] = await Promise.all([
    readHourlyTide(slug),
    readWaveWeek(slug),
    readSkyWeek(slug),
    readGridpointWeek(slug),
    readSkyWording(slug),
  ]);

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
    // "today" inside a sentence, `Thu, Aug 27` on the other six. The grid's own
    // label, so the heading and the cell a reader just chose agree.
    const when = day.isToday ? "today" : day.dayLabel;

    const tideDay =
      hourly.state.kind === "week"
        ? hourly.state.days.find((each) => each.localDate === day.localDate)
        : undefined;

    const waveDay =
      waves.state.kind === "week"
        ? waves.state.days.find((each) => each.localDate === day.localDate)
        : undefined;

    const cloudHours =
      sky.state.kind === "week"
        ? (sky.state.days.find((each) => each.localDate === day.localDate)
            ?.hours ?? [])
        : [];

    const gridDay =
      grid.state.kind === "week"
        ? grid.state.days.find((each) => each.localDate === day.localDate)
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
        points: tideDay === undefined ? [] : tidePoints(tideDay),
        description:
          tideDay === undefined
            ? WORDS.tide.outOfReach(when)
            : chartDescription(
                tideDay,
                when,
                day.sunriseLabel,
                day.sunsetLabel,
              ),
        absence: absenceFor(hourly, WORDS.tide, when),
      },
      {
        key: "swell",
        label: "Swell",
        unitLabel: "ft",
        points: waveDay === undefined ? [] : swellPoints(waveDay),
        description:
          waveDay === undefined
            ? WORDS.swell.outOfReach(when)
            : swellDescription(
                waveDay,
                when,
                day.sunriseLabel,
                day.sunsetLabel,
              ),
        absence: absenceFor(waves, WORDS.swell, when),
      },
      {
        key: "wind",
        label: "Wind",
        unitLabel: "mph",
        points: gridDay === undefined ? [] : gridPoints(gridDay.windMph),
        description: gridDescription(
          "Wind",
          "mph",
          gridDay?.windMph,
          when,
          day.sunriseLabel,
          day.sunsetLabel,
          WORDS.wind.outOfReach(when),
        ),
        absence: gridAbsenceFor(grid, gridDay?.windMph, WORDS.wind, when),
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
        points: gridDay === undefined ? [] : gridPoints(gridDay.airTempF),
        description: gridDescription(
          "Air temperature",
          "°F",
          gridDay?.airTempF,
          when,
          day.sunriseLabel,
          day.sunsetLabel,
          WORDS.temperature.outOfReach(when),
        ),
        absence: gridAbsenceFor(
          grid,
          gridDay?.airTempF,
          WORDS.temperature,
          when,
        ),
      },
    ];

    return {
      localDate: day.localDate,
      // "Today" at the head of a heading, the grid's own label otherwise.
      dayName: day.isToday ? "Today" : day.dayLabel,
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
      wording: <SkyWording view={wording} localDate={day.localDate} />,
      /*
        Rendered here and handed over finished, which is the `wording` field's
        precedent one line up: the reads are the server's and `ChosenDay` is a
        client component, so a measured block that fetched for itself would
        have to become one too.

        `day.isToday` decides it here rather than `ChosenDay` testing
        `nowMs !== null` downstream. That test would work -- six days carry
        null -- and it would be reading a coincidence of construction as if it
        were a contract. The daylight read states which day is today, and this
        is the one place that fact is already in hand.
      */
      measured: day.isToday ? (
        <Suspense
          fallback={
            <p className="text-base text-fog">
              Reading the buoy and the air station…
            </p>
          }
        >
          <MeasuredPanel slug={slug} />
        </Suspense>
      ) : (
        <MeasuredToday when={when} readings={null} />
      ),
    };
  });

  /*
    The map is built once and handed over, outside the seven days, because it
    is the same picture on all seven: this beach, its coast, and the four places
    its figures come from. It is also the one thing in this region that reads no
    feed -- `beaches.json` and `mop-lines.json` are committed -- so it cannot go
    quiet and does not belong behind a Suspense boundary.

    A beach the inventory does not hold is not this component's error to invent
    a map for: the route already answered that question before rendering, and
    `beachBySlug` returning null here would mean the page is showing a beach it
    does not have.
  */
  const beach = beachBySlug(slug);
  const shore = beach === null ? null : shoreViewFor(beach);

  return (
    <section aria-labelledby="day-panel-heading">
      <ChosenDay
        days={days}
        map={
          shore === null ? null : (
            <ShoreMap
              {...shore}
              description={mapDescription(beach!.name, shore.markers.length)}
              absence="We cannot place this beach on a map: every source we have for it is at the same point."
              noCoast="The coastline this site traces is the open coast, and it does not reach this beach."
              coastCredit={`Shore traced from CDIP's model lines, which run a few hundred metres offshore — so the water fades in rather than stopping at a shoreline.`}
            />
          )
        }
      />
    </section>
  );
}
