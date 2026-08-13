import type { Metadata } from "next";
import Link from "next/link";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = {
  title: "Tuesday Co-op",
  description:
    "A Tuesday outdoor co-op for K–8 homeschoolers exploring San Diego's wild coast — tidepools, hikes, nature journaling and science.",
};

export default function Coop() {
  return (
    <main className="flex-1">
      <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
        <p className="mb-7 text-2xs font-extrabold tracking-widest text-ocean uppercase">
          Tuesdays · 10am – 1pm · Fall 2026
        </p>
        <h1 className="text-title leading-display mb-4 font-black italic">
          Tuesday <span className="text-ocean">co-op.</span>
        </h1>
        <p className="leading-relaxed mb-9 max-w-130 text-base text-fog">
          Exploring San Diego&apos;s wild coast through tidepools, hikes, nature
          journaling and hands-on science. Spots are limited for fall, and full
          co-op details are on their way.
        </p>
        <Link
          href="/#community"
          className="rounded-pill mb-12 inline-block bg-ocean px-7 py-[13px] text-sm font-black text-white transition-colors duration-fast"
        >
          Join the interest list →
        </Link>
        {/* Reserved slots for the content pass: the weekly rhythm and photos
            from past adventures. */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-box border-2 border-dashed border-lavender bg-white/60 px-8 py-12 text-center">
            <span aria-hidden="true" className="mb-3.5 block text-5xl">
              🌿
            </span>
            <p className="leading-normal text-sm text-fog">
              Full co-op details coming soon.
              <br />
              <br />
              The weekly rhythm, meeting spots, and fall sign-up details land
              here.
            </p>
          </div>
          <Placeholder
            label="Co-op adventures photo gallery"
            className="rounded-box min-h-60"
          />
        </div>
      </section>
    </main>
  );
}
