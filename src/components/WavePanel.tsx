/**
 * The seam between the network and the wave markup: read, compose, render.
 *
 * **Two reads now, from two publishers, made concurrently and failing apart.**
 * NDBC answers what the water is doing at the buoy this minute; CDIP's MOP
 * model answers what the swell does at this shore over the day. They share no
 * outage, so neither may hold up or take down the other's half of the card --
 * the same argument `readLatestAir` makes for its two stations.
 *
 * **The forecast read is the same one the week grid makes**, so the page reaches
 * CDIP once per beach rather than twice: Next dedupes on the URL, and both
 * callers build the same window from `mopWindow`. Sharing it is why the
 * selection happens here rather than in `lib/conditions.ts` -- which day of the
 * week a now-card shows is presentation, and the read has no opinion about it.
 *
 * **Today's column and nothing else.** The card is the page's answer to "what
 * is it doing", so the forecast beside it is today's peak, matching the grid's
 * today cell exactly rather than offering a second, differently-chosen figure.
 */

import { readLatestWaves, readWaveWeek } from "@/lib/conditions";
import { WavesToday, type WaveForecastPeak } from "./WavesToday";

export async function WavePanel({ slug }: { slug: string }) {
  const [view, week] = await Promise.all([
    readLatestWaves(slug),
    readWaveWeek(slug),
  ]);

  /*
    Null in three states that mean different things and all render the same
    way: the beach binds no line, CDIP could not answer, or the forecast no
    longer reaches today. None of them is explained here, because the week grid
    below says all three in words and this block is the secondary view of that
    row -- the mirror of the tide arrangement, where the week's note points at
    the card that shares its request.
  */
  const today =
    week.state.kind === "week"
      ? week.state.days.find((day) => day.isToday)
      : undefined;

  const peak: WaveForecastPeak | null =
    today === undefined || week.line === null
      ? null
      : {
          line: week.line,
          timeLabel: today.timeLabel,
          heightFt: today.heightFt,
          periodS: today.periodS,
        };

  return <WavesToday {...view} peak={peak} />;
}
