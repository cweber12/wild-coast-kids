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
      <SnapSection height="content">
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
      <SnapSection height="screen-less-footer">
        <QuoteStats />
      </SnapSection>
    </main>
  );
}
