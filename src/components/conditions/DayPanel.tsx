/**
 * The day's own region, below the week.
 *
 * The seam between the network and the markup, and deliberately thin, like the
 * panels beside it: read, compose, render. Everything with a judgement in it
 * sits on one side or the other, where it can be tested without a network.
 *
 * **It shows today and only today, for now.** The week above becomes the day
 * selector in a later slice of this same pull request; until then the panel is
 * the day a reader is standing in, which is the day it opens on afterwards
 * anyway. That ordering is deliberate rather than incidental -- the panel has
 * to be worth looking at before it is worth switching, and a selector wired to
 * a region nobody has reviewed is two unreviewed things at once.
 *
 * **Two tabs, and the frame belongs to neither of them.** The plot draws the
 * tide or the swell; wind and temperature arrive next, from a cell this page
 * already reads. They arrive as a foreground swapped inside the same frame,
 * which is why the day's ends, the night and the cloud are all composed here
 * rather than inside any one series -- and why the frame is arithmetic on the
 * calendar rather than a field of the tide read. It used to be the latter, and
 * that would have let a NOAA outage decide whether CDIP got drawn.
 *
 * **Which day is today comes from the daylight read, and no clock is read
 * here.** A component that called `Date.now()` would be reading a clock during
 * render, which is impure and which this repo's lint rules refuse -- correctly,
 * and it caught the first version of this file. `readDaylightWeek` is computed
 * from the beach's own coordinates rather than fetched, so it cannot fail and
 * costs no request; it carries the instant it was computed from, which is what
 * the chart's "now" line is drawn at. `WeekPanel` takes its columns from the
 * same read, so the two regions cannot disagree about which day is today.
 *
 * **Four reads, made concurrently and failing apart.** The hourly heights come
 * from NOAA, the swell from CDIP, the cloud from the National Weather Service's
 * numbers and the wording from its sentences -- four products, four outages. A
 * quiet cloud feed costs the band and not the curve; a quiet NOAA costs the
 * tide tab and not the swell tab; and each tab that is quiet says which
 * publisher went quiet rather than saying only that something is missing.
 */

import {
  readDaylightWeek,
  readHourlyTide,
  readSkyWeek,
  readSkyWording,
  readWaveWeek,
  type TideHourlyDay,
  type TideHourlyView,
  type WaveWeekDay,
  type WaveWeekView,
} from "@/lib/conditions";
import { localMidnightOf, addLocalDays } from "@/lib/pacific-time";
import { HourChart, type HourSeries } from "./HourChart";
import { REGION_HEADING } from "./headingRank";
import { SkyWording } from "./SkyWording";
import { swellPoints, tidePoints } from "./series";

/** What the chart says when the window this page asked NOAA for did not reach today. */
const NO_SERIES =
  "We have no hour-by-hour tide prediction for today. The figures on the week above are unaffected.";

/**
 * What each tab says when its own feed is the thing that is missing.
 *
 * **Three states and not one sentence, and that is a change from the
 * one-series chart.** A beach with no MOP line will never have a swell curve
 * and that is a permanent fact about the place; a feed that did not answer is a
 * fact about this quarter of an hour; a day the forecast does not reach is
 * neither. With one series a reader could work out which had happened from the
 * rest of the page. With four tabs they cannot: "we have no figure for today"
 * printed four times says nothing about which publisher went quiet.
 *
 * The outage half follows `WeekPanel`'s wording rather than inventing its own,
 * down to the drift clause -- `ProvenanceLine`'s docstring records what a
 * second call site usually costs this repo, and two sentences about the same
 * outage in two registers is that cost.
 */
const WORDS = {
  tide: {
    outOfReach: NO_SERIES,
    outage:
      "We could not get today's hour-by-hour tide prediction from NOAA just now.",
    drift:
      "NOAA's payload was not the shape this site pins, which is a bug here rather than a problem at NOAA.",
  },
  swell: {
    outOfReach:
      "CDIP's forecast for this beach does not reach today. The figures on the week above are unaffected.",
    outage: "We could not get today's wave forecast from CDIP just now.",
    drift:
      "CDIP's payload was not the shape this site pins, which is a bug here rather than a problem with the model.",
  },
} as const;

