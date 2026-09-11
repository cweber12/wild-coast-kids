/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * The one seam the prototype cuts into the real route: `/conditions?variant=`
 * picks a layout, and `now` renders the page exactly as it ships so every
 * variant is judged against the thing it would replace rather than memory.
 *
 * Reading a search param makes the route render dynamically, which is why the
 * real page's fifteen-minute revalidate stops applying while this is in the
 * tree. Upstream requests are unaffected — `lib/upstream.ts` caches those for
 * six hours on their own `next.revalidate`, and nothing here sets
 * `dynamic = "force-dynamic"`, which is the thing that would override them to
 * `no-store`.
 */

import { Suspense } from "react";
import { ConditionsSection } from "../ConditionsSection";
import { PrototypeSwitcher } from "./PrototypeSwitcher";
import { isVariantKey, type VariantKey } from "./variants";
import { VariantD } from "./VariantD";
import { VariantE } from "./VariantE";
import { VariantF } from "./VariantF";

export function ConditionsVariants({
  variant,
  areaSlug,
  beachSlug,
}: {
  variant: string | undefined;
  areaSlug: string;
  beachSlug: string | null;
}) {
  const current: VariantKey = isVariantKey(variant) ? variant : "now";

  return (
    <>
      {current === "now" && (
        <ConditionsSection areaSlug={areaSlug} beachSlug={beachSlug} />
      )}
      {current === "d" && (
        <VariantD areaSlug={areaSlug} beachSlug={beachSlug} />
      )}
      {current === "e" && (
        <VariantE areaSlug={areaSlug} beachSlug={beachSlug} />
      )}
      {current === "f" && (
        <VariantF areaSlug={areaSlug} beachSlug={beachSlug} />
      )}

      {/*
        Development only. It keeps the bar out of any build that reaches a
        reader, and it keeps `next/navigation`'s hooks out of the page's own
        tests, which mock that module for the chooser and export only
        `useRouter`. `useSearchParams` needs a Suspense boundary above it.
      */}
      {process.env.NODE_ENV === "development" && (
        <Suspense fallback={null}>
          <PrototypeSwitcher current={current} />
        </Suspense>
      )}
    </>
  );
}
