"use client";

import { useRef, type ReactNode } from "react";

type GalleryRowProps = {
  /** Names the row for assistive tech, since it is a focus stop. */
  label: string;
  children: ReactNode;
};

const CONTROL_CLASSES =
  "rounded-pill shadow-card absolute top-1/2 z-10 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center border-2 border-lavender bg-cream text-base font-black text-dark transition-colors duration-fast hover:border-purple hover:text-purple";

/**
 * A horizontally paged row of artwork, driven by controls at its edges.
 *
 * Native scrolling rather than a transform and an index: touch fling,
 * trackpad, arrow keys and screen-reader navigation all work without being
 * reimplemented, and there is no index to fall out of step with reality when
 * a resize changes how many items fit.
 *
 * A press moves one screenful, not one item, and `snap-x mandatory` pulls the
 * result back onto an item edge — so paging stays aligned without the button
 * having to know how many items are visible at the current width. The
 * scrollbar is hidden because the controls are the affordance.
 *
 * The row is a focus stop (`tabindex="0"`) so arrow keys scroll it — a
 * scrollable region with no way in is unreachable for anyone not using a
 * pointer, and the controls alone would not give it a name.
 */
export function GalleryRow({ label, children }: GalleryRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const page = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: row.clientWidth * direction });
  };

  return (
    <div className="relative">
      <div
        ref={rowRef}
        tabIndex={0}
        role="group"
        aria-label={label}
        className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-gutter-sm motion-safe:scroll-smooth md:px-gutter"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Previous artwork"
        className={`${CONTROL_CLASSES} left-3 md:left-6`}
        onClick={() => page(-1)}
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        type="button"
        aria-label="Next artwork"
        className={`${CONTROL_CLASSES} right-3 md:right-6`}
        onClick={() => page(1)}
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
