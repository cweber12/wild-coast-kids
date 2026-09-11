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
 *
 * **The first round (`a`, `b`, `c`, `ac`) was rejected whole and is gone.**
 * Four rejected arrangements in the switcher is four keystrokes between the
 * two things actually being compared. They are in the branch's history at
 * `c84dbc4` if a detail is wanted back.
 */

export const VARIANTS = [
  { key: "now", name: "Current page" },
  { key: "d", name: "One-row toolbar" },
  { key: "e", name: "Two-tier readout" },
  { key: "f", name: "Sticky condensed bar" },
] as const;

export type VariantKey = (typeof VARIANTS)[number]["key"];

export function isVariantKey(value: string | undefined): value is VariantKey {
  return VARIANTS.some((variant) => variant.key === value);
}
