import { CommunityForm } from "@/components/CommunityForm";
import { Conditions } from "@/components/Conditions";
import { GallerySection } from "@/components/GallerySection";
import { HeroViewport } from "@/components/HeroViewport";
import { ProgramCards } from "@/components/ProgramCards";
import { QuoteStats } from "@/components/QuoteStats";

export default function Home() {
  return (
    <main className="flex-1">
      <HeroViewport />
      <GallerySection />
      <ProgramCards />
      <QuoteStats />
      <Conditions />
      <CommunityForm />
    </main>
  );
}
