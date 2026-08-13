import { Hero } from "./Hero";
import { Marquee } from "./Marquee";

/**
 * The opening poster: hero fills the window and the marquee sits at its
 * bottom edge. min-h (not a hard height) by decision — on short screens the
 * block grows instead of clipping the hero stack.
 *
 * The nav sits in the document flow above this, so the poster is the window
 * less the nav. That subtraction is the only place outside globals.css that
 * knows the nav has a height at all — down from six modules that each
 * reserved space for it while it was fixed.
 */
export function HeroViewport() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--spacing-nav-sm))] flex-col md:min-h-[calc(100dvh-var(--spacing-nav))]">
      <Hero />
      <Marquee />
    </div>
  );
}
