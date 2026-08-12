import { Hero } from "./Hero";
import { Marquee } from "./Marquee";

/**
 * The opening poster: hero fills the window and the marquee sits at its
 * bottom edge. min-h-dvh (not a hard h-dvh) by decision — on short screens
 * the block grows instead of clipping the hero stack.
 */
export function HeroViewport() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Hero />
      <Marquee />
    </div>
  );
}
