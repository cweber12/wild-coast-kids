import type { Metadata } from "next";
import { InterestListForm } from "@/components/InterestListForm";
import { Placeholder } from "@/components/Placeholder";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Families making, wondering and exploring together on San Diego's coast. Join the Wild Coast Kids community for class news and co-op updates.",
};

export default function Community() {
  return (
    <main className="flex-1 pt-[90px] md:pt-nav">
      <section className="px-gutter-sm pt-section-sm md:px-gutter md:pt-section">
        <p className="mb-7 text-2xs font-extrabold tracking-widest text-purple uppercase">
          Families · Updates · Coastal adventures
        </p>
        <h1 className="text-title leading-display mb-4 font-black italic">
          Join the <span className="text-purple">community.</span>
        </h1>
        <p className="leading-relaxed mb-9 max-w-130 text-base text-fog">
          Wild Coast Kids is families making, wondering and exploring together.
          Here&apos;s where community stories will live — and where you can jump
          in.
        </p>
        {/* Reserved slots for the content pass: stories, meetups and photos. */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-box border-2 border-dashed border-lavender bg-white/60 px-8 py-12 text-center">
            <span aria-hidden="true" className="mb-3.5 block text-5xl">
              🏄
            </span>
            <p className="leading-normal text-sm text-fog">
              Community stories coming soon.
              <br />
              <br />
              Photos, testimonials and upcoming meetups land here.
            </p>
          </div>
          <Placeholder
            label="Community photo gallery"
            className="rounded-box min-h-60"
          />
        </div>
      </section>
      {/* The form alone, not the landing teaser: this is the page that
          teaser points at. */}
      <section className="px-gutter-sm pb-section-sm md:px-gutter md:pb-section">
        <h2 className="text-title leading-display mb-4 font-black italic">
          Join the <span className="text-purple">interest list.</span>
        </h2>
        <p className="leading-relaxed mb-6 max-w-130 text-base text-fog">
          Drop your info and we&apos;ll reach out with new classes, co-op
          updates and coastal adventures.
        </p>
        <div className="max-w-130">
          <InterestListForm />
        </div>
      </section>
    </main>
  );
}
