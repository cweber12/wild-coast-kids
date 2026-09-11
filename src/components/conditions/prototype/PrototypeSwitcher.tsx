"use client";

/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * The floating bar that flips between layout variants. Deliberately ugly and
 * high-contrast so it reads as scaffolding rather than as part of any design
 * being judged.
 */

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VARIANTS, type VariantKey } from "./variants";

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const index = VARIANTS.findIndex((variant) => variant.key === current);

  useEffect(() => {
    const go = (step: number) => {
      const next = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
      const query = new URLSearchParams(params.toString());
      query.set("variant", next.key);
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    };

    const onKey = (event: KeyboardEvent) => {
      // Never steal the arrow keys from something the reader is typing in.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, params, pathname, router]);

  const step = (delta: number) => {
    const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
    const query = new URLSearchParams(params.toString());
    query.set("variant", next.key);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-pill bg-dark px-2 py-2 text-cream shadow-lg">
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Previous layout variant"
        className="rounded-pill px-3 py-1 text-base hover:bg-purple"
      >
        ←
      </button>
      <span className="px-2 text-sm whitespace-nowrap tabular-nums">
        <strong className="uppercase">{current}</strong> —{" "}
        {VARIANTS[index].name}
        <span className="ml-2 opacity-60">
          {index + 1}/{VARIANTS.length}
        </span>
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Next layout variant"
        className="rounded-pill px-3 py-1 text-base hover:bg-purple"
      >
        →
      </button>
    </div>
  );
}
