import type { ReactNode } from "react";

type SnapSectionProps = {
  children: ReactNode;
  /** Anchor target, when something links to this section. */
  id?: string;
  /**
   * Keeps the section's own height instead of filling the screen. The
   * closing section uses this so the footer below it shares the same screen.
   */
  natural?: boolean;
  /** The surface this stop is painted on. */
  tone?: "cream" | "mist" | "ocean";
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
 * Everything is `md` and up. Two of the landing page's sections are taller
 * than a phone viewport, so below `md` there is no snapping and no forced
 * height — a phone gets an ordinary scrolling page. `HeroViewport` keeps its
 * own height because the poster fills the screen at every width, which is a
 * different rule from this one rather than a copy of it.
 *
 * `justify-center-safe`, not `justify-center`: plain centring pushes an
 * over-tall child out of *both* ends of the box, and the top end of a snap
 * stop cannot be scrolled to. Safe centring falls back to start-alignment
 * the moment the content stops fitting, so the top of a section is always
 * reachable.
 *
 * Children do not add their own vertical padding at `md` — this box supplies
 * the space. Padding on both would be counted twice, which is what pushed
 * sections past the height they had to fit in.
 */
export function SnapSection({
  children,
  id,
  natural = false,
  tone = "cream",
}: SnapSectionProps) {
  return (
    <section
      id={id}
      className={`md:snap-start ${TONES[tone]} ${
        natural
          ? ""
          : "md:flex md:min-h-[calc(100dvh-var(--spacing-nav))] md:flex-col md:justify-center-safe"
      }`}
    >
      {children}
    </section>
  );
}
