/**
 * The dial for the day a reader chose, on a map that is the same on all seven.
 *
 * **The smallest client island that makes this work.** `DayPanel` builds the
 * shore map once and hands it over as finished markup, because the beach, its
 * coast and the four places its figures come from do not change when somebody
 * picks Thursday. The needles do: each day has its own resultant bearing and
 * its own arc. Seven copies of the map would carry the coast seven times --
 * measured at La Jolla, four and a half kilobytes of coordinates a copy, and
 * two hundred points at `del-mar-city-beach` -- to vary two numbers.
 *
 * So the map stays one server-rendered picture with a hole in it, and this
 * fills the hole. Seven days of needles is a few dozen numbers.
 *
 * **Two components rather than one with a switch**, because the dial and its
 * words go in two different places: the dial inside the map's own drawing
 * space, where the projection puts it on the beach, and the words down in the
 * list beside the picture, where `ShoreMap` already keeps the names of things
 * it draws. Each is a line over one shared hook.
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
  /** Empty on a day no feed gave a bearing for, which draws no dial. */
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

/** The dial itself, drawn into whatever origin `ShoreMap` translated it to. */
export function DayCompass({ days }: { days: readonly CompassDay[] }) {
  const day = useChosen(days);
  return day === undefined ? null : <Compass needles={day.needles} />;
}

/** What the dial says, for a reader not looking at it. */
export function DayCompassSources({ days }: { days: readonly CompassDay[] }) {
  const day = useChosen(days);
  return day === undefined ? null : <CompassSources needles={day.needles} />;
}
