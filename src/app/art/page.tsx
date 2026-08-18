import type { Metadata } from "next";
import { PillLink } from "@/components/PillLink";
import { Placeholder } from "@/components/Placeholder";
import { SessionSchedule } from "@/components/SessionSchedule";
import { fetchSessions } from "@/lib/sessions";

export const metadata: Metadata = {
  title: "Art Classes",
  description:
    "Watercolors, ink, collage and printmaking for K–8 kids, inspired by the San Diego coast. Group and private sessions, charter fund eligible.",
};

/** Per request, and for the reasons given in full on `/coop`. */
export const dynamic = "force-dynamic";

export default async function Art() {
  const schedule = await fetchSessions("art");

  if (schedule.kind === "unavailable")
    console.error(
      `[sessions] art schedule unavailable${schedule.drift ? " (drift)" : ""}: ${schedule.reason}`,
    );

  return (
    <main className="flex-1">
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
        <div className="mb-12">
          <PillLink href="/book" tone="purple">
            Book a class →
          </PillLink>
        </div>
        {/* The schedule fills the slot that promised session times and pricing.
            Charter-fund details are page copy still to be written, not data, so
            the slot's wording keeps naming them while it stands in. */}
        <div className="grid gap-4 md:grid-cols-2">
          <SessionSchedule
            result={schedule}
            program="art"
            emoji="🎨"
            headline="Schedule & pricing coming soon."
            detail="Session times, group and private options, and charter-fund details land here."
          />
          <Placeholder
            label="Student artwork gallery"
            className="rounded-box min-h-60"
          />
        </div>
      </section>
    </main>
  );
}
