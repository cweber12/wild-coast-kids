import type { Metadata } from "next";
import Link from "next/link";
import { ReservedSlot } from "@/components/ReservedSlot";

export const metadata: Metadata = {
  title: "Book Now",
  description:
    "Book an art class with Wild Coast Kids. Online booking is on its way — join the interest list to grab a spot first.",
};

export default function Book() {
  return (
    <main className="flex-1">
      <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
        <p className="mb-7 text-2xs font-extrabold tracking-widest text-purple uppercase">
          In-person · Group & Private · K–8
        </p>
        <h1 className="text-title leading-display mb-4 font-black italic">
          Book a <span className="text-purple">class.</span>
        </h1>
        <p className="leading-relaxed mb-9 max-w-130 text-base text-fog">
          Watercolors, ink, collage, printmaking — pick a session and come make
          something wild. Online booking is on its way; until it lands, the
          interest list is the fastest way to grab a spot.
        </p>
        <Link
          href="/#community"
          className="rounded-pill mb-12 inline-block bg-purple px-7 py-[13px] text-sm font-black text-white transition-colors duration-fast hover:bg-purple-deep"
        >
          Join the interest list →
        </Link>
        <ReservedSlot
          emoji="🗓️"
          headline="Online booking coming soon."
          detail="The scheduler embeds here once a booking provider is chosen."
        />
      </section>
    </main>
  );
}
