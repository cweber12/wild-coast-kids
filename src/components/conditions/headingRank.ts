/**
 * A region heading, in the site's display register. See ADR-0014.
 *
 * The site writes headings two ways. The **display register** is
 * `font-black italic` at a size token with `leading-display` -- the `<h1>`,
 * `ProgramCards`' card titles, `QuoteStats`' pull quote. The **label register**
 * is `text-2xs font-extrabold tracking-widest uppercase` in an accent colour --
 * card headings, day headings, stat labels, provenance lines, eyebrows. A
 * region heading had been written both ways depending on which page reached
 * for it first, which left `/conditions` rendering a region, a card inside it
 * and a day inside that at the same 10px.
 *
 * `--text-quote` rather than `--text-card`, the other unused mid token: card
 * clamps to 30px at 375 against the `<h1>`'s 32px, where a region heading would
 * all but equal the page title. Quote is 20px there and 34px at 1536, clear at
 * both ends of the clamp -- and a rank that holds only on a desktop is not a
 * rank.
 *
 * The colour is inherited rather than set, as the `<h1>` inherits it: no new
 * text-on-surface pair, so nothing here is owed a contrast measurement the
 * page has not already taken.
 *
 * Named once because a rank asserted in two places is one of them waiting to
 * drift, which is the argument `touchTarget.ts` makes about a number. It does
 * not prove the rendered rank -- jsdom applies no stylesheets (ADR-0001) -- so
 * tests assert that a region heading refers to this and a card heading does
 * not, and a human confirms the rank is visible.
 */
export const REGION_HEADING =
  "text-quote leading-display mb-4 font-black italic";
