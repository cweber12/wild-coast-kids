import type { Metadata } from "next";
import { PillLink } from "@/components/ui/PillLink";
import { Placeholder } from "@/components/ui/Placeholder";
import { SessionSchedule } from "@/components/SessionSchedule";
import { fetchSessions } from "@/lib/sessions";

export const metadata: Metadata = {
  title: "Tuesday Co-op",
  description:
    "A Tuesday outdoor co-op for K–8 homeschoolers exploring San Diego's wild coast — tidepools, hikes, nature journaling and science.",
};

/**
 * Rendered per request, not prerendered.
 *
 * Unlike `/conditions`, which sets a `revalidate` because its upstream is a
 * public NOAA endpoint, this page's upstream needs credentials — and the gate
 * runs `npm run build` in CI with none. A prerendered page would bake in the
 * reserved slot at build time and serve it until the first background
 * regeneration. Dynamic keeps the build credential-free and makes a row edited
 * in Supabase Studio live on the next request.
 *
 * The cost is a Supabase round trip per view, and the loss of fetch caching:
 * `force-dynamic` overrides every fetch to `no-store` in this version of Next,
 * which is why `lib/sessions.ts` names no revalidate of its own.
 */
export const dynamic = "force-dynamic";

export default async function Coop() {
  const schedule = await fetchSessions("coop");

  // The reader gets the reserved slot either way; only the log distinguishes a
  // co-op with nothing booked yet from a database that could not be reached.
  if (schedule.kind === "unavailable")
    console.error(
      `[sessions] coop schedule unavailable${schedule.drift ? " (drift)" : ""}: ${schedule.reason}`,
    );

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
        <div className="mb-12">
          <PillLink href="/#community" tone="ocean">
            Join the interest list →
          </PillLink>
        </div>
        {/* The schedule takes the slot it was always promised; the eyebrow above
            still carries the weekly rhythm, and this answers which Tuesdays.
            Photos stay a reserved image beside it. */}
        <div className="grid gap-4 md:grid-cols-2">
          <SessionSchedule
            result={schedule}
            program="coop"
            emoji="🌿"
            headline="Full co-op details coming soon."
            detail="The weekly rhythm, meeting spots, and fall sign-up details land here."
          />
          <Placeholder
            label="Co-op adventures photo gallery"
            className="rounded-box min-h-60"
          />
        </div>
      </section>
    </main>
  );
}
