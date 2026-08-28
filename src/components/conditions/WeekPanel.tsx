/**
 * The seam between the reads and the week grid: read, compose, render.
 *
 * The same thin shape `TidePanel` established, with one addition it earns —
 * turning view models into grid rows. That mapping is here rather than in
 * `WeekGrid` because the grid must not know what a tide is, and it is here
 * rather than in `lib/conditions.ts` because which glyph marks a row and what a
 * row is called are presentation.
 *
 * **Five reads, and only one of them cannot fail.** The tide's figures and its
 * hourly series come from NOAA, the wave forecast from CDIP and the cloud
 * forecast from the National Weather Service; daylight is computed in this repo
 * from the beach's own coordinates. So the columns are taken from the daylight
 * read: an outage then costs a row rather than the whole grid, and the week
 * still answers a question a parent came with. All of them build their days
 * from one helper in `lib/conditions.ts`, which is what stops the rows
 * disagreeing about which day is Tuesday.
 *
 * **The four upstream reads are made concurrently and fail apart.** They share
 * no publisher and no failure, and NOAA going quiet must not cost the week its
 * wave row -- the same argument `readLatestAir` makes for its two stations.
 * The cloud read joins them under ADR-0020, which moved sky off the air card
 * and into this grid: after that change this row is the only sky on the site,
 * so an outage here is a whole variable missing rather than one row thinner,
 * and it says so in the notes below the grid.
 *
 * **The hourly tide is the fourth, and it is a second request to the station
 * the first one already asked.** `interval` is part of CO-OPS' URL, so the
 * curve and the turning points cannot arrive together. They therefore fail
 * apart too: the shape can go missing while the figure it sits under is fine,
 * which is a state the notes below say out loud rather than leaving as seven
 * empty frames.
 *
 * **Composing the shapes is this file's job and not the grid's**, for the
 * reason the row mapping is: three publishers' hours have to become one series
 * plus two background layers, and `WeekGrid` must not know what a tide is.
 */

import {
  readDaylightWeek,
  readHourlyTide,
  readSkyWeek,
  readWaveWeek,
  readWeekOfLowestLows,
  type TideHourlyDay,
} from "@/lib/conditions";
import { DaylightWeek } from "./DaylightWeek";
import { DaySpark, type SparkPoint } from "./DaySpark";
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

/** What a day says when the window this page asked NOAA for did not reach it. */
const NO_SERIES = "No hourly prediction for this day.";

/**
 * One value range for every shape in the week.
 *
 * **Seven small multiples share one scale or they are seven charts.** A day
 * scaled to its own range fills the frame whatever it did, so a flat Tuesday
 * and a dramatic Wednesday draw the same picture and the comparison the grid
 * exists for is destroyed. Derived across every hour of every day, which is
 * also what guarantees no point falls outside the frame it is drawn in.
 *
 * Null when the week holds no hours at all, which is a week with nothing to
 * draw rather than a week that is flat.
 */
function sharedRange(
  days: readonly TideHourlyDay[],
): { low: number; high: number } | null {
  const feet = days.flatMap((day) => day.hours.map((hour) => hour.feet));
  if (feet.length === 0) return null;
  return { low: Math.min(...feet), high: Math.max(...feet) };
}

/**
 * What a reader who cannot see the shape is told instead.
 *
 * **The extremes are named as the lowest and highest *hour*, not as the day's
 * low and high.** They are hourly samples of a continuous curve, so the real
 * turning point is lower than any of them and falls between two — which is
 * exactly why this page asks NOAA for the turning points separately and prints
 * that figure above. Wording this as "the day's lowest tide" would put a second
 * figure in the cell that disagrees with the first by a few minutes and a few
 * hundredths, which is worse than having no second figure at all.
 */
function sparkDescription(
  day: TideHourlyDay,
  sunriseLabel: string,
  sunsetLabel: string,
): string {
  const feet = day.hours.map((hour) => hour.feet);
  if (feet.length === 0) return NO_SERIES;
  const low = Math.min(...feet).toFixed(1);
  const high = Math.max(...feet).toFixed(1);
  return (
    `Tide through ${day.dayLabel}, hour by hour: ${low} ft at its lowest hour, ` +
    `${high} ft at its highest. Night is shaded; the sun is up from ` +
    `${sunriseLabel} to ${sunsetLabel}.`
  );
}

