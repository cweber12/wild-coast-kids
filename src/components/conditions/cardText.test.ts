import { expect, test } from "vitest";
import { CARD_MUTED, CARD_PROSE, PAGE_MUTED } from "./cardText";

/**
 * The contrast figures in `cardText.ts` were measured once and then trusted,
 * and trusting them is how `ProvenanceLine` came to print `text-white/55` on
 * the page's own cream ground at 1.03:1 -- text the same colour as the paper.
 *
 * So the ratios are computed here from the token values rather than quoted.
 * These tests would have failed the day that line was rendered outside a card.
 *
 * **The hexes mirror `globals.css` and are named, not inlined.** They cannot be
 * imported: they are CSS custom properties, and the `stylesheet` gate is what
 * checks the built sheet. Mirroring three values is the cost of asserting the
 * property that actually matters, which is that a reader can see the text.
 */
const WHITE = "#ffffff";
/** `--color-dark`, the reading card's surface. */
const DARK = "#1a1a2e";
/** `--color-cream`, the page's own ground. */
const CREAM = "#faf8f5";
/** `--color-fog`, the page's subordinate text. */
const FOG = "#6b5f7d";

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (at) => parseInt(hex.slice(at, at + 2), 16) / 255,
  );
  const linear = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** Text at an alpha, painted over an opaque ground. */
function over(hex: string, alpha: number, ground: string): string {
  const mix = [1, 3, 5].map((at) => {
    const fg = parseInt(hex.slice(at, at + 2), 16);
    const bg = parseInt(ground.slice(at, at + 2), 16);
    return Math.round(fg * alpha + bg * (1 - alpha));
  });
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function contrast(text: string, ground: string): number {
  const a = luminance(text);
  const b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * What a Tailwind text class actually paints, so the assertion is about the
 * rendered colour rather than about the string in the className.
 */
function painted(role: string, ground: string): string {
  if (role === "text-fog") return FOG;
  const alpha = role.match(/^text-white\/(\d+)$/);
  if (alpha === null) throw new Error(`no colour known for ${role}`);
  return over(WHITE, Number(alpha[1]) / 100, ground);
}

/**
 * The page holds itself to 4.5:1 for text, which is WCAG AA at these sizes --
 * every one of these roles renders at 13px or 16px, so the 3:1 large-text
 * allowance never applies to any of them.
 */
const FLOOR = 4.5;

test("the card's prose clears the floor on the card", () => {
  expect(contrast(painted(CARD_PROSE, DARK), DARK)).toBeGreaterThanOrEqual(
    FLOOR,
  );
});

test("the card's muted role clears the floor on the card", () => {
  expect(contrast(painted(CARD_MUTED, DARK), DARK)).toBeGreaterThanOrEqual(
    FLOOR,
  );
});

/**
 * The regression. `PAGE_MUTED` exists because `CARD_MUTED` was printed on the
 * page ground by two components, and white at 55% over cream is cream: measured
 * on the built page at 1.03:1, against the 5.96:1 the same class gives on the
 * card it was chosen for.
 */
test("the page's muted role clears the floor on the page", () => {
  expect(contrast(painted(PAGE_MUTED, CREAM), CREAM)).toBeGreaterThanOrEqual(
    FLOOR,
  );
});

/**
 * The bug itself, pinned so it cannot come back by someone reaching for the
 * nearer constant. This is not a style rule: it is the arithmetic that says the
 * card's colour is invisible off the card.
 */
test("the card's muted role is unreadable on the page, which is why two exist", () => {
  expect(contrast(painted(CARD_MUTED, CREAM), CREAM)).toBeLessThan(1.1);
});

/**
 * The day chart's tile, which is a third ground and not the page's own.
 *
 * `HourChart`'s shell is `bg-white/60` over the page, so the provenance line
 * beneath its plot is printed on cream lightened rather than on cream. It is
 * the *lighter* of the two, which makes `CARD_MUTED` worse here than the 1.03:1
 * it shipped at on cream and `PAGE_MUTED` slightly better -- but "slightly
 * better than a figure measured somewhere else" is the reasoning that produced
 * the invisible line in the first place, so this ground is computed rather than
 * argued from the one next to it.
 */
const CHART = over(WHITE, 0.6, CREAM);

test("the page's muted role clears the floor on the day chart's tile", () => {
  expect(contrast(painted(PAGE_MUTED, CHART), CHART)).toBeGreaterThanOrEqual(
    FLOOR,
  );
});

test("the card's muted role would be invisible on the day chart's tile too", () => {
  expect(contrast(painted(CARD_MUTED, CHART), CHART)).toBeLessThan(1.1);
});
