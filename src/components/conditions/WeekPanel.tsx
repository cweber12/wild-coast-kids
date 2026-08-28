/**
 * The seam between the reads and the week grid: read, compose, render.
 *
 * The same thin shape `TidePanel` established, with one addition it earns —
 * turning view models into grid rows. That mapping is here rather than in
 * `WeekGrid` because the grid must not know what a tide is, and it is here
 * rather than in `lib/conditions.ts` because which glyph marks a row and what a
 * row is called are presentation.
 *
 * **Four reads, and only one of them cannot fail.** The tide comes from NOAA,
 * the wave forecast from CDIP and the cloud forecast from the National Weather
 * Service; daylight is computed in this repo from the beach's own coordinates. So the columns are taken from the daylight read: an
 * outage then costs a row rather than the whole grid, and the week still
 * answers a question a parent came with. All three build their days from one
 * helper in `lib/conditions.ts`, which is what stops the rows disagreeing about
 * which day is Tuesday.
 *
 * **The three upstream reads are made concurrently and fail apart.** They share
 * no publisher and no failure, and NOAA going quiet must not cost the week its
 * wave row -- the same argument `readLatestAir` makes for its two stations.
 * The cloud read joins them under ADR-0020, which moved sky off the air card
 * and into this grid: after that change this row is the only sky on the site,
 * so an outage here is a whole variable missing rather than one row thinner,
 * and it says so in the notes below the grid.
 */

import {
  readDaylightWeek,
  readSkyWeek,
  readWaveWeek,
  readWeekOfLowestLows,
} from "@/lib/conditions";
import { DaylightWeek } from "./DaylightWeek";
import {
  MOP_MODEL_NOTE,
  MOP_NETWORK,
  mopLineDistanceKm,
  mopLineSource,
} from "./mopLine";
import {
  GRID_MODEL_NOTE,
  GRID_NETWORK,
  GRID_SOURCE,
  gridCellCaveat,
} from "./gridCell";
import { SkyWeek, SKY_WEEK_ROW } from "./SkyWeek";
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
 * **The gridded slot is gone**, because the row it stood in for exists. Same
 * rule the wave slot came out under: a slot removed before its replacement
 * would leave the page promising less than it did, and a slot left in beside a
 * filled row would promise it twice.
 *
 * **It promises sky and nothing else, and both halves of that are measured.**
 * Visibility cannot follow: the gridpoint declares `visibility` and
 * `ceilingHeight` as keys and publishes no values for either -- measured
 * 2026-08-26, zero entries at every one of the 21 cells covering this
 * inventory, against 34-37 for `skyCover` -- so a row promising visibility
 * would promise a product that does not exist. Temperature and wind must not
 * follow: they come from the air
 * station rather than an airport, measured at p50 3.7 km and max 7.4 km, and
 * ADR-0012 records them as among the best-founded readings here. Moving those
 * to a forecast is the displacement ADR-0019 declined to decide, and this row
 * previously promised it.
 *
 * The surf zone forecast is zone-level and reaches about three days
 * out; it is the product the tide heights on this page were checked against.
 *
 * No issue numbers in the copy. A reader is owed what is coming, not our
 * backlog — the sighting map's slot set that precedent.
 */
const RESERVED: readonly ReservedRow[] = [
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
  const [view, waves, sky] = await Promise.all([
    readWeekOfLowestLows(slug),
    readWaveWeek(slug),
    readSkyWeek(slug),
  ]);
  const daylight = readDaylightWeek(slug);

  /*
    The columns come from the daylight read rather than the tide read, and that
    is deliberate: daylight is computed here and cannot fail, so a NOAA outage
    takes a row off the grid instead of taking the grid off the page. Both reads
    build their days from the same helper, so the two rows cannot disagree about
    which day is Tuesday.

    It rides on the day rather than in `rows`, because it is the window the
    other three rows' figures are selected inside rather than a fourth figure.
    Putting it in the header is what lets those rows be called "Low tide" and
    "Swell": the scope is stated once above them instead of three times in three
    labels that never fitted the cell. See
    `docs/plans/week-grid-legibility.md`.
  */
  const days = daylight.days.map((day) => ({
    ...day,
    daylight: <DaylightWeek day={day} />,
  }));

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

  /*
    Second of three, under the tide. The order down a day block is tide, swell,
    cloud -- what the sea does, what the swell does, what the sky does -- inside
    the window the header states. Daylight used to sit between the first two so
    that a reader could tell a 2:23 AM low from a 2:23 PM one; it is in the
    header now, where it does that for all three rows at once.

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
    Last of the three, under the wave row. Cloud goes last because it is the
    only row with no time in it: a reader scanning a column reads two "when"s
    and then the one figure that is about the whole day, and putting it between
    two timed rows would break that reading. It is also the row whose second
    line varies most in length, and a variable line does least damage at the
    bottom of the cell -- see `SkyWeek`.

    Ragged like the wave row, and for the same reason: the product reaches about
    seven and a half days and the far column may have none.
  */
  if (sky.state.kind === "week" && sky.cell !== null) {
    const cell = sky.cell;
    rows.push({
      ...SKY_WEEK_ROW,
      cells: Object.fromEntries(
        sky.state.days.map((day) => [
          day.localDate,
          <SkyWeek key={day.localDate} day={day} />,
        ]),
      ),
      // Every word from `gridCell.ts`, for the reason `mopLine.ts` exists: two
      // call sites wording one fact is how `ProvenanceLine` came to print the
      // same station two ways on one card. The caveat is null at all but three
      // beaches, where the cell averages over 100 m and covers the bluff.
      provenance: {
        source: GRID_SOURCE,
        network: GRID_NETWORK,
        note: [GRID_MODEL_NOTE, gridCellCaveat(cell.elevationM)]
          .filter((part) => part !== null)
          .join("; "),
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
  /*
    The cloud row's failures get their own sentences, and they carry more weight
    than the wave row's. After ADR-0020 this row is the only sky on the site, so
    a reader who came to find out whether it will be foggy is told nothing at
    all rather than told it elsewhere -- and a silent gap would read as a clear
    week.
  */
  if (sky.state.kind === "no-cell") {
    notes.push(
      "We have no cloud forecast for this beach. The National Weather Service " +
        "publishes its forecasts for squares of the map, and this beach does not " +
        "sit in one we can read.",
    );
  }
  if (sky.state.kind === "unavailable") {
    notes.push(
      `We could not get this week's cloud forecast from the National Weather Service just ` +
        `now. ${sky.state.detail}` +
        (sky.state.drift
          ? " The forecast's payload was not the shape this site pins, which is a bug here " +
            "rather than a problem at the National Weather Service."
          : ""),
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
