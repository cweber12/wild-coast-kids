import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions",
  description:
    "Real-time surf, tide, wind and visibility for San Diego's coast — built by a local, for families planning tidepool visits and hikes.",
};

export default function Conditions() {
  return (
    <main className="flex-1">
      <section className="px-gutter-sm py-section-sm md:px-gutter md:py-section">
        <p className="mb-7 text-2xs font-extrabold tracking-widest text-ocean uppercase">
          Surf · Tide · Wind · Visibility
        </p>
        <h1 className="text-title leading-display mb-4 font-black italic">
          Check <span className="text-ocean">conditions</span> first.
        </h1>
        <p className="leading-relaxed mb-9 max-w-130 text-base text-fog">
          Real-time surf, tide, wind and visibility for San Diego&apos;s coast —
          built by a local, for families planning tidepool visits and hikes.
          Know before you go.
        </p>
        {/* The reserved slot for the conditions tool, same contract as the
            landing section's: drop the URL and it embeds here. */}
        <div className="rounded-box border-2 border-dashed border-lavender bg-white/60 px-8 py-12 text-center">
          <span aria-hidden="true" className="mb-3.5 block text-5xl">
            🌊
          </span>
          <p className="leading-normal text-sm text-fog">
            Conditions tool coming soon.
            <br />
            <br />
            Drop the URL and it embeds here automatically.
          </p>
        </div>
      </section>
    </main>
  );
}
