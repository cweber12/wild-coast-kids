"use client";

import { useRef } from "react";

/**
 * The gallery row's paging mechanic: a ref to the scroller, and a press that
 * moves it one screenful.
 *
 * Native scrolling rather than a transform and an index: touch fling,
 * trackpad, arrow keys and screen-reader navigation all work without being
 * reimplemented, and there is no index to fall out of step with reality when
 * a resize changes how many items fit.
 *
 * A press moves one screenful, not one item, and `snap-x mandatory` on the row
 * pulls the result back onto an item edge — so paging stays aligned without
 * the button having to know how many items are visible at the current width.
 *
 * It lives in its own module because the row and the controls no longer sit
 * together in the DOM (ADR-0008), so the two need something to share. That is
 * the same reason `StripTrack` is kept as a seam with one caller: the mechanic
 * is the intricate part and is worth one home, not because anything varies
 * across it.
 */
export function useGalleryPaging() {
  const rowRef = useRef<HTMLDivElement>(null);

  const page = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: row.clientWidth * direction });
  };

  return { rowRef, page };
}
