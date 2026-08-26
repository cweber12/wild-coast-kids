import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConditionsSection } from "@/components/conditions/ConditionsSection";
import { beachBySlug } from "@/lib/beaches";

/**
 * Fifteen minutes, for the calendar rather than the tide. See
 * `../page.tsx`, which carries the reasoning; the two must agree, because the
 * same section is rendered by both and a reader should not get a fresher answer
 * depending on which URL they arrived at.
 */
export const revalidate = 900;

/**
 * Nothing prerendered at build, and every beach reachable.
 *
 * A NOAA request per beach on every build would ask the publisher for a great
 * deal that nobody has looked at. Returning none means a beach is fetched the
 * first time somebody actually chooses it and is served from the cache after
 * that, so upstream load follows real readers.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const beach = beachBySlug(slug);
  if (!beach) return { title: "Conditions" };

  return {
    title: `${beach.name} conditions`,
    description: `Today's lowest tide at ${beach.name}, from NOAA Tides & Currents — for families planning tidepool visits and beach days in San Diego.`,
  };
}

export default async function BeachConditions({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // A slug outside the inventory is a 404 rather than a page apologising about a
  // beach that does not exist. The chooser cannot produce one; a stale link can.
  if (!beachBySlug(slug)) notFound();

  return (
    <main className="flex-1">
      <ConditionsSection slug={slug} />
    </main>
  );
}
