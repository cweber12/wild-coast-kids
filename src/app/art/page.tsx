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

/** Tie each list to its heading; the two cannot drift apart. */
const APPROACH_HEADING_ID = "art-approach-heading";
const PRICING_HEADING_ID = "art-pricing-heading";

/**
 * What the weekly small-group class costs.
 *
 * Copy, not `price_cents`. A pack spans sessions, so a column holding one
 * integer per session cannot express one; and these three numbers are the same
 * for every weekly session, which makes them a fact about the program rather
 * than about any date. A session that is priced differently still says so on
 * its own row — see `docs/plans/art-program-page-copy.md`.
 *
 * Written as the strings a reader sees rather than as cents run through
 * `formatPrice`. There is no arithmetic here to get wrong, and a test that
 * imported the number it asserts could not fail when the number is wrong.
 *
 * The monthly themed class is deliberately absent until it has a price.
 */
const TIERS = [
  {
    name: "Drop-in",
    price: "$20",
    detail: "One class, whenever it suits. No commitment.",
  },
  {
    name: "6-pack",
    price: "$100",
    detail: "Six classes, one of them free.",
  },
  {
    name: "12-pack",
    price: "$200",
    detail: "Twelve classes, two of them free. The best value per class.",
  },
];

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
        {/* Pricing sits between the pitch and the dates: a parent who wants in
            asks the cost before they ask which Tuesday. */}
        <section aria-labelledby={PRICING_HEADING_ID} className="mb-12">
          <h2
            id={PRICING_HEADING_ID}
            className="text-2xs mb-3 font-extrabold tracking-widest text-purple uppercase"
          >
            Packages &amp; pricing
          </h2>
          <p className="leading-relaxed mb-4 max-w-130 text-base text-fog">
            A weekly small-group class, capped at ten kids, starting fall 2026.
            Come once, or save with a pack — packs are shared, so siblings can
            draw from the same one.
          </p>
          <ul className="grid gap-3 md:grid-cols-3">
            {TIERS.map(({ name, price, detail }) => (
              <li
                key={name}
                className="rounded-tile border-[1.5px] border-lavender bg-white/60 p-5"
              >
                <h3 className="text-2xs mb-2 font-extrabold tracking-widest text-purple uppercase">
                  {name}
                </h3>
                <p className="leading-display mb-1.5 text-stat font-black italic">
                  {price}
                </p>
                <p className="leading-relaxed text-sm text-fog">{detail}</p>
              </li>
            ))}
          </ul>
        </section>
        {/* The slot promises only what is still missing. Pricing moved onto the
            page above, so a slot still naming it would be promising what has
            already arrived — the drift ReservedSlot was extracted to stop.
            Charter-fund copy is genuinely unwritten and is a separate slice; it
            is not the schedule's to promise either way. */}
        <div className="grid gap-4 md:grid-cols-2">
          <SessionSchedule
            result={schedule}
            program="art"
            emoji="🎨"
            headline="Fall dates coming soon."
            detail="Class times and where we meet land here as the fall schedule is set."
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
