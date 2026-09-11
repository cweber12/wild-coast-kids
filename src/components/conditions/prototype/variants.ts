/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * The variant table, in a module with no `"use client"` on it.
 *
 * It lived in `PrototypeSwitcher.tsx` until that turned out to be a real
 * boundary violation: a server component cannot *call* a function exported
 * from a client module, only render it. The page's own tests did not catch it
 * — vitest renders both sides in one process and enforces no boundary — and
 * the page threw at request time with everything green.
 */

export const VARIANTS = [
  { key: "now", name: "Current page" },
  { key: "a", name: "Answer rail" },
  { key: "b", name: "Week-first spine" },
  { key: "c", name: "One grid, quiet prose" },
  { key: "ac", name: "Answer rail + quiet prose" },
] as const;

export type VariantKey = (typeof VARIANTS)[number]["key"];

export function isVariantKey(value: string | undefined): value is VariantKey {
  return VARIANTS.some((variant) => variant.key === value);
}
