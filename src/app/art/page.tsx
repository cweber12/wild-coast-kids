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

/** Ties the approach list to its heading; the two cannot drift apart. */
const APPROACH_HEADING_ID = "art-approach-heading";

/**
 * What a parent is actually choosing between, in the program's own terms.
 *
 * Copy rather than data, and staying that way: these describe the standing
 * offer, not any one session, and `public.sessions` deliberately holds nothing
 * about a program. See `docs/plans/art-program-page-copy.md`.
 */
const APPROACH = [
  {
    title: "Led by the kids",
    detail:
      "What we make starts from what they are curious about that week, not from a lesson plan that ignores them.",
  },
  {
    title: "Art history every class",
    detail:
      "Real artists and real movements, told the way a kid will actually remember them.",
  },
  {
    title: "Skills, not copies",
    detail:
      "Nobody leaves with the same picture. Everyone leaves with the same technique.",
  },
  {
    title: "Foundations first",
    detail:
      "Technique and fundamentals, because creative freedom needs something to stand on.",
  },
  {
    title: "It goes home with them",
    detail:
      "Skills that work at the kitchen table on a Tuesday, not only at ours.",
  },
  {
    title: "Confidence, not just craft",
    detail:
      "Knowing how to begin is what makes a kid keep going after the class ends.",
  },
];

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
          whatever sparks curiosity. Every class teaches a real technique, and
          nobody goes home with the same picture.
        </p>
        <div className="mb-12">
          <PillLink href="/book" tone="purple">
            Book a class →
          </PillLink>
        </div>
        {/* The half of the page a parent decides on. It sits above the schedule
            because "what is this?" comes before "when is it?" — a parent who has
            not been sold yet has no use for a list of dates. */}
        <section aria-labelledby={APPROACH_HEADING_ID} className="mb-12">
          <h2
            id={APPROACH_HEADING_ID}
            className="text-2xs mb-3 font-extrabold tracking-widest text-purple uppercase"
          >
            What makes it different
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {APPROACH.map(({ title, detail }) => (
              <li
                key={title}
                className="rounded-tile border-[1.5px] border-lavender bg-white/60 p-5"
              >
                <h3 className="leading-display mb-1.5 text-base font-black italic">
                  {title}
                </h3>
                <p className="leading-relaxed text-sm text-fog">{detail}</p>
              </li>
            ))}
          </ul>
        </section>
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
