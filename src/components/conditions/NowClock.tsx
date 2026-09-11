/**
 * What time it is, beside what time the instruments read.
 *
 * **It cannot come from the server, and that is the whole reason this is a
 * client component.** The three conditions routes set `revalidate = 900`, so a
 * clock rendered on the server is the *render* time and can be a quarter of an
 * hour behind the reader. On a page whose discipline is refusing to print a
 * confident wrong number, a clock quietly fourteen minutes slow is the worst
 * figure available to add. The observation time beside it has the opposite
 * property — a fact about the past survives caching intact — which is why the
 * two halves come from different places. See ADR-0054.
 *
 * **Pacific, not the reader's locale.** Somebody in New York would otherwise
 * see 5:26 PM beside a reading taken at 2:26 PM at a San Diego beach, and the
 * gap between those two numbers is the only reason to show both.
 *
 * **`useSyncExternalStore` rather than state and an effect**, which is what
 * `hydrated.ts` next door already reaches for and what this repo's lint rules
 * leave available: a value allowed to differ between the server render and the
 * client one belongs in a store, not in `setState` inside `useEffect`. The
 * store here is the clock itself — `subscribe` opens the interval,
 * `getSnapshot` reads the minute, and the server snapshot is `null`, which is
 * both the "not hydrated yet" state and the no-JavaScript state.
 *
 * So a reader with a blocked script sees the observation time and no "now".
 * Nothing false is shown, which is the same trade `hydrated.ts` records for
 * every other control on this page.
 *
 * **A minute, not a second.** The band prints `2:26 PM`; a second-resolution
 * timer would re-render sixty times for every change a reader could see.
 */

"use client";

import { useSyncExternalStore } from "react";
import { localDateOf, localDayLabel, localTimeOf } from "@/lib/pacific-time";

const MINUTE_MS = 60_000;

/**
 * Module scope, so the identities are stable across renders. `hydrated.ts`
 * records why: a function declared inside the component would re-subscribe on
 * every render.
 */
function subscribe(onStoreChange: () => void): () => void {
  const id = setInterval(onStoreChange, MINUTE_MS);
  return () => clearInterval(id);
}

/**
 * The minute, not the instant. Returning `Date.now()` would hand React a new
 * value on every read and loop, because `useSyncExternalStore` compares
 * snapshots by identity.
 */
const getSnapshot = () => Math.floor(Date.now() / MINUTE_MS);

/** Null through the server render and the first client one; a minute after. */
const getServerSnapshot = () => null;

export function NowClock({
  /**
   * Whether something follows this on the line, so the separator can belong to
   * the half that can disappear.
   *
   * **This prop is the fix for a bug that shipped in the first draft**, which
   * the docstring above had already predicted and the code did anyway: with the
   * interpunct written on the bound's side, a server render — and every reader
   * with a blocked script — got a line opening ` · nothing older than 2:48 PM`.
   *
   * The clock is the only half of this line that can vanish between the server
   * and the client, so it is the half that must carry the join. `ProvenanceLine`
   * settles its own optional segments the same way: the separator is written by
   * the thing that may not be there.
   */
  trailing = false,
}: {
  trailing?: boolean;
}) {
  const minute = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Nothing at all rather than a placeholder, so nothing has to be cleaned up
  // around it when the clock is absent.
  if (minute === null) return null;

  const nowMs = minute * MINUTE_MS;
  return (
    <span>
      {localTimeOf(nowMs)}, {localDayLabel(localDateOf(nowMs))}
      {trailing ? " · " : ""}
    </span>
  );
}
