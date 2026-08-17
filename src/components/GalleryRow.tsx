import type { ReactNode, RefObject } from "react";

type GalleryRowProps = {
  /** What the pager's `aria-controls` names. */
  id: string;
  /** Names the row for assistive tech, since it is a focus stop. */
  label: string;
  /** From `useGalleryPaging`, whose `page` measures and scrolls this element. */
  rowRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/**
 * A horizontally paged row of artwork.
 *
 * The scroller alone: `useGalleryPaging` owns the mechanic that moves it and
 * `GalleryPager` owns the controls that drive it, because the controls sit
 * outside the artwork rather than on this row's edges (ADR-0008). The
 * scrollbar is hidden because those controls are the affordance.
 *
 * The row is a focus stop (`tabindex="0"`) so arrow keys scroll it — a
 * scrollable region with no way in is unreachable for anyone not using a
 * pointer, and the controls alone would not give it a name.
 *
 * The scroll padding matches the padding because a snapport is the scrollport
 * reduced by it. Left unset, `snap-start` would align the first tile with the
 * padding box rather than the inset, and mandatory snapping would rest the row
 * one whole gutter in — losing the inset the rest of the page keeps.
 */
export function GalleryRow({ id, label, rowRef, children }: GalleryRowProps) {
  return (
    <div
      id={id}
      ref={rowRef}
      tabIndex={0}
      role="group"
      aria-label={label}
      className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-gutter-sm scroll-pl-gutter-sm motion-safe:scroll-smooth md:px-gutter md:scroll-pl-gutter"
    >
      {children}
    </div>
  );
}
