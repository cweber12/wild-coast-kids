/**
 * "Has this reached the client yet", which is the question every control on
 * this page has to answer before it draws itself.
 *
 * **Why the page needs it at all.** ADR-0027 requires that a control mounts
 * only once it can work: rendered on the server it would be a dead button for
 * a reader with a blocked script, which is the failure `BeachSelector`'s
 * `noscript` list exists to prevent. Where that component has something to fall
 * back *to* -- a list of links that do the same job in plain markup -- the
 * chart's per-hour detail and the week's day selection do not exist on the page
 * in any other form, so the honest fallback is no affordance at all and the
 * page renders exactly as it did before the control existed.
 *
 * **`useSyncExternalStore` rather than an effect that sets state.** This repo's
 * lint rules refuse `setState` inside an effect, correctly, and this is what
 * React offers instead for a value that is allowed to differ between the server
 * render and the client one. The store never changes, so `subscribe` returns a
 * no-op and the two snapshots are constants.
 *
 * **Its own module because it now has two callers**, `HourChart` and the week's
 * day selection, and the three functions have to live at module scope for their
 * identities to be stable across renders. Two copies of that would be two
 * chances for one of them to be declared inside a component and re-subscribe on
 * every render.
 */

"use client";

import { useSyncExternalStore } from "react";

const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** False through the server render and the first client one; true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(neverChanges, onClient, onServer);
}