/** Why a tab has no curve, said about that tab's own publisher. */
function absenceFor(
  view: TideHourlyView | WaveWeekView,
  words: (typeof WORDS)[keyof typeof WORDS],
): string {
  if (view.state.kind === "week") return words.outOfReach;
  if (view.state.kind === "unavailable") {
    return (
      `${words.outage} ${view.state.detail}` +
      (view.state.drift ? ` ${words.drift}` : "")
    );
  }
  // `no-station` and `no-line`: the join's own reason, which names the distance
  // that refused the binding. It is already a sentence and rewording it here
  // would lose the figure in it.
  return view.state.reason;
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
  sunriseLabel: string,
  sunsetLabel: string,
): string {
  const feet = day.hours.map((hour) => hour.feet);
  const low = Math.min(...feet).toFixed(1);
  const high = Math.max(...feet).toFixed(1);
  return (
    `Tide today, hour by hour from midnight to midnight: ${low} ft at its lowest hour, ` +
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
  sunriseLabel: string,
  sunsetLabel: string,
): string {
  const heights = day.hours.map((hour) => hour.heightFt);
  const published = day.hours.filter((hour) => hour.published).length;
  const low = Math.min(...heights).toFixed(1);
  const high = Math.max(...heights).toFixed(1);
  return (
    `Swell today, from ${low} ft to ${high} ft. CDIP publishes every three hours and ` +
    `issued ${published} estimates for today; the curve between them is drawn here rather ` +
    `than forecast. Night is shaded; the sun is up from ${sunriseLabel} to ${sunsetLabel}.`
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
): string | undefined {
  if (hours.length === 0) return undefined;
  const values = hours.map((hour) => hour.percent);
  return (
    `Cloud cover through today, hour by hour: ${Math.min(...values)} to ` +
    `${Math.max(...values)} per cent. Darker is more cloud.`
  );
}

export async function DayPanel({ slug }: { slug: string }) {
  const daylight = readDaylightWeek(slug);
  const [hourly, waves, sky, wording] = await Promise.all([
    readHourlyTide(slug),
    readWaveWeek(slug),
    readSkyWeek(slug),
    readSkyWording(slug),
  ]);

  // `weekOfDays` builds its array from today outward, so the first entry is
  // today by construction. Taking it from any of the four reads above instead
  // would not work: each is ragged in its own way, and each can fail.
  const today = daylight.days[0];

  const tideDay =
    hourly.state.kind === "week"
      ? hourly.state.days.find((day) => day.localDate === today.localDate)
      : undefined;

  const waveDay =
    waves.state.kind === "week"
      ? waves.state.days.find((day) => day.localDate === today.localDate)
      : undefined;

  const cloudHours =
    sky.state.kind === "week"
      ? (sky.state.days.find((day) => day.localDate === today.localDate)
          ?.hours ?? [])
      : [];

  /*
    The frame comes from the calendar, not from a feed.

    It used to be the tide read's own `startMs` and `endMs`, which was right
    when the tide was the only series: no tide, no chart, no frame needed. With
    four products in one frame that would let NOAA's outage decide whether CDIP
    gets drawn. `localMidnightOf` is arithmetic on the beach's own zone and
    cannot fail, and it steps by date rather than by adding twenty-four hours,
    because twice a year on this coast a day is twenty-three or twenty-five.
  */
  const startMs = localMidnightOf(today.localDate);
  const endMs = localMidnightOf(addLocalDays(today.localDate, 1));

  /*
    Tide first, always, and the order is the tab order.

    It is the page's lead product -- the first row of the week and the first
    card above it -- and it is what a reader without a script gets, since the
    server renders the first tab. Reordering to put a series with data first
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
          ? NO_SERIES
          : chartDescription(tideDay, today.sunriseLabel, today.sunsetLabel),
      absence: absenceFor(hourly, WORDS.tide),
    },
    {
      key: "swell",
      label: "Swell",
      unitLabel: "ft",
      points: waveDay === undefined ? [] : swellPoints(waveDay),
      description:
        waveDay === undefined
          ? WORDS.swell.outOfReach
          : swellDescription(waveDay, today.sunriseLabel, today.sunsetLabel),
      absence: absenceFor(waves, WORDS.swell),
    },
  ];

  return (
    <section aria-labelledby="day-panel-heading">
      <h2 id="day-panel-heading" className={REGION_HEADING}>
        Today, hour by hour
      </h2>

      <div className="mb-4">
        <SkyWording view={wording} localDate={today.localDate} />
      </div>

      {/*
        The plot draws the whole day rather than the daylight window, which is
        what discharges ADR-0023's overnight debt: the 3 AM low the week grid
        cannot print a label for is here, inside a band that is visibly night.

        Every tab draws that same day against the same night and the same cloud.
        Only the foreground changes, which is what makes the four one instrument
        rather than four charts sharing a tile.
      */}
      <HourChart
        startMs={startMs}
        endMs={endMs}
        series={series}
        sunriseMs={today.sunriseMs}
        sunsetMs={today.sunsetMs}
        cloud={cloudHours.map((hour) => ({
          atMs: hour.atMs,
          value: hour.percent,
          published: true,
        }))}
        cloudDescription={cloudBandDescription(cloudHours)}
        nowMs={daylight.atMs}
      />
    </section>
  );
}
