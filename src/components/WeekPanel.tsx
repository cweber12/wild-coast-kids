/**
 * The seam between the network and the week grid: read, compose, render.
 *
 * The same thin shape `TidePanel` established, with one addition it earns —
 * turning a view model into grid rows. That mapping is here rather than in
 * `WeekGrid` because the grid must not know what a tide is, and it is here
 * rather than in `lib/conditions.ts` because which glyph marks a row and what
 * a row is called are presentation.
 */

import { readWeekOfLowestLows } from "@/lib/conditions";
import { TideWeek, TIDE_WEEK_ROW } from "./TideWeek";
import { WeekGrid, type ReservedRow, type WeekRow } from "./WeekGrid";

/**
 * The forecasts this grid is shaped for and does not yet carry.
 *
 * **Waves are reserved rather than omitted**, and the distinction is the point:
 * only NDBC is observation-only. CDIP's MOP system publishes an hourly wave
 * forecast about ten days ahead at roughly 100 m along the shore, so a layout
 * with no wave row would encode "no wave forecast exists" — which is false.
 * Adopting MOP needs decisions of its own (NetCDF over THREDDS is not a shape
 * this repo parses, and CDIP asks to be contacted and credited), so the row is
 * held open rather than filled. Tracked as #126.
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
    emoji: "🏄",
    headline: "A wave forecast is coming.",
    detail:
      "Swell height and period for each day, forecast close to this shore rather than at a buoy miles offshore.",
  },
  {
    emoji: "🌡️",
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
  const view = await readWeekOfLowestLows(slug);

  const days = view.state.kind === "week" ? view.state.days : [];

  const rows: WeekRow[] =
    days.length === 0
      ? []
      : [
          {
            ...TIDE_WEEK_ROW,
            cells: Object.fromEntries(
              days.map((day) => [
                day.localDate,
                <TideWeek key={day.localDate} state={day.state} />,
              ]),
            ),
          },
        ];

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
