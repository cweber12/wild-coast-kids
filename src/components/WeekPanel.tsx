/**
 * The seam between the reads and the week grid: read, compose, render.
 *
 * The same thin shape `TidePanel` established, with one addition it earns —
 * turning view models into grid rows. That mapping is here rather than in
 * `WeekGrid` because the grid must not know what a tide is, and it is here
 * rather than in `lib/conditions.ts` because which glyph marks a row and what a
 * row is called are presentation.
 *
 * **Three reads, and only one of them cannot fail.** The tide comes from NOAA
 * and the wave forecast from CDIP; daylight is computed in this repo from the
 * beach's own coordinates. So the columns are taken from the daylight read: an
 * outage then costs a row rather than the whole grid, and the week still
 * answers a question a parent came with. All three build their days from one
 * helper in `lib/conditions.ts`, which is what stops the rows disagreeing about
 * which day is Tuesday.
 *
 * **The two upstream reads are made concurrently and fail apart.** They share
 * no publisher and no failure, and NOAA going quiet must not cost the week its
 * wave row -- the same argument `readLatestAir` makes for its two stations.
 */

import {
  readDaylightWeek,
  readWaveWeek,
  readWeekOfLowestLows,
} from "@/lib/conditions";
import { DaylightWeek, DAYLIGHT_WEEK_ROW } from "./DaylightWeek";
import {
  MOP_MODEL_NOTE,
  MOP_NETWORK,
  mopLineDistanceKm,
  mopLineSource,
} from "./mopLine";
import { TideWeek, TIDE_WEEK_ROW } from "./TideWeek";
import { WaveWeek, WAVE_WEEK_ROW } from "./WaveWeek";
import { WeekGrid, type ReservedRow, type WeekRow } from "./WeekGrid";

/**
 * The forecasts this grid is shaped for and does not yet carry.
 *
 * **The wave slot is gone**, because the row it stood in for exists. It came out
 * in the same change that filled it: a slot removed before its replacement
 * would leave the page promising less than it did, and a slot left in beside a
 * filled row would promise it twice.
 *
 * The gridded National Weather Service forecast is #95, which exists so that
 * sky and visibility can come from this beach's own grid cell instead of an
 * aerodrome. The surf zone forecast is zone-level and reaches about three days
 * out; it is the product the tide heights on this page were checked against.
 *
 * No issue numbers in the copy. A reader is owed what is coming, not our
 * backlog — the sighting map's slot set that precedent.
 */
const RESERVED: readonly ReservedRow[] = [
  {
    emoji: "💨",
    headline: "A gridded forecast is coming.",
    detail:
      "Temperature, wind and sky for this beach's own grid cell, instead of the nearest airport's reading.",
  },
  {
    emoji: "🏖️",
    headline: "The surf zone forecast is coming.",
    detail:
      "Rip current risk, surf height and water temperature, issued for this stretch of coast about three days ahead.",
  },
];

export async function WeekPanel({ slug }: { slug: string }) {
  // Concurrently, and failing apart: NOAA and CDIP share no publisher and no
  // outage, so neither may hold up or take down the other's row.
  const [view, waves] = await Promise.all([
    readWeekOfLowestLows(slug),
    readWaveWeek(slug),
  ]);
  const daylight = readDaylightWeek(slug);

  /*
    The columns come from the daylight read rather than the tide read, and that
    is deliberate: daylight is computed here and cannot fail, so a NOAA outage
    takes a row off the grid instead of taking the grid off the page. Both reads
    build their days from the same helper, so the two rows cannot disagree about
    which day is Tuesday.
  */
  const days = daylight.days;

  const rows: WeekRow[] = [];

  if (view.state.kind === "week") {
    const tideDays = view.state.days;
    rows.push({
      ...TIDE_WEEK_ROW,
      cells: Object.fromEntries(
        tideDays.map((day) => [
          day.localDate,
          <TideWeek key={day.localDate} state={day.state} />,
        ]),
      ),
    });
  }

  rows.push({
    ...DAYLIGHT_WEEK_ROW,
    cells: Object.fromEntries(
      daylight.days.map((day) => [
        day.localDate,
        <DaylightWeek key={day.localDate} day={day} />,
      ]),
    ),
  });

  /*
    Last, under daylight rather than between it and the tide. `DaylightWeek`'s
    whole argument is that it sits beside the tide row -- a lowest low at 2:23
    is a different trip depending on whether it is AM or PM, and the daylight
    row is what answers that -- so putting a third product between them would
    take away the thing it is there for. It also puts the row that carries a
    provenance line closest to the line itself.

    Ragged by construction: only the days the forecast reached become cells, and
    the grid draws no pair where a row has none.
  */
  if (waves.state.kind === "week" && waves.line !== null) {
    const line = waves.line;
    rows.push({
      ...WAVE_WEEK_ROW,
      cells: Object.fromEntries(
        waves.state.days.map((day) => [
          day.localDate,
          <WaveWeek key={day.localDate} day={day} />,
        ]),
      ),
      // Every word of this comes from `mopLine.ts`, because the wave card
      // states the same four facts and two call sites wording one fact is how
      // `ProvenanceLine` came to print the same station two ways on one card.
      provenance: {
        source: mopLineSource(line.id),
        network: MOP_NETWORK,
        distanceKm: mopLineDistanceKm(line.distanceM),
        note: MOP_MODEL_NOTE,
      },
    });
  }

  /*
    One sentence, not seven. The upstream detail stays behind the disclosure on
    the tide card above, which shares this exact request and therefore fails at
    the same moment — repeating it here would be the same failure twice.
  */
  const notes: string[] = [];
  if (view.state.kind === "unavailable") {
    notes.push(
      "We could not get this week's tide predictions from NOAA just now. " +
        "Nothing is wrong with the beach — the card above says what went wrong.",
    );
  }
  if (view.state.kind === "no-station") {
    notes.push(
      "We have no tide station for this beach, so there is nothing to predict " +
        "this week from. The tide here is not different; we simply have no " +
        "published figure for it.",
    );
  }

  /*
    The wave forecast gets its own sentences rather than pointing at a card, and
    that is the difference from the tide above. The tide row shares a request
    with the card over it, so its disclosure is already on the page; CDIP is
    read here and nowhere else, so a failure that said only "we could not get
    it" would be the silent half of a failure.
  */
  if (waves.state.kind === "no-line") {
    notes.push(
      "There is no wave forecast for this beach either, and for the same reason " +
        "as the reading above: every point the model publishes sits at 10 m " +
        "depth out on the open coast.",
    );
  }
  if (waves.state.kind === "unavailable") {
    notes.push(
      `We could not get this week's wave forecast from CDIP just now. ${waves.state.detail}` +
        (waves.state.drift
          ? " CDIP's payload was not the shape this site pins, which is a bug here rather than a problem with the model."
          : ""),
    );
  }

  return (
    <WeekGrid
      headingId="week-ahead-heading"
      title="The week ahead"
      days={days}
      rows={rows}
      notes={notes}
      reserved={RESERVED}
    />
  );
}
