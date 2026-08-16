import type { ReactNode } from "react";

type SnapSectionProps = {
  children: ReactNode;
  /** Anchor target, when something links to this section. */
  id?: string;
  /** How tall the stop is. */
  height?: "screen" | "screen-less-footer" | "content";
  /** The surface this stop is painted on. */
  tone?: "cream" | "mist" | "ocean";
};

const CENTRED = "stops:flex stops:flex-col stops:justify-center-safe";

const HEIGHTS = {
  screen: `stops:min-h-[calc(100dvh-var(--spacing-nav))] ${CENTRED}`,
  /* The footer sits below this stop and shares its screen, so the stop is
     the window less the nav less the footer. Both come from tokens the nav
     and footer set their own heights from, so nothing measures anything. */
  "screen-less-footer": `stops:min-h-[calc(100dvh-var(--spacing-nav)-var(--spacing-footer))] ${CENTRED}`,
  /* The hero brings its own height, and fills the screen at every width
     rather than only from md up. */
  content: "",
};

/* The stop owns its surface. Painting the child instead leaves the colour
   the height of the content while the stop stays a screen tall, which is
   how the ocean band ended up with a cream stripe above it. */
const TONES = {
  cream: "",
  mist: "bg-mist",
  ocean: "bg-ocean",
};

/**
 * One stop on the landing page: a screen's worth of content the viewport
 * comes to rest on.
 *
 * The height is the window less the nav — the nav sits in the document flow
 * (ADR-0003), so a full `100dvh` would push each section's tail below the
 * fold. Holding that subtraction here rather than at six call sites is the
 * point of the module.
 *
 * Everything is behind the `stops` variant: wide enough *and* tall enough for
 * a stop. Two of the landing page's sections are taller than a phone viewport,
 * and three are taller than a 639px desktop one, so outside that window there
 * is no snapping and no forced height — the page scrolls normally, and the
 * sections put their own vertical padding back.
 *
 * `justify-center-safe`, not `justify-center`: plain centring pushes an
 * over-tall child out of *both* ends of the box, and the top end of a snap
 * stop cannot be scrolled to. Safe centring falls back to start-alignment
 * the moment the content stops fitting, so the top of a section is always
 * reachable.
 *
 * Children do not add their own vertical padding under `stops` — this box
 * supplies the space. Padding on both would be counted twice, which is what
 * pushed sections past the height they had to fit in. They gate that on the
 * same variant, so the padding comes back wherever this height does not apply.
 */
export function SnapSection({
  children,
  id,
  height = "screen",
  tone = "cream",
}: SnapSectionProps) {
  return (
    <section
      id={id}
      className={`stops:snap-start ${TONES[tone]} ${HEIGHTS[height]}`}
    >
      {children}
    </section>
  );
}
