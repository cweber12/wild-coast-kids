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
 */
export function SnapSection({
  children,
  id,
  natural = false,
}: SnapSectionProps) {
  return (
    <section
      id={id}
      className={`md:snap-start ${
        natural
          ? ""
          : "md:flex md:min-h-[calc(100dvh-var(--spacing-nav))] md:flex-col md:justify-center"
      }`}
    >
      {children}
    </section>
  );
}
