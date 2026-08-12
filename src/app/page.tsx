import { Marquee } from "@/components/Marquee";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Marquee />
      </main>
    </>
  );
}
