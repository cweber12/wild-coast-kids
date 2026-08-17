type GalleryPagerProps = {
  /** The `id` of the row these controls page, named for assistive tech. */
  controls: string;
  /** From `useGalleryPaging`, which owns the row this pages. */
  page: (direction: 1 | -1) => void;
};

const CONTROL_CLASSES =
  "rounded-pill shadow-card flex size-11 cursor-pointer items-center justify-center border-2 border-lavender bg-cream text-base font-black text-dark transition-colors duration-fast hover:border-purple hover:text-purple";

/**
 * The gallery row's prev/next pair.
 *
 * In normal flow rather than overlaid on the row's edges. A 44px control
 * (ADR-0004) does not fit a 24px gutter below `md` at any offset, and a
 * scroll container's padding is empty space only at the scroll extremes — so
 * an overlaid control covers artwork at some scroll position whatever the
 * padding is. See `docs/adr/0008-gallery-controls-outside-the-artwork.md`.
 *
 * Sitting apart from the row costs the pair the relationship the old position
 * implied, so `aria-controls` states it instead.
 */
export function GalleryPager({ controls, page }: GalleryPagerProps) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        aria-label="Previous artwork"
        aria-controls={controls}
        className={CONTROL_CLASSES}
        onClick={() => page(-1)}
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        type="button"
        aria-label="Next artwork"
        aria-controls={controls}
        className={CONTROL_CLASSES}
        onClick={() => page(1)}
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
