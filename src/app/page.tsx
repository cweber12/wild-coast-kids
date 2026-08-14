import { Conditions } from "@/components/Conditions";
import { GallerySection } from "@/components/GallerySection";
import { HeroViewport } from "@/components/HeroViewport";
import { InterestListTeaser } from "@/components/InterestListTeaser";
import { ProgramCards } from "@/components/ProgramCards";
import { QuoteStats } from "@/components/QuoteStats";
import { SnapSection } from "@/components/SnapSection";

export default function Home() {
  return (
    <main className="flex-1">
      {/* natural: the poster brings its own height, and fills the screen at
          every width rather than only from md up. */}
      <SnapSection natural>
        <HeroViewport />
      </SnapSection>
      <SnapSection tone="mist">
        <GallerySection />
      </SnapSection>
      <SnapSection>
        <ProgramCards />
      </SnapSection>
      <SnapSection tone="ocean">
        <Conditions />
      </SnapSection>
      <SnapSection id="community">
        <InterestListTeaser />
      </SnapSection>
      {/* natural: the footer sits below this one, and the two share a screen. */}
      <SnapSection natural>
        <QuoteStats />
      </SnapSection>
    </main>
  );
}