/** Hourly heights as the shape draws them. Every hour is NOAA's own; none is interpolated. */
function tidePoints(day: TideHourlyDay): SparkPoint[] {
  return day.hours.map((hour) => ({
    atMs: hour.atMs,
    value: hour.feet,
    published: true,
  }));
}

export async function WeekPanel({ slug }: { slug: string }) {
  // Concurrently, and failing apart: NOAA and CDIP share no publisher and no
  // outage, so neither may hold up or take down the other's row.
  //
  // The hourly read is a fourth request and a second one to NOAA -- `interval`
  // is part of the URL, so the curve and the turning points cannot arrive in
  // one response. It fails apart from the figures it sits under for the same
  // reason the others do: an outage on the hourly series must cost the shape
  // and not the week.
  const [view, hourly, waves, sky] = await Promise.all([
    readWeekOfLowestLows(slug),
    readHourlyTide(slug),
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
  /*
    The shapes, composed from two reads that each own a different layer: the
    hourly heights from NOAA, and the night from this repo's own astronomy.

    It was three. The cloud wash came off the shape after review -- at this
    height a grey wash and a grey night band are two grey things competing for
    one frame, and cloud is legible at the day chart's size rather than this
    one. `sky` is still read here, because the cloud *row* below still prints
    its thirds; what changed is that nothing paints them behind the curve.

    The tide read decides whether there is a shape at all, and daylight only
    ever subtracts from it. Daylight cannot fail, so a shape either exists with
    its night drawn or does not exist at all.

    ADR-0023's figures are untouched by every line of this. The shape draws the
    hours the daylight figure was selected out of; nothing here changes which
    figure that is or puts a second one in the cell.
  */
  const hourlyByDate = new Map(
    hourly.state.kind === "week"
      ? hourly.state.days.map((day) => [day.localDate, day])
      : [],
  );
  const range =
    hourly.state.kind === "week" ? sharedRange(hourly.state.days) : null;

  const days = daylight.days.map((day) => {
    const series = hourlyByDate.get(day.localDate);

    return {
      ...day,
      daylight: <DaylightWeek day={day} />,
      /*
        No shape at all when the tide read failed, rather than an empty frame
        seven times over: the grid then renders exactly as it did before there
        was a spark, and the sentence explaining the outage is already in the
        notes below. A day the read reached but the window did not gets its
        named absence instead, because that is one day missing rather than a
        feed being down.
      */
      spark:
        series === undefined || range === null ? undefined : (
          <DaySpark
            startMs={series.startMs}
            endMs={series.endMs}
            points={tidePoints(series)}
            sunriseMs={day.sunriseMs}
            sunsetMs={day.sunsetMs}
            lowValue={range.low}
            highValue={range.high}
            description={sparkDescription(
              series,
              day.sunriseLabel,
              day.sunsetLabel,
            )}
            absence={NO_SERIES}
          />
        ),
    };
  });

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

  /*
    First, because it qualifies every figure in the grid rather than reporting
    one feed's trouble. ADR-0023 dropped the day's own extremes from these
    cells -- a lowest low at 3:38 AM is a real prediction and a useless plan,
    and the labels naming it never fitted -- and this sentence is the condition
    that was allowed under. Without it a reader who saw a -0.2 ft here last
    week finds it gone with nothing to explain the change, which is the silent
    failure this repo is built to avoid.

    Unconditional, and one sentence rather than seven: the scope is a fact
    about the grid, the same shape as every other note here. It says where the
    figure went as well as that it is missing, because "not shown" alone reads
    as an omission rather than a decision.
  */
  notes.push(
    "This week shows what falls between sunrise and sunset. Lows and swells " +
      "overnight are real and often bigger — today's are on the cards above.",
  );

  if (view.state.kind === "unavailable") {
    notes.push(
      "We could not get this week's tide predictions from NOAA just now. " +
        "Nothing is wrong with the beach — the card above says what went wrong.",
    );
  }
  /*
    The shape and the figure are two requests to one station, so one can go
    quiet while the other answers. A reader who saw the curves last week would
    otherwise find them gone with nothing to explain it, which is the silent
    failure this repo is built to avoid -- and the tide card's disclosure cannot
    cover it, because that card shares the *other* request.

    Only when the figures came through. When both failed the sentence above
    already says so, and saying it twice would make one outage read as two.
  */
  if (view.state.kind === "week" && hourly.state.kind === "unavailable") {
    notes.push(
      "The hour-by-hour shape behind each day's figure is missing this time: " +
        "NOAA answered for the day's high and low tides but not for the hourly " +
        "heights in between. The figures themselves are unaffected.",
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
