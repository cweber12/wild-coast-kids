import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Book Now",
  description:
    "Book an art class with Wild Coast Kids. Online booking is on its way — join the interest list to grab a spot first.",
};

export default function Book() {
  return (
    <main className="flex-1 pt-[90px] md:pt-nav">
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
        {/* The reserved slot for the scheduler, once a provider is chosen. */}
        <div className="rounded-box border-2 border-dashed border-lavender bg-white/60 px-8 py-12 text-center">
          <span aria-hidden="true" className="mb-3.5 block text-5xl">
            🗓️
          </span>
          <p className="leading-normal text-sm text-fog">
            Online booking coming soon.
            <br />
            <br />
            The scheduler embeds here once a booking provider is chosen.
          </p>
        </div>
      </section>
    </main>
  );
}
