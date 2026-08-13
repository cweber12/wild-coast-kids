import type { Metadata } from "next";
import Link from "next/link";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = {
  title: "Art Classes",
  description:
    "Watercolors, ink, collage and printmaking for K–8 kids, inspired by the San Diego coast. Group and private sessions, charter fund eligible.",
};

export default function Art() {
  return (
    <main className="flex-1 pt-[90px] md:pt-nav">
      <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
        <p className="mb-7 text-2xs font-extrabold tracking-widest text-purple uppercase">
          In-person · Group & Private · K–8
        </p>
        <h1 className="text-title leading-display mb-4 font-black italic">
          Art <span className="text-purple">classes.</span>
        </h1>
        <p className="leading-relaxed mb-9 max-w-130 text-base text-fog">
          Watercolors, ink, collage, printmaking — inspired by the coast and
          whatever sparks curiosity. Every session is different, and full class
          details are on their way.
        </p>
        <Link
          href="/book"
          className="rounded-pill mb-12 inline-block bg-purple px-7 py-[13px] text-sm font-black text-white transition-colors duration-fast hover:bg-purple-deep"
        >
          Book a class →
        </Link>
        {/* Reserved slots for the content pass: real schedule, pricing and
            student photos. */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-box border-2 border-dashed border-lavender bg-white/60 px-8 py-12 text-center">
            <span aria-hidden="true" className="mb-3.5 block text-5xl">
              🎨
            </span>
            <p className="leading-normal text-sm text-fog">
              Schedule & pricing coming soon.
              <br />
              <br />
              Session times, group and private options, and charter-fund details
              land here.
            </p>
          </div>
          <Placeholder
            label="Student artwork gallery"
            className="rounded-box min-h-60"
          />
        </div>
      </section>
    </main>
  );
}
