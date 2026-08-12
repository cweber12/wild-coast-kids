import { GallerySection } from "@/components/GallerySection";
import { HeroViewport } from "@/components/HeroViewport";
import { Nav } from "@/components/Nav";
import { ProgramCards } from "@/components/ProgramCards";
import { QuoteStats } from "@/components/QuoteStats";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <HeroViewport />
        <GallerySection />
        <ProgramCards />
        <QuoteStats />
      </main>
    </>
  );
}
