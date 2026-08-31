/**
 * Which hour of the day the page is showing, shared between the plot that
 * offers the choice and the readout that was ignoring it.
 *
 * **One selected hour, and no day mode.** `HourChart` held this as its own
 * `useState` and the map's readout showed a day aggregate beside it, so the two
 * regions stated different things about one day. ADR-0027 refused the obvious
 * fix -- a needle "whose meaning changes depending on what was last clicked" --
 * and ADR-0035 supersedes that clause by removing the thing that changes: the
 * readout has no day mode to switch out of, because it shows an hour before any
 * click as well as after every one.
 *
 * **An hour, not an instant.** `HourChart`'s own comment gives the reason it
 * held an instant: an index means something different in each of the four
 * series, so index 9 is 9 AM in one and mid-afternoon in another. An hour
 * survives a tab change for that same reason -- it is resolved against each
 * series by its own `atMs` -- *and* survives a day change, which an instant
 * cannot, because an instant on Tuesday matches no point in Thursday. That
 * second property is the one this file is for: the default resolves per day, so
 * the shared value had to be a day-relative one either way, and a reader who
 * chose 5 PM watching the page revert it on every day change is the one thing
 * they cannot have meant.
 *
 * **Null means "whatever hour it is now", and nothing here reads a clock.**
 * `selectedDay.ts` starts null and lets each consumer resolve it against its own
 * first column, for the reason that only `conditions.ts` honestly knows what
 * today is. The same holds twice over here: the page carries `revalidate = 900`,
 * so a client reading its own clock would disagree with a fifteen-minute-old
 * cached render across an hour boundary and hydrate wrong. `currentHour` is
 * therefore supplied by the server read that already knows which day is today,
 * and the server render and the first client render agree by construction.
 *
 * **The hour is an index into the day, which is `HourChart`'s convention rather
 * than a new one.** That component derives an hour as
 * `Math.round((atMs - startMs) / HOUR_MS)` and prints it through `hourLabel`,
 * which reads an index as a clock hour -- and `localMidnightOf` resolves the
 * zone offset twice, so a fall-back day is twenty-five hours long and the two
 * diverge. That defect predates this file and is not fixed here; what this file
 * owes it is not to introduce a second, disagreeing convention, so that the
 * chart and the readout can never call one hour by two names and the fix stays
 * a single-site one. See ADR-0035's last consequence.
 */

"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SelectedHour = {
  /** The hour a reader chose, as an index into the day, or null for "now". */
  selected: number | null;
  choose: (hour: number) => void;
  /**
   * Which hour is now, as an index into any of the seven days.
   *
   * The same number on all seven, deliberately: at 3:40 PM every day shows its
   * own 3 PM. Six of them have no "now" at all -- `DayPanel` sets `nowMs` from
   * `day.isToday` and null otherwise -- so "the current hour" needs a rule for
   * Thursday, and the same clock hour is the one rule that means the same thing
   * on all of them.
   *
   * `null` outside the provider, where nobody has supplied a clock.
   */
  currentHour: number | null;
};

/**
 * The default is the null state rather than a throw, which is `selectedDay.ts`'s
 * choice and is made here for its reason.
 *
 * A chart rendered outside the provider selects nothing and offers no choice,
 * which is the state it shipped in and a working degradation rather than a
 * blank one. It is also what a test rendering one component in isolation gets,
 * so the isolation does not have to be arranged.
 */
const SelectedHourContext = createContext<SelectedHour>({
  selected: null,
  choose: () => {},
  currentHour: null,
});

export function SelectedHourProvider({
  currentHour,
  children,
}: {
  /**
   * Which hour is now. Computed by the caller from the read that knows which
   * day is today, never from a clock read here -- see the header.
   *
   * Nullable because the caller cannot prove to a type checker what it knows
   * structurally: `weekOfDays` is built from the same instant, so exactly one
   * of the seven days is today, always. Passing a made-up hour to satisfy the
   * signature would select midnight on a page whose read had gone wrong; null
   * selects nothing, which is what this chart did before it had a default and
   * is visible rather than plausible.
   */
  currentHour: number | null;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <SelectedHourContext value={{ selected, choose: setSelected, currentHour }}>
      {children}
    </SelectedHourContext>
  );
}

export function useSelectedHour(): SelectedHour {
  return useContext(SelectedHourContext);
}

/**
 * `hourOfDay` lives in `dayFrame.ts` rather than here, and the build is what
 * said so.
 *
 * This module is `"use client"`, so everything it exports is a client
 * reference and `DayPanel` -- a server component -- cannot call it. That is not
 * a packaging detail: the hour's *definition* is day geometry, shared by a
 * server component that computes the default and a client one that draws it,
 * where everything in this file is about a choice a reader makes. `dayFrame.ts`
 * is already the module for "the geometry two plots of one day must agree
 * about", and the reason given there is this one exactly.
 */

/**
 * The chosen hour, or the one it is now, or nothing.
 *
 * One function rather than `selected ?? currentHour` written in two components,
 * for `resolveSelected`'s reason and not a weaker version of it: the plot and
 * the readout resolving the default differently is the exact failure this file
 * exists to prevent, it would show up only on a page nobody had clicked yet,
 * and it would show up as the two regions disagreeing about the hour -- which
 * is the defect this whole change is fixing.
 *
 * `null` only when there is no provider above and therefore no clock, which is
 * the degraded render rather than a state the page reaches.
 */
export function resolveHour(
  selected: number | null,
  currentHour: number | null,
): number | null {
  return selected ?? currentHour;
}
