import type { Metadata } from "next";
import { ReservedSlot } from "@/components/ReservedSlot";

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
        {/* Same slot the landing section carries, on this page's surface. */}
        <ReservedSlot
          emoji="🌊"
          headline="Conditions tool coming soon."
          detail="Drop the URL and it embeds here automatically."
        />
      </section>
    </main>
  );
}
