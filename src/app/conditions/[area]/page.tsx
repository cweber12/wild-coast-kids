import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ConditionsSection } from "@/components/conditions/ConditionsSection";
import { areaBySlug, canonicalConditionsPath, soleBeachOf } from "@/lib/areas";
import { beachBySlug } from "@/lib/beaches";

/**
 * Fifteen minutes, for the calendar rather than the tide. See `../page.tsx`,
 * which carries the reasoning; all three routes must agree, because they render
 * one section and which URL a reader arrived at should not decide how fresh
 * their answer is.
 */
export const revalidate = 900;

/**
 * Nothing prerendered at build, and every area reachable. `[beach]/page.tsx`
 * says the same for the same reason: a request per place on every build would
 * ask five publishers for a great deal nobody has looked at.
 */
export function generateStaticParams() {
  return [];
}

/**
 * The one segment, resolved twice.
 *
 * `/conditions/<area>` and `/conditions/<beach>` cannot both be dynamic
 * segments at this level, and the old beach URLs have to keep working. So this
 * route asks the area table first and the inventory second, and a slug that is
 * only a beach is redirected into the area holding it — permanently, because
 * the nesting is the shape from here on.
 *
 * **Three slugs are both**, and the area wins: `pacific-beach`,
 * `mission-beach` and `ocean-beach` name an area and a beach alike. A reader
 * following an old bookmark to one of those lands on the area containing the
 * beach they saved rather than on the beach itself, which is a near-miss and
 * not a broken link. Their beach is one level down, at
 * `/conditions/pacific-beach/pacific-beach`. Five slugs would have collided
 * before Mission Bay and San Diego Bay were split into compass points
 * (ADR-0046).
 */
async function resolve(slug: string) {
  const area = areaBySlug(slug);
  if (area) return area;

  const beach = beachBySlug(slug);
  if (beach) {
    // Straight to wherever that beach is actually served, which for the sole
    // beach of its area is the area's own URL. Asking `canonicalConditionsPath`
    // rather than composing the nested form here is what stops this from
    // redirecting into a second redirect.
    //
    // Never null for a beach in the inventory -- the partition is total and the
    // `areas` gate row keeps it so. Checked rather than asserted, because a 404
    // is a better failure than a redirect to `/conditions/null/...`.
    const canonical = canonicalConditionsPath(beach.slug);
    if (canonical) permanentRedirect(canonical);
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<Metadata> {
  const { area: slug } = await params;
  const area = areaBySlug(slug);
  if (!area) return { title: "Conditions" };

  return {
    title: `${area.name} conditions`,
    description:
      `Tide, surf and wind for ${area.name} — from NOAA, CDIP and the National ` +
      `Weather Service, for families planning tidepool visits and beach days in San Diego.`,
  };
}

export default async function AreaConditions({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area: slug } = await params;
  const area = await resolve(slug);

  // A slug that is neither an area nor a beach is a 404 rather than a page
  // apologising about a place that does not exist. The chooser cannot produce
  // one; a stale link can.
  if (!area) notFound();

  /*
    An area of one holds no choice, so it shows its beach instead of offering it.
    ADR-0046 permits a single-member area on the grounds that "a lone member
    shares everything with itself and its area is the beach page" -- this is
    where that stops being an argument and becomes the page. Six of the eighteen
    are like this; for the rest `beachSlug` stays null and the reader picks.
  */
  return (
    <main className="flex-1">
      <ConditionsSection areaSlug={area.slug} beachSlug={soleBeachOf(area)} />
    </main>
  );
}
