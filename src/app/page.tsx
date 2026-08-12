import { HeroViewport } from "@/components/HeroViewport";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <HeroViewport />
      </main>
    </>
  );
}
