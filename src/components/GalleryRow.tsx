"use client";

import { useRef, type ReactNode } from "react";

type GalleryRowProps = {
  /** Names the row for assistive tech, since it is a focus stop. */
  label: string;
  children: ReactNode;
};

const CONTROL_CLASSES =
  "rounded-pill flex size-11 cursor-pointer items-center justify-center border-2 border-lavender bg-cream text-base font-black text-dark transition-colors duration-fast hover:border-purple hover:text-purple";

/**
 * A horizontally scrollable row with prev/next controls.
 *
 * Native scrolling rather than a transform and an index: touch fling,
 * trackpad, arrow keys and screen-reader navigation all work without being
 * reimplemented, and there is no index to fall out of step with reality when
 * a resize changes how many items fit.
 *
 * The row is a focus stop (`tabindex="0"`) so arrow keys scroll it — a
 * scrollable region with no way in is unreachable for anyone not using a
 * pointer, and the controls alone would not give it a name.
 */
export function GalleryRow({ label, children }: GalleryRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  // One item per press, measured from the row itself rather than assumed:
  // the items are one width below md and another above it.
  const scrollByOneItem = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    const item = row.firstElementChild;
    const step = item ? item.getBoundingClientRect().width : row.clientWidth;
    row.scrollBy({ left: step * direction });
  };

  return (
    <div>
      <div
        ref={rowRef}
        tabIndex={0}
        role="group"
        aria-label={label}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-gutter-sm md:px-gutter"
      >
        {children}
      </div>
      <div className="mt-6 flex gap-3 px-gutter-sm md:px-gutter">
        <button
          type="button"
          aria-label="Previous artwork"
          className={CONTROL_CLASSES}
          onClick={() => scrollByOneItem(-1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          aria-label="Next artwork"
          className={CONTROL_CLASSES}
          onClick={() => scrollByOneItem(1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
