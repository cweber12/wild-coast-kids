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
 * **One tab's worth of chart, and the tab bar is not here yet.** The plot draws
 * the tide. Swell, wind and temperature arrive next, and they arrive as a
 * foreground swapped inside this same frame -- which is why nothing about the
 * background layers below is keyed to the tide.
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
 * **Three reads, made concurrently and failing apart.** The hourly heights come
 * from NOAA, the cloud from the National Weather Service's numbers and the
 * wording from its sentences -- three products, three outages. A quiet cloud
 * feed costs the wash and not the curve; a quiet NOAA costs the curve and not
 * the words.
 */

import {
  readDaylightWeek,
  readHourlyTide,
  readSkyWeek,
  readSkyWording,
  type TideHourlyDay,
} from "@/lib/conditions";
import { HourChart } from "./HourChart";
import { REGION_HEADING } from "./headingRank";
import { SkyWording } from "./SkyWording";
import { tidePoints } from "./series";

/** What the chart says when the window this page asked NOAA for did not reach today. */
const NO_SERIES =
  "We have no hour-by-hour tide prediction for today. The figures on the week above are unaffected.";

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
    `${high} ft at its highest. Night is shaded and cloud runs along the top; the sun ` +
    `is up from ${sunriseLabel} to ${sunsetLabel}.`
  );
}

export async function DayPanel({ slug }: { slug: string }) {
  const daylight = readDaylightWeek(slug);
  const [hourly, sky, wording] = await Promise.all([
    readHourlyTide(slug),
    readSkyWeek(slug),
    readSkyWording(slug),
  ]);

  // `weekOfDays` builds its array from today outward, so the first entry is
  // today by construction. Taking it from any of the three reads above instead
  // would not work: each is ragged in its own way, and each can fail.
  const today = daylight.days[0];

  const series =
    hourly.state.kind === "week"
      ? hourly.state.days.find((day) => day.localDate === today.localDate)
      : undefined;

  const cloudHours =
    sky.state.kind === "week"
      ? (sky.state.days.find((day) => day.localDate === today.localDate)
          ?.hours ?? [])
      : [];

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

        `startMs` and `endMs` come from the tide read rather than being derived
        as midnight plus 24 hours, because twice a year on this coast a day is
        twenty-three hours or twenty-five.
      */}
      {series === undefined ? (
        <p className="leading-relaxed text-base text-fog">{NO_SERIES}</p>
      ) : (
        <HourChart
          startMs={series.startMs}
          endMs={series.endMs}
          points={tidePoints(series)}
          sunriseMs={today.sunriseMs}
          sunsetMs={today.sunsetMs}
          cloud={cloudHours.map((hour) => ({
            atMs: hour.atMs,
            value: hour.percent,
            published: true,
          }))}
          nowMs={daylight.atMs}
          variableLabel="Tide"
          unitLabel="ft"
          description={chartDescription(
            series,
            today.sunriseLabel,
            today.sunsetLabel,
          )}
          absence={NO_SERIES}
        />
      )}
    </section>
  );
}
