/**
 * The readout for the day a reader chose, on a map that is the same on all
 * seven.
 *
 * **The smallest client island that makes this work.** `DayPanel` builds the
 * shore map once and hands it over as finished markup, because the beach, its
 * coast and the four places its figures come from do not change when somebody
 * picks Thursday. The readout does: each day has its own resultant bearing and
 * its own spread. Seven copies of the map would carry the coast seven times --
 * measured at La Jolla, four and a half kilobytes of coordinates a copy, and
 * two hundred points at `del-mar-city-beach` -- to vary two numbers.
 *
 * So the map stays one server-rendered picture with two holes in it, and this
 * fills them. Seven days of needles is a few dozen numbers.
 *
 * **Two components rather than one with a switch**, because the readout and its
 * attribution go in two different places: the readout over a corner of the
 * picture, where `ShoreMap` positions it clear of the coastline, and the
 * publishers down in the list beneath, where `ShoreMap` already keeps the names
 * of things it draws. Each is a line over one shared hook.
 *
 * Rendered outside the provider it shows the first day and offers no choice,
 * which is `selectedDay.ts`'s deliberate default and the state a reader with a
 * blocked script is in.
 */

"use client";

import { Compass, CompassSources, type CompassNeedle } from "./Compass";
import { resolveSelected, useSelectedDay } from "./selectedDay";

/** One day's needles, keyed by the date the week grid chooses by. */
export type CompassDay = {
  /** `YYYY-MM-DD` in Pacific. */
  localDate: string;
  /** Empty on a day no feed gave a bearing for, which renders no readout. */
  needles: readonly CompassNeedle[];
};

function useChosen(days: readonly CompassDay[]): CompassDay | undefined {
  const { selected } = useSelectedDay();
  const showing = resolveSelected(
    selected,
    days.map((day) => day.localDate),
  );
  return days.find((day) => day.localDate === showing) ?? days[0];
}

/** The rows themselves, laid into whichever corner `ShoreMap` chose. */
export function DayCompass({ days }: { days: readonly CompassDay[] }) {
  const day = useChosen(days);
  return day === undefined ? null : <Compass needles={day.needles} />;
}

/** Where the readout's figures came from, printed beneath the picture. */
export function DayCompassSources({ days }: { days: readonly CompassDay[] }) {
  const day = useChosen(days);
  return day === undefined ? null : <CompassSources needles={day.needles} />;
}
