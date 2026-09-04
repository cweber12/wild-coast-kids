import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ConditionsSection } from "@/components/conditions/ConditionsSection";
import { areaBySlug, areaOfBeach, soleBeachOf } from "@/lib/areas";
import { beachBySlug } from "@/lib/beaches";

/**
 * Fifteen minutes, for the calendar rather than the tide. See
 * `../../page.tsx`, which carries the reasoning; all three routes must agree.
 */
export const revalidate = 900;

/** Nothing prerendered at build. See `../page.tsx`. */
export function generateStaticParams() {
  return [];
}

/**
 * One beach, and the area it is actually in.
 *
 * The pair has to agree, because the URL asserts a containment that
 * `areas.json` owns. `/conditions/coronado/la-jolla-cove` is a claim about San
 * Diego that is false, and serving it would mean two URLs for one beach with
 * one of them lying about where it is. So a mismatched pair is redirected to
 * the right area rather than rendered or refused: the beach exists and the
 * reader asked for it, only the first segment is wrong.
 */
function resolvePair(areaSlug: string, beachSlug: string) {
  const beach = beachBySlug(beachSlug);
  if (!beach) return null;

  const holding = areaOfBeach(beach.slug);
  if (!holding) return null;

  if (holding.slug !== areaSlug) {
    if (!areaBySlug(areaSlug)) return null;
    permanentRedirect(`/conditions/${holding.slug}/${beach.slug}`);
  }

  /*
    An area of one serves its beach at the area's own URL, so this level does
    not exist for it -- one page, one address. Redirected rather than 404ed:
    the beach is real and the reader asked for it, and the nested form is the
    one this route itself linked to until the sole beach moved up.
  */
  if (soleBeachOf(holding) !== null) {
    permanentRedirect(`/conditions/${holding.slug}`);
  }

  return { area: holding, beach };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string; beach: string }>;
}): Promise<Metadata> {
  const { beach: beachSlug } = await params;
  const beach = beachBySlug(beachSlug);
  if (!beach) return { title: "Conditions" };

  return {
    title: `${beach.name} conditions`,
    description: `Today's lowest tide at ${beach.name}, from NOAA Tides & Currents — for families planning tidepool visits and beach days in San Diego.`,
  };
}

export default async function BeachConditions({
  params,
}: {
  params: Promise<{ area: string; beach: string }>;
}) {
  const { area: areaSlug, beach: beachSlug } = await params;
  const pair = resolvePair(areaSlug, beachSlug);

  if (!pair) notFound();

  return (
    <main className="flex-1">
      <ConditionsSection
        areaSlug={pair.area.slug}
        beachSlug={pair.beach.slug}
      />
    </main>
  );
}
