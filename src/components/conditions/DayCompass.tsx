/**
 * The readout for the hour a reader is looking at, on a map that is the same on
 * all seven days.
 *
 * **The smallest client island that makes this work.** `DayPanel` builds the
 * shore map once and hands it over as finished markup, because the beach, its
 * coast and the four places its figures come from do not change when somebody
 * picks Thursday, or 3 PM. The readout does: every hour has its own bearing and
 * its own figure. Seven copies of the map would carry the coast seven times --
 * measured at La Jolla, four and a half kilobytes of coordinates a copy, and
 * two hundred points at `del-mar-city-beach` -- to vary two numbers.
 *
 * So the map stays one server-rendered picture with two holes in it, and this
 * fills them. A week of hourly needles is a few hundred numbers, and the parts
 * that do not vary by hour are not copied into each one: a day's two wedges are
 * its own, and the three hours inside one of CDIP's estimates share the row
 * that states it, because they are that one estimate rather than three copies
 * of it.
 *
 * **Two components rather than one with a switch**, because the readout and its
 * attribution go in two different places: the readout over a corner of the
 * picture, where `ShoreMap` positions it clear of the coastline, and the
 * publishers down in the list beneath, where `ShoreMap` already keeps the names
 * of things it draws. Each is a line over one shared hook.
 *
 * **Rendered outside the providers it draws nothing**, which is a change from
 * the day it showed before. `selectedDay`'s default resolves to the first
 * column, so a day was always available; `selectedHour`'s resolves to the hour
 * the server said it was, and outside the provider there is no server and no
 * clock. Selecting midnight to have something to draw would be a plausible
 * figure standing in for a missing one, and this page states an absence rather
 * than filling it. On the built page the provider is always there -- `DayPanel`
 * wraps the whole panel in it, and the hour is computed in the same read that
 * decides which day is today.
 */

"use client";

import { Compass, CompassSources, type CompassNeedle } from "./Compass";
import { resolveSelected, useSelectedDay } from "./selectedDay";
import { resolveHour, useSelectedHour } from "./selectedHour";

/**
 * What the readout says at one hour of one day.
 *
 * **One entry per hour the day can answer for**, and none at all for an hour it
 * cannot: an hour with no wind bearing and no swell estimate in reach is not an
 * entry with two empty rows. `DayPanel` builds these, so which hours those are
 * is a fact about the forecast rather than about this component.
 */
export type CompassHour = {
  /** The hour's position in its own day, which is `hourOfDay`'s convention. */
  hour: number;
  /**
   * What to call it, worded by `hourLabelAt` from the position's own instant so
   * the chart's readout agrees. Not derived from `hour` above: on a fall-back
   * day two positions are both 1 AM and one is 11 PM (ADR-0040).
   */
  caption: string;
  /** Empty on an hour no feed gave a bearing for, which renders no readout. */
  needles: readonly CompassNeedle[];
};

/** One day of the readout, keyed by the date the week grid chooses by. */
export type CompassDay = {
  /** `YYYY-MM-DD` in Pacific. */
  localDate: string;
  /** Oldest first, ragged: the far end of the week runs out of forecast. */
  hours: readonly CompassHour[];
};

/**
 * The day and the hour the page is showing, or nothing to draw.
 *
 * **Two selections, resolved the same way.** The day comes from `selectedDay`
 * and falls back to the first column; the hour comes from `selectedHour` and
 * falls back to the hour it is now, which the server computed. Both defaults
 * live in their own modules rather than here, so the chart and this block
 * cannot resolve one differently -- which would show up only on a page nobody
 * had clicked yet, and would show up as the two regions disagreeing about the
 * hour.
 *
 * `undefined` where there is no hour to show: outside the provider, where
 * nobody supplied a clock, and on an hour this day's forecast does not reach.
 * The first is the degraded render a test in isolation gets; the second is a
 * reader stepping past the end of a ragged day. Both draw no readout, which is
 * what this component already did for a day with no needles.
 */
function useShowing(days: readonly CompassDay[]): CompassHour | undefined {
  const { selected } = useSelectedDay();
  const { selected: chosenHour, currentHour } = useSelectedHour();

  const showing = resolveSelected(
    selected,
    days.map((day) => day.localDate),
  );
  const day = days.find((each) => each.localDate === showing) ?? days[0];
  const hour = resolveHour(chosenHour, currentHour);
  if (day === undefined || hour === null) return undefined;

  return day.hours.find((each) => each.hour === hour);
}

/** The rows themselves, laid into whichever corner `ShoreMap` chose. */
export function DayCompass({ days }: { days: readonly CompassDay[] }) {
  const showing = useShowing(days);
  return showing === undefined ? null : (
    <Compass needles={showing.needles} caption={showing.caption} />
  );
}

/** Where the readout's figures came from, printed beneath the picture. */
export function DayCompassSources({ days }: { days: readonly CompassDay[] }) {
  const showing = useShowing(days);
  return showing === undefined ? null : (
    <CompassSources needles={showing.needles} />
  );
}
